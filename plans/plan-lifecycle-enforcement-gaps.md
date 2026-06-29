---
title: Plan Lifecycle Enforcement Gaps — MCP, Hook, and Agent Process Gaps
status: in-progress
author: NetYeti
created: 2026-06-28
tags:
proposal_source: proposals/approved/plan-lifecycle-enforcement-gaps.md
priority: medium
automated: full
assigned_to: NetYeti
tests_defined: true
tests_human_reviewed: false
_path: plans/plan-lifecycle-enforcement-gaps.md
scenario_synthesis: "Happy path: MCP update_plan_status rejects in-progress transition when steps are placeholder; rejects completed transition when testing plan is TBD; pre-commit hook mirrors both checks at the git layer. Failure path: direct file edits with placeholder steps or TBD sections are blocked at commit time; session-start flags offending plans upfront so the gap is visible before work begins."
total_steps: 6
completed_steps: 6
---

# Plan Lifecycle Enforcement Gaps — MCP, Hook, and Agent Process Gaps

## Overview

*Plan generated from approved proposal: Plan Lifecycle Enforcement Gaps — MCP, Hook, and Agent Process Gaps*

### Problem

Two plans shipped with broken governance trails in the same session, revealing systemic gaps in lifecycle enforcement:

1. **`governance-engine-view-container`** — code was built and shipped under a different plan (`ui-layout-view-container-refactor`, Step 11). The dedicated plan sat as an orphaned scaffold with one empty placeholder step. Nothing caught this.

2. **`plugin-system`** — steps were marked done but the Testing Plan section was never populated (`_Testing plan TBD_`) and gate criteria were never signed off before the session ended. The plan was pushed through without finishing the governance trail.

**Root cause:** enforcement exists at the wrong layer or not at all.

- The pre-commit hook validates commit format and frontmatter fields, but does NOT check whether Implementation Steps are real vs placeholder before allowing `status: in-progress`.
- The MCP `update_plan_status` tool checks gate criteria checkboxes, but does NOT check whether the Testing Plan section has actual content vs `_TBD_`.
- Nothing checks whether a plan being worked is the *correct* plan for the work being done — work can drift to a related plan and leave the original orphaned.
- Session-start does not flag `approved` plans with empty/placeholder steps as requiring attention before new work begins.
- AI agents have no hard stop when they attempt to start a plan with no real steps.

**Systemic impact:** these gaps compound. A plan with placeholder steps enters the pipeline unchallenged. Work proceeds under a sibling plan while the original stays orphaned. Testing is deferred to TBD. The plan exits with an incomplete trail. Without layered enforcement every session repeats this cycle — the gaps are invisible until audit, and by then the trail is cold.

This will keep happening. Every session that touches a plan with empty steps or a TBD testing plan is a governance liability.

### Out of Scope

- **Retroactive remediation of existing plans** with placeholder steps or TBD testing sections. The two incident plans and any others in the same state will be handled under a separate remediation proposal. This covers forward enforcement only.
- **CI pipeline validation.** A CI-side plan health check is noted in Future but requires infrastructure changes outside the MCP/hook/skill layer targeted here.
- **Human workflow enforcement.** This proposal covers only automated code-level enforcement, not peer review, training, or managerial oversight of the lifecycle.
- **Non-status transitions.** Only `in-progress` and `completed` transitions are gated. Approval, cancellation, and review transitions have different validation needs and are left for separate scoping.

### Alternatives Considered

**Warn instead of block at the MCP layer** — rejected. Warnings have been tried implicitly (the TBD sections exist as visible gaps) and humans and AI alike ignore them under time pressure. Hard errors are the only reliable mechanism.

**Only fix the hook** — rejected. The pre-commit hook fires at commit time, after the work is already done. The MCP layer fires at transition time, which is earlier and more actionable. Both are needed; neither alone is sufficient.

**Rely on better AI discipline** — explicitly rejected per `policies/core/code-over-memory.md`. Memory and discipline are known failure modes.

### Verification

Each layer must be independently verifiable:

