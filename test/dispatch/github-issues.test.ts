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

describe('github-issues — Project schema + detailed read (Step 2/3)', () => {
  const FIELDS = { data: { node: { fields: { nodes: [
    { __typename: 'ProjectV2SingleSelectField', id: 'F_life', name: 'Lifecycle', dataType: 'SINGLE_SELECT', options: [{ id: 'O_new', name: 'new' }, { id: 'O_tri', name: 'triaged' }] },
    { __typename: 'ProjectV2FieldCommon', id: 'F_dem', name: 'Demand', dataType: 'NUMBER' },
    { __typename: 'ProjectV2FieldCommon', id: 'F_dates', name: 'Reported Dates', dataType: 'TEXT' },
  ] } } } };

  it('getProjectFields resolves fields by name with options', async () => {
    const { fetch } = mockFetch(() => ({ body: FIELDS }));
    const gh = new GitHubClient(CFG, fetch);
    const fields = await gh.getProjectFields();
    assert.strictEqual(fields.get('Lifecycle')!.dataType, 'SINGLE_SELECT');
    assert.strictEqual(fields.get('Lifecycle')!.options![1].name, 'triaged');
    assert.strictEqual(fields.get('Demand')!.id, 'F_dem');
  });

  it('listProjectItemsDetailed maps issue content + field values by name', async () => {
    const { fetch } = mockFetch(() => ({ body: { data: { node: { items: { nodes: [{
      id: 'PVTI_1',
      content: { __typename: 'Issue', number: 5, title: 't', body: 'b', state: 'OPEN', url: 'u', labels: { nodes: [{ name: 'bug' }] } },
      fieldValues: { nodes: [
        { __typename: 'ProjectV2ItemFieldSingleSelectValue', name: 'triaged', field: { name: 'Lifecycle' } },
        { __typename: 'ProjectV2ItemFieldNumberValue', number: 3, field: { name: 'Demand' } },
        { __typename: 'ProjectV2ItemFieldTextValue', text: '["2026-07-01"]', field: { name: 'Reported Dates' } },
      ] },
    }] } } } } }));
    const gh = new GitHubClient(CFG, fetch);
    const items = await gh.listProjectItemsDetailed();
    assert.strictEqual(items[0].issue!.number, 5);
    assert.strictEqual(items[0].issue!.state, 'open'); // OPEN → open
    assert.deepStrictEqual(items[0].issue!.labels, ['bug']);
    assert.deepStrictEqual(items[0].fields, { Lifecycle: 'triaged', Demand: 3, 'Reported Dates': '["2026-07-01"]' });
  });

  it('setProjectFieldByName resolves a single-select option id', async () => {
    const { fetch, calls } = mockFetch((_u, init) => {
      const q = JSON.parse(init.body).query;
      if (q.includes('fields(first:50)')) return { body: FIELDS };
      return { body: { data: { updateProjectV2ItemFieldValue: { projectV2Item: { id: 'x' } } } } };
    });
    const gh = new GitHubClient(CFG, fetch);
    await gh.setProjectFieldByName('PVTI_1', 'Lifecycle', 'triaged');
    const mutation = calls.find(c => JSON.parse(c.init.body).query.includes('updateProjectV2ItemFieldValue'))!;
    assert.strictEqual(JSON.parse(mutation.init.body).variables.o, 'O_tri', 'resolved option id, not the name');
  });

  it('setProjectFieldByName throws for an unknown field or option', async () => {
    const { fetch } = mockFetch(() => ({ body: FIELDS }));
    const gh = new GitHubClient(CFG, fetch);
    await assert.rejects(() => gh.setProjectFieldByName('i', 'Nope', 'x'), /no field named 'Nope'/);
    await assert.rejects(() => gh.setProjectFieldByName('i', 'Lifecycle', 'bogus'), /no option 'bogus'/);
  });

  it('addComment POSTs to the issue comments endpoint', async () => {
    const { fetch, calls } = mockFetch(() => ({ body: {} }));
    const gh = new GitHubClient(CFG, fetch);
    await gh.addComment(42, 'hello');
    assert.ok(calls[0].url.endsWith('/repos/growlf/docwright/issues/42/comments'));
    assert.strictEqual(calls[0].init.method, 'POST');
  });
});
