import assert from 'node:assert';
import { ghSuggestDuplicates, ghCreateReportedBug, ghConfirmDuplicate } from '../../src/dispatch/capture-github';
import type { GitHubClient } from '../../src/dispatch/github-issues';

// GH-pivot Step 4: capture against GitHub Issues + the Project board. A recording fake
// isolates the capture logic from the client's wire details (those are covered in
// github-issues.test.ts).

function fakeClient(over: Partial<Record<string, any>> = {}) {
  const calls: any[] = [];
  const base: any = {
    searchIssues: async (q: string) => { calls.push(['searchIssues', q]); return over.searchIssues?.(q) ?? []; },
    createIssue: async (input: any) => { calls.push(['createIssue', input]); return { number: 100, nodeId: 'I_100', url: 'https://gh/100', title: input.title, body: input.body, state: 'open', labels: input.labels ?? [] }; },
    addIssueToProject: async (nodeId: string) => { calls.push(['addIssueToProject', nodeId]); return 'PVTI_1'; },
    setProjectFieldByName: async (item: string, name: string, value: any) => { calls.push(['setField', name, value]); if (over.failField === name) throw new Error(`no field ${name}`); },
    addLabels: async (n: number, labels: string[]) => { calls.push(['addLabels', n, labels]); },
    addComment: async (n: number, body: string) => { calls.push(['addComment', n, body]); },
    listProjectItemsDetailed: async () => { calls.push(['listDetailed']); return over.items ?? []; },
  };
  return { client: base as unknown as GitHubClient, calls };
}

const REPORT = { title: 'Login times out', description: 'It hangs on submit', reporter: 'garth', priority: 'high' as const, system_info: 'chrome/mac', channel: 'web-ui' };

describe('capture-github — suggest', () => {
  it('scores + filters GH search results, demand from label', async () => {
    const { client, calls } = fakeClient({
      searchIssues: () => [
        { number: 7, title: 'Login times out on submit', body: '', state: 'open', url: 'u7', labels: ['bug', 'demand:4'] },
        { number: 8, title: 'Totally unrelated thing', body: '', state: 'open', url: 'u8', labels: ['bug'] },
      ],
    });
    const out = await ghSuggestDuplicates(client, 'Login times out', 'bug');
    assert.strictEqual(out.length, 1, 'only the similar one clears the threshold');
    assert.strictEqual(out[0].ghIssueNumber, 7);
    assert.strictEqual(out[0].demandCount, 4);
    assert.strictEqual(out[0].source, 'gh');
    assert.ok(calls.some(c => c[0] === 'searchIssues' && c[1].includes('label:bug')));
  });
});

describe('capture-github — create', () => {
  it('creates the issue, adds it to the board, and stamps the fields', async () => {
    const { client, calls } = fakeClient();
    const r = await ghCreateReportedBug(client, REPORT, '2026-07-13');
    assert.deepStrictEqual({ number: r.ghIssueNumber, demand: r.demandCount, source: r.source }, { number: 100, demand: 1, source: 'github' });
    assert.strictEqual(r.path, 'gh:100');
    // demand label on create
    const created = calls.find(c => c[0] === 'createIssue')![1];
    assert.deepStrictEqual(created.labels, ['bug', 'demand:1']);
    assert.ok(calls.some(c => c[0] === 'addIssueToProject'));
    const fieldsSet = Object.fromEntries(calls.filter(c => c[0] === 'setField').map(c => [c[1], c[2]]));
    assert.strictEqual(fieldsSet['Lifecycle'], 'new');
    assert.strictEqual(fieldsSet['Demand'], 1);
    assert.strictEqual(fieldsSet['Reported Dates'], '["2026-07-13"]');
    assert.strictEqual(fieldsSet['DocWright ID'], 'login-times-out');
    assert.strictEqual(fieldsSet['Priority'], 'high');
    assert.strictEqual(fieldsSet['Channel'], 'web-ui');
  });

  it('a missing OPTIONAL field is tolerated, but a missing load-bearing field fails', async () => {
    const okChannel = fakeClient({ failField: 'Channel' });
    await assert.doesNotReject(() => ghCreateReportedBug(okChannel.client, REPORT, '2026-07-13'));
    const badDemand = fakeClient({ failField: 'Demand' });
    await assert.rejects(() => ghCreateReportedBug(badDemand.client, REPORT, '2026-07-13'), /Demand/);
  });
});

describe('capture-github — confirm (two-way reconcile)', () => {
  it('+1 demand, appends today, bumps label + comments', async () => {
    const { client, calls } = fakeClient({
      items: [{ itemId: 'PVTI_9', issue: { number: 9, title: 't', body: '', state: 'open', url: 'u', labels: [] }, fields: { Demand: 4, 'Reported Dates': '["2026-07-01"]' } }],
    });
    const r = await ghConfirmDuplicate(client, 'gh:9', REPORT, '2026-07-13');
    assert.strictEqual(r.demandCount, 5);
    assert.strictEqual(r.ghIssueNumber, 9);
    const fieldsSet = Object.fromEntries(calls.filter(c => c[0] === 'setField').map(c => [c[1], c[2]]));
    assert.strictEqual(fieldsSet['Demand'], 5);
    assert.strictEqual(fieldsSet['Reported Dates'], '["2026-07-01","2026-07-13"]');
    assert.ok(calls.some(c => c[0] === 'addLabels' && c[2][0] === 'demand:5'));
    assert.ok(calls.some(c => c[0] === 'addComment' && c[1] === 9));
  });

  it('does not double-append a same-day report', async () => {
    const { client, calls } = fakeClient({
      items: [{ itemId: 'PVTI_9', issue: { number: 9, title: 't', body: '', state: 'open', url: 'u', labels: [] }, fields: { Demand: 1, 'Reported Dates': '["2026-07-13"]' } }],
    });
    await ghConfirmDuplicate(client, 9, REPORT, '2026-07-13');
    const dates = calls.filter(c => c[0] === 'setField' && c[1] === 'Reported Dates')[0][2];
    assert.strictEqual(dates, '["2026-07-13"]');
  });

  it('throws when the issue is not on the board', async () => {
    const { client } = fakeClient({ items: [] });
    await assert.rejects(() => ghConfirmDuplicate(client, 'gh:999', REPORT, '2026-07-13'), /not on the Project board/);
  });
});
