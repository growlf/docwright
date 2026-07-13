---
title: "Plan: Formalization cadence rule (repeated task → skill → script)"
status: draft
author: "NetYeti"
created: "2026-07-13"
created_by: "NetYeti@phoenix"
tags: [planning]
proposal_source: "proposals/formalization-cadence-rule"
priority: medium
phase: 
automated: full
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
tests_defined: false
tests_human_reviewed: false  # Set to true after human certifies AI-generated tests
# Gate fields — populated when a lifecycle gate applies to this document
gate_reviewer:  # Who must review (set automatically by gate rules)
gate_status:    # pending | approved | waived
gate_date:      # Stamped when gate_status is set
gate_note:      # Optional reviewer note
gate_reviews: []  # Phase 1a — array of {reviewer, role, status, date, note}
gate_quorum: 1    # Phase 1a — minimum approvals needed
---

# Plan: Formalization cadence rule (repeated task → skill → script)

## Mode

Plan modes: `off` (mentorship), `guided` (agent drafts, human approves), `full` (autonomous).

**MENTORSHIP MODE — Human leads, LLM advises**

- Human carries out tasks their own way
- LLM provides SOP compliance checks and safety warnings
- LLM offers suggestions when human asks for help

## Overview

### Summary

**Part A** of the split progressive-formalization proposal
([[proposals/progressive-skill-script-formalization]] — split per
[[docs/formalization-proposal-review]]). A lightweight, safe amendment to
[[.opencode/rules/one-off-formalization]]: give the existing "formalize repeated work" rule a
concrete **cadence** and a **detection surface**, hardened per the three-reviewer critique.
**Part B (the skill-writer / self-authored-tooling engine) is deferred** — it is a
trust/supply-chain surface and must bind to the authz generated-tooling review gate first; it
stays in the original proposal, not here. This proposal is safe to adopt on its own.

### Problem

`one-off-formalization` says "a one-off you've done before → file a formalization proposal" but
lacks a cadence and a reliable way to *notice* repetition. In practice the same multi-step flows
get re-derived by hand, burning tokens and risking inconsistency (the 2026-07-11..13 sessions ran
several flows 6–10× by hand).

### Proposed rule (hardened per review)

1. **Trigger = repetition AND stability, not raw count.** Consider formalizing when a flow ran
   **≥3×** *and* its shape was **unchanged between the last runs** *and* the substrate it wraps
   is **not an in-progress plan** (don't freeze a moving target). Count alone is insufficient.
2. **Detection from a structured event log, not prose.** Reuse the existing gitignored append-only
   substrate: a `.docwright/skill-usage.jsonl` (sibling to `audit.jsonl`). A skill's
   instrumentation is one deterministic "append a `skill_invoked` record" call — **not**
   self-tracking markdown (a static `.md` can't execute/self-count). A small aggregator surfaces
   candidates at session-start as **advisory, human-confirmed suggestions** (mirror
   `capture_bug_report` suggest→confirm), over a rolling window.
3. **Retirement path (a chute, not just a ratchet).** Record `last_used`; session-start also
   surfaces "skill X unused in N sessions — retire?" so the library doesn't sprawl.
4. **Form is a judgment call, decoupled from count.** The count *suggests considering*; the
   *form* (skill / npm script / dispatch fn / MCP tool) is chosen from `one-off-formalization`'s
   menu by the nature of the work. MCP tools (state mutations) need explicit human sign-off
   regardless of count.
5. **When NOT to formalize (explicit stop-list):** volatile substrate; high run-to-run variance;
   the flow is cheap to redo; the deterministic core can't be separated from judgment.
6. **Measured pilot first.** Baseline ONE settled flow (e.g. branch-per-fix) — steps/tokens for
   the manual version — and require the formalized version to beat it net of amortized
   authoring+maintenance before generalizing the rule.

### Security implications

Low. The usage log is gitignored operational telemetry (not governance state); detection is
advisory (never auto-creates); no new authorization surface. (Any move to *generate* tooling is
Part B, gated separately.)

### Verification

- `.docwright/skill-usage.jsonl` accrues `skill_invoked` records; the aggregator surfaces a
  repeated flow at session-start as a human-confirmed suggestion (not auto-action).
- The retirement prompt surfaces an unused skill.
- The pilot flow's measured step/token count drops net of authoring+maintenance.

### Related

- [[proposals/progressive-skill-script-formalization]] — the original (holds deferred Part B).
- [[docs/formalization-proposal-review]] — the three-perspective review this hardens.
- [[.opencode/rules/one-off-formalization]] — the rule this sharpens with a cadence.


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
- [ ] Plan: Formalization cadence rule (repeated task → skill → script) functionality works end-to-end

### Gate Criteria

- [ ] `tests_defined` set to `true` in frontmatter
- [ ] Human reviewer has verified step outcomes above
- [ ] No regressions introduced to adjacent workflows

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-07-13 | Created | NetYeti |
