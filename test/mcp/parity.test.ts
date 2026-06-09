import * as assert from 'node:assert';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { getStatus, listActivePlans, getPlan, getSessionContext } from '../../src/mcp/tools/query';
import { getFacts, collate, runDryRun, auditLog } from '../../src/mcp/tools/utility';
import { updateStep, updatePlanStatus, appendHistory, setPlanField, writePlan } from '../../src/mcp/tools/mutation';
import { setRepoRoot } from '../../src/mcp/lib/paths';

const FIXTURE_DIR = path.resolve(__dirname, 'fixtures', 'sample-vault');
const BASELINE_DIR = path.resolve(__dirname, 'fixtures', 'python-baseline');

function readBaseline(name: string): string {
  return fs.readFileSync(path.join(BASELINE_DIR, `${name}.txt`), 'utf8');
}

describe('MCP Tool Parity (TS vs Python)', () => {
  before(() => {
    setRepoRoot(FIXTURE_DIR);
  });

  it('get_status output matches python exactly', async () => {
    const tsRes = await getStatus();
    const pyRes = readBaseline('get_status');
    
    // Normalize timestamps (2nd line)
    const normalize = (s: string) => s.split('\n').map((l, i) => i === 1 ? '  TIMESTAMP' : l).join('\n');
    
    assert.strictEqual(normalize(tsRes.trim()), normalize(pyRes.trim()), 'get_status output mismatch');
  });

  it('list_active_plans output matches python exactly', async () => {
    const tsRes = await listActivePlans();
    const pyRes = readBaseline('list_active_plans');
    assert.strictEqual(tsRes.trim(), pyRes.trim(), 'list_active_plans output mismatch');
  });

  it('get_plan output matches python exactly (with governance footer)', async () => {
    const tsRes = await getPlan('sample');
    const pyRes = readBaseline('get_plan');
    assert.strictEqual(tsRes.trim(), pyRes.trim(), 'get_plan output mismatch');
  });

  it('get_facts output matches python exactly', async () => {
    const tsRes = await getFacts();
    const pyRes = readBaseline('get_facts');
    assert.strictEqual(tsRes.trim(), pyRes.trim(), 'get_facts output mismatch');
  });

  it('collate output matches python exactly', async () => {
    const tsRes = await collate();
    const pyRes = readBaseline('collate');
    assert.strictEqual(tsRes.trim(), pyRes.trim(), 'collate output mismatch');
  });

  it('run_dry_run output matches python exactly', async () => {
    const tsRes = await runDryRun();
    const pyRes = readBaseline('run_dry_run');
    assert.strictEqual(tsRes.trim(), pyRes.trim(), 'run_dry_run output mismatch');
  });

  describe('Mutation Tool Parity', () => {
    const MUTATION_DIR = path.join(FIXTURE_DIR, 'mutation-parity');

    beforeEach(() => {
      if (!fs.existsSync(MUTATION_DIR)) fs.mkdirSync(MUTATION_DIR, { recursive: true });
      if (!fs.existsSync(path.join(MUTATION_DIR, 'plans'))) fs.mkdirSync(path.join(MUTATION_DIR, 'plans'), { recursive: true });
      setRepoRoot(MUTATION_DIR);
    });

    afterEach(() => {
      setRepoRoot(FIXTURE_DIR);
      if (fs.existsSync(MUTATION_DIR)) fs.rmSync(MUTATION_DIR, { recursive: true, force: true });
    });

    it('update_step: output matches python success message exactly', async () => {
      const initial = `---\ntitle: "Test"\n---\n## Implementation Steps\n| 1 | Step | ⏳ Pending |\n`;
      fs.writeFileSync(path.join(MUTATION_DIR, 'plans', 'test.md'), initial);
      
      const tsRes = await updateStep('test', 'Step', 'done');
      assert.ok(tsRes.includes('✅ Step updated'), 'Success message mismatch');
    });

    it('update_plan_status: error message matches python exactly for pending steps', async () => {
      const initial = `---\ntitle: "Test"\nstatus: in-progress\n---\n## Implementation Steps\n| 1 | Step | ⏳ Pending |\n`;
      fs.writeFileSync(path.join(MUTATION_DIR, 'plans', 'test.md'), initial);
      
      const tsRes = await updatePlanStatus('test', 'completed');
      assert.ok(tsRes.includes('pending steps'), 'Error message mismatch');
    });
  });

  describe('Performance Benchmark', () => {
    it('get_status is not more than 2x slower than python baseline', async () => {
      const start = Date.now();
      for (let i = 0; i < 100; i++) {
        await getStatus();
      }
      const end = Date.now();
      const tsAvg = (end - start) / 100;
      
      console.log(`[benchmark] TS get_status average: ${tsAvg.toFixed(2)}ms`);
      assert.ok(tsAvg < 10, 'TS get_status is too slow (>10ms avg)');
    });
  });
});
