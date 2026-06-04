---
title: Phase 1 — Plan Step Completion Enforcement
status: in-progress
tests_defined: false
author: NetYeti
created: 2026-06-04
phase: 1
gate_reviewer: NetYeti
gate_status: pending
proposal_source:
  - proposals/plan-step-completion-enforcement.md
  - proposals/plan-complete-blocks-on-pending-steps.md
priority: high
automated: off
assigned_to: NetYeti
depends_on:
  - phase-1-ui-polish
scenario_synthesis: Pre-commit hook script and UI enforcement; no deployment or shell steps beyond running the hook
tags:
  - phase-1
  - governance
  - enforcement
  - hooks
_path: plans/phase-1-plan-step-enforcement.md
---

# Phase 1 — Plan Step Completion Enforcement

## Overview

Two governance gaps discovered during Phase 1 development that must be closed
by code before Phase 2 begins:

1. **Stale step tables** — plan tasks were marked ✅ Complete while step rows
   still showed ⏳ Pending. Discovered in phase-1-ui-polish. AI memory is not
   enforcement; a pre-commit hook is.

2. **Complete button not blocked** — the PropertiesPane "Complete" button was
   available even when steps were pending. Partially fixed in UI (button
   disabled when pending steps detected); hook enforcement still needed for
   direct YAML edits and AI mutations.

Both are direct applications of the "code over memory" core policy.

## Deliverables

| # | Deliverable | Details | Status |
|---|-------------|---------|--------|
| 1 | UI: Complete button disabled when steps pending | ✅ Shipped — `$derived.by` counts ⏳ in Implementation Steps section; button shows count and tooltip | ✅ Done |
| 2 | Pre-commit hook: warn on completed task with pending steps | `hasPendingStepsInSection()` state-machine parser + `checkPendingSteps()` added to `lifecycle-gate.js`; called from `validateFile()` | ✅ Done |
| 3 | Pre-commit hook: block plan `status: completed` with pending steps | Same check; `--check-files` consolidates all staged plan files into one Node.js call; hook wired in pre-commit | ✅ Done |
| 4 | Plan template: reminder note | ✅ Shipped — "When marking a task ✅ Complete, update every step row" note above Implementation Steps table | ✅ Done |
| 5 | Test: hook fires correctly | `test/hooks/test-pending-steps.js` — 9 cases: true-positive, false-positive (prose ⏳), non-✅ section, empty content | ✅ Done |

## Rationale for Phase 1

The pre-commit hook is the enforcement mechanism. Without it, the rule exists
only in AI memory and a template note — both of which were already present and
failed. Code enforces; memory reminds.

Phase 2 plans will have implementation step tables. They must be enforced from
day one, not retrofitted.

## Phase Gate

Must complete before Phase 2 begins alongside `phase-1-ui-polish` and
`phase-1-containerization`.

**Gate reviewer:** NetYeti
**Gate status:** `pending`
**Note:** Gate reviewer and assignee are the same person (solo Phase 1). Adversarial AI critique via `/critique-plan` substitutes for human independence at this scale.

**Gate checklist — all must be true before `gate_status: approved`:**
- [ ] All 5 deliverables marked ✅ Done in the table
- [ ] `node test/hooks/test-pending-steps.js` runs and shows 12/12 passing
- [ ] Staging a plan with `status: completed` and ⏳ rows causes hook to exit non-zero
- [ ] Complete button in PropertiesPane is disabled when plan has pending steps
- [ ] All Critical Review items have Resolution filled in
- [ ] `tests_defined: true` set after reviewing the ## Tests section below

## Critical Review — Open Questions Before Starting

*Reviewed by /critique-plan adversarial agent. Resolve ⚠️/🚫 before starting.*

### Deliverable 2 — `gate-check.ts` reference 🚫 block — RESOLVED
- **Finding:** `gate-check.ts` does not exist. `lifecycle-gate.js` does.
- **Resolution:** Deliverable 2 updated to extend `lifecycle-gate.js`. `gate-check.ts` reference removed entirely.

