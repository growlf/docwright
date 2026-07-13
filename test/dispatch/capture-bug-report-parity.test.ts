import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { createReportedBug } from '../../src/dispatch/bridge';
import { parseFrontmatter } from '../../src/dispatch/frontmatter';
import { lintDocument } from '../../src/dispatch/linter';
import type { ProfileConfig } from '../../src/dispatch/profile';

// #261: capture_bug_report must emit issue frontmatter that passes the SAME
// validation the pre-commit hook / dispatch linter runs — so a filed bug commits
// with zero hand-edits. This asserts parity, guarding against future drift between
// the tool's output and the linter's issue-status enum (which had gone stale).
const EMPTY_PROFILE = {} as ProfileConfig;

describe('capture_bug_report output — parity with the issue linter (#261)', () => {
  let root: string;
  beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'dw-cbr-')); });
  afterEach(() => { fs.rmSync(root, { recursive: true, force: true }); });

  // lintDocument() reads process.env.ISSUES_SOURCE; when it's 'github' the local issue-status
  // rule is retired (GH-pivot Step 8), so the "'open' is rejected" assertion below would
  // silently pass the wrong branch and fail only inside the dev instance (which runs
  // ISSUES_SOURCE=github). Pin the governed branch and restore the ambient value after.
  let _ambientIssuesSource: string | undefined;
  before(() => { _ambientIssuesSource = process.env.ISSUES_SOURCE; delete process.env.ISSUES_SOURCE; });
  after(() => {
    if (_ambientIssuesSource === undefined) delete process.env.ISSUES_SOURCE;
    else process.env.ISSUES_SOURCE = _ambientIssuesSource;
  });

  it('createReportedBug writes status: new and no milestone', () => {
    const { path: relPath } = createReportedBug(root, {
      title: 'Something is broken',
      description: 'It breaks when I do the thing.',
      reporter: 'agent',
      priority: 'medium',
      category: 'bug',
    });
    const fm = parseFrontmatter(fs.readFileSync(path.join(root, relPath), 'utf-8'));
    assert.strictEqual(fm.status, 'new', 'initial issue status is new (canonical), not open');
    assert.ok(fm.milestone === undefined, 'no milestone on a new issue — the hook forbids it before proposal-linked');
  });

  it('the created frontmatter passes the dispatch linter with zero errors', () => {
    const { path: relPath } = createReportedBug(root, {
      title: 'Another bug report',
      description: 'Reproduction steps here.',
      reporter: 'agent',
      category: 'bug',
    });
    const fm = parseFrontmatter(fs.readFileSync(path.join(root, relPath), 'utf-8'));
    // relPath is 'issues/bug-….md' — the linter keys its issue rules off that prefix
    const errors = lintDocument(relPath, fm, EMPTY_PROFILE).filter(r => r.severity === 'error');
    assert.deepStrictEqual(errors, [], `expected zero lint errors, got: ${JSON.stringify(errors)}`);
  });

  it('the linter accepts every canonical issue status and rejects a stale one', () => {
    const canonical = ['new', 'triaged', 'scope-checked', 'awaiting-proposal', 'proposal-linked', 'resolved', 'deferred', 'duplicate'];
    for (const status of canonical) {
      const statusResults = lintDocument('issues/x.md', { status }, EMPTY_PROFILE).filter(r => r.field === 'status');
      assert.deepStrictEqual(statusResults, [], `'${status}' should be a valid issue status`);
    }
    const stale = lintDocument('issues/x.md', { status: 'open' }, EMPTY_PROFILE);
    assert.ok(stale.some(r => r.field === 'status'), "'open' is no longer a valid issue status (matches the pre-commit hook)");
  });
});
