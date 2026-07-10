/**
 * Unit tests for the presence tracker (live-ai-visibility 3.6).
 */
import assert from 'assert';
import { createPresenceTracker } from '../../src/webui/src/lib/server/ai-presence';
import type { OpencodeEvent } from '../../src/webui/src/lib/server/opencode-events';

const status = (sid: string, type: 'busy' | 'idle'): OpencodeEvent => ({
  type: 'session.status',
  properties: { sessionID: sid, status: { type } },
});
const idle = (sid: string): OpencodeEvent => ({ type: 'session.idle', properties: { sessionID: sid } });

describe('ai-presence — createPresenceTracker', () => {
  it('goes busy when an owned session starts and idle when it finishes', () => {
    const t = createPresenceTracker((sid) => sid === 'mine');
    assert.deepStrictEqual(t.snapshot(), { busy: false, count: 0 });
    assert.strictEqual(t.apply(status('mine', 'busy')), true);
    assert.deepStrictEqual(t.snapshot(), { busy: true, count: 1 });
    assert.strictEqual(t.apply(idle('mine')), true);
    assert.deepStrictEqual(t.snapshot(), { busy: false, count: 0 });
  });

  it('ignores sessions the user does not own', () => {
    const t = createPresenceTracker((sid) => sid === 'mine');
    assert.strictEqual(t.apply(status('someone-else', 'busy')), false);
    assert.deepStrictEqual(t.snapshot(), { busy: false, count: 0 });
  });

  it('counts concurrent owned sessions and only signals change on transitions', () => {
    const t = createPresenceTracker(() => true);
    assert.strictEqual(t.apply(status('a', 'busy')), true); // 0→1
    assert.strictEqual(t.apply(status('a', 'busy')), false); // already busy, no change
    assert.strictEqual(t.apply(status('b', 'busy')), true); // 1→2
    assert.deepStrictEqual(t.snapshot(), { busy: true, count: 2 });
    assert.strictEqual(t.apply(status('a', 'idle')), true); // 2→1, still busy
    assert.deepStrictEqual(t.snapshot(), { busy: true, count: 1 });
    assert.strictEqual(t.apply(idle('b')), true); // 1→0
    assert.deepStrictEqual(t.snapshot(), { busy: false, count: 0 });
  });

  it('ignores unrelated event types and missing sessionID', () => {
    const t = createPresenceTracker(() => true);
    assert.strictEqual(t.apply({ type: 'message.part.delta', properties: { sessionID: 'a', delta: 'x' } }), false);
    assert.strictEqual(t.apply({ type: 'server.heartbeat', properties: {} }), false);
    assert.deepStrictEqual(t.snapshot(), { busy: false, count: 0 });
  });
});
