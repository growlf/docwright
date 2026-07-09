/**
 * Unit tests for the OpenCode event-bus consumer (live-ai-visibility step 2.1):
 * SSE parsing (fixture-driven + malformed tolerance), backoff jitter bounds,
 * and subscribe/unsubscribe bookkeeping. Network behavior (reconnect, bus-gap,
 * auth header) is covered by opencode-events-integration.test.ts.
 */
import assert from 'assert';
import fs from 'node:fs';
import path from 'node:path';
import {
  parseSSE,
  computeBackoffMs,
  createOpencodeEventBus,
  type OpencodeEvent,
} from '../../src/webui/src/lib/server/opencode-events';

const FIX = path.resolve(__dirname, '../fixtures/opencode-events');

/** Wrap recorded JSONL events back into raw SSE frames the parser consumes. */
function fixtureAsSSE(name: string): { raw: string; events: OpencodeEvent[] } {
  const lines = fs.readFileSync(path.join(FIX, name), 'utf8').split('\n').filter(Boolean);
  const events = lines.map((l) => JSON.parse(l));
  const raw = lines.map((l) => `data: ${l}\n\n`).join('');
  return { raw, events };
}

describe('opencode-events — parseSSE (fixture-driven)', () => {
  for (const name of ['plain-text.jsonl', 'reasoning.jsonl', 'tool-use.jsonl']) {
    it(`parses every event from ${name} with no loss`, () => {
      const { raw, events } = fixtureAsSSE(name);
      const { events: parsed, remainder } = parseSSE(raw);
      assert.strictEqual(remainder, '', 'buffer ended on a frame boundary');
      assert.strictEqual(parsed.length, events.length);
      // spot-check types round-trip
      assert.deepStrictEqual(
        parsed.map((e) => e.type),
        events.map((e) => e.type),
      );
    });
  }

  it('surfaces the key event vocabulary (delta / updated / step / status)', () => {
    const { raw } = fixtureAsSSE('tool-use.jsonl');
    const { events } = parseSSE(raw);
    const types = new Set(events.map((e) => e.type));
    assert.ok(types.has('message.part.delta'), 'delta present');
    assert.ok(types.has('message.part.updated'), 'updated present');
    assert.ok(types.has('session.status'), 'status present');
    // step boundaries arrive as part.updated snapshots with part.type step-*
    const partTypes = new Set(
      events
        .filter((e) => e.type === 'message.part.updated')
        .map((e) => (e.properties?.part as { type?: string })?.type),
    );
    assert.ok(partTypes.has('step-start') && partTypes.has('step-finish'), 'step boundaries present');
    assert.ok(partTypes.has('tool'), 'tool part present');
  });
});

describe('opencode-events — parseSSE (robustness)', () => {
  it('tolerates malformed data lines without throwing or dropping good ones', () => {
    const raw =
      'data: {"type":"a","properties":{"sessionID":"s1"}}\n\n' +
      'data: {not json\n\n' + // malformed
      ': keepalive\n\n' + // comment frame
      'event: ping\ndata: \n\n' + // non-data field + empty data
      'data: 42\n\n' + // valid JSON but not an event object
      'data: {"type":"b"}\n\n';
    const { events, remainder } = parseSSE(raw);
    assert.deepStrictEqual(events.map((e) => e.type), ['a', 'b']);
    assert.strictEqual(remainder, '');
  });

  it('holds a partial trailing frame in the remainder until completed', () => {
    const first = parseSSE('data: {"type":"a"}\n\ndata: {"type":"b"');
    assert.deepStrictEqual(first.events.map((e) => e.type), ['a']);
    assert.ok(first.remainder.includes('"type":"b"'), 'partial frame retained');
    // feeding the remainder + the rest completes the second event
    const second = parseSSE(first.remainder + '}\n\n');
    assert.deepStrictEqual(second.events.map((e) => e.type), ['b']);
    assert.strictEqual(second.remainder, '');
  });

  it('normalizes CRLF frame separators', () => {
    const { events } = parseSSE('data: {"type":"a"}\r\n\r\ndata: {"type":"b"}\r\n\r\n');
    assert.deepStrictEqual(events.map((e) => e.type), ['a', 'b']);
  });
});

describe('opencode-events — computeBackoffMs (jitter bounds)', () => {
  it('stays within ±50% of the exponential base and honors the cap', () => {
    const cases = [
      { attempt: 1, base: 1000 },
      { attempt: 2, base: 2000 },
      { attempt: 3, base: 4000 },
      { attempt: 6, base: 30000 }, // 32000 capped to 30000
      { attempt: 10, base: 30000 }, // well past cap
    ];
    for (const { attempt, base } of cases) {
      for (let i = 0; i < 2000; i++) {
        const ms = computeBackoffMs(attempt);
        assert.ok(ms >= base * 0.5, `attempt ${attempt}: ${ms} >= ${base * 0.5}`);
        assert.ok(ms < base * 1.5, `attempt ${attempt}: ${ms} < ${base * 1.5}`);
      }
    }
  });

  it('respects a custom base and cap', () => {
    for (let i = 0; i < 500; i++) {
      const ms = computeBackoffMs(1, 100, 20);
      assert.ok(ms >= 10 && ms < 30, `custom base: ${ms}`);
    }
  });
});

describe('opencode-events — subscribe/unsubscribe bookkeeping', () => {
  // Point at a dead port so no real connection succeeds; we only assert
  // registration bookkeeping here (delivery is the integration test's job).
  const bus = createOpencodeEventBus({ baseUrl: 'http://127.0.0.1:1', baseBackoffMs: 5, maxBackoffMs: 10, log: () => {} });
  after(() => bus.stop());

  it('tracks distinct sessions and drops empty sets on unsubscribe', () => {
    const a = () => {};
    const b = () => {};
    bus.subscribe('s1', a);
    bus.subscribe('s1', b);
    bus.subscribe('s2', a);
    assert.strictEqual(bus.subscriberCount(), 2);
    bus.unsubscribe('s1', a);
    assert.strictEqual(bus.subscriberCount(), 2, 's1 still has b');
    bus.unsubscribe('s1', b);
    assert.strictEqual(bus.subscriberCount(), 1, 's1 dropped when empty');
    bus.unsubscribe('s2', a);
    assert.strictEqual(bus.subscriberCount(), 0);
  });

  it('unsubscribing an unknown session/callback is a no-op', () => {
    assert.doesNotThrow(() => bus.unsubscribe('nope', () => {}));
  });
});
