import assert from 'assert';
import { reportBug } from '../../src/dispatch/bridge';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

describe('Bug Reporting Bridge', () => {
  let tmpDir = '';

  function setupVault(): string {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-test-'));
    fs.mkdirSync(path.join(tmpDir, 'issues'));
    return tmpDir;
  }

  function teardownVault(): void {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  beforeEach(() => setupVault());
  afterEach(() => teardownVault());

  it('creates a new bug document when no duplicate exists', () => {
    const report = {
      title: 'Database connection timeout in production',
      description: 'The DB connection pool times out after 10 seconds under load.',
      reporter: 'NetYeti',
      priority: 'high' as const,
      system_info: 'Linux x86_64, Node v20',
    };

    const res = reportBug(tmpDir, report);
    assert.strictEqual(res.isDuplicate, false);
    assert.strictEqual(res.demandCount, 1);
    assert.ok(fs.existsSync(path.join(tmpDir, res.path)));

    const content = fs.readFileSync(path.join(tmpDir, res.path), 'utf-8');
    assert.ok(content.includes('title: Database connection timeout in production'));
    assert.ok(content.includes('status: open'));
    assert.ok(content.includes('category: bug'));
    assert.ok(content.includes('priority: high'));
    assert.ok(content.includes('demand_count: 1'));
  });

  it('detects a duplicate bug and increments the demand_count', () => {
    const report1 = {
      title: 'UI alignment issue on settings panel',
      description: 'The save button is cut off on mobile views.',
      reporter: 'User A',
      priority: 'low' as const,
    };

    const res1 = reportBug(tmpDir, report1);
    assert.strictEqual(res1.isDuplicate, false);

    // Report a similar bug
    const report2 = {
      title: 'UI alignment issue on settings panel!',
      description: 'Button cut off on mobile screen.',
      reporter: 'User B',
    };

    const res2 = reportBug(tmpDir, report2);
    assert.strictEqual(res2.isDuplicate, true);
    assert.strictEqual(res2.demandCount, 2);
    assert.strictEqual(res2.path, res1.path);

    const content = fs.readFileSync(path.join(tmpDir, res2.path), 'utf-8');
    assert.ok(content.includes('demand_count: 2'));
  });
});
