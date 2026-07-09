/**
 * Integration test for the OpenCode event-bus consumer (live-ai-visibility 2.1),
 * failure-recovery path: a fake SSE server is killed and restarted mid-stream.
 *
 * Asserts: the consumer reconnects on the same port, the subscriber survives and
 * receives post-restart events, exactly one synthetic bus-gap is delivered, and
 * the fake server saw the Basic Authorization header on BOTH connections.
 */
import assert from 'assert';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  createOpencodeEventBus,
  BUS_GAP,
  type OpencodeEvent,
  type OpencodeEventBus,
} from '../../src/webui/src/lib/server/opencode-events';

const PASSWORD = 'itest-pw';
const EXPECTED_AUTH = 'Basic ' + Buffer.from(`opencode:${PASSWORD}`).toString('base64');

function sse(event: OpencodeEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

async function waitFor(cond: () => boolean, timeoutMs = 3000, label = 'condition'): Promise<void> {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > timeoutMs) throw new Error(`timeout waiting for ${label}`);
    await new Promise((r) => setTimeout(r, 15));
  }
}

/** A fake OpenCode /event server that can be killed and restarted on a fixed port. */
class FakeOpencode {
  server: http.Server | null = null;
  port = 0;
  authSeen: (string | undefined)[] = [];
  private activeRes: http.ServerResponse | null = null;
  private sockets = new Set<import('node:net').Socket>();

  async start(port = 0): Promise<number> {
    this.server = http.createServer((req, res) => {
      if (!req.url?.startsWith('/event')) {
        res.writeHead(404).end();
        return;
      }
      this.authSeen.push(req.headers['authorization']);
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });
      res.write(': hello\n\n');
      this.activeRes = res;
    });
    this.server.on('connection', (s) => {
      this.sockets.add(s);
      s.on('close', () => this.sockets.delete(s));
    });
    await new Promise<void>((resolve) => this.server!.listen(port, '127.0.0.1', resolve));
    this.port = (this.server!.address() as AddressInfo).port;
    return this.port;
  }

  /** Push an event to the currently connected client (if any). */
  push(event: OpencodeEvent): void {
    this.activeRes?.write(sse(event));
  }

  hasClient(): boolean {
    return this.activeRes !== null && !this.activeRes.writableEnded;
  }

  /** Hard-kill: destroy sockets and stop listening, freeing the port. */
  async kill(): Promise<void> {
    this.activeRes = null;
    for (const s of this.sockets) s.destroy();
    this.sockets.clear();
    await new Promise<void>((resolve) => this.server!.close(() => resolve()));
    this.server = null;
  }
}

describe('opencode-events — reconnect + bus-gap + auth (integration)', function () {
  this.timeout(15000);

  let fake: FakeOpencode;
  let bus: OpencodeEventBus;
  const received: OpencodeEvent[] = [];
  const savedPw = process.env.OPENCODE_SERVER_PASSWORD;

  before(() => {
    process.env.OPENCODE_SERVER_PASSWORD = PASSWORD;
  });
  after(() => {
    if (savedPw === undefined) delete process.env.OPENCODE_SERVER_PASSWORD;
    else process.env.OPENCODE_SERVER_PASSWORD = savedPw;
  });

  it('survives a server kill/restart mid-stream', async () => {
    fake = new FakeOpencode();
    const port = await fake.start(0);

    bus = createOpencodeEventBus({
      baseUrl: `http://127.0.0.1:${port}`,
      directory: '/workspace',
      baseBackoffMs: 20,
      maxBackoffMs: 60,
      log: () => {}, // quiet
    });

    bus.subscribe('sess-1', (e) => received.push(e));

    // 1. First connection established, pre-restart event delivered.
    await waitFor(() => fake.hasClient(), 3000, 'first client connect');
    fake.push({ type: 'message.part.delta', properties: { sessionID: 'sess-1', delta: 'pre' } });
    await waitFor(() => received.some((e) => e.properties?.delta === 'pre'), 3000, 'pre event');
    assert.strictEqual(bus.getBusStatus().connected, true);

    // 2. Kill the server mid-stream.
    await fake.kill();
    await waitFor(() => bus.getBusStatus().connected === false, 3000, 'disconnect detected');

    // 3. Restart on the SAME port; consumer should reconnect via backoff.
    await fake.start(port);
    await waitFor(() => fake.hasClient(), 5000, 'reconnect');

    // 4. Post-restart event delivered to the same subscriber.
    fake.push({ type: 'message.part.delta', properties: { sessionID: 'sess-1', delta: 'post' } });
    await waitFor(() => received.some((e) => e.properties?.delta === 'post'), 3000, 'post event');

    // --- assertions ---
    const gaps = received.filter((e) => e.type === BUS_GAP);
    assert.strictEqual(gaps.length, 1, 'exactly one bus-gap emitted on reconnect');
    // bus-gap arrives before the post-restart event (renderer learns of the gap first)
    assert.ok(
      received.indexOf(gaps[0]) < received.findIndex((e) => e.properties?.delta === 'post'),
      'bus-gap precedes post-restart event',
    );
    assert.strictEqual(bus.getBusStatus().reconnectCount, 1, 'reconnectCount == 1');

    // auth header present on BOTH the original and the reconnected connection
    assert.ok(fake.authSeen.length >= 2, `two connections seen (got ${fake.authSeen.length})`);
    for (const a of fake.authSeen) assert.strictEqual(a, EXPECTED_AUTH, 'Basic auth on every connection');
  });

  after(async () => {
    if (bus) bus.stop();
    if (fake?.server) await fake.kill();
  });
});
