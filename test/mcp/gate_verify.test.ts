import * as assert from 'node:assert';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { verifyGateCriteria, type CmdRunner } from '../../src/mcp/tools/gate_verify';
import { checkCompletionGate } from '../../src/mcp/lib/steps';
import { parseFrontmatter } from '../../src/dispatch/frontmatter';
import { GATE_CMD_ALLOWLIST } from '../../src/dispatch/gate-criteria';
import { setRepoRoot } from '../../src/mcp/lib/paths';

// A runner that honours the allowlist boundary but never spawns a real process.
const fakeRunner: CmdRunner = (name) =>
  GATE_CMD_ALLOWLIST[name] ? { satisfied: true, detail: `cmd:${name} pass` } : null;

const PLAN = `---
title: "Recorder Plan"
status: in-progress
tests_defined: true
tests_human_reviewed: true
verification_type: none
---

# Recorder Plan

## Implementation Steps

| Step | Action | Status |
| --- | --- | --- |
| 1 | Do it | ✅ Done |

## Phase Gate

- [ ] (cmd) typechecks — verify: cmd:typecheck
- [ ] (file) policy exists — verify: file_exists:policies/core/x.md
- [ ] (bad) disallowed — verify: cmd:rm-rf
- [ ] (rev) design sound — verify: human

## Document History

| Date | Change | Author |
| --- | --- | --- |
`;

describe('verify_gate_criteria (recorder)', () => {
  let tmp: string;
  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dw-gate-verify-'));
    fs.mkdirSync(path.join(tmp, 'plans'), { recursive: true });
    fs.mkdirSync(path.join(tmp, 'policies', 'core'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'package.json'), JSON.stringify({ scripts: {} }));
    fs.writeFileSync(path.join(tmp, 'plans', 'p.md'), PLAN);
    setRepoRoot(tmp);
  });
  afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

  const read = () => parseFrontmatter(fs.readFileSync(path.join(tmp, 'plans', 'p.md'), 'utf8'));

  it('records machine criteria into gate_evidence, keyed by id (skips human)', async () => {
    fs.writeFileSync(path.join(tmp, 'policies', 'core', 'x.md'), '# x');
    const res = await verifyGateCriteria('p', { runCmd: fakeRunner, fileExists: (a) => fs.existsSync(a), now: () => 'T0' });
    const ev = read().gate_evidence;
    assert.deepStrictEqual(Object.keys(ev).sort(), ['bad', 'cmd', 'file']); // no 'rev' (human)
    assert.strictEqual(ev.cmd.satisfied, true);
    assert.strictEqual(ev.file.satisfied, true);
    assert.match(res, /Recorded gate evidence/);
  });

  it('a disallowed cmd name records satisfied:false and never executes', async () => {
    const res = await verifyGateCriteria('p', { runCmd: fakeRunner, fileExists: () => false });
    const ev = read().gate_evidence;
    assert.strictEqual(ev.bad.satisfied, false); // cmd:rm-rf not in allowlist
    assert.match(JSON.stringify(ev.bad), /not allowed/);
    assert.match(res, /❌ \(bad\)/);
  });

  it('missing file_exists records satisfied:false', async () => {
    await verifyGateCriteria('p', { runCmd: fakeRunner, fileExists: (a) => fs.existsSync(a) });
    assert.strictEqual(read().gate_evidence.file.satisfied, false); // x.md not created here
  });

  it('recorded evidence lets the completion gate pass the cmd/file criteria', async () => {
    fs.writeFileSync(path.join(tmp, 'policies', 'core', 'x.md'), '# x');
    // Drop the disallowed + human criteria so the only gate items are the two now-satisfied ones.
    const trimmed = PLAN.replace('- [ ] (bad) disallowed — verify: cmd:rm-rf\n', '')
      .replace('- [ ] (rev) design sound — verify: human\n', '');
    fs.writeFileSync(path.join(tmp, 'plans', 'p.md'), trimmed);
    await verifyGateCriteria('p', { runCmd: fakeRunner, fileExists: (a) => fs.existsSync(a) });
    const text = fs.readFileSync(path.join(tmp, 'plans', 'p.md'), 'utf8');
    assert.strictEqual(checkCompletionGate(text, 'p'), null);
  });

  it('errors cleanly on a missing plan', async () => {
    const res = await verifyGateCriteria('ghost', { runCmd: fakeRunner });
    assert.match(res, /^ERROR/);
  });

  it('the allowlist contains no shell metacharacters (fixed, safe names)', () => {
    for (const [name, script] of Object.entries(GATE_CMD_ALLOWLIST)) {
      assert.match(name, /^[A-Za-z0-9:_-]+$/);
      assert.match(script, /^[A-Za-z0-9:_-]+$/);
    }
  });
});
