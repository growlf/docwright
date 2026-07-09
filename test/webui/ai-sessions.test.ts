/**
 * Unit tests for the AI session ownership registry (live-ai-visibility 2.2):
 * ownership recorded, lookup, listFor, persistence reload, TTL pruning (lazy +
 * explicit), and the createOwnedSession wrapper (fetch stubbed).
 */
import assert from 'assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  createSessionRegistry,
  createOwnedSession,
  getSession,
  listSessionsFor,
  type OwnedSession,
} from '../../src/webui/src/lib/server/ai-sessions';

function tmpCacheDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'dw-ai-sessions-'));
}

function rec(over: Partial<OwnedSession> = {}): OwnedSession {
  return {
    sessionID: 'ses_1',
    owner: 'alice',
    feature: 'review',
    docPath: 'plans/x.md',
    createdAt: 1_000_000,
    ...over,
  };
}

describe('ai-sessions — registry core', () => {
  it('records and looks up ownership', () => {
    const dir = tmpCacheDir();
    const reg = createSessionRegistry({ cacheDir: dir, autoSweep: false, now: () => 1_000_000 });
    reg.record(rec());
    const got = reg.get('ses_1');
    assert.ok(got);
    assert.strictEqual(got!.owner, 'alice');
    assert.strictEqual(got!.feature, 'review');
    assert.strictEqual(got!.docPath, 'plans/x.md');
    assert.strictEqual(reg.get('nope'), undefined);
    reg.stop();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('listFor returns only that user\'s sessions', () => {
    const dir = tmpCacheDir();
    const reg = createSessionRegistry({ cacheDir: dir, autoSweep: false, now: () => 1_000_000 });
    reg.record(rec({ sessionID: 'ses_a', owner: 'alice' }));
    reg.record(rec({ sessionID: 'ses_b', owner: 'bob' }));
    reg.record(rec({ sessionID: 'ses_c', owner: 'alice' }));
    const alice = reg.listFor('alice').map((s) => s.sessionID).sort();
    assert.deepStrictEqual(alice, ['ses_a', 'ses_c']);
    assert.deepStrictEqual(reg.listFor('carol'), []);
    reg.stop();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('persists to disk and reloads in a fresh registry instance', () => {
    const dir = tmpCacheDir();
    const reg1 = createSessionRegistry({ cacheDir: dir, autoSweep: false, now: () => 1_000_000 });
    reg1.record(rec({ sessionID: 'ses_persist', owner: 'dana' }));
    reg1.stop();

    // A brand-new instance pointed at the same dir must load the record.
    const reg2 = createSessionRegistry({ cacheDir: dir, autoSweep: false, now: () => 1_000_000 });
    const got = reg2.get('ses_persist');
    assert.ok(got, 'record survived reload');
    assert.strictEqual(got!.owner, 'dana');
    reg2.stop();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('prunes entries older than the TTL (explicit sweep)', () => {
    const dir = tmpCacheDir();
    let clock = 1_000_000;
    const reg = createSessionRegistry({ cacheDir: dir, autoSweep: false, ttlMs: 1000, now: () => clock });
    reg.record(rec({ sessionID: 'fresh', createdAt: clock }));
    reg.record(rec({ sessionID: 'old', createdAt: clock - 5000 })); // already stale
    assert.strictEqual(reg.prune(), 1, 'one stale entry pruned');
    assert.strictEqual(reg.get('old'), undefined);
    assert.ok(reg.get('fresh'));

    // advance the clock past the TTL → fresh becomes stale
    clock += 2000;
    assert.strictEqual(reg.prune(), 1);
    assert.strictEqual(reg.size(), 0);
    reg.stop();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('lazily expires on get/listFor without waiting for a sweep', () => {
    const dir = tmpCacheDir();
    let clock = 1_000_000;
    const reg = createSessionRegistry({ cacheDir: dir, autoSweep: false, ttlMs: 1000, now: () => clock });
    reg.record(rec({ sessionID: 'ses_x', owner: 'eve', createdAt: clock }));
    clock += 2000; // now expired
    assert.strictEqual(reg.get('ses_x'), undefined, 'expired entry not returned by get');
    assert.deepStrictEqual(reg.listFor('eve'), [], 'expired entry not listed');
    assert.strictEqual(reg.size(), 0, 'get lazily removed it');
    reg.stop();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('drops stale entries at load time', () => {
    const dir = tmpCacheDir();
    // Hand-write a file with one fresh + one ancient record.
    fs.writeFileSync(
      path.join(dir, 'ai-sessions.json'),
      JSON.stringify({
        sessions: [
          rec({ sessionID: 'keep', createdAt: 1_000_000 }),
          rec({ sessionID: 'drop', createdAt: 0 }),
        ],
      }),
    );
    const reg = createSessionRegistry({ cacheDir: dir, autoSweep: false, ttlMs: 1000, now: () => 1_000_000 });
    assert.ok(reg.get('keep'));
    assert.strictEqual(reg.get('drop'), undefined);
    reg.stop();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('starts empty on a corrupt cache file without throwing', () => {
    const dir = tmpCacheDir();
    fs.writeFileSync(path.join(dir, 'ai-sessions.json'), '{ not valid json');
    let reg: ReturnType<typeof createSessionRegistry>;
    assert.doesNotThrow(() => {
      reg = createSessionRegistry({ cacheDir: dir, autoSweep: false, log: () => {} });
    });
    assert.strictEqual(reg!.size(), 0);
    reg!.stop();
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe('ai-sessions — createOwnedSession (fetch stubbed)', () => {
  const savedFetch = globalThis.fetch;
  const savedCacheDir = process.env.DOCWRIGHT_CACHE_DIR;
  let dir: string;

  beforeEach(() => {
    dir = tmpCacheDir();
    process.env.DOCWRIGHT_CACHE_DIR = dir;
    // fresh shared registry per test
    delete (globalThis as Record<string, unknown>).__dwAiSessions;
  });
  afterEach(() => {
    globalThis.fetch = savedFetch;
    if (savedCacheDir === undefined) delete process.env.DOCWRIGHT_CACHE_DIR;
    else process.env.DOCWRIGHT_CACHE_DIR = savedCacheDir;
    delete (globalThis as Record<string, unknown>).__dwAiSessions;
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('creates a session and records ownership on the shared registry', async () => {
    globalThis.fetch = (async () =>
      ({ ok: true, status: 200, json: async () => ({ id: 'ses_new' }) }) as Response) as typeof fetch;

    const record = await createOwnedSession({ user: 'frank', feature: 'chat', docPath: 'plans/y.md' });
    assert.strictEqual(record.sessionID, 'ses_new');
    assert.strictEqual(record.owner, 'frank');
    // visible through the shared-registry accessors
    assert.strictEqual(getSession('ses_new')!.owner, 'frank');
    assert.deepStrictEqual(listSessionsFor('frank').map((s) => s.sessionID), ['ses_new']);
  });

  it('throws a clear error when session creation fails', async () => {
    globalThis.fetch = (async () => ({ ok: false, status: 500 }) as Response) as typeof fetch;
    await assert.rejects(() => createOwnedSession({ user: 'g', feature: 'chat' }), /HTTP 500/);
  });
});
