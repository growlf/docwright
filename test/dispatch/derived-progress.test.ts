import assert from 'assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { computeProgressFromIssues, hasLinkedIssues, getProgressCounts } from '../../src/mcp/lib/derived-progress';
import { setRepoRoot } from '../../src/mcp/lib/paths';

describe('Derived plan progress from issues', () => {
  const tmpDir = path.join(__dirname, '../../test-tmp-derived-progress');

  before(() => {
    setRepoRoot(tmpDir);
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true });
    }
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.mkdirSync(path.join(tmpDir, 'issues'), { recursive: true });
  });

  after(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  function createIssue(filename: string, status: string): void {
    const content = `---\ntitle: Test Issue\nstatus: ${status}\nauthor: Test\ncreated: 2026-01-01\nauthor-role: contributor\ncreated_by: Test@test\n---\n\nTest`;
    fs.writeFileSync(path.join(tmpDir, 'issues', filename), content);
  }

  describe('computeProgressFromIssues', () => {
    it('returns all zeros for empty list', () => {
      const result = computeProgressFromIssues([]);
      assert.deepStrictEqual(result, { total: 0, completed: 0, pending: 0 });
    });

    it('counts resolved issues as completed', () => {
      createIssue('test-resolved.md', 'resolved');
      createIssue('test-new.md', 'new');

      const result = computeProgressFromIssues(['issues/test-resolved.md', 'issues/test-new.md']);

      assert.strictEqual(result.total, 2);
      assert.strictEqual(result.completed, 1);
      assert.strictEqual(result.pending, 1);
    });

    it('treats missing issues as pending (conservative)', () => {
      const result = computeProgressFromIssues(['issues/nonexistent.md', 'issues/test-resolved.md']);

      assert.strictEqual(result.total, 2);
      assert.strictEqual(result.completed, 1);
      assert.strictEqual(result.pending, 1);
    });

    it('recognizes multiple resolved statuses', () => {
      createIssue('resolved.md', 'resolved');
      createIssue('completed.md', 'completed');
      createIssue('duplicate.md', 'duplicate');
      createIssue('deferred.md', 'deferred');
      createIssue('new.md', 'new');

      const result = computeProgressFromIssues([
        'issues/resolved.md',
        'issues/completed.md',
        'issues/duplicate.md',
        'issues/deferred.md',
        'issues/new.md',
      ]);

      assert.strictEqual(result.total, 5);
      assert.strictEqual(result.completed, 4);
      assert.strictEqual(result.pending, 1);
    });
  });

  describe('hasLinkedIssues', () => {
    it('returns false when tracked_by is absent', () => {
      const planContent = '---\ntitle: Test\n---\n';
      assert.strictEqual(hasLinkedIssues(planContent), false);
    });

    it('returns false when tracked_by is empty', () => {
      const planContent = '---\ntitle: Test\ntracked_by: []\n---\n';
      assert.strictEqual(hasLinkedIssues(planContent), false);
    });

    it('returns true when tracked_by has items', () => {
      const planContent = '---\ntitle: Test\ntracked_by:\n  - issues/test.md\n---\n';
      assert.strictEqual(hasLinkedIssues(planContent), true);
    });
  });

  describe('getProgressCounts', () => {
    it('returns zero counts for plan without issues', () => {
      const planContent = '---\ntitle: Test\n---\n';
      const result = getProgressCounts(planContent);
      assert.deepStrictEqual(result, { total: 0, completed: 0, pending: 0 });
    });

    it('computes counts from tracked_by issues', () => {
      createIssue('progress-test-1.md', 'resolved');
      createIssue('progress-test-2.md', 'new');
      createIssue('progress-test-3.md', 'resolved');

      const planContent = `---\ntitle: Test\ntracked_by:\n  - issues/progress-test-1.md\n  - issues/progress-test-2.md\n  - issues/progress-test-3.md\n---\n`;
      const result = getProgressCounts(planContent);

      assert.strictEqual(result.total, 3);
      assert.strictEqual(result.completed, 2);
      assert.strictEqual(result.pending, 1);
    });
  });
});
