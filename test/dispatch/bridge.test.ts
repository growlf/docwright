import assert from 'assert';
import { suggestDuplicates, confirmDuplicate, createReportedBug, promoteIssueToGithub } from '../../src/dispatch/bridge';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

describe('Bug Reporting Bridge (suggest-style, two-phase)', () => {
  let tmpDir = '';

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-test-'));
    fs.mkdirSync(path.join(tmpDir, 'issues'));
  });
  afterEach(() => { if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true }); });

  const report = (over: Partial<any> = {}) => ({
    title: 'UI alignment issue on settings panel',
    description: 'Save button is cut off on mobile.',
    reporter: 'User A',
    ...over,
  });

  it('createReportedBug files a new bug with status: new and no milestone', () => {
    const res = createReportedBug(tmpDir, report({ priority: 'high', system_info: 'Linux, Node 20' }));
    assert.strictEqual(res.demandCount, 1);
    const content = fs.readFileSync(path.join(tmpDir, res.path), 'utf-8');
    assert.ok(content.includes('category: bug'));
    assert.ok(content.includes('status: new'), 'new issues start with status: new');
    assert.ok(!content.includes('milestone: future'), 'milestone not set on new issues');
    assert.ok(content.includes('priority: high'));
  });

  it('suggestDuplicates is read-only and returns similar open bugs (no write, no auto-merge)', () => {
    createReportedBug(tmpDir, report());
    const before = fs.readdirSync(path.join(tmpDir, 'issues')).length;
    const suggestions = suggestDuplicates(tmpDir, 'UI alignment issue on settings panel!!!', 'bug', () => []);
    const after = fs.readdirSync(path.join(tmpDir, 'issues')).length;
    assert.strictEqual(before, after, 'suggest must not write');
    assert.ok(suggestions.length >= 1);
    assert.ok(suggestions[0].score >= 0.5);
    assert.ok(suggestions[0].demandCount === 1);
    assert.strictEqual(suggestions[0].source, 'local');
  });

  it('does NOT suggest a genuinely different bug (never swallow distinct reports)', () => {
    createReportedBug(tmpDir, report());
    const suggestions = suggestDuplicates(tmpDir, 'Database replication lag under heavy write load', 'bug', () => []);
    assert.strictEqual(suggestions.length, 0);
  });

  it('confirmDuplicate increments demand AND harvests the new report context', () => {
    const first = createReportedBug(tmpDir, report());
    const res = confirmDuplicate(tmpDir, first.path, report({
      reporter: 'User B',
      description: 'Also happens on tablet in landscape.',
      system_info: 'iPad Safari',
    }));
    assert.strictEqual(res.demandCount, 2);
    const content = fs.readFileSync(path.join(tmpDir, first.path), 'utf-8');
    assert.ok(content.includes('demand_count: 2'));
    assert.ok(content.includes('Additional reports'), 'context section added');
    assert.ok(content.includes('User B'), 'reporter harvested');
    assert.ok(content.includes('tablet in landscape'), 'description harvested');
    assert.ok(content.includes('iPad Safari'), 'environment harvested');
  });

  it('createReportedBug records related associations without incrementing demand', () => {
    const first = createReportedBug(tmpDir, report());
    const res = createReportedBug(tmpDir, report({ title: 'Different but related layout glitch' }), [first.path]);
    const content = fs.readFileSync(path.join(tmpDir, res.path), 'utf-8');
    assert.ok(content.includes('related:'));
    assert.ok(content.includes(first.path));
    // the related canonical's demand is untouched (association, not a +1 lie)
    const firstContent = fs.readFileSync(path.join(tmpDir, first.path), 'utf-8');
    assert.ok(firstContent.includes('demand_count: 1'));
  });

  it('createReportedBug files a feature request with category: feature and a feature- prefixed filename', () => {
    const res = createReportedBug(tmpDir, report({
      title: 'Bulk-export issues to CSV',
      category: 'feature',
    }));
    assert.ok(res.path.startsWith(path.join('issues', 'feature-')), `expected feature- prefix, got ${res.path}`);
    const content = fs.readFileSync(path.join(tmpDir, res.path), 'utf-8');
    assert.ok(content.includes('category: feature'));
    assert.ok(content.includes('status: new'));
    assert.ok(content.includes('reported-feature'));
  });

  it('suggestDuplicates only matches within the same category (bug vs feature never cross-suggest)', () => {
    createReportedBug(tmpDir, report({ category: 'feature' }));
    const bugSuggestions = suggestDuplicates(tmpDir, 'UI alignment issue on settings panel', 'bug', () => []);
    assert.strictEqual(bugSuggestions.length, 0, 'a feature request must not surface as a bug duplicate');

    const featureSuggestions = suggestDuplicates(tmpDir, 'UI alignment issue on settings panel!!!', 'feature', () => []);
    assert.ok(featureSuggestions.length >= 1, 'the same-category feature request should still be suggested');
  });

  it('merges injected GitHub suggestions deterministically (no real gh call)', () => {
    // Regression for the flaky 2000ms timeout: suggestDuplicates used to shell out
    // to the real `gh issue list` (execSync). It now takes an injectable query, so
    // tests never hit the network and the gh path is covered deterministically.
    const fakeGh = () => [{ number: 42, title: 'UI alignment issue on settings panel' }];
    const suggestions = suggestDuplicates(tmpDir, 'UI alignment issue on settings panel', 'bug', fakeGh);
    const gh = suggestions.find(s => s.source === 'gh');
    assert.ok(gh, 'the injected GitHub issue should appear as a gh-source suggestion');
    assert.strictEqual(gh!.ghIssueNumber, 42);
  });

  // promoteIssueToGithub shells out to the real `gh` CLI -- these cases only cover the
  // guard logic that runs before that call, not live issue creation (never hit the
  // network from a test).
  describe('promoteIssueToGithub (guard logic only, never hits the network)', () => {
    it('throws if the issue is already linked to a GitHub issue', () => {
      const first = createReportedBug(tmpDir, report());
      let raw = fs.readFileSync(path.join(tmpDir, first.path), 'utf-8');
      raw = raw.replace(/^status: new$/m, 'status: new\ngithub_issue: 999');
      fs.writeFileSync(path.join(tmpDir, first.path), raw, 'utf-8');
      assert.throws(() => promoteIssueToGithub(tmpDir, first.path), /Already linked to GitHub issue #999/);
    });

    it('throws if the issue file does not exist', () => {
      assert.throws(() => promoteIssueToGithub(tmpDir, 'issues/does-not-exist.md'), /File not found/);
    });

    it('throws if issuePath escapes the issues/ directory', () => {
      assert.throws(() => promoteIssueToGithub(tmpDir, '../outside.md'), /must be under issues\//);
    });
  });
});
