import * as assert from 'node:assert';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { verifyPlanTests, TestRunner } from '../../src/mcp/tools/verify_tests';
import { updatePlanStatus } from '../../src/mcp/tools/mutation';
import { transitionToCompleted } from '../../src/mcp/tools/transitions';
import { uncheckedTestingPlanBoxes, checkCompletionGate } from '../../src/mcp/lib/steps';
import { setRepoRoot } from '../../src/mcp/lib/paths';

const passRunner: TestRunner = () => ({ ok: true, outputTail: '12 passing' });
const failRunner: TestRunner = () => ({ ok: false, outputTail: '1 failing' });

function planDoc(opts: {
  status?: string;
  testsDefined?: boolean;
  testsReviewed?: boolean;
  lastResult?: string;
  openBox?: boolean;
}): string {
  return [
    '---',
    'title: "Gate Test Plan"',
    `status: ${opts.status ?? 'in-progress'}`,
    `tests_defined: ${opts.testsDefined ?? true}`,
    `tests_human_reviewed: ${opts.testsReviewed ?? true}`,
    ...(opts.lastResult ? [`tests_last_result: ${opts.lastResult}`] : []),
    '---',
    '## Implementation Steps',
    '| Step | Action | Status |',
    '| --- | --- | --- |',
    '| 1 | Do the thing | ✅ Done |',
    '',
    '## Testing Plan',
    '',
    '- [x] Step 1 verified (some.test.ts)',
    ...(opts.openBox ? ['- [ ] Step 2 never verified'] : ['- [x] Step 2 verified']),
    '',
    '### Gate Criteria',
    '',
    '- [x] Gate signed off',
    '',
    '## Document History',
    '| Date | Change | Author |',
    '| --- | --- | --- |',
    '',
  ].join('\n');
}

