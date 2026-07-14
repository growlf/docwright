import assert from 'node:assert';
import { setFrontmatterMap, parseFrontmatter } from '../../src/dispatch/frontmatter';
import {
  buildGateEvidence, evaluateMachineCheckLive, machineCheckOf, parseBinding, GATE_CMD_ALLOWLIST,
  type LiveEffects,
} from '../../src/dispatch/gate-criteria';
import { checkCompletionGate } from '../../src/dispatch/completion-gate';

describe('frontmatter — setFrontmatterMap', () => {
  const doc = `---\ntitle: "T"\n# a comment line\npriority: high\n---\n\n# body\n`;
  it('writes a nested map and preserves other fields + comments; round-trips', () => {
    const out = setFrontmatterMap(doc, 'gate_evidence', { tests: { satisfied: true, detail: 'x' } });
    assert.match(out, /# a comment line/);
    assert.match(out, /priority: high/);
    const fm = parseFrontmatter(out);
    assert.deepStrictEqual(fm.gate_evidence, { tests: { satisfied: true, detail: 'x' } });
    assert.strictEqual(fm.title, 'T');
  });
  it('replaces an existing map block without leaking old keys or touching neighbours', () => {
    const withMap = setFrontmatterMap(doc, 'gate_evidence', { a: { satisfied: false, detail: 'old' } });
    const replaced = setFrontmatterMap(withMap, 'gate_evidence', { b: { satisfied: true, detail: 'new' } });
    const fm = parseFrontmatter(replaced);
    assert.deepStrictEqual(fm.gate_evidence, { b: { satisfied: true, detail: 'new' } });
    assert.strictEqual(fm.priority, 'high');
  });
});

describe('gate-criteria — machineCheckOf', () => {
  it('returns the check for tier 1 + the sub-check for human+check, null for human/unbound', () => {
    assert.strictEqual(machineCheckOf(parseBinding('tests_pass'))?.kind, 'tests_pass');
    assert.strictEqual(machineCheckOf(parseBinding('human+tests_pass'))?.kind, 'tests_pass');
    assert.strictEqual(machineCheckOf(parseBinding('human')), null);
    assert.strictEqual(machineCheckOf(null), null);
  });
});

describe('gate-criteria — evaluateMachineCheckLive', () => {
  it('file_exists uses the injected predicate', () => {
    const c = machineCheckOf(parseBinding('file_exists:policies/core/x.md'))!;
    assert.strictEqual(evaluateMachineCheckLive(c, { fileExists: () => true }).satisfied, true);
    assert.strictEqual(evaluateMachineCheckLive(c, { fileExists: () => false }).satisfied, false);
  });
  it('cmd uses the injected runner; a null (disallowed) result is not satisfied', () => {
    const c = machineCheckOf(parseBinding('cmd:typecheck'))!;
    assert.strictEqual(evaluateMachineCheckLive(c, { runCmd: () => ({ satisfied: true, detail: 'ok' }) }).satisfied, true);
    const disallowed = evaluateMachineCheckLive(c, { runCmd: () => null });
    assert.strictEqual(disallowed.satisfied, false);
    assert.match(disallowed.detail, /not allowed/);
  });
});

describe('gate-criteria — buildGateEvidence', () => {
  const body = `## Phase Gate
- [ ] (steps) all steps done — verify: steps_done
- [ ] (file) policy exists — verify: file_exists:policies/core/x.md
- [ ] (cmd) typechecks — verify: cmd:typecheck
- [ ] (rev) design sound — verify: human
- [ ] hand item

## Next
`;
  const fx: LiveEffects = {
    hasPendingSteps: false,
    fileExists: (p) => p.endsWith('x.md'),
    runCmd: (name) => (GATE_CMD_ALLOWLIST[name] ? { satisfied: true, detail: `cmd:${name} pass` } : null),
  };

  it('records only machine criteria (skips human/unbound), keyed by id, with stamp', () => {
    const { evidence, recorded, warnings } = buildGateEvidence(body, fx, { commit: 'abc123', ts: 'T0' });
    assert.deepStrictEqual(Object.keys(evidence).sort(), ['cmd', 'file', 'steps']);
    assert.strictEqual(evidence.steps.satisfied, true);
    assert.strictEqual(evidence.file.satisfied, true);
    assert.strictEqual(evidence.cmd.satisfied, true);
    assert.strictEqual(evidence.cmd.at, 'abc123');
    assert.strictEqual(recorded.length, 3);
    assert.strictEqual(warnings.length, 0);
  });

  it('merges onto existing evidence rather than clobbering', () => {
    const { evidence } = buildGateEvidence(body, fx, {}, { other: { satisfied: true, detail: 'kept' } as any });
    assert.ok(evidence.other && (evidence.other as any).detail === 'kept');
    assert.ok(evidence.steps);
  });

  it('warns when a machine criterion has no (id)', () => {
    const noId = `## Phase Gate\n- [ ] green — verify: tests_pass\n\n## Next\n`;
    const { recorded, warnings } = buildGateEvidence(noId, { frontmatter: { tests_last_result: 'pass' } });
    assert.strictEqual(recorded.length, 0);
    assert.strictEqual(warnings.length, 1);
    assert.match(warnings[0], /no \(id\)/);
  });
});

// The step-2 ↔ step-3 loop closes: recorded evidence lets checkCompletionGate satisfy a
// cmd:/file_exists: criterion it cannot evaluate itself (it is pure).
describe('gate-criteria — recorded evidence satisfies checkCompletionGate', () => {
  const plan = (gateEvidenceYaml: string) => `---
title: "T"
tests_defined: true
tests_human_reviewed: true
verification_type: none
${gateEvidenceYaml}
---

# T

## Phase Gate

- [ ] (cmd) typechecks — verify: cmd:typecheck

## Document History
`;
  it('unrecorded cmd criterion blocks; recorded-pass satisfies', () => {
    assert.match(checkCompletionGate(plan('depends_on: []'), 'p') ?? '', /not run yet|unsatisfied/);
    const recorded = plan('gate_evidence:\n  cmd:\n    satisfied: true\n    detail: ok');
    assert.strictEqual(checkCompletionGate(recorded, 'p'), null);
    const failed = plan('gate_evidence:\n  cmd:\n    satisfied: false\n    detail: nope');
    assert.ok(checkCompletionGate(failed, 'p'));
  });
});
