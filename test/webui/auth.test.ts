import assert from 'assert';
import { createHash } from 'node:crypto';

// ── Session store ─────────────────────────────────────────────────────────────

// Import after setting env — module-level constants read env at load time.
// Isolate between test runs by re-importing fresh copies is not practical
// with CJS require cache, so we test the exported API directly.
import {
  createSession,
  getSession,
  deleteSession,
} from '../../src/webui/src/lib/server/session.js';

const ALICE = {
  id: 'u1',
  username: 'alice',
  email: 'alice@example.com',
  displayName: 'Alice',
  teams: ['admin'],
};

describe('session store', () => {
  it('creates a session and retrieves the user', () => {
    const id = createSession(ALICE);
    assert.ok(id, 'session id must be truthy');
    assert.strictEqual(id.length, 64, 'session id should be 64 hex chars');
    const user = getSession(id);
    assert.ok(user, 'getSession must return the user');
    assert.strictEqual(user?.username, 'alice');
  });

  it('returns null for unknown session ids', () => {
    assert.strictEqual(getSession('does-not-exist'), null);
  });

  it('deletes a session', () => {
    const id = createSession(ALICE);
    deleteSession(id);
    assert.strictEqual(getSession(id), null);
  });

  it('returns distinct ids for distinct sessions', () => {
    const a = createSession(ALICE);
    const b = createSession(ALICE);
    assert.notStrictEqual(a, b);
  });
});

// ── Local auth ────────────────────────────────────────────────────────────────

import { validateLocalAuth } from '../../src/webui/src/lib/server/local-auth.js';

describe('local auth', () => {
  before(() => {
    process.env.LOCAL_AUTH_USER = 'testuser';
    process.env.LOCAL_AUTH_PASSWORD = 'secret123';
    process.env.LOCAL_AUTH_EMAIL = 'test@localhost';
    process.env.LOCAL_AUTH_DISPLAY_NAME = 'Test User';
  });

  after(() => {
    delete process.env.LOCAL_AUTH_USER;
    delete process.env.LOCAL_AUTH_PASSWORD;
    delete process.env.LOCAL_AUTH_EMAIL;
    delete process.env.LOCAL_AUTH_DISPLAY_NAME;
  });

  it('returns a user for valid credentials', () => {
    const user = validateLocalAuth('testuser', 'secret123');
    assert.ok(user, 'should return a user');
    assert.strictEqual(user?.username, 'testuser');
    assert.strictEqual(user?.email, 'test@localhost');
    assert.strictEqual(user?.displayName, 'Test User');
    assert.deepStrictEqual(user?.teams, ['admin']);
  });

  it('returns null for wrong password', () => {
    assert.strictEqual(validateLocalAuth('testuser', 'wrong'), null);
  });

  it('returns null for wrong username', () => {
    assert.strictEqual(validateLocalAuth('other', 'secret123'), null);
  });

  it('returns null when LOCAL_AUTH_PASSWORD is unset', () => {
    delete process.env.LOCAL_AUTH_PASSWORD;
    assert.strictEqual(validateLocalAuth('testuser', ''), null);
    process.env.LOCAL_AUTH_PASSWORD = 'secret123';
  });
});

// ── OCC ETag logic ────────────────────────────────────────────────────────────

function etag(content: string): string {
  return `"${createHash('sha256').update(content).digest('hex').slice(0, 16)}"`;
}

describe('OCC etag', () => {
  it('same content produces same etag', () => {
    const a = etag('hello world');
    const b = etag('hello world');
    assert.strictEqual(a, b);
  });

  it('different content produces different etags', () => {
    const a = etag('version 1');
    const b = etag('version 2');
    assert.notStrictEqual(a, b);
  });

  it('etag is quoted', () => {
    const e = etag('test');
    assert.ok(e.startsWith('"') && e.endsWith('"'), 'etag must be quoted');
  });
});
