/**
 * Integration tests for the authenticated per-session stream core
 * (live-ai-visibility step 2.3): event passthrough, interleaved-session
 * isolation, 400/403/429, keepalive, and listener/slot cleanup on disconnect.
 * Uses a fake bus + fake ownership so no network or SvelteKit server is needed.
 */
import assert from 'assert';
import { createAiStreamer } from '../../src/webui/src/lib/server/ai-stream';
import { parseSSE, type OpencodeEvent } from '../../src/webui/src/lib/server/opencode-events';

type EventCb = (e: OpencodeEvent) => void;

function makeFakeBus() {
  const subs = new Map<string, Set<EventCb>>();
  return {
    subscribe(id: string, cb: EventCb) {
      let s = subs.get(id);
      if (!s) subs.set(id, (s = new Set()));
      s.add(cb);
    },
    unsubscribe(id: string, cb: EventCb) {
      const s = subs.get(id);
      if (s) {
        s.delete(cb);
        if (s.size === 0) subs.delete(id);
      }
    },
    emit(id: string, evt: OpencodeEvent) {
      for (const cb of subs.get(id) ?? []) cb(evt);
    },
    listenerCount(id: string) {
      return subs.get(id)?.size ?? 0;
    },
  };
}

function ownership(map: Record<string, string>) {
  return (id: string) => (map[id] ? { owner: map[id] } : undefined);
}

const tick = () => new Promise((r) => setTimeout(r, 5));

/** Read up to `want` data-events from an SSE Response (or until timeout). */
async function drain(
  res: Response,
  want: number,
  timeoutMs = 1000,
): Promise<{ events: OpencodeEvent[]; raw: string; reader: ReadableStreamDefaultReader<Uint8Array> }> {
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = '';
  let raw = '';
  const events: OpencodeEvent[] = [];
  const deadline = Date.now() + timeoutMs;
  while (events.length < want && Date.now() < deadline) {
    const timeout = new Promise<{ __t: true }>((r) => setTimeout(() => r({ __t: true }), Math.max(1, deadline - Date.now())));
    const r = await Promise.race([reader.read(), timeout]);
    if ('__t' in r) break;
    if (r.done) break;
    const text = dec.decode(r.value, { stream: true });
    raw += text;
    buf += text;
    const parsed = parseSSE(buf);
    buf = parsed.remainder;
    events.push(...parsed.events);
  }
  return { events, raw, reader };
}

describe('ai-stream — access control', () => {
  it('400 when the session parameter is missing', () => {
    const s = createAiStreamer({ getSession: ownership({}), subscribe() {}, unsubscribe() {} });
    assert.strictEqual(s.open(null, 'alice').status, 400);
    assert.strictEqual(s.open('', 'alice').status, 400);
  });

  it('403 for an unknown session or a non-owner', () => {
    const bus = makeFakeBus();
    const s = createAiStreamer({ getSession: ownership({ ses_a: 'alice' }), subscribe: bus.subscribe, unsubscribe: bus.unsubscribe });
    assert.strictEqual(s.open('ses_unknown', 'alice').status, 403, 'unknown session');
    assert.strictEqual(s.open('ses_a', 'bob').status, 403, 'not the owner');
    assert.strictEqual(bus.listenerCount('ses_a'), 0, 'no subscription created on a rejected open');
  });

  it('200 for the rightful owner', () => {
    const bus = makeFakeBus();
    const s = createAiStreamer({ getSession: ownership({ ses_a: 'alice' }), subscribe: bus.subscribe, unsubscribe: bus.unsubscribe });
    const res = s.open('ses_a', 'alice');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers.get('Content-Type'), 'text/event-stream');
    assert.strictEqual(res.headers.get('X-Accel-Buffering'), 'no');
    res.body!.cancel();
  });
});

describe('ai-stream — per-user concurrency cap', () => {
  it('allows up to maxPerUser then returns 429, releasing on disconnect', async () => {
    const bus = makeFakeBus();
    const s = createAiStreamer({
      getSession: ownership({ s1: 'alice', s2: 'alice', s3: 'alice' }),
      subscribe: bus.subscribe,
      unsubscribe: bus.unsubscribe,
      maxPerUser: 2,
    });
    const r1 = s.open('s1', 'alice');
    const r2 = s.open('s2', 'alice');
    assert.strictEqual(r1.status, 200);
    assert.strictEqual(r2.status, 200);
    assert.strictEqual(s.activeCount('alice'), 2);

    const r3 = s.open('s3', 'alice');
    assert.strictEqual(r3.status, 429, '3rd concurrent stream rejected');

    // A different user is unaffected by alice's cap.
    const other = createAiStreamer({ getSession: ownership({ s1: 'bob' }), subscribe: bus.subscribe, unsubscribe: bus.unsubscribe, maxPerUser: 2 });
    assert.strictEqual(other.open('s1', 'bob').status, 200);

    // Disconnect one of alice's → slot frees → a new open succeeds.
    await r1.body!.cancel();
    await tick();
    assert.strictEqual(s.activeCount('alice'), 1, 'slot released on disconnect');
    assert.strictEqual(s.open('s3', 'alice').status, 200, 'reopen after release');

    await r2.body!.cancel();
  });
});