1. **MCP gates**: unit tests for `in-progress` and `completed` validation covering normal, placeholder-step, and TBD-testing-plan cases.
2. **Pre-commit hook**: commit a plan with placeholder steps and `status: in-progress` — must fail. Commit with filled steps and testing plan — must pass.
3. **`write_plan` warning**: assert the warning string appears in tool response when scaffolding a plan with empty steps.
4. **Session-start health check**: start a session with a known-bad approved plan — the warning must surface in session context.
5. **Integration scenario**: simulate the exact `plugin-system` incident — attempt to mark a plan complete with TBD testing section — must be rejected at both MCP and hook layers.

### Future

- Auto-generate a stub Testing Plan section when `write_plan` creates a plan from a proposal, so it's never literally TBD from day one.
- A `validate_plan` MCP tool that runs all health checks on demand and returns a structured report — useful for session-start and CI.
- CI check: scan all `plans/*.md` for empty steps or TBD testing plans and fail the build. Makes the gaps visible in PRs before they accumulate.

### Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-28 | AI-improved via Improve | NetYeti |


## Implementation Steps

| Step | Action | Details | Status |
|------|--------|---------|--------|
| 1 | Gate plan status transitions | Reject `in-progress` if steps are placeholders; reject `completed` if Testing Plan is TBD | ✅ Done |
| 2 | Mirror MCP in pre-commit hook | Emit hard errors for same validations in pre-commit to prevent direct-file-edit bypass | ✅ Done |
| 3 | Emit empty-step warnings | Warn in `write_plan` when steps are empty without blocking scaffolding | ✅ Done |
| 4 | Surface health at session-start | Warn for approved plans with empty steps or in-progress plans with TBD testing | ✅ Done |
| 5 | Update AGENTS.md + profiles | Add explicit pre-flight checks before working a plan | ✅ Done |
| 6 | Keyword-overlap detection | Flag when work on Plan A matches approved Plan B | ✅ Done |

## Testing Plan

### Step Verification
- [x] Step 1: Gate plan status transitions — `npm run test:mcp` passes; unit tests cover placeholder-step rejection and TBD-testing-plan rejection
- [x] Step 2: Mirror MCP in pre-commit hook — `validate_plan_in_progress_steps` and `validate_testing_plan_not_tbd` added to `.githooks/pre-commit`; wired into main loop
- [x] Step 3: Emit empty-step warnings — `writePlan` returns `⚠ Warning: placeholder steps` without blocking; unit test verifies
- [x] Step 4: Surface health at session-start — `scripts/plan-health.js` created; session-start skill updated with Step 2.5; `node scripts/plan-health.js` ran against live vault and produced output
- [x] Step 5: Update AGENTS.md + profiles — AGENTS.md pre-flight checklist added; `src/profiles/org-operations/opencode-instructions.md` updated with pre-flight section
- [x] Step 6: Keyword-overlap detection — `planOverlapReport()` added to `src/mcp/lib/collate.ts`; 3 unit tests cover threshold, empty, and same-status cases; live vault run detected real overlap (`contribution-pipeline` vs `plan-lifecycle-enforcement-gaps`)

- [x] **Step 1** — Unit test: `updatePlanStatus('in-progress')` with placeholder steps returns `ERROR: placeholder steps`. `updatePlanStatus('completed')` with `_Testing plan TBD_` returns `ERROR: Testing Plan section is TBD`. Both verified in `npm run test:mcp` (12 passing).
- [x] **Step 2** — `validate_plan_in_progress_steps` and `validate_testing_plan_not_tbd` bash functions added. AWK-based Action-cell inspection handles both headered and legacy tables.
- [x] **Step 3** — `writePlan` with empty Action cells: returns `✅ Plan rewritten` + `⚠ Warning: placeholder steps`. File is still written. Unit test confirms write succeeds.
- [x] **Step 4** — `node scripts/plan-health.js` outputs `[placeholder-steps]`, `[tbd-testing]`, and `[overlap N%]` warnings. Session-start Step 2.5 instructs running it each session.
- [x] **Step 5** — `grep "Testing Plan is not TBD" AGENTS.md` matches. `grep "Testing Plan" src/profiles/org-operations/opencode-instructions.md` matches. Pre-flight checklist present in both.
- [x] **Step 6** — `planOverlapReport([...], 0.1)` with two auth-themed plans returns pair with score ≥ 0.1. Live vault: `contribution-pipeline` ↔ `plan-lifecycle-enforcement-gaps` at 0.18 detected.

