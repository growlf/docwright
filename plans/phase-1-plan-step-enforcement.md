---
title: Phase 1 — Plan Step Completion Enforcement
status: approved
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
scenario_synthesis: "Pre-commit hook script and UI enforcement; no deployment or shell steps beyond running the hook"
tags:
  - phase-1
  - governance
  - enforcement
  - hooks
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
| 2 | Pre-commit hook: warn on completed task with pending steps | Extend `scripts/gate-check.ts` (or create it) — detect `✅` task header with `⏳` step rows in same section; block commit with clear message | ⏳ Pending |
| 3 | Pre-commit hook: block plan `status: completed` with pending steps | When a plan file transitions to `status: completed`, check for `⏳` in body; block if found | ⏳ Pending |
| 4 | Plan template: reminder note | ✅ Shipped — "When marking a task ✅ Complete, update every step row" note above Implementation Steps table | ✅ Done |
| 5 | Test: hook fires correctly | Verify hook blocks a commit where task is marked done but steps are pending; confirm clean commits pass | ⏳ Pending |

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

### Deliverable 2 — `gate-check.ts` reference 🚫 block
- **Finding:** `gate-check.ts` does not exist. `lifecycle-gate.js` (~600 lines) does. The plan says "extend gate-check.ts (or create it)" — this undecided fork is a trap. An implementer will silently make an architecture choice mid-task.
- **Action:** Remove `gate-check.ts` from the plan entirely. Deliverable 2 must state: "Add `checkPendingSteps(file, content)` to `scripts/lifecycle-gate.js`; call from `validateFile()`; invoke via `node scripts/lifecycle-gate.js --check <file>` in the pre-commit hook."
- **Resolution:**

### Deliverable 2 — Parsing strategy 🚫 block
- **Finding:** The plan warns against regex but does not commit to an alternative. `remark`/`unified` adds a dep that must be `npm install`'d before hooks work on a fresh clone. That's a real contributor friction.
- **Action:** Use a minimal state-machine section parser (30 lines, no deps) that tracks "inside Implementation Steps section" + "inside a pipe table row". The table format in this repo is consistent. Commit to this approach in the plan before writing a line of code.
- **Resolution:**

### Deliverable 3 — Section scope must match UI 🚫 block
- **Finding:** The UI check scopes to the `## Implementation Steps` section. The hook must match exactly or they disagree — one will flag a plan the other passes.
- **Action:** Explicitly state in Deliverable 3 that the check is scoped to the Implementation Steps section only, using the same parser as Deliverable 2.
- **Resolution:**

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
