import assert from 'node:assert';
import { GitHubClient, githubConfigFromEnv, GitHubError, type FetchLike } from '../../src/dispatch/github-issues';

// Step 1 of the GH-pivot plan: the client is unit-tested against a MOCKED API —
// no network, no token. Reads cache + degrade; writes surface errors.

function mockFetch(handler: (url: string, init: any) => { ok?: boolean; status?: number; body: any }) {
  const calls: Array<{ url: string; init: any }> = [];
  const fetch: FetchLike = async (url, init) => {
    calls.push({ url, init });
    const r = handler(url, init);
    return {
      ok: r.ok ?? true,
      status: r.status ?? 200,
      json: async () => r.body,
      text: async () => (typeof r.body === 'string' ? r.body : JSON.stringify(r.body)),
    };
  };
  return { fetch, calls };
}

const CFG = { owner: 'growlf', repo: 'docwright', token: 'tok', projectId: 'PVT_abc' };

describe('github-issues — config', () => {
  it('resolves config from env', () => {
    const c = githubConfigFromEnv({ DOCWRIGHT_GH_REPO: 'growlf/docwright', DOCWRIGHT_GH_TOKEN: 'x', DOCWRIGHT_GH_PROJECT_ID: 'P1' } as any);
    assert.deepStrictEqual(c, { owner: 'growlf', repo: 'docwright', token: 'x', projectId: 'P1' });
  });
  it('returns null when token or repo is missing', () => {
    assert.strictEqual(githubConfigFromEnv({ DOCWRIGHT_GH_REPO: 'growlf/docwright' } as any), null);
    assert.strictEqual(githubConfigFromEnv({ DOCWRIGHT_GH_TOKEN: 'x' } as any), null);
    assert.strictEqual(githubConfigFromEnv({ DOCWRIGHT_GH_REPO: 'noslash', DOCWRIGHT_GH_TOKEN: 'x' } as any), null);
  });
});

describe('github-issues — issues (REST)', () => {
  it('lists open issues and filters out PRs', async () => {
    const { fetch } = mockFetch(() => ({ body: [
      { number: 1, node_id: 'I_1', title: 'a', body: 'b', state: 'open', labels: [{ name: 'bug' }], html_url: 'u1' },
      { number: 2, node_id: 'I_2', title: 'pr', state: 'open', labels: [], html_url: 'u2', pull_request: { url: 'x' } },
    ] }));
    const gh = new GitHubClient(CFG, fetch);
    const issues = await gh.listOpenIssues();
    assert.strictEqual(issues.length, 1, 'PR filtered out');
    assert.deepStrictEqual(issues[0], { number: 1, nodeId: 'I_1', title: 'a', body: 'b', state: 'open', labels: ['bug'], url: 'u1' });
  });

  it('caches reads within the TTL (one fetch for two calls)', async () => {
    const { fetch, calls } = mockFetch(() => ({ body: [] }));
    const gh = new GitHubClient(CFG, fetch, { ttlMs: 1000, now: () => 100 });
    await gh.listOpenIssues();
    await gh.listOpenIssues();
    assert.strictEqual(calls.length, 1, 'second call served from cache');
  });

  it('degrades a read to [] on HTTP error (never throws)', async () => {
    const { fetch } = mockFetch(() => ({ ok: false, status: 503, body: 'down' }));
    const gh = new GitHubClient(CFG, fetch);
    assert.deepStrictEqual(await gh.listOpenIssues(), []);
  });

  it('serves the stale cache when a later read fails', async () => {
    let fail = false;
    let t = 0;
    const { fetch } = mockFetch(() => (fail ? { ok: false, status: 500, body: 'x' } : { body: [{ number: 9, node_id: 'I_9', title: 'keep', state: 'open', labels: [], html_url: 'u' }] }));
    const gh = new GitHubClient(CFG, fetch, { ttlMs: 10, now: () => t });
    const first = await gh.listOpenIssues();
    assert.strictEqual(first[0].number, 9);
    fail = true; t = 1000; // expire the cache, then fail
    const second = await gh.listOpenIssues();
    assert.strictEqual(second[0].number, 9, 'stale cache served on failure');
  });

  it('scopes searchIssues to the repo', async () => {
    const { fetch, calls } = mockFetch(() => ({ body: { items: [] } }));
    const gh = new GitHubClient(CFG, fetch);
    await gh.searchIssues('table pipe');
    assert.ok(calls[0].url.includes('repo%3Agrowlf%2Fdocwright'), 'query scoped to repo');
    assert.ok(calls[0].url.includes('is%3Aissue'));
  });

  it('createIssue POSTs and maps; a write error surfaces (throws)', async () => {
    const { fetch, calls } = mockFetch((_u, init) => {
      const b = JSON.parse(init.body);
      return { body: { number: 42, node_id: 'I_42', title: b.title, body: b.body, state: 'open', labels: (b.labels || []).map((n: string) => ({ name: n })), html_url: 'u42' } };
    });
    const gh = new GitHubClient(CFG, fetch);
    const issue = await gh.createIssue({ title: 'T', body: 'B', labels: ['demand:1'] });
    assert.strictEqual(issue.number, 42);
    assert.deepStrictEqual(issue.labels, ['demand:1']);
    assert.strictEqual(calls[0].init.method, 'POST');

    const bad = new GitHubClient(CFG, mockFetch(() => ({ ok: false, status: 422, body: 'nope' })).fetch);
    await assert.rejects(() => bad.createIssue({ title: 'x', body: 'y' }), (e: any) => e instanceof GitHubError && e.status === 422);
  });
});

describe('github-issues — Project v2 (GraphQL)', () => {
  it('addIssueToProject returns the item id', async () => {
    const { fetch, calls } = mockFetch(() => ({ body: { data: { addProjectV2ItemById: { item: { id: 'PVTI_1' } } } } }));
    const gh = new GitHubClient(CFG, fetch);
    const itemId = await gh.addIssueToProject('I_42');
    assert.strictEqual(itemId, 'PVTI_1');
    assert.ok(calls[0].url.endsWith('/graphql'));
  });

  it('addIssueToProject throws when no projectId is configured', async () => {
    const gh = new GitHubClient({ ...CFG, projectId: undefined }, mockFetch(() => ({ body: {} })).fetch);
    await assert.rejects(() => gh.addIssueToProject('I_1'), /projectId/);
  });

  it('listProjectItems maps items and returns [] with no projectId', async () => {
    const { fetch } = mockFetch(() => ({ body: { data: { node: { items: { nodes: [
      { id: 'PVTI_1', content: { number: 5 } },
      { id: 'PVTI_2', content: {} },
    ] } } } } }));
    const gh = new GitHubClient(CFG, fetch);
    assert.deepStrictEqual(await gh.listProjectItems(), [{ itemId: 'PVTI_1', issueNumber: 5 }, { itemId: 'PVTI_2', issueNumber: null }]);

    const noProj = new GitHubClient({ ...CFG, projectId: undefined }, fetch);
    assert.deepStrictEqual(await noProj.listProjectItems(), []);
  });

  it('surfaces GraphQL errors[] as a GitHubError', async () => {
    const { fetch } = mockFetch(() => ({ body: { errors: [{ message: 'bad field' }] } }));
    const gh = new GitHubClient(CFG, fetch);
    await assert.rejects(() => gh.addIssueToProject('I_1'), /bad field/);
  });
});
