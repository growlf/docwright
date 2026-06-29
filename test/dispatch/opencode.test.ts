import assert from 'assert';
import {
  checkHealth,
  listSessions,
  createSession,
  forkSession,
  summariseSession,
  shareSession,
  deleteSession,
  getSessionMessages,
  sendMessage,
  abortSession,
  listModels,
  listProviders,
  getSessionDiff,
} from '../../src/dispatch/opencode';

// ── Helpers ─────────────────────────────────────────────────────────────────

const BASE = 'http://test-open:4096';
const VAULT = '/tmp/test-vault';
const SES_ID = 'ses-123';

/** Minimal Response-like object */
function mockRes(init: {
  ok?: boolean;
  status?: number;
  statusText?: string;
  json?: unknown;
  text?: string;
  headers?: Record<string, string>;
}): Response {
  const body = init.json !== undefined
    ? JSON.stringify(init.json)
    : (init.text ?? '');
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    statusText: init.statusText ?? 'OK',
    headers: new Map(Object.entries(init.headers ?? { 'content-type': 'application/json' })) as unknown as Headers,
    json: () => Promise.resolve(init.json ?? {}),
    text: () => Promise.resolve(body),
    clone: () => mockRes(init),
  } as Response;
}

let fetchCalls: Array<{ url: string; init: RequestInit }> = [];

function mockFetch(fn: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const orig = globalThis.fetch;
  globalThis.fetch = (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const urlStr = typeof url === 'string' ? url : url.toString();
    fetchCalls.push({ url: urlStr, init: init ?? {} });
    return Promise.resolve(fn(urlStr, init));
  };
  return () => { globalThis.fetch = orig; };
}

function captureFetch() {
  fetchCalls = [];
}