describe('verify_plan_tests + completion test gate', () => {
  let tmpRoot: string;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dw-verify-'));
    fs.mkdirSync(path.join(tmpRoot, 'plans', 'completed'), { recursive: true });
    fs.mkdirSync(path.join(tmpRoot, 'docs'), { recursive: true });
    fs.mkdirSync(path.join(tmpRoot, '.docwright'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpRoot, 'package.json'),
      JSON.stringify({ scripts: { test: 'mocha', 'test:mcp': 'mocha test/mcp' } }),
    );
    setRepoRoot(tmpRoot);
  });

  afterEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  function writePlanFile(name: string, content: string) {
    fs.writeFileSync(path.join(tmpRoot, 'plans', name), content);
  }
  function readPlanFile(name: string): string {
    return fs.readFileSync(path.join(tmpRoot, 'plans', name), 'utf8');
  }

  describe('verifyPlanTests', () => {
    it('records a passing run: frontmatter stamps + history row', async () => {
      writePlanFile('p.md', planDoc({}));
      const res = await verifyPlanTests('p', 'test', passRunner);
      assert.ok(res.startsWith('✅'), res);
      const updated = readPlanFile('p.md');
      assert.ok(updated.includes('tests_last_result: pass'));
      assert.ok(updated.includes('tests_last_run:'));
      assert.ok(updated.match(/verify_plan_tests: npm test → PASS/));
    });

    it('records a failing run and says the gate will refuse', async () => {
      writePlanFile('p.md', planDoc({}));
      const res = await verifyPlanTests('p', 'test', failRunner);
      assert.ok(res.startsWith('❌'), res);
      assert.ok(res.includes('completion gate will refuse'));
      assert.ok(readPlanFile('p.md').includes('tests_last_result: fail'));
    });

    it('warns about unchecked Testing Plan boxes even on a green run', async () => {
      writePlanFile('p.md', planDoc({ openBox: true }));
      const res = await verifyPlanTests('p', 'test', passRunner);
      assert.ok(res.includes('still unchecked'), res);
    });

    it('rejects script names not defined in package.json', async () => {
      writePlanFile('p.md', planDoc({}));
      const res = await verifyPlanTests('p', 'not-a-script', passRunner);
      assert.ok(res.startsWith('ERROR'), res);
      assert.ok(res.includes('Available:'));
    });

    it('rejects shell-metacharacter script names outright', async () => {
      writePlanFile('p.md', planDoc({}));
      const res = await verifyPlanTests('p', 'test; rm -rf /', passRunner);
      assert.ok(res.startsWith('ERROR: invalid script name'), res);
    });

    it('errors cleanly on a missing plan', async () => {
      const res = await verifyPlanTests('ghost', 'test', passRunner);
      assert.ok(res.startsWith('ERROR'), res);
    });
  });

  describe('completion gate: recorded run required', () => {
    it('update_plan_status → completed refuses with no recorded test run', async () => {
      writePlanFile('p.md', planDoc({}));
      const res = await updatePlanStatus('p', 'completed');
      assert.ok(res.includes('no recorded test run'), res);
    });

    it('refuses with a recorded FAILING run', async () => {
      writePlanFile('p.md', planDoc({ lastResult: 'fail' }));
      const res = await updatePlanStatus('p', 'completed');
      assert.ok(res.includes('tests_last_result=fail'), res);
    });

    it('refuses with an unchecked Testing Plan box, naming it', async () => {
      writePlanFile('p.md', planDoc({ lastResult: 'pass', openBox: true }));
      const res = await updatePlanStatus('p', 'completed');
      assert.ok(res.includes('unchecked Testing Plan item'), res);
      assert.ok(res.includes('Step 2 never verified'), res);
    });

    it('allows completion with green run + fully-checked Testing Plan', async () => {
      writePlanFile('p.md', planDoc({ lastResult: 'pass' }));
      const res = await updatePlanStatus('p', 'completed');
      assert.ok(res.includes('✅') || res.toLowerCase().includes('completed'), res);
      assert.ok(readPlanFile('p.md').includes('status: completed'));
    });

    it('transition_to_completed enforces the same gate on hand-set status', async () => {
      // status: completed written directly (predates gate / hand-edit) — archival must still refuse
      writePlanFile('p.md', planDoc({ status: 'completed' }));
      const res = await transitionToCompleted('p');
      assert.ok(res.includes('no recorded test run'), res);
      assert.ok(!fs.existsSync(path.join(tmpRoot, 'plans', 'completed', 'p.md')));
    });

    it('transition_to_completed archives when evidence is green', async () => {
      writePlanFile('p.md', planDoc({ status: 'completed', lastResult: 'pass' }));
      const res = await transitionToCompleted('p');
      assert.ok(res.includes("✅ Plan 'p.md' completed"), res);
      assert.ok(fs.existsSync(path.join(tmpRoot, 'plans', 'completed', 'p.md')));
    });

    it('warns (without blocking) when the green run predates HEAD', async () => {
      const { execSync } = await import('node:child_process');
      execSync(
        'git init -q && git -c user.email=t@t -c user.name=t commit -q --allow-empty -m x',
        { cwd: tmpRoot },
      );
      const doc = planDoc({ status: 'completed', lastResult: 'pass' }).replace(
        'tests_last_result: pass',
        'tests_last_result: pass\ntests_last_commit: abc1234',
      );
      writePlanFile('p.md', doc);
      const res = await transitionToCompleted('p');
      assert.ok(res.includes("✅ Plan 'p.md' completed"), res);
      assert.ok(res.includes('Test evidence is stale'), res);
      assert.ok(res.includes('abc1234'), res);
    });
  });

  describe('uncheckedTestingPlanBoxes / checkCompletionGate units', () => {
    it('finds open boxes only inside the Testing Plan section', () => {
      const text = '## Overview\n- [ ] not a test box\n\n## Testing Plan\n- [ ] open one\n- [x] done\n\n## Rollback\n- [ ] also not counted\n';
      const boxes = uncheckedTestingPlanBoxes(text);
      assert.deepStrictEqual(boxes, ['- [ ] open one']);
    });

    it('gate passes a fully-green plan document', () => {
      assert.strictEqual(checkCompletionGate(planDoc({ lastResult: 'pass' }), 'p'), null);
    });

    // #315 — verification_type relaxes the unit-run requirement for plans that
    // have no relevant unit suite (infra/deployment/docs).
    const inject = (extra: string) => planDoc({}).replace('title: "Gate Test Plan"', `title: "Gate Test Plan"\n${extra}`);

    it('unit (default) still requires a recorded green run', () => {
      const err = checkCompletionGate(planDoc({}), 'p'); // no tests_last_result
      assert.ok(err && err.includes('no recorded test run'), `expected the unit-run requirement, got: ${err}`);
    });

    it('verification_type: none completes with no recorded run (#315)', () => {
      assert.strictEqual(checkCompletionGate(inject('verification_type: none'), 'p'), null);
    });

    it('verification_type: runtime requires runtime_verified: true (#315)', () => {
      const missing = checkCompletionGate(inject('verification_type: runtime'), 'p');
      assert.ok(missing && missing.includes('runtime_verified'), `expected the runtime attestation requirement, got: ${missing}`);
      const attested = checkCompletionGate(inject('verification_type: runtime\nruntime_verified: true'), 'p');
      assert.strictEqual(attested, null, 'runtime_verified: true satisfies the gate');
    });
  });
});
