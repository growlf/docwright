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

// bcrypt hash of 'secret123' — generated once, fixed for test stability
const BCRYPT_SECRET123 = '$2b$10$YSWoawr27hal54r4aQI6LuL9LAjQpnsN8WpQ5hXn/EdegFX5SXFX6';

describe('local auth', () => {
  before(() => {
    process.env.LOCAL_AUTH_USER = 'testuser';
    process.env.LOCAL_AUTH_PASSWORD = BCRYPT_SECRET123;
    process.env.LOCAL_AUTH_EMAIL = 'test@localhost';
    process.env.LOCAL_AUTH_DISPLAY_NAME = 'Test User';
  });

  after(() => {
    delete process.env.LOCAL_AUTH_USER;
    delete process.env.LOCAL_AUTH_PASSWORD;
    delete process.env.LOCAL_AUTH_EMAIL;
    delete process.env.LOCAL_AUTH_DISPLAY_NAME;
  });

  it('returns a user for valid credentials', async () => {
    const user = await validateLocalAuth('testuser', 'secret123');
    assert.ok(user, 'should return a user');
    assert.strictEqual(user?.username, 'testuser');
    assert.strictEqual(user?.email, 'test@localhost');
    assert.strictEqual(user?.displayName, 'Test User');
    assert.deepStrictEqual(user?.teams, ['admin']);
  });

  it('returns null for wrong password', async () => {
    assert.strictEqual(await validateLocalAuth('testuser', 'wrong'), null);
  });

  it('returns null for wrong username', async () => {
    assert.strictEqual(await validateLocalAuth('other', 'secret123'), null);
  });

  it('returns null when LOCAL_AUTH_PASSWORD is unset', async () => {
    delete process.env.LOCAL_AUTH_PASSWORD;
    assert.strictEqual(await validateLocalAuth('testuser', ''), null);
    process.env.LOCAL_AUTH_PASSWORD = BCRYPT_SECRET123;
  });
});

// ── auth/constants.ts — public path detection ─────────────────────────────────

import { isPublicPath } from '../../src/webui/src/lib/auth/constants.js';

describe('isPublicPath', () => {
  it('marks /login as public', () => assert.ok(isPublicPath('/login')));
  it('marks /auth/callback as public', () => assert.ok(isPublicPath('/auth/callback')));
  it('marks /api/health as public', () => assert.ok(isPublicPath('/api/health')));
  it('marks /login/sub as public (prefix match)', () => assert.ok(isPublicPath('/login/sub')));
  it('marks / as protected', () => assert.ok(!isPublicPath('/')));
  it('marks /api/write as protected', () => assert.ok(!isPublicPath('/api/write')));
  it('marks /documents/plan.md as protected', () => assert.ok(!isPublicPath('/documents/plan.md')));
});

// ── requireAuth wrapper ───────────────────────────────────────────────────────

import { requireAuth, requireRole, isApiRequest } from '../../src/webui/src/lib/server/auth.js';

describe('requireAuth', () => {
  const handler = async () => new Response('ok', { status: 200 });

  it('returns 401 when locals.user is null', async () => {
    const wrapped = requireAuth(handler);
    const res = await wrapped({ locals: { user: null }, cookies: {}, url: new URL('http://localhost/api/write') } as never);
    assert.strictEqual(res.status, 401);
  });

  it('passes through when locals.user is set', async () => {
    const wrapped = requireAuth(handler);
    const res = await wrapped({ locals: { user: ALICE }, cookies: {}, url: new URL('http://localhost/api/write') } as never);
    assert.strictEqual(res.status, 200);
  });
});

describe('requireRole', () => {
  const handler = async () => new Response('ok', { status: 200 });

  it('returns 401 when user is null', async () => {
    const wrapped = requireRole(['admin'], handler);
    const res = await wrapped({ locals: { user: null } } as never);
    assert.strictEqual(res.status, 401);
  });

  it('returns 403 when user lacks the required team', async () => {
    const wrapped = requireRole(['superuser'], handler);
    const res = await wrapped({ locals: { user: ALICE } } as never); // ALICE has teams: ['admin']
    assert.strictEqual(res.status, 403);
  });

  it('passes through when user has a matching team', async () => {
    const wrapped = requireRole(['admin'], handler);
    const res = await wrapped({ locals: { user: ALICE } } as never);
    assert.strictEqual(res.status, 200);
  });
});

describe('isApiRequest', () => {
  it('returns true for /api/* paths', () => assert.ok(isApiRequest(new URL('http://localhost/api/write'))));
  it('returns false for non-api paths', () => assert.ok(!isApiRequest(new URL('http://localhost/documents/plan.md'))));
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
