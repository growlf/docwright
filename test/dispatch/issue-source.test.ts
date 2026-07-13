import assert from 'node:assert';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { readIssueDocs, readLocalIssueDocs, projectItemToDoc, getIssueSource } from '../../src/dispatch/issue-source';
import type { GitHubClient, ProjectItemDetail } from '../../src/dispatch/github-issues';

// GH-pivot Step 3: the flagged read layer. Local read (default) is byte-for-fm identical
// to reading issues/*.md; GH read reconstructs demand_count + EVERY reported_date so the
// heatmap math is unchanged (Bar B).

function tmpVault(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dw-issue-src-'));
  fs.mkdirSync(path.join(dir, 'issues'));
  fs.writeFileSync(path.join(dir, 'issues', 'bug-foo.md'),
    '---\ntitle: Foo breaks\nstatus: new\ncategory: bug\ndemand_count: 3\nreported_dates: [2026-07-01, 2026-07-05]\n---\n# Foo\n');
  return dir;
}

const ITEM: Pick<ProjectItemDetail, 'issue' | 'fields'> = {
  issue: { number: 42, title: 'Foo breaks', body: 'b', state: 'open', url: 'https://gh/42', labels: ['bug', 'demand:3'] },
  fields: { Lifecycle: 'triaged', Priority: 'high', Demand: 3, 'Reported Dates': '["2026-07-01","2026-07-05","2026-07-09"]', Channel: 'web-ui', 'DocWright ID': 'bug-foo' },
};

describe('issue-source — source flag', () => {
  it('defaults to local; github only when explicitly set', () => {
    assert.strictEqual(getIssueSource({} as any), 'local');
    assert.strictEqual(getIssueSource({ ISSUES_SOURCE: 'local' } as any), 'local');
    assert.strictEqual(getIssueSource({ ISSUES_SOURCE: 'github' } as any), 'github');
  });
});

describe('issue-source — local read', () => {
  it('reads issues/*.md as { path, fm }', () => {
    const dir = tmpVault();
    const docs = readLocalIssueDocs(dir);
    assert.strictEqual(docs.length, 1);
    assert.strictEqual(docs[0].path, path.join('issues', 'bug-foo.md'));
    assert.strictEqual(docs[0].fm.demand_count, 3);
  });

  it('readIssueDocs() defaults to local', async () => {
    const dir = tmpVault();
    const docs = await readIssueDocs(dir, { env: {} as any });
    assert.strictEqual(docs.length, 1);
    assert.strictEqual(docs[0].fm.title, 'Foo breaks');
  });
});

describe('issue-source — GH mapping (Bar B)', () => {
  it('projectItemToDoc reconstructs demand + EVERY reported date + lifecycle', () => {
    const doc = projectItemToDoc(ITEM)!;
    assert.strictEqual(doc.fm.status, 'triaged');           // from Lifecycle field
    assert.strictEqual(doc.fm.demand_count, 3);
    assert.deepStrictEqual(doc.fm.reported_dates, ['2026-07-01', '2026-07-05', '2026-07-09']); // all 3 kept
    assert.strictEqual(doc.fm.category, 'bug');             // from labels
    assert.strictEqual(doc.fm.github_issue, 42);
    assert.strictEqual(doc.path, 'issues/bug-foo.md');      // DocWright ID → stable path
  });

  it('falls back to gh-<number> path and open→new when DocWright ID / Lifecycle absent', () => {
    const doc = projectItemToDoc({ issue: { ...ITEM.issue!, labels: ['enhancement'] }, fields: {} })!;
    assert.strictEqual(doc.path, 'issues/gh-42.md');
    assert.strictEqual(doc.fm.status, 'new');
    assert.strictEqual(doc.fm.category, 'feature');
    assert.strictEqual(doc.fm.demand_count, 0);
    assert.deepStrictEqual(doc.fm.reported_dates, []);
  });

  it('readIssueDocs(github) maps board items via an injected client', async () => {
    const client = { listProjectItemsDetailed: async () => [ITEM] } as unknown as GitHubClient;
    const docs = await readIssueDocs('/unused', { env: { ISSUES_SOURCE: 'github' } as any, client });
    assert.strictEqual(docs.length, 1);
    assert.strictEqual(docs[0].fm.demand_count, 3);
  });

  it('degrades to local when github is selected but unconfigured (no client)', async () => {
    const dir = tmpVault();
    // env selects github but has no token/repo → makeClient() returns null → local.
    const docs = await readIssueDocs(dir, { env: { ISSUES_SOURCE: 'github' } as any, client: null as any });
    assert.strictEqual(docs.length, 1);
    assert.strictEqual(docs[0].path, path.join('issues', 'bug-foo.md'));
  });
});
