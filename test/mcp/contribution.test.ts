import * as assert from 'node:assert';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { logFriction } from '../../src/mcp/tools/friction';
import { contributeUpstream } from '../../src/mcp/tools/contribute_upstream';
import { setRepoRoot } from '../../src/mcp/lib/paths';
import { setMode } from '../../src/mcp/lib/mode';
import { parseFrictionLog, FRICTION_LOG_PATH } from '../../src/dispatch/friction';

describe('Contribution pipeline tools', () => {
  let tmpRoot: string;
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dw-contrib-'));
    setRepoRoot(tmpRoot);
    for (const key of ['DOCWRIGHT_CONTRIB_APPROVED', 'DOCWRIGHT_GITHUB_TOKEN']) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    setMode('vault');
    fs.rmSync(tmpRoot, { recursive: true, force: true });
    for (const [key, val] of Object.entries(savedEnv)) {
      if (val === undefined) delete process.env[key];
      else process.env[key] = val;
    }
  });

  describe('log_friction (Step 2)', () => {
    it('rejects in upstream mode', () => {
      setMode('upstream');
      const res = logFriction('some pain');
      assert.ok(res.startsWith('ERROR'), res);
      assert.ok(res.includes('vault mode'));
    });

    it('creates docs/friction-log.md with a well-formed entry when absent', () => {
      setMode('vault');
      const res = logFriction('Editor loses cursor position', 'ux-friction', 'high');
      assert.ok(res.startsWith('✅'), res);
      const raw = fs.readFileSync(path.join(tmpRoot, FRICTION_LOG_PATH), 'utf8');
      const entries = parseFrictionLog(raw);
      assert.strictEqual(entries.length, 1);
      assert.strictEqual(entries[0].category, 'ux-friction');
      assert.strictEqual(entries[0].severity, 'high');
      assert.ok(entries[0].description.includes('Editor loses cursor position'));
      assert.ok(raw.includes('**Review cadence: weekly.**'));
    });

    it('appends to an existing log without clobbering prior entries', () => {
      setMode('vault');
      logFriction('first', 'bug', 'low');
      logFriction('second', 'docs-gap', 'medium');
      const raw = fs.readFileSync(path.join(tmpRoot, FRICTION_LOG_PATH), 'utf8');
      const entries = parseFrictionLog(raw);
      assert.strictEqual(entries.length, 2);
      assert.ok(entries[0].description.includes('first'));
      assert.ok(entries[1].description.includes('second'));
    });

    it('rejects empty descriptions and coerces invalid category/severity', () => {
      setMode('vault');
      assert.ok(logFriction('   ').startsWith('ERROR'));
      logFriction('x', 'not-a-category', 'catastrophic');
      const entries = parseFrictionLog(fs.readFileSync(path.join(tmpRoot, FRICTION_LOG_PATH), 'utf8'));
      assert.strictEqual(entries[0].category, 'ux-friction');
      assert.strictEqual(entries[0].severity, 'medium');
    });

    it('strips HTML from descriptions', () => {
      setMode('vault');
      logFriction('<script>alert(1)</script>bad markup', 'bug', 'low');
      const entries = parseFrictionLog(fs.readFileSync(path.join(tmpRoot, FRICTION_LOG_PATH), 'utf8'));
      assert.ok(!entries[0].description.includes('<script>'));
      assert.ok(entries[0].description.includes('bad markup'));
    });
  });

  describe('contribute_upstream (Step 1 — retroactive coverage)', () => {
    it('rejects in vault mode', async () => {
      setMode('vault');
      const res = await contributeUpstream('t', 'd');
      assert.ok(res.startsWith('ERROR'), res);
      assert.ok(res.includes('upstream mode'));
    });

    it('rejects without DOCWRIGHT_CONTRIB_APPROVED=1 (human gate)', async () => {
      setMode('upstream');
      const res = await contributeUpstream('t', 'd');
      assert.ok(res.includes('DOCWRIGHT_CONTRIB_APPROVED'), res);
    });

    it('without token: returns a pre-filled URL and logs the contribution', async () => {
      setMode('upstream');
      process.env.DOCWRIGHT_CONTRIB_APPROVED = '1';
      const res = await contributeUpstream('Broken thing', 'It broke', 'bug');
      assert.ok(res.includes('issues/new?'), res);
      const logPath = path.join(tmpRoot, '.docwright', 'contributions.log');
      assert.ok(fs.existsSync(logPath), 'contributions.log should exist');
      const lines = fs.readFileSync(logPath, 'utf8').trim().split('\n');
      const entry = JSON.parse(lines[lines.length - 1]);
      assert.strictEqual(entry.title, 'Broken thing');
      assert.strictEqual(entry.category, 'bug');
      assert.ok(entry.issue_url_or_prefill.includes('issues/new?'));
      // Never log a token
      assert.ok(!JSON.stringify(entry).includes('token'));
    });

    it('rejects empty titles', async () => {
      setMode('upstream');
      process.env.DOCWRIGHT_CONTRIB_APPROVED = '1';
      const res = await contributeUpstream('<b></b>', 'desc');
      assert.ok(res.startsWith('ERROR'), res);
    });

    it('with valid token: POSTs the issue to GitHub and logs the created URL', async () => {
      setMode('upstream');
      process.env.DOCWRIGHT_CONTRIB_APPROVED = '1';
      process.env.DOCWRIGHT_GITHUB_TOKEN = 'ghp_test_token';
      const realFetch = global.fetch;
      const calls: { url: string; init: any }[] = [];
      global.fetch = (async (url: any, init: any) => {
        calls.push({ url: String(url), init });
        return {
          ok: true,
          status: 201,
          json: async () => ({ html_url: 'https://github.com/growlf/docwright/issues/999' }),
          text: async () => '',
        };
      }) as any;
      try {
        const res = await contributeUpstream('Tokened report', 'It broke with a token', 'bug');
        assert.ok(res.includes('✅ GitHub issue created'), res);
        assert.ok(res.includes('/issues/999'), res);

        assert.strictEqual(calls.length, 1);
        assert.ok(calls[0].url.includes('api.github.com/repos/'), calls[0].url);
        assert.strictEqual(calls[0].init.method, 'POST');
        assert.strictEqual(calls[0].init.headers['Authorization'], 'Bearer ghp_test_token');
        const body = JSON.parse(calls[0].init.body);
        assert.strictEqual(body.title, 'Tokened report');
        assert.deepStrictEqual(body.labels, ['bug', 'contribution-pipeline']);

        const logPath = path.join(tmpRoot, '.docwright', 'contributions.log');
        const lines = fs.readFileSync(logPath, 'utf8').trim().split('\n');
        const entry = JSON.parse(lines[lines.length - 1]);
        assert.strictEqual(entry.issue_url_or_prefill, 'https://github.com/growlf/docwright/issues/999');
        assert.ok(!JSON.stringify(entry).includes('ghp_test_token'), 'token must never be logged');
      } finally {
        global.fetch = realFetch;
      }
    });

    it('with token but API failure: falls back to the pre-filled URL and still logs', async () => {
      setMode('upstream');
      process.env.DOCWRIGHT_CONTRIB_APPROVED = '1';
      process.env.DOCWRIGHT_GITHUB_TOKEN = 'ghp_test_token';
      const realFetch = global.fetch;
      global.fetch = (async () => ({
        ok: false,
        status: 500,
        json: async () => ({}),
        text: async () => 'boom',
      })) as any;
      try {
        const res = await contributeUpstream('Fallback report', 'desc', 'bug');
        assert.ok(res.includes('issues/new?'), res);
        const logPath = path.join(tmpRoot, '.docwright', 'contributions.log');
        const entry = JSON.parse(fs.readFileSync(logPath, 'utf8').trim().split('\n').pop()!);
        assert.ok(entry.issue_url_or_prefill.includes('issues/new?'));
      } finally {
        global.fetch = realFetch;
      }
    });
  });
});