### Integration & Regression

- [x] Run `npm run test:dispatch` — 288 passing, 3 pre-existing failures (fix-stale-approvals; unrelated to this plan)
- [x] Run the full test suite — `npm test` — same result; no new regressions introduced
- [x] Run `npm run typecheck` — zero type errors
- [ ] Create, approve, and complete a clean plan end-to-end to confirm the lifecycle flow remains unblocked for valid plans (requires human to run)

### Gate Criteria

- [x] All six Step Verification checkboxes are marked done with evidence above
- [ ] Pre-commit hook rejects a `TBD` Testing Plan in `plans/` path (note: check does not apply to `proposals/` — proposals have no Testing Plan section; gate criterion wording was aspirational)
- [ ] MCP `update_plan_status` rejects `completed` when `## Testing Plan` is `TBD` and rejects `in-progress` when steps contain placeholder text
- [ ] Session-start reports plan health warnings for all active plans that violate the step/TBD rules
- [ ] No false-positive warnings for valid, scaffolded plans that simply have empty steps at creation time (Layer 3 warning, not gate rejection)

## Rollback Procedures

| Scenario | Rollback |
|---|---|---|
| Layer 1 gate rejects in-progress/completed transitions incorrectly | Revert the MCP tool validation logic in the relevant tool handler; restore prior version from git |
| Pre-commit hook falsely blocks a valid plan edit | Remove or comment out the hard error check in the pre-commit hook script; commit bypass |
| write_plan warnings clutter scaffolding output | Lower warning level to debug or remove the empty-step check temporarily from write_plan |
| Session-start plan health warnings surface false positives | Adjust the warning threshold in the session-start script to ignore approved plans with at least one non-empty step |
| AGENTS.md / profile instructions cause agents to skip valid work | Revert the pre-flight check additions in AGENTS.md and profile `opencode-instructions.md` |
| Keyword-overlap detection incorrectly flags unrelated plans as conflicting | Reduce overlap similarity threshold or disable the collation step in the session-start pipeline |

## Risk Assessment

```
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Pre-commit hook false positives block legitimate scaffolding | Medium | Medium | Whitelist known placeholder keywords (`TODO`, `FIXME`); require structured TBD only in Testing Plan sections |
| Direct file edits via `--no-verify` or non-hook tooling bypass MCP gates | Medium | High | Audit log every plan mutation in `.docwright/audit.jsonl`; periodic drift-scan compares file state against expected transitions |
| Session-start warning fatigue causes ignored plan health signals | Medium | Medium | Only surface warnings for approved plans with empty steps or in-progress plans with TBD testing; suppress after first dismissal per session |
| Layer 6 keyword-overlap false positives on unrelated plans | Medium | Low | Require Jaccard threshold ≥ 0.12 with manual confirmation before flagging; exclude common boilerplate terms |
| AGENTS.md pre-flight checks drift from MCP tool validations | Medium | High | Generate agent guidance from the same source-of-truth validation schema; CI test that `canWorkPlan()` logic matches MCP gate logic |
| MCP server unavailable during session-start blocks all lifecycle activity | Low | High | Degrade gracefully: emit warnings but do not gate session-start on MCP availability; re-validate at first write operation |
```

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-28 | Created from approved proposal | NetYeti |
| 2026-06-29 | All 6 steps implemented: MCP gates (in-progress/completed), pre-commit hook mirrors, write_plan warning, plan-health.js script, session-start skill updated, AGENTS.md + org-operations profile updated, planOverlapReport() in collate.ts, 13 new unit tests | NetYeti |
| 2026-06-29 | Testing Plan step verification checkboxes checked with evidence; 4 of 5 Gate Criteria ready for human sign-off | NetYeti |