function lastFetch() {
  return fetchCalls[fetchCalls.length - 1];
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('checkHealth', () => {

  it('returns true when server responds ok', async () => {
    const restore = mockFetch(() => mockRes({ ok: true }));
    try {
      const result = await checkHealth(BASE, VAULT);
      assert.strictEqual(result, true);
    } finally { restore(); }
  });

  it('returns false on network error', async () => {
    const restore = mockFetch(() => { throw new Error('fetch failed'); });
    try {
      const result = await checkHealth(BASE, VAULT);
      assert.strictEqual(result, false);
    } finally { restore(); }
  });

  it('returns false on non-ok status', async () => {
    const restore = mockFetch(() => mockRes({ ok: false, status: 503 }));
    try {
      const result = await checkHealth(BASE, VAULT);
      assert.strictEqual(result, false);
    } finally { restore(); }
  });

  it('adds directory query param when vaultPath provided', async () => {
    captureFetch();
    const restore = mockFetch(() => mockRes({ ok: true }));
    try {
      await checkHealth(BASE, VAULT);
      const call = lastFetch();
      assert.ok(call.url.includes(`directory=${encodeURIComponent(VAULT)}`));
    } finally { restore(); }
  });
});

describe('listSessions', () => {

  it('returns sessions from array response', async () => {
    const restore = mockFetch(() => mockRes({
      json: [{ id: 's1', title: 'one' }, { id: 's2' }],
    }));
    try {
      const sessions = await listSessions(BASE);
      assert.strictEqual(sessions.length, 2);
      assert.strictEqual(sessions[0].id, 's1');
      assert.strictEqual(sessions[0].title, 'one');
    } finally { restore(); }
  });

  it('returns sessions from object response', async () => {
    const restore = mockFetch(() => mockRes({
      json: { sessions: [{ id: 's1' }, { id: 's2' }] },
    }));
    try {
      const sessions = await listSessions(BASE);
      assert.strictEqual(sessions.length, 2);
    } finally { restore(); }
  });

  it('returns empty array on empty response', async () => {
    const restore = mockFetch(() => mockRes({ json: [] }));
    try {
      const sessions = await listSessions(BASE);
      assert.deepStrictEqual(sessions, []);
    } finally { restore(); }
  });
});

describe('createSession', () => {

  it('creates a session and extracts id from flat response', async () => {
    const restore = mockFetch(() => mockRes({ json: { id: SES_ID } }));
    try {
      const s = await createSession(BASE, VAULT);
      assert.strictEqual(s.id, SES_ID);
    } finally { restore(); }
  });

  it('extracts id from sessionID field', async () => {
    const restore = mockFetch(() => mockRes({ json: { sessionID: 'ses-456' } }));
    try {
      const s = await createSession(BASE);
      assert.strictEqual(s.id, 'ses-456');
    } finally { restore(); }
  });

  it('extracts id from nested session object', async () => {
    const restore = mockFetch(() => mockRes({ json: { session: { id: 'ses-nested' } } }));
    try {
      const s = await createSession(BASE);
      assert.strictEqual(s.id, 'ses-nested');
    } finally { restore(); }
  });

  it('extracts id from nested session.sessionID', async () => {
    const restore = mockFetch(() => mockRes({ json: { session: { sessionID: 'ses-n2' } } }));
    try {
      const s = await createSession(BASE);
      assert.strictEqual(s.id, 'ses-n2');
    } finally { restore(); }
  });

  it('sends providerID and modelID when provided', async () => {
    captureFetch();
    const restore = mockFetch(() => mockRes({ json: { id: SES_ID } }));
    try {
      await createSession(BASE, VAULT, { providerID: 'opencode', modelID: 'big-pickle' });
      const call = lastFetch();
      const body = JSON.parse(call.init.body as string);
      assert.strictEqual(body.providerID, 'opencode');
      assert.strictEqual(body.modelID, 'big-pickle');
    } finally { restore(); }
  });

  it('throws when no session ID is returned', async () => {
    const restore = mockFetch(() => mockRes({ json: {} }));
    try {
      await assert.rejects(() => createSession(BASE), /no session ID/i);
    } finally { restore(); }
  });
});

describe('forkSession', () => {

  it('forks a session and returns new id', async () => {
    const restore = mockFetch(() => mockRes({ json: { id: 'ses-forked' } }));
    try {
      const s = await forkSession(BASE, SES_ID, VAULT);
      assert.strictEqual(s.id, 'ses-forked');
    } finally { restore(); }
  });

  it('sends POST to /session/:id/fork', async () => {
    captureFetch();
    const restore = mockFetch(() => mockRes({ json: { id: 'ses-forked' } }));
    try {
      await forkSession(BASE, SES_ID, VAULT);
      const call = lastFetch();
      assert.ok(call.url.includes(`session/${SES_ID}/fork`));
      assert.strictEqual(call.init.method ?? 'GET', 'POST');
    } finally { restore(); }
  });
});

describe('summariseSession', () => {

  it('returns summary text', async () => {
    const restore = mockFetch(() => mockRes({ text: 'Summary here', headers: {} }));
    try {
      const text = await summariseSession(BASE, SES_ID);
      assert.strictEqual(text, 'Summary here');
    } finally { restore(); }
  });
});

describe('shareSession', () => {

  it('returns share URL', async () => {
    const restore = mockFetch(() => mockRes({ json: { url: 'https://share/abc' } }));
    try {
      const url = await shareSession(BASE, SES_ID);
      assert.strictEqual(url, 'https://share/abc');
    } finally { restore(); }
  });

  it('returns empty string when no URL', async () => {
    const restore = mockFetch(() => mockRes({ json: {} }));
    try {
      const url = await shareSession(BASE, SES_ID);
      assert.strictEqual(url, '');
    } finally { restore(); }
  });
});

describe('deleteSession', () => {

  it('sends DELETE and succeeds on 200', async () => {
    captureFetch();
    const restore = mockFetch(() => mockRes({ ok: true }));
    try {
      await deleteSession(BASE, SES_ID);
      const call = lastFetch();
      assert.strictEqual(call.init.method ?? 'GET', 'DELETE');
      assert.ok(call.url.includes(`session/${SES_ID}`));
    } finally { restore(); }
  });

  it('throws on non-ok status', async () => {
    const restore = mockFetch(() => mockRes({ ok: false, status: 404 }));
    try {
      await assert.rejects(() => deleteSession(BASE, SES_ID), /404/);
    } finally { restore(); }
  });
});

describe('getSessionMessages', () => {

  const msgs = [
    { id: 'm1', role: 'user', parts: [{ type: 'text', text: 'hello' }] },
    { id: 'm2', role: 'assistant', parts: [{ type: 'text', text: 'hi' }] },
  ];

  it('returns messages from array response', async () => {
    const restore = mockFetch(() => mockRes({ json: msgs }));
    try {
      const result = await getSessionMessages(BASE, SES_ID);
      assert.strictEqual(result.length, 2);
      assert.strictEqual(result[0].role, 'user');
      assert.strictEqual(result[1].parts[0].text, 'hi');
    } finally { restore(); }
  });

  it('returns messages from object response', async () => {
    const restore = mockFetch(() => mockRes({ json: { messages: msgs } }));
    try {
      const result = await getSessionMessages(BASE, SES_ID);
      assert.strictEqual(result.length, 2);
    } finally { restore(); }
  });

  it('normalises human role to user', async () => {
    const restore = mockFetch(() => mockRes({
      json: [{ id: 'm1', role: 'human', parts: [{ type: 'text', text: 'hey' }] }],
    }));
    try {
      const result = await getSessionMessages(BASE, SES_ID);
      assert.strictEqual(result[0].role, 'user');
    } finally { restore(); }
  });

  it('falls back to messageID field when id is missing', async () => {
    const restore = mockFetch(() => mockRes({
      json: [{ messageID: 'mid-1', role: 'user', parts: [] }],
    }));
    try {
      const result = await getSessionMessages(BASE, SES_ID);
      assert.strictEqual(result[0].id, 'mid-1');
    } finally { restore(); }
  });
});

describe('sendMessage', () => {

  it('sends text and returns parts', async () => {
    const restore = mockFetch(() => mockRes({
      json: { parts: [{ type: 'text', text: 'response' }] },
    }));
    try {
      const result = await sendMessage(BASE, SES_ID, 'hello', VAULT);
      assert.strictEqual(result.parts.length, 1);
      assert.strictEqual(result.parts[0].text, 'response');
    } finally { restore(); }
  });

  it('extracts parts from output.parts when top-level parts is missing', async () => {
    const restore = mockFetch(() => mockRes({
      json: { output: { parts: [{ type: 'text', text: 'nested' }] } },
    }));
    try {
      const result = await sendMessage(BASE, SES_ID, 'hello');
      assert.strictEqual(result.parts[0].text, 'nested');
    } finally { restore(); }
  });

  it('returns empty parts array when neither present', async () => {
    const restore = mockFetch(() => mockRes({ json: {} }));
    try {
      const result = await sendMessage(BASE, SES_ID, 'hello');
      assert.deepStrictEqual(result.parts, []);
    } finally { restore(); }
  });

  it('extracts messageId from info.id', async () => {
    const restore = mockFetch(() => mockRes({
      json: { info: { id: 'info-id' }, parts: [] },
    }));
    try {
      const result = await sendMessage(BASE, SES_ID, 'hello');
      assert.strictEqual(result.messageId, 'info-id');
    } finally { restore(); }
  });

  it('extracts messageId from message.id', async () => {
    const restore = mockFetch(() => mockRes({
      json: { message: { id: 'msg-id' }, parts: [] },
    }));
    try {
      const result = await sendMessage(BASE, SES_ID, 'hello');
      assert.strictEqual(result.messageId, 'msg-id');
    } finally { restore(); }
  });

  it('includes usage when present', async () => {
    const restore = mockFetch(() => mockRes({
      json: { parts: [], usage: { inputTokens: 10, outputTokens: 20 } },
    }));
    try {
      const result = await sendMessage(BASE, SES_ID, 'hello');
      assert.strictEqual(result.usage?.inputTokens, 10);
      assert.strictEqual(result.usage?.outputTokens, 20);
    } finally { restore(); }
  });
});

describe('abortSession', () => {

  it('sends POST to /session/:id/abort', async () => {
    captureFetch();
    const restore = mockFetch(() => mockRes({ ok: true }));
    try {
      await abortSession(BASE, SES_ID);
      const call = lastFetch();
      assert.ok(call.url.includes(`session/${SES_ID}/abort`));
      assert.strictEqual(call.init.method ?? 'GET', 'POST');
    } finally { restore(); }
  });

  it('throws on network failure', async () => {
    const restore = mockFetch(() => { throw new Error('fail'); });
    try {
      await assert.rejects(abortSession(BASE, SES_ID), /fail/);
    } finally { restore(); }
  });
});

describe('listModels', () => {

  it('returns models from response', async () => {
    const restore = mockFetch(() => mockRes({
      json: { data: [{ id: 'm1', providerID: 'p1', name: 'Model 1' }] },
    }));
    try {
      const models = await listModels(BASE);
      assert.strictEqual(models.length, 1);
      assert.strictEqual(models[0].id, 'm1');
    } finally { restore(); }
  });

  it('returns empty array on error', async () => {
    const restore = mockFetch(() => { throw new Error('fail'); });
    try {
      const models = await listModels(BASE);
      assert.deepStrictEqual(models, []);
    } finally { restore(); }
  });

  it('falls back to id as name when name is missing', async () => {
    const restore = mockFetch(() => mockRes({
      json: { data: [{ id: 'm1', providerID: 'p1' }] },
    }));
    try {
      const models = await listModels(BASE);
      assert.strictEqual(models[0].name, 'm1');
    } finally { restore(); }
  });
});

describe('listProviders', () => {

  it('returns providers from array response', async () => {
    const restore = mockFetch(() => mockRes({
      json: [{ id: 'opencode', label: 'OpenCode' }],
    }));
    try {
      const providers = await listProviders(BASE);
      assert.strictEqual(providers.length, 1);
      assert.strictEqual(providers[0].id, 'opencode');
    } finally { restore(); }
  });

  it('returns providers from data field', async () => {
    const restore = mockFetch(() => mockRes({
      json: { data: [{ id: 'opencode' }] },
    }));
    try {
      const providers = await listProviders(BASE);
      assert.strictEqual(providers.length, 1);
    } finally { restore(); }
  });

  it('returns providers from providers field', async () => {
    const restore = mockFetch(() => mockRes({
      json: { providers: [{ id: 'opencode' }] },
    }));
    try {
      const providers = await listProviders(BASE);
      assert.strictEqual(providers.length, 1);
    } finally { restore(); }
  });

  it('returns empty array on error', async () => {
    const restore = mockFetch(() => { throw new Error('fail'); });
    try {
      const providers = await listProviders(BASE);
      assert.deepStrictEqual(providers, []);
    } finally { restore(); }
  });
});

describe('getSessionDiff', () => {

  it('returns diff text on success', async () => {
    const diffText = 'diff --git a/file.md b/file.md\nindex abc..def\n--- a/file.md\n+++ b/file.md\n@@ -1,3 +1,4 @@\n unchanged\n-old line\n+new line\n';
    const restore = mockFetch(() => mockRes({ text: diffText, headers: {} }));
    try {
      const result = await getSessionDiff(BASE, SES_ID, VAULT);
      assert.strictEqual(result, diffText);
    } finally { restore(); }
  });

  it('sends GET to /session/:id/diff', async () => {
    captureFetch();
    const restore = mockFetch(() => mockRes({ text: '', headers: {} }));
    try {
      await getSessionDiff(BASE, SES_ID, VAULT);
      const call = lastFetch();
      assert.ok(call.url.includes(`session/${SES_ID}/diff`));
      assert.strictEqual(call.init.method ?? 'GET', 'GET');
    } finally { restore(); }
  });

  it('throws on non-ok status', async () => {
    const restore = mockFetch(() => mockRes({ ok: false, status: 404 }));
    try {
      await assert.rejects(() => getSessionDiff(BASE, SES_ID), /404/);
    } finally { restore(); }
  });
});
