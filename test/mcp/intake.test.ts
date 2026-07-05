import * as assert from 'node:assert';
import {
  listDocwrightIssues,
  createDocwrightProposal,
  upstreamRepoSlug,
} from '../../src/mcp/tools/docwright_intake';
import { setMode } from '../../src/mcp/lib/mode';
import { setRepoRoot } from '../../src/mcp/lib/paths';

describe('DocWright intake tools (Step 3)', () => {
  const realFetch = global.fetch;
  let savedEnv: string | undefined;
  let savedToken: string | undefined;

  beforeEach(() => {
    savedEnv = process.env.DOCWRIGHT_UPSTREAM_REPO;
    savedToken = process.env.DOCWRIGHT_GITHUB_TOKEN;
    delete process.env.DOCWRIGHT_UPSTREAM_REPO;
    delete process.env.DOCWRIGHT_GITHUB_TOKEN;
    setMode('vault');
  });

  afterEach(() => {
    global.fetch = realFetch;
    if (savedEnv === undefined) delete process.env.DOCWRIGHT_UPSTREAM_REPO;
    else process.env.DOCWRIGHT_UPSTREAM_REPO = savedEnv;
    if (savedToken === undefined) delete process.env.DOCWRIGHT_GITHUB_TOKEN;
    else process.env.DOCWRIGHT_GITHUB_TOKEN = savedToken;
    setMode('vault');
  });

  function stubFetch(payload: unknown, ok = true, status = 200): { calls: string[] } {
    const calls: string[] = [];
    global.fetch = (async (url: any) => {
      calls.push(String(url));
      return {
        ok,
        status,
        json: async () => payload,
        text: async () => JSON.stringify(payload),
      };
    }) as any;
    return { calls };
  }

  describe('upstreamRepoSlug', () => {
    it('defaults to growlf/docwright in vault mode (vault origin is not upstream)', () => {
      setMode('vault');
      setRepoRoot('/nonexistent');
      assert.strictEqual(upstreamRepoSlug(), 'growlf/docwright');
    });

    it('honors DOCWRIGHT_UPSTREAM_REPO when well-formed, rejects junk', () => {
      process.env.DOCWRIGHT_UPSTREAM_REPO = 'myorg/myfork';
      assert.strictEqual(upstreamRepoSlug(), 'myorg/myfork');
      process.env.DOCWRIGHT_UPSTREAM_REPO = 'not a slug!';
      assert.strictEqual(upstreamRepoSlug(), 'growlf/docwright');
    });
  });

  describe('list_docwright_issues', () => {
    it('lists issues and filters out pull requests', async () => {
      const { calls } = stubFetch([
        { number: 1, title: 'Real issue', html_url: 'https://x/1', labels: [{ name: 'bug' }], assignee: { login: 'growlf' } },
        { number: 2, title: 'A PR', html_url: 'https://x/2', labels: [], pull_request: {} },
      ]);
      const res = await listDocwrightIssues();
      assert.ok(res.includes('1 open issue(s)'), res);
      assert.ok(res.includes('#1 [bug] → growlf Real issue'));
      assert.ok(!res.includes('A PR'));
      assert.ok(calls[0].includes('repos/growlf/docwright/issues'));
      assert.ok(calls[0].includes('state=open'));
    });

    it('passes label and assignee filters through to the API query', async () => {
      const { calls } = stubFetch([]);
      await listDocwrightIssues('proposal', 'growlf', 'all');
      assert.ok(calls[0].includes('labels=proposal'));
      assert.ok(calls[0].includes('assignee=growlf'));
      assert.ok(calls[0].includes('state=all'));
    });

    it('reports empty results readably', async () => {
      stubFetch([]);
      const res = await listDocwrightIssues('nonexistent-label');
      assert.ok(res.startsWith('No open issues'), res);
    });

    it('surfaces API errors including rate-limit hint', async () => {
      stubFetch({}, false, 403);
      const res = await listDocwrightIssues();
      assert.ok(res.startsWith('ERROR'), res);
      assert.ok(res.includes('DOCWRIGHT_GITHUB_TOKEN'));
    });

    it('surfaces network failure without throwing', async () => {
      global.fetch = (async () => { throw new Error('ECONNREFUSED'); }) as any;
      const res = await listDocwrightIssues();
      assert.ok(res.startsWith('ERROR'), res);
      assert.ok(res.includes('offline'));
    });
  });

  describe('create_docwright_proposal', () => {
    it('returns a pre-filled URL and writes nothing', () => {
      const res = createDocwrightProposal('Add dark mode', 'Because eyes.', 'feature-request');
      assert.ok(res.includes('nothing has been submitted'), res);
      assert.ok(res.includes('https://github.com/growlf/docwright/issues/new?'));
      const url = new URL(res.split('\n')[1]);
      assert.strictEqual(url.searchParams.get('title'), '[proposal] Add dark mode');
      assert.ok(url.searchParams.get('body')!.includes('Because eyes.'));
      assert.strictEqual(url.searchParams.get('labels'), 'proposal,feature-request');
    });

    it('rejects empty titles and coerces invalid categories', () => {
      assert.ok(createDocwrightProposal('', 'body').startsWith('ERROR'));
      const res = createDocwrightProposal('t', 'b', 'not-real');
      assert.ok(res.includes('labels=proposal%2Cfeature-request'));
    });

    it('strips HTML from title and body', () => {
      const res = createDocwrightProposal('<img src=x>clean', '<script>x</script>safe');
      const url = new URL(res.split('\n')[1]);
      assert.strictEqual(url.searchParams.get('title'), '[proposal] clean');
      assert.ok(!url.searchParams.get('body')!.includes('<script>'));
    });
  });
});
