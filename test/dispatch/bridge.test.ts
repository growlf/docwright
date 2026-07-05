import assert from 'assert';
import { suggestDuplicates, confirmDuplicate, createReportedBug } from '../../src/dispatch/bridge';
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

  it('createReportedBug files a new bug with milestone: future and no auto v0.5.0', () => {
    const res = createReportedBug(tmpDir, report({ priority: 'high', system_info: 'Linux, Node 20' }));
    assert.strictEqual(res.demandCount, 1);
    const content = fs.readFileSync(path.join(tmpDir, res.path), 'utf-8');
    assert.ok(content.includes('category: bug'));
    assert.ok(content.includes('milestone: future'), 'defaults to future, not v0.5.0');
    assert.ok(content.includes('priority: high'));
  });

  it('suggestDuplicates is read-only and returns similar open bugs (no write, no auto-merge)', () => {
    createReportedBug(tmpDir, report());
    const before = fs.readdirSync(path.join(tmpDir, 'issues')).length;
    const suggestions = suggestDuplicates(tmpDir, 'UI alignment issue on settings panel!!!');
    const after = fs.readdirSync(path.join(tmpDir, 'issues')).length;
    assert.strictEqual(before, after, 'suggest must not write');
    assert.ok(suggestions.length >= 1);
    assert.ok(suggestions[0].score >= 0.5);
    assert.ok(suggestions[0].demandCount === 1);
    assert.strictEqual(suggestions[0].source, 'local');
  });

  it('does NOT suggest a genuinely different bug (never swallow distinct reports)', () => {
    createReportedBug(tmpDir, report());
    const suggestions = suggestDuplicates(tmpDir, 'Database replication lag under heavy write load');
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
});
