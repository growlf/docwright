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

### `scripts/gate-check.ts` doesn't exist yet
- Deliverable 2 says "Extend `scripts/gate-check.ts` (or create it)" — it must
  be created. There is a `lifecycle-gate.js` (Node.js, ~600 lines) but it is
  not the same file. Decide: extend the existing JS, or create a new TS script.
  Pick one before starting.

### Markdown section parsing must not use regex
- Detecting "✅ task header" + "⏳ rows in the Implementation Steps section
  below it" requires understanding markdown structure — not just pattern matching.
- Regex on the whole file will produce false positives (✅/⏳ in prose text,
  code blocks, commit messages).
- **Action:** Use `marked` or `remark` to parse the markdown AST, then walk
  sections. This is harder but correct.

### Pre-commit hook performance
- The hook currently takes ~0.5s. Adding a Node.js script invocation adds
  ~0.3–0.8s depending on startup time. Over threshold (>1s) harms DX.
- **Action:** If using Node.js, compile the check to a plain JS bundle
  (no ts-node) so startup is fast. Or implement the check purely in bash
  (simpler, faster, but regex-only).

### User experience when blocked
- When the hook blocks a commit, what does the message say?
- Must tell the developer: which file, which task, how many steps are pending.
- This is UX design, not just code. Specify the error message format.

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-04 | Created — promoted to Phase 1; UI enforcement already shipped | NetYeti |
