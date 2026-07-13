---
title: "Plan: Verified gate criteria — evidence-backed plan completion, not checkbox theater"
status: draft
author: "NetYeti"
created: "2026-07-13"
created_by: "NetYeti@phoenix"
tags: [planning]
proposal_source: "proposals/verified-gate-criteria-evidence-backed-completion"
priority: medium
phase: 
automated: guided
waiting_reason:  # Populated when status = waiting-for-user
assigned_to: ["NetYeti"]
# parent_plan: phase-N-overview.md   # filename of parent plan (omit if top-level)
# parent_deliverable: "1"            # row number in parent's Deliverables table
related_to: []
depends_on: []
blocks: []
reviewed_by:
reviewed_date:
canceled_date:  # Populated when plan is canceled
cancellation_reason:  # Populated when plan is canceled
template_version: "1.0"
tests_defined: true
tests_human_reviewed: false  # Set to true after human certifies AI-generated tests
# Gate fields — populated when a lifecycle gate applies to this document
gate_reviewer:  # Who must review (set automatically by gate rules)
gate_status:    # pending | approved | waived
gate_date:      # Stamped when gate_status is set
gate_note:      # Optional reviewer note
gate_reviews: []  # Phase 1a — array of {reviewer, role, status, date, note}
gate_quorum: 1    # Phase 1a — minimum approvals needed
---

# Plan: Verified gate criteria — evidence-backed plan completion, not checkbox theater

## Mode

Plan modes: `off` (mentorship), `guided` (agent drafts, human approves), `full` (autonomous).

**MENTORSHIP MODE — Human leads, LLM advises**

- Human carries out tasks their own way
- LLM provides SOP compliance checks and safety warnings
- LLM offers suggestions when human asks for help

## Overview

### Problem (this is a defect, not an enhancement)

Plan completion is gated on a Phase Gate / Gate Criteria checklist
(`src/dispatch/completion-gate.ts` → `checkCompletionGate`). Today that gate does exactly
one thing: it counts `- [ ]` vs `- [x]` and trusts whoever typed the `x`. That is broken in
two directions, and both were hit live on 2026-07-13 completing
`plans/roadmap-date-discipline`:

1. **The gate verifies nothing.** A checked box is taken as truth with zero confirmation that
   the underlying claim ("validator unit-tested", "`/status` surfaces violations") is actually
   satisfied. A human — or an AI — can check a box that isn't true and the gate waves it
   through. **A rubber-stamped gate is worse than no gate:** it manufactures false assurance
   and writes a lie into the audit trail. This directly contradicts DocWright's stated values
   — *"Test verified at every stage"* and *"Govern with code, not compliance"*
   ([[policies/core/code-over-memory]]).

2. **The criteria have no write path.** Nothing checks the boxes as the backing work lands
   (`update_step` only touches the Implementation Steps table), and the Web UI has no control
   to check them — `PropertiesPane.svelte` merely *counts* them and turns the count into a
   Complete blocker. So every plan dead-ends at completion: steps done, tests certified, yet
   Complete refuses with "N gate criteria unchecked" and no supported way to resolve it short
   of hand-editing plan markdown via `write_plan` (which the direct-edit hooks otherwise block).
   Tracked as growlf/docwright#407.

The real need, in the BDFL's words: *"verifying that the human correctly checked them should
be happening — the verification is the part we really need."* The value was never the tick; it
is whether the **claim behind the tick is true**.

### Proposed solution — a gate criterion is a verifiable claim, not a checkbox

Model each gate criterion as a *claim with a declared way to verify it*, resolved into three
tiers. Per [[policies/core/code-over-memory]] the default is **machine-derive everything that
can be; require a human only for what genuinely cannot.**

1. **Machine-verifiable → derived, never typed.** The criterion binds to observable evidence
   (a `tests_last_result: pass`, a CI status, a command exit code, a file's existence, a step's
   done-state). The box is *computed*: auto-checked when the evidence holds, **auto-unchecked
   when it stops holding**. Nobody types it; nobody can lie about it. Example: "validator + CLI
   unit-tested; `roadmap:check` green" ⇒ derive from the recorded test run + a `roadmap:check`
   invocation.

2. **Human-attested, machine cross-checked.** For judgment claims that still have evidence
   ("test coverage is adequate"), the human attests, but a validator confirms the attestation
   is **not contradicted** by evidence — e.g. you cannot certify "tests reviewed" while
   `tests_last_result: fail`. A check that contradicts observed reality is flagged and blocks.

