import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { execSync } from 'node:child_process';
import { loadEndpoint } from './sveltekit-shim';

/**
 * #148 — /api/write must run syncTestCriteria ONLY when the Implementation
 * Steps table actually changed. A plain save (prose edit, checkbox tick,
 * status flip) leaves the Testing Plan byte-identical; a step-table change
 * still syncs.
 */

const PLAN = `---
title: "Sync fixture"
status: in-progress
tests_defined: false
tests_human_reviewed: false
---

# Sync fixture

## Implementation Steps

| Step | Action | Details | Status |
|------|--------|---------|--------|
| 1 | First thing | details | ✅ Done |
| 2 | Second thing | details | ⏳ Pending |

## Testing Plan

### Step Verification

- [x] Step 1: First thing — reworded by a human, evidence cited
- [ ] Step 2: Second thing

## Document History

| Date | Change | Author |
|------|--------|--------|
`;

const USER = { displayName: 'Sync Tester', email: 'sync@example.com' };

function testingPlanOf(content: string): string {
  const m = content.match(/^## Testing Plan\n[\s\S]*?(?=^## )/m);
  return m ? m[0] : '';
}

async function save(POST: any, filePath: string, content: string) {
  return POST({
    url: new URL(`http://localhost/api/write?path=${encodeURIComponent(filePath)}`),
    request: { json: async () => ({ content }), headers: { get: () => null } },
    locals: { user: USER },
  } as any);
}

describe('/api/write syncTestCriteria gating (#148)', function () {
  this.timeout(20000);
  let vault: string;
  let POST: any;
  const originalEnv = process.env.DOCWRIGHT_ROOT;

  before(() => {
    vault = fs.mkdtempSync(path.join(os.tmpdir(), 'write-sync-'));
    fs.mkdirSync(path.join(vault, 'plans', 'completed'), { recursive: true });
    fs.writeFileSync(path.join(vault, 'plans', 'sync-fixture.md'), PLAN);
    fs.writeFileSync(path.join(vault, '.gitignore'), '.docwright/\n');
    execSync('git init -q -b main', { cwd: vault });
    execSync('git add -A && git -c user.name=Seed -c user.email=seed@example.com commit -qm "chore: seed"', { cwd: vault });
    process.env.DOCWRIGHT_ROOT = vault;
    ({ POST } = loadEndpoint('src/webui/src/routes/api/write/+server'));
  });

  after(() => {
    if (originalEnv === undefined) delete process.env.DOCWRIGHT_ROOT;
    else process.env.DOCWRIGHT_ROOT = originalEnv;
    fs.rmSync(vault, { recursive: true, force: true });
  });

  it('plain prose edit leaves the Testing Plan byte-identical', async () => {
    // The human-reworded Step 1 line doesn't match the table's action text —
    // the old unconditional sync would re-inject a phantom '- [ ] Step 1:'.
    const edited = PLAN.replace('# Sync fixture', '# Sync fixture\n\nNew overview prose.');
    const res = await save(POST, 'plans/sync-fixture.md', edited);
    assert.strictEqual(res.status, 200);
    const onDisk = fs.readFileSync(path.join(vault, 'plans', 'sync-fixture.md'), 'utf-8');
    assert.strictEqual(testingPlanOf(onDisk), testingPlanOf(PLAN));
    assert.ok(!onDisk.includes('- [ ] Step 1:'), 'phantom Step 1 line was re-injected');
  });

  it('step-table change still syncs a criterion for the new step', async () => {
    const current = fs.readFileSync(path.join(vault, 'plans', 'sync-fixture.md'), 'utf-8');
    const added = current.replace(
      '| 2 | Second thing | details | ⏳ Pending |',
      '| 2 | Second thing | details | ⏳ Pending |\n| 3 | Third thing | details | ⏳ Pending |',
    );
    const res = await save(POST, 'plans/sync-fixture.md', added);
    assert.strictEqual(res.status, 200);
    const onDisk = fs.readFileSync(path.join(vault, 'plans', 'sync-fixture.md'), 'utf-8');
    assert.ok(onDisk.includes('- [ ] Step 3: Third thing'));
  });

  it('never syncs against plans/completed/', async () => {
    const archived = PLAN.replace('status: in-progress', 'status: completed\ncompleted_date: 2026-07-01');
    fs.writeFileSync(path.join(vault, 'plans', 'completed', 'archived.md'), archived);
    // Even a step-table change on an archived plan must not rewrite anything
    const mutated = archived.replace('| 2 | Second thing |', '| 2 | Second thing, reworded |');
    const res = await save(POST, 'plans/completed/archived.md', mutated);
    assert.strictEqual(res.status, 200);
    const onDisk = fs.readFileSync(path.join(vault, 'plans', 'completed', 'archived.md'), 'utf-8');
    assert.strictEqual(testingPlanOf(onDisk), testingPlanOf(archived));
  });
});
