import assert from 'assert';
import { getReleaseReadiness } from '../../src/dispatch/release';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

describe('Release Readiness Calculations', () => {
  let tmpDir = '';

  function setupVault(): string {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'release-test-'));
    fs.mkdirSync(path.join(tmpDir, 'plans'));
    fs.mkdirSync(path.join(tmpDir, 'plans/completed'));
    fs.mkdirSync(path.join(tmpDir, 'issues'));
    return tmpDir;
  }

  function writeDoc(relPath: string, content: string): void {
    const abs = path.join(tmpDir, relPath);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, 'utf8');
  }

  function teardownVault(): void {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  beforeEach(() => setupVault());
  afterEach(() => teardownVault());

  it('calculates readiness correctly for a clean milestone', () => {
    writeDoc('plans/base-plan.md', [
      '---',
      'title: Milestone Base Plan',
      'status: in-progress',
      'milestone: v0.5.0',
      'created: 2026-06-01',
      'channel: dev',
      'priority: high',
      '---',
    ].join('\n'));

    writeDoc('issues/resolved-issue.md', [
      '---',
      'title: Resolved Issue',
      'status: resolved',
      'milestone: v0.5.0',
      'priority: high',
      '---',
    ].join('\n'));

    const readiness = getReleaseReadiness(tmpDir, 'v0.5.0');
    assert.strictEqual(readiness.milestone, 'v0.5.0');
    assert.strictEqual(readiness.channel, 'dev');
    assert.strictEqual(readiness.blockers.count, 0);
    assert.strictEqual(readiness.dogfoodWindow.passed, true);
    assert.strictEqual(readiness.burndown.resolved, 1);
    assert.strictEqual(readiness.burndown.open, 1);
    assert.strictEqual(readiness.burndown.passed, true);
    assert.strictEqual(readiness.ready, true);
  });

  it('blocks readiness when there are open blockers', () => {
    writeDoc('plans/base-plan.md', [
      '---',
      'title: Milestone Base Plan',
      'status: in-progress',
      'milestone: v0.5.0',
      'created: 2026-06-01',
      'channel: beta',
      '---',
    ].join('\n'));

    writeDoc('issues/blocking-bug.md', [
      '---',
      'title: Critical Bug',
      'status: open',
      'milestone: v0.5.0',
      'priority: high',
      '---',
    ].join('\n'));

    const readiness = getReleaseReadiness(tmpDir, 'v0.5.0');
    assert.strictEqual(readiness.channel, 'beta');
    assert.strictEqual(readiness.blockers.count, 1);
    assert.strictEqual(readiness.blockers.items[0].title, 'Critical Bug');
    assert.strictEqual(readiness.ready, false);
  });

  it('blocks readiness when dogfood window is too short', () => {
    const todayStr = new Date().toISOString().slice(0, 10);
    writeDoc('plans/new-plan.md', [
      '---',
      'title: New Plan',
      'status: in-progress',
      'milestone: v0.5.0',
      'created: ' + todayStr,
      '---',
    ].join('\n'));

    const readiness = getReleaseReadiness(tmpDir, 'v0.5.0');
    assert.strictEqual(readiness.dogfoodWindow.passed, false);
    assert.strictEqual(readiness.ready, false);
  });
});
