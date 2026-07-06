import assert from 'assert';
import { assemblePlan } from '../../src/webui/src/routes/api/approve-proposal/plan-generator';

// Regression guard for #108: approve→plan must not dump the proposal, must land as draft,
// must inherit priority/tags, and must not touch tests_defined.
describe('assemblePlan (approve→plan generation, #108)', () => {
  const base = {
    title: 'Widget overhaul',
    author: 'NetYeti',
    created: '2026-07-02',
    tags: ['governance', 'process'],
    priority: 'high',
    proposalSource: 'proposals/approved/widget-overhaul.md',
    planPath: 'plans/widget-overhaul.md',
    assigned: 'NetYeti',
    summary: 'Overhaul the widget subsystem.',
    steps: '| Step | Action | Details | Status |\n|--|--|--|--|\n| 1 | Do it | | ⏳ Pending |',
    testingPlan: '- [ ] it works',
    rollback: 'revert the PR',
    riskAssessment: 'low',
  };

  it('creates the plan as status: draft (never approved)', () => {
    const p = assemblePlan(base);
    assert.match(p, /^status: draft$/m);
    assert.doesNotMatch(p, /^status: approved$/m);
  });

  it('inherits priority from the proposal', () => {
    assert.match(assemblePlan(base), /^priority: high$/m);
    assert.match(assemblePlan({ ...base, priority: 'low' }), /^priority: low$/m);
  });

  it('emits tags as a YAML list, not a scalar string', () => {
    const p = assemblePlan(base);
    assert.match(p, /^tags:\n {2}- governance\n {2}- process$/m);
    assert.doesNotMatch(p, /^tags: governance, process$/m);
  });

  it('empty tags render as an empty list', () => {
    assert.match(assemblePlan({ ...base, tags: [] }), /^tags: \[\]$/m);
  });

  it('Overview is a summary + link, NOT a dump of the proposal body', () => {
    const p = assemblePlan(base);
    // links to the proposal for the full what/why
    assert.match(p, /\[\[proposals\/approved\/widget-overhaul\.md\]\]/);
    // includes the bounded summary
    assert.match(p, /Overhaul the widget subsystem\./);
    // exactly ONE H1 (the plan title) — the old bug duplicated it from the pasted proposal
    assert.strictEqual((p.match(/^# /gm) || []).length, 1);
    // no proposal-dump artifact (the old generator produced a "### Overview" under "## Overview")
    assert.doesNotMatch(p, /^### Overview$/m);
  });

  it('keeps tests_defined false (set only by run-tests / toggle)', () => {
    assert.match(assemblePlan(base), /^tests_defined: false$/m);
  });

  // The MCP plan generator (transitions.ts) writes `_path`; the UI generator omitted it,
  // so an out-of-band normalize later backfilled it → uncommitted churn on a governed plan
  // file (bug-plan-file-runtime-writeback-churn). Emit it at generation time so the plan is
  // complete and consistent from birth.
  it('writes _path so nothing backfills it later (matches transitions.ts)', () => {
    assert.match(assemblePlan(base), /^_path: plans\/widget-overhaul\.md$/m);
  });

  it('places the derived sections', () => {
    const p = assemblePlan(base);
    assert.match(p, /## Implementation Steps\n\n\| Step/);
    assert.match(p, /## Testing Plan\n\n- \[ \] it works/);
    assert.match(p, /## Rollback Procedures\n\nrevert the PR/);
    assert.match(p, /## Risk Assessment\n\nlow/);
  });
});
