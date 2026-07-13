import assert from 'node:assert';
import {
  parseLocalIssue, buildFields, buildLabels, buildBody, statusToLifecycle,
  planMigration, executeMigration, computeLinkRewrites,
  type LocalIssue, type ExistingGhIssue,
} from '../../src/dispatch/migrate-issues';
import type { GitHubClient } from '../../src/dispatch/github-issues';

// GH-pivot Step 5: lossless (Bar B), two-way, idempotent migration. Pure planning +
// builders tested here; executeMigration runs against a recording mock client.

function local(slug: string, fm: Record<string, any>, body = '# body\n\nsome text'): LocalIssue {
  const front = Object.entries(fm).map(([k, v]) => `${k}: ${Array.isArray(v) ? `[${v.join(', ')}]` : v}`).join('\n');
  return parseLocalIssue(`issues/${slug}.md`, `---\ntitle: ${fm.title}\n${front}\n---\n${body}`);
}

describe('migrate-issues — builders (Bar B fidelity)', () => {
  it('statusToLifecycle maps enum + folds unknowns', () => {
    assert.strictEqual(statusToLifecycle('proposal-linked'), 'proposal-linked');
    assert.strictEqual(statusToLifecycle('wont-fix'), 'resolved');
    assert.strictEqual(statusToLifecycle(''), 'new');
    assert.strictEqual(statusToLifecycle('weird'), 'triaged');
  });

  it('buildFields preserves demand + EVERY reported date', () => {
    const i = local('bug-x', { title: 'X', status: 'triaged', priority: 'high', demand_count: 5, reported_dates: ['2026-07-01', '2026-07-03', '2026-07-09'], channel: 'dev', scope_decision: 'in-scope' });
    const f = buildFields(i);
    assert.strictEqual(f['Lifecycle'], 'triaged');
    assert.strictEqual(f['Priority'], 'high');
    assert.strictEqual(f['Demand'], 5);
    assert.deepStrictEqual(JSON.parse(String(f['Reported Dates'])), ['2026-07-01', '2026-07-03', '2026-07-09']);
    assert.strictEqual(f['DocWright ID'], 'bug-x');
    assert.strictEqual(f['Channel'], 'dev');
    assert.strictEqual(f['Scope Decision'], 'in-scope');
  });

  it('buildLabels + buildBody carry category, demand, scope + related verbatim', () => {
    const i = local('feat-y', { title: 'Y', status: 'new', category: 'feature', demand_count: 2, scope_assessment: 'big', related: ['proposals/p.md'] }, '# Y\n\nwant this');
    assert.deepStrictEqual(buildLabels(i), ['enhancement', 'demand:2']);
    const body = buildBody(i);
    assert.ok(body.includes('want this'));
    assert.ok(body.includes('## Scope') && body.includes('big'));
    assert.ok(body.includes('## Related') && body.includes('proposals/p.md'));
    assert.ok(body.includes('Migrated from DocWright vault'));
  });
});

describe('migrate-issues — planMigration (two-way, no duplicates)', () => {
  const locals = [
    local('bug-a', { title: 'A bug', status: 'new', demand_count: 1, reported_dates: ['2026-07-01'] }),                 // novel
    local('bug-b', { title: 'B bug', status: 'resolved', demand_count: 3, reported_dates: ['2026-07-02'], github_issue: 50 }), // mirrored
    local('bug-c', { title: 'C bug', status: 'new', demand_count: 1, reported_dates: ['2026-07-03'] }),                 // title match
  ];
  const existing: ExistingGhIssue[] = [
    { number: 50, nodeId: 'I_50', title: 'B bug', labels: ['bug'] },
    { number: 77, nodeId: 'I_77', title: 'C bug', labels: ['bug'] },
  ];

  it('creates novel, updates mirrored, adopts title-match (never duplicates)', () => {
    const plan = planMigration(locals, existing, new Map());
    const byslug = Object.fromEntries(plan.actions.map(a => [a.slug, a]));
    assert.strictEqual(byslug['bug-a'].kind, 'create');
    assert.strictEqual(byslug['bug-b'].kind, 'update');
    assert.strictEqual(byslug['bug-b'].ghIssueNumber, 50);
    assert.strictEqual(byslug['bug-c'].kind, 'update');       // adopted by title
    assert.strictEqual(byslug['bug-c'].ghIssueNumber, 77);
    assert.deepStrictEqual(plan.summary, { create: 1, update: 2, skip: 0, total: 3 });
  });

  it('is idempotent: mirrored + on board + fields match → skip (a no-op re-run)', () => {
    const board = new Map<number, Record<string, string | number>>([
      [50, { Lifecycle: 'resolved', Priority: 'medium', Demand: 3, 'Reported Dates': '["2026-07-02"]', 'DocWright ID': 'bug-b' }],
    ]);
    const plan = planMigration([locals[1]], existing, board);
    assert.strictEqual(plan.actions[0].kind, 'skip');
  });

  it('an empty-title issue reconciles by slug (created title == match key — no duplicate)', () => {
    // Regression: empty title → created titled with the slug; the lookup must use the
    // same slug fallback, else a second run re-creates it.
    const noTitle = parseLocalIssue('issues/bug-empty.md', `---\nstatus: new\ndemand_count: 1\n---\n# body`);
    // First run against an empty GH → create, titled with the slug.
    const first = planMigration([noTitle], [], new Map());
    assert.strictEqual(first.actions[0].kind, 'create');
    assert.strictEqual(first.actions[0].title, 'bug-empty');
    // Second run: GH now has an issue titled with the slug → must reconcile, not duplicate.
    const second = planMigration([noTitle], [{ number: 5, nodeId: 'I_5', title: 'bug-empty', labels: [] }], new Map());
    assert.strictEqual(second.actions[0].kind, 'update');
    assert.strictEqual(second.actions[0].ghIssueNumber, 5);
  });

  it('same dates in a different order still count as matching (set compare)', () => {
    const i = local('bug-d', { title: 'D', status: 'new', demand_count: 2, reported_dates: ['2026-07-01', '2026-07-05'], github_issue: 90 });
    const ex: ExistingGhIssue[] = [{ number: 90, nodeId: 'I_90', title: 'D', labels: [] }];
    const board = new Map<number, Record<string, string | number>>([
      [90, { Lifecycle: 'new', Priority: 'medium', Demand: 2, 'Reported Dates': '["2026-07-05","2026-07-01"]', 'DocWright ID': 'bug-d' }],
    ]);
    assert.strictEqual(planMigration([i], ex, board).actions[0].kind, 'skip');
  });
});

