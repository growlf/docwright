/**
 * Proves opencodeComplete() actually sends the Authorization header on its
 * OpenCode fetches when OPENCODE_SERVER_PASSWORD is set — the wiring test for
 * plan live-ai-visibility step 1.1 (the helper's own behavior is covered in
 * test/dispatch/opencode-auth.test.ts).
 *
 * Stubs global fetch; the first stubbed response fails session creation so the
 * call exits after one request — we only need the captured headers.
 */
import assert from 'assert';
import { opencodeComplete } from '../../src/webui/src/lib/server/opencode-complete';

describe('opencodeComplete — auth header wiring', () => {
  const savedFetch = globalThis.fetch;
  const savedPassword = process.env.OPENCODE_SERVER_PASSWORD;
  let captured: { url: string; headers: Record<string, string> }[] = [];

  beforeEach(() => {
    captured = [];
    globalThis.fetch = (async (url: any, init?: any) => {
      captured.push({ url: String(url), headers: { ...(init?.headers ?? {}) } });
      return { ok: false, status: 599 } as Response; // abort flow after capture
    }) as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = savedFetch;
    if (savedPassword === undefined) delete process.env.OPENCODE_SERVER_PASSWORD;
    else process.env.OPENCODE_SERVER_PASSWORD = savedPassword;
  });

  it('sends Basic Authorization on the session-create fetch when password set', async () => {
    process.env.OPENCODE_SERVER_PASSWORD = 'test-pw';
    await assert.rejects(() => opencodeComplete('hello'));
    assert.strictEqual(captured.length, 1);
    assert.ok(captured[0].url.includes('/session'));
    const expected = 'Basic ' + Buffer.from('opencode:test-pw').toString('base64');
    assert.strictEqual(captured[0].headers['Authorization'], expected);
    assert.strictEqual(captured[0].headers['Content-Type'], 'application/json');
  });

  it('sends no Authorization when password unset', async () => {
    delete process.env.OPENCODE_SERVER_PASSWORD;
    await assert.rejects(() => opencodeComplete('hello'));
    assert.strictEqual(captured.length, 1);
    assert.strictEqual(captured[0].headers['Authorization'], undefined);
    assert.strictEqual(captured[0].headers['Content-Type'], 'application/json');
  });
});
