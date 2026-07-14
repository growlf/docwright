import assert from 'node:assert';
import { checkCompletionGate, isReadyForHumanCompletion } from '../../src/dispatch/completion-gate';

// Verified gate criteria (step 2) — checkCompletionGate now resolves each gate criterion via
// gate-criteria.ts. Unbound criteria keep EXACT legacy behaviour; bound criteria are derived
// from / attested against evidence in the plan's own frontmatter.

// Minimal plan that passes the pre-gate checks (tests_defined/reviewed) and has no Testing Plan
// section, so the ONLY thing under test is the gate-criteria block. verification_type: none
// skips the separate tail test-evidence check, isolating the gate section.
const plan = (fmExtra: string, gateLines: string) => `---
title: "T"
tests_defined: true
tests_human_reviewed: true
verification_type: none
${fmExtra}
---

# T

## Phase Gate

${gateLines}

## Document History
`;

describe('completion-gate — backward compatibility (unbound criteria)', () => {
  it('unbound + checked ⇒ passes', () => {
    assert.strictEqual(checkCompletionGate(plan('', '- [x] done by hand'), 'p'), null);
  });
  it('unbound + unchecked ⇒ the EXACT legacy message', () => {
    assert.strictEqual(
      checkCompletionGate(plan('', '- [ ] not yet'), 'p'),
      "ERROR: Plan 'p' has 1 unchecked gate item. All Gate Criteria items must be checked [x] before the plan can be completed.",
    );
  });
  it('no gate section ⇒ the legacy "no Gate Criteria section" error', () => {
    const noGate = `---\ntitle: "T"\ntests_defined: true\ntests_human_reviewed: true\nverification_type: none\n---\n\n# T\n\n## Overview\nnothing\n`;
    assert.match(checkCompletionGate(noGate, 'p') ?? '', /no Gate Criteria section/);
  });
});

describe('completion-gate — machine-derived criteria (tier 1)', () => {
  it('tests_pass derives from frontmatter — an UNCHECKED box passes when the run is green', () => {
    assert.strictEqual(
      checkCompletionGate(plan('tests_last_result: pass', '- [ ] (t) validator green — verify: tests_pass'), 'p'),
      null,
    );
  });
  it('a failing machine criterion blocks with a per-criterion reason', () => {
    const err = checkCompletionGate(plan('tests_last_result: fail', '- [ ] (t) validator green — verify: tests_pass'), 'p');
    assert.match(err ?? '', /unsatisfied gate criterion/);
    assert.match(err ?? '', /tests_last_result: fail/);
  });
  it('a checked box does NOT override a failing machine check (no lying)', () => {
    const err = checkCompletionGate(plan('tests_last_result: fail', '- [x] (t) validator green — verify: tests_pass'), 'p');
    assert.ok(err, 'a checked-but-false machine criterion must still block');
  });
});

describe('completion-gate — human criteria (tiers 2 & 3)', () => {
  it('human criterion without an attestation blocks', () => {
    const err = checkCompletionGate(plan('', '- [ ] (rev) design is sound — verify: human'), 'p');
    assert.match(err ?? '', /awaiting human attestation/);
  });
  it('human criterion passes once attested (frontmatter gate_attestations)', () => {
    const fm = 'gate_attestations:\n  rev:\n    by: NetYeti\n    role: steward\n    commit: abc123';
    assert.strictEqual(checkCompletionGate(plan(fm, '- [ ] (rev) design is sound — verify: human'), 'p'), null);
  });
  it('tier-2 human+check blocks when the bound check is contradicted, even if attested', () => {
    const fm = 'tests_last_result: fail\ngate_attestations:\n  p:\n    by: NetYeti';
    const err = checkCompletionGate(plan(fm, '- [ ] (p) coverage adequate — verify: human+tests_pass'), 'p');
    assert.match(err ?? '', /contradicted/);
  });
});

describe('completion-gate — mixed unmet reports per-criterion (not the legacy count)', () => {
  it('lists each unmet criterion when any binding is involved', () => {
    const err = checkCompletionGate(
      plan('tests_last_result: fail', '- [ ] (t) green — verify: tests_pass\n- [ ] hand item'),
      'p',
    );
    assert.match(err ?? '', /unsatisfied gate criteria/);
    assert.match(err ?? '', /\(t\) green/);
  });
});

describe('completion-gate — isReadyForHumanCompletion (machine done, human pending)', () => {
  const body = plan('tests_last_result: pass', '- [ ] (t) green — verify: tests_pass\n- [ ] (rev) sound — verify: human');
  it('ready when tier-1 criteria are satisfied even though a human criterion is still pending', () => {
    assert.strictEqual(isReadyForHumanCompletion(body), true);
  });
  it('NOT ready when a machine criterion is unmet', () => {
    const failing = plan('tests_last_result: fail', '- [ ] (t) green — verify: tests_pass\n- [ ] (rev) sound — verify: human');
    assert.strictEqual(isReadyForHumanCompletion(failing), false);
  });
});