3. **Pure judgment → ACL + audit + optional second reviewer.** Claims no machine can verify
   ("the design is sound") are safe-guarded not by trust but by: the attester holding the right
   role (ACL), the attestation recording **who + when + against which commit**, and — for
   high-stakes gates — a second independent reviewer ([[policies/core/multi-perspective-review]]).

**The AI's role (the connection the BDFL intuited).** Before a human signs off, the agent
**verifies each criterion against the actual artifacts and presents the evidence beside the
box** — "✅ 499 tests green @ f9abad9", "✅ `/status` returned the violation (response attached)"
— and **flags any box whose claim does not match what it observed.** The human then confirms a
*verified* claim instead of guessing. The same discipline runs in reverse: the validator catches
the agent checking something untrue exactly as it catches a human ([[policies/core/mutual-augmentation-cycle]]).

**Completion becomes:** every criterion is either machine-satisfied, human-attested-and-not-
contradicted, or ACL-attested-with-audit — with a supported write path (auto for tier 1; an
ACL-gated UI control routed through the sanctioned plan-write for tiers 2–3). No plan can reach
Complete via unverified ticks, and no plan can *dead-end* because a satisfied criterion had no
way to be recorded.

### Design decision to settle in the plan

How much is expressed as structured, machine-checkable criteria vs. free-text? Leaning: give
gate criteria an optional `verify:` binding (a named check the validator can run) in a
structured plan-steps-style schema; criteria without a binding fall to tier 3 (human + audit).
This dovetails with the deferred structured-plan-steps work ([[proposals/roadmap-discipline-carryover]]).

### Security implications

Strengthens the security posture: removes a false-assurance surface (the unverifiable gate),
makes every completion attestation evidence-backed and auditable (who/when/commit), and keeps
enforcement in code rather than convention. Tier-3 attestations must be ACL-gated so only
authorized roles can sign off; the audit record is append-only. No new bypass is introduced —
the machine-derived tiers *remove* a bypass.

### How this will be verified

- Unit: `checkCompletionGate` (and its tier resolver) pass/fail against fixtures for each tier —
  derived-true, derived-false, attested-consistent, attested-contradicted, judgment-with/without-ACL.
- Integration: gate parity — MCP and Web UI refuse/accept the same plan identically
  (extends `test/integration/gate-parity.test.ts`).
- Runtime (the real fix): from the Web UI, a plan with all steps done + tests green can be driven
  to Complete **with no manual markdown edit and no raw MCP call**, and a plan with a contradicted
  attestation is refused with the contradiction named.

### Relationship to existing issues

- **Subsumes** growlf/docwright#407 (Phase Gate boxes have no write path) — that is the tier-1/UI
  slice of this.
- **Relates to** #406 (dispatch env-coupling) and the structured-plan-steps carryover.
- Touches `src/dispatch/completion-gate.ts`, `PropertiesPane.svelte`, the plan schema, and the
  plan-review API.

### Future

Once criteria carry `verify:` bindings, the same evidence can render a live "why can't this
complete?" panel and feed the roadmap/burndown — a plan's real readiness, computed, not asserted.


## Implementation Steps

> When marking a task ✅ Complete, update every step row in this table
> to reflect what was actually built. Stale ⏳ rows mislead reviewers.

| Step | Action | Details | Status |
|------|--------|---------|--------|
| 1 | | | ⏳ Pending |

## Testing Plan



## Rollback Procedures



## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| | | | |

## Phase Gate

- [ ] All implementation steps resolved (delivered or formally deferred with captured proposals)
- [ ] Test coverage defined and human-reviewed (`tests_human_reviewed: true`)
- [ ] Deferred ideas captured as proposals before closing (see [[policies/core/capture-deferred-ideas.md]])
- [ ] Rollback procedures documented
- [ ] Risk assessment completed

## Testing Plan

### Step Verification

- [ ] All implementation steps complete and outcomes verified

### Integration & Regression

- [ ] Existing tests pass without modification (`npm test`)
- [ ] TypeScript compiles cleanly (`npm run typecheck`)
- [ ] Plan: Verified gate criteria — evidence-backed plan completion, not checkbox theater functionality works end-to-end

### Gate Criteria

- [ ] `tests_defined` set to `true` in frontmatter
- [ ] Human reviewer has verified step outcomes above
- [ ] No regressions introduced to adjacent workflows

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-07-13 | Created | NetYeti |