describe('ai-stream — event relay', () => {
  it('passes a session\'s events through to the client in order', async () => {
    const bus = makeFakeBus();
    const s = createAiStreamer({ getSession: ownership({ ses_a: 'alice' }), subscribe: bus.subscribe, unsubscribe: bus.unsubscribe, keepaliveMs: 10_000 });
    const res = s.open('ses_a', 'alice');
    await tick();
    bus.emit('ses_a', { type: 'message.part.delta', properties: { sessionID: 'ses_a', delta: 'Hel' } });
    bus.emit('ses_a', { type: 'message.part.delta', properties: { sessionID: 'ses_a', delta: 'lo' } });
    bus.emit('ses_a', { type: 'session.idle', properties: { sessionID: 'ses_a' } });
    const { events, reader } = await drain(res, 3);
    assert.deepStrictEqual(events.map((e) => e.type), ['message.part.delta', 'message.part.delta', 'session.idle']);
    assert.deepStrictEqual(
      events.filter((e) => e.type === 'message.part.delta').map((e) => e.properties?.delta),
      ['Hel', 'lo'],
    );
    await reader.cancel();
  });

  it('two interleaved sessions never cross-bleed (each gets only its own, in order)', async () => {
    const bus = makeFakeBus();
    const s = createAiStreamer({
      getSession: ownership({ ses_a: 'alice', ses_b: 'bob' }),
      subscribe: bus.subscribe,
      unsubscribe: bus.unsubscribe,
      keepaliveMs: 10_000,
    });
    const resA = s.open('ses_a', 'alice');
    const resB = s.open('ses_b', 'bob');
    await tick();

    // Interleave emissions across the two sessions.
    bus.emit('ses_a', { type: 'd', properties: { sessionID: 'ses_a', delta: 'a1' } });
    bus.emit('ses_b', { type: 'd', properties: { sessionID: 'ses_b', delta: 'b1' } });
    bus.emit('ses_a', { type: 'd', properties: { sessionID: 'ses_a', delta: 'a2' } });
    bus.emit('ses_b', { type: 'd', properties: { sessionID: 'ses_b', delta: 'b2' } });
    bus.emit('ses_a', { type: 'd', properties: { sessionID: 'ses_a', delta: 'a3' } });

    const a = await drain(resA, 3);
    const b = await drain(resB, 2);
    assert.deepStrictEqual(a.events.map((e) => e.properties?.delta), ['a1', 'a2', 'a3'], 'session A sees only A, in order');
    assert.deepStrictEqual(b.events.map((e) => e.properties?.delta), ['b1', 'b2'], 'session B sees only B, in order');
    await a.reader.cancel();
    await b.reader.cancel();
  });

  it('emits a keepalive comment within the interval', async () => {
    const bus = makeFakeBus();
    const s = createAiStreamer({ getSession: ownership({ ses_a: 'alice' }), subscribe: bus.subscribe, unsubscribe: bus.unsubscribe, keepaliveMs: 25 });
    const res = s.open('ses_a', 'alice');
    const { raw, reader } = await drain(res, 999, 300); // no data events; collect raw until timeout
    assert.ok(raw.includes(': keepalive'), 'keepalive comment observed');
    await reader.cancel();
  });
});

describe('ai-stream — cleanup on disconnect', () => {
  it('unsubscribes from the bus and frees the slot when the client disconnects', async () => {
    const bus = makeFakeBus();
    const s = createAiStreamer({ getSession: ownership({ ses_a: 'alice' }), subscribe: bus.subscribe, unsubscribe: bus.unsubscribe, keepaliveMs: 10_000 });
    const res = s.open('ses_a', 'alice');
    await tick();
    assert.strictEqual(bus.listenerCount('ses_a'), 1, 'subscribed while open');
    assert.strictEqual(s.activeCount('alice'), 1);

    await res.body!.cancel(); // client disconnect
    await tick();
    assert.strictEqual(bus.listenerCount('ses_a'), 0, 'no leaked listener after disconnect');
    assert.strictEqual(s.activeCount('alice'), 0, 'slot freed after disconnect');
  });
});
