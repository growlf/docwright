---
title: Phase 1 — Plan Step Completion Enforcement
status: completed
completed_date: 2026-06-04
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
- **Finding:** This plan's purpose is "code enforces, not memory." A manually-verified test produces no artifact and is inconsistent with that philosophy.
- **Action:** Add a shell test in `test/hooks/` that creates a fixture file, stages it, asserts hook exits non-zero. Include true-positive, false-positive (prose `⏳`), and clean-commit cases.
- **Resolution:**

### Deliverable 1 — UI regex has the same false-positive risk 📝 note
- **Finding:** The shipped UI check also uses regex on the section content. A `⏳` in a code block or blockquote inside the Implementation Steps section will fire falsely.
- **Action:** Document as a known Phase 1 limitation. When Deliverable 2's state-machine parser exists, update the UI to use it for consistency.
- **Resolution:**

### Hook performance — consolidate Node.js calls 📝 note
- **Finding:** The hook now runs `node scripts/version.js` on plan completion. Adding per-file `node lifecycle-gate.js` calls compounds cold-start time. On 3 staged plan files: 4+ Node invocations, potentially 2-4 seconds.
- **Action:** Extend `lifecycle-gate.js --check` to also run pending-steps validation, and pass all staged files in one invocation. Do not fan out.
- **Resolution:**

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-04 | Created — promoted to Phase 1; UI enforcement already shipped | NetYeti |