### Deliverable 2 — Parsing strategy 🚫 block — RESOLVED
- **Finding:** No dep-free alternative was committed to.
- **Resolution:** State-machine parser with no dependencies — tracks "inside Implementation Steps section" + "inside a pipe table row". ~30 lines. Consistent with this repo's table format.

### Deliverable 3 — Section scope must match UI 🚫 block — RESOLVED
- **Finding:** Scope was unspecified; UI and hook could disagree.
- **Resolution:** Deliverable 3 explicitly scoped to Implementation Steps section using the same state-machine parser as Deliverable 2.

### Deliverable 5 — Manual smoke test is not a test ⚠️ warn
- **Finding:** Manual smoke test produces no artifact.
- **Action:** Write automated test in `test/hooks/` with fixture files.
- **Resolution:** Resolved — `test/hooks/test-pending-steps.js` with 9 automated cases replaces manual smoke test. All pass (`node test/hooks/test-pending-steps.js` confirms).

### Test 9 is a tautology ⚠️ warn
- **Finding:** Test 9 asserts `checkPendingSteps(...) !== undefined` — the function always returns an object so this always passes regardless of behavior. There is no test that stages a fixture file and asserts hook exits non-zero.
- **Action:** Replace test 9 with a content-based test using the existing `planWithPending` fixture: write it to a temp file with a `plans/` path, call `checkPendingSteps`, assert `{ ok: false }`.
- **Resolution:**

### Deliverable 1 — UI regex has the same false-positive risk 📝 note
- **Finding:** UI check uses regex on section content; `⏳` in a code block inside Implementation Steps will fire falsely.
- **Action:** Document as known Phase 1 limitation; update UI to use state-machine parser in Phase 2.
- **Resolution:** Accepted as Phase 1 known limitation. Tracked for Phase 2 when state-machine parser is reused in UI.

### Hook performance — consolidate Node.js calls 📝 note
- **Finding:** Per-file Node.js invocations compound hook time.
- **Action:** Use `--check-files` to pass all staged files in one invocation.
- **Resolution:** Resolved — pre-commit hook calls `node lifecycle-gate.js --check-files` with all staged plan files in a single invocation.

### Gate condition undefined ⚠️ warn
- **Finding:** Phase Gate section states a sequencing dependency but no gate criteria. Reviewer cannot approve against criteria that are not written down.
- **Action:** Add explicit gate checklist to Phase Gate section.
- **Resolution:**

### `tests_defined` field absent; no `## Tests` section ⚠️ warn
- **Finding:** Plan predates and implements the test certification proposal but does not itself comply with it. Should be the exemplar.
- **Action:** Add `tests_defined: false` to frontmatter; write `## Tests` section mapping each deliverable to its test case.
- **Resolution:**

### Self-review (gate_reviewer == assigned_to) 📝 note
- **Finding:** Same person implements and gates. Not a policy violation at Phase 1 solo scale but should be noted.
- **Action:** Document in gate section that adversarial AI critique substitutes for human independence at Phase 1 scale.
- **Resolution:**

## Tests

> When marking this plan complete, `tests_defined` must be checked by the human reviewer
> after confirming the tests below adequately cover the requirements.

| # | Test | Verifies | How to run | Expected result |
|---|------|----------|-----------|-----------------|
| 1 | 8 content-based unit tests | `hasPendingStepsInSection()` state-machine parser — all cases | `node test/hooks/test-pending-steps.js` | 12/12 pass |
| 2 | File-based integration tests | `checkPendingSteps()` reads real file; ok:false when ⏳ present | `node test/hooks/test-pending-steps.js` | Tests 11-12 pass |
| 3 | Hook blocks completion with pending steps | Pre-commit hook exits non-zero on staged plan with ⏳ | Stage a test plan file with `status: completed` + ⏳ row; attempt commit | Hook blocks, prints error |
| 4 | Hook passes clean plan | Pre-commit hook allows completion when all steps ✅ | Stage plan with `status: completed`, all steps ✅, `completed_date` set | Hook passes |
| 5 | UI Complete button disabled | PropertiesPane disables button when plan has ⏳ in steps | Open any plan with ⏳ in Implementation Steps; inspect Complete button | Button disabled with tooltip showing count |

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-04 | Created — promoted to Phase 1; UI enforcement already shipped | NetYeti |
