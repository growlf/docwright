import * as assert from 'node:assert';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { getStatus, listActivePlans, getPlan, getSessionContext, resetStatusCache } from '../../src/mcp/tools/query';
import { getFacts, collate, runDryRun, auditLog } from '../../src/mcp/tools/utility';
import { updateStep, updatePlanStatus, appendHistory, setPlanField, writePlan } from '../../src/mcp/tools/mutation';
import { setRepoRoot } from '../../src/mcp/lib/paths';

const FIXTURE_DIR = path.resolve(__dirname, 'fixtures', 'parity-vault');
const BASELINE_DIR = path.resolve(__dirname, 'fixtures', 'python-baseline');

function readBaseline(name: string): string {
  return fs.readFileSync(path.join(BASELINE_DIR, `${name}.txt`), 'utf8');
}

describe('MCP Tool Parity (TS vs Python)', () => {
  before(() => {
    const SAMPLE = path.resolve(__dirname, 'fixtures', 'sample-vault');
    if (!fs.existsSync(FIXTURE_DIR)) fs.mkdirSync(FIXTURE_DIR, { recursive: true });
    // Copy sample-vault content to parity-vault
    const copyRecursive = (src: string, dest: string) => {
      if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
      fs.readdirSync(src).forEach(file => {
        const s = path.join(src, file);
        const d = path.join(dest, file);
        if (fs.statSync(s).isDirectory()) copyRecursive(s, d);
        else fs.copyFileSync(s, d);
      });
    };
    copyRecursive(SAMPLE, FIXTURE_DIR);
  });

  beforeEach(() => {
    setRepoRoot(FIXTURE_DIR);
    resetStatusCache();
  });

  it('get_status output matches python exactly', async () => {
    const tsRes = await getStatus();
    const pyRes = readBaseline('get_status');
    const normalize = (s: string) => s.split('\n').map((l, i) => i === 1 ? '  TIMESTAMP' : l).join('\n');
    assert.strictEqual(normalize(tsRes.trim()), normalize(pyRes.trim()));
  });

  it('list_active_plans output matches python exactly', async () => {
    const tsRes = await listActivePlans();
    const pyRes = readBaseline('list_active_plans');
    assert.strictEqual(tsRes.trim(), pyRes.trim());
  });

  it('get_plan output matches python exactly', async () => {
    const tsRes = await getPlan('sample');
    const pyRes = readBaseline('get_plan');
    assert.strictEqual(tsRes.trim(), pyRes.trim());
  });

  it('get_facts output matches python exactly', async () => {
    const tsRes = await getFacts();
    const pyRes = readBaseline('get_facts');
    assert.strictEqual(tsRes.trim(), pyRes.trim());
  });

  it('collate output matches python exactly', async () => {
    const tsRes = await collate();
    const pyRes = readBaseline('collate');
    assert.strictEqual(tsRes.trim(), pyRes.trim());
  });

  it('run_dry_run output matches python exactly', async () => {
    const tsRes = await runDryRun();
    const pyRes = readBaseline('run_dry_run');
    assert.strictEqual(tsRes.trim(), pyRes.trim());
  });
});