describe('migrate-issues — executeMigration', () => {
  function mockClient() {
    const calls: any[] = [];
    let n = 200;
    const c: any = {
      createIssue: async (input: any) => { calls.push(['create', input.title]); return { number: ++n, nodeId: `I_${n}`, url: `https://gh/${n}`, title: input.title, body: input.body, state: 'open', labels: input.labels }; },
      addIssueToProject: async (node: string) => { calls.push(['addToProject', node]); return `PVTI_${node}`; },
      setProjectFieldByName: async (item: string, name: string, v: any) => { calls.push(['field', name, v]); },
      updateIssue: async (num: number, patch: any) => { calls.push(['update', num]); return { number: num }; },
      addLabels: async (num: number, labels: string[]) => { calls.push(['labels', num, labels]); },
    };
    return { client: c as unknown as GitHubClient, calls };
  }

  const plan = planMigration(
    [local('bug-a', { title: 'A', status: 'new', demand_count: 1, reported_dates: ['2026-07-01'] })],
    [], new Map(),
  );

  it('dry-run performs NO writes', async () => {
    const { client, calls } = mockClient();
    const r = await executeMigration(plan, client, { dryRun: true, repoUrlBase: 'https://gh' });
    assert.strictEqual(calls.length, 0, 'no client calls in dry-run');
    assert.strictEqual(r.created, 1);
    assert.strictEqual(r.dryRun, true);
  });

  it('execute creates the issue, places it on the board, sets fields', async () => {
    const { client, calls } = mockClient();
    const r = await executeMigration(plan, client, { dryRun: false, repoUrlBase: 'https://gh' });
    assert.strictEqual(r.created, 1);
    assert.ok(calls.some(c => c[0] === 'create'));
    assert.ok(calls.some(c => c[0] === 'addToProject'));
    const fields = calls.filter(c => c[0] === 'field').map(c => c[1]);
    assert.ok(fields.includes('Lifecycle') && fields.includes('Demand') && fields.includes('Reported Dates'));
    assert.ok(r.map['bug-a'].number >= 201);
  });
});

describe('migrate-issues — computeLinkRewrites', () => {
  const slugToUrl = { 'bug-a': { url: 'https://github.com/growlf/docwright/issues/201' } };
  it('rewrites wikilinks, .md paths, and bare paths', () => {
    const files = [
      { path: 'proposals/p.md', content: 'see [[issues/bug-a]] and issues/bug-a.md and also issues/bug-a here' },
      { path: 'plans/q.md', content: 'nothing to change' },
    ];
    const out = computeLinkRewrites(files, slugToUrl);
    assert.strictEqual(out.length, 1);
    assert.strictEqual(out[0].path, 'proposals/p.md');
    assert.strictEqual(out[0].changes, 3);
    assert.ok(!out[0].content.includes('issues/bug-a'));
    assert.ok(out[0].content.includes('https://github.com/growlf/docwright/issues/201'));
  });

  it('does not touch a slug that is a prefix of another', () => {
    const out = computeLinkRewrites([{ path: 'x.md', content: 'issues/bug-a-extended.md stays' }], slugToUrl);
    assert.strictEqual(out.length, 0);
  });
});
