---
title: "Assign Plans to Phases on Creation and Allow Editing"
status: completed
completed_date: 2026-06-08
author: NetYeti
created: 2026-06-08
tags:
  - governance
  - plans
  - phases
  - ux
proposal_source: proposals/approved/assign-plans-to-phases.md
priority: medium
phase: 2
mode: guided
assigned_to: NetYeti
parent_plan: phase-2-foundation.md
parent_deliverable: "12"
tests_defined: true
tests_human_reviewed: false
total_steps: 6
completed_steps: 6
scenario_synthesis: UI + dispatch + linter changes; no infrastructure; all changes are low-risk additive
---

# Assign Plans to Phases on Creation and Allow Editing

## Overview

Implements the plan-to-phase assignment system end-to-end: auto-assign on creation,
dropdown in the Properties Pane, linter validation, status page grouping, and template
update. Backfills `phase:` on all existing plans that were missing it.

## Implementation Steps

| Step | Action | Details | Status |
|------|--------|---------|--------|
| 1 | PropertiesPane phase dropdown | Added `phase` to SELECT_OPTIONS with values `1`, `2`, `3`, `4`, `post-alpha`. Field renders as a `<select>` instead of free text. | ✅ Done |
| 2 | create-plan API auto-assigns current phase | Added `detectCurrentPhase()` to `create-plan/+server.ts`: scans `plans/phase-N*.md` for the lowest-numbered in-progress/approved overview plan, injects the result into newly scaffolded plans. | ✅ Done |
| 3 | Plan template adds `phase:` field; fixes `automated:` comment | Added `phase:` placeholder after `priority:` in `templates/plan-template.md`. Removed inline YAML comment from `automated: off` that was breaking pre-commit hook validation. | ✅ Done |
| 4 | Linter warns on active plans missing phase | Added check in `src/dispatch/linter.ts`: approved/in-progress plans with no `phase:` get a `warn`. Excludes `phase-N.md` overview plans. | ✅ Done |
| 5 | Status API exposes phase on active plan entries | Added `phase` field to `entry()` in `src/webui/src/routes/api/status/+server.ts`. | ✅ Done |
| 6 | Status page groups active plans by phase | `activePlansByPhase` derived value in `status/+page.svelte`: groups by phase, sorted numerically. Phase subheadings with count badges. Backfilled `phase:` on 8 previously unassigned plans. | ✅ Done |

## Testing Plan

| # | Criterion | How to verify | Verified |
|---|-----------|---------------|---------|
| T1 | Linter: approved plan missing `phase:` → warn | `test/dispatch/linter.test.ts` — existing or new test case | ✅ |
| T2 | Linter: draft plan missing `phase:` → no warn | Same test file | ✅ |
| T3 | Linter: `phase-N.md` overview plan missing `phase:` → no warn | Same test file | ✅ |
| T4 | Create plan via UI → `phase:` auto-set to current phase in frontmatter | Manual: click Plan button, inspect created file | ✅ |
| T5 | PropertiesPane shows phase as dropdown, change persists on save | Manual: open plan, change phase, save, reopen | ✅ |
| T6 | Status page shows Phase 2 / Phase 3 groups with correct plan counts | Manual: `/status` page | ✅ |

## Phase Gate

- [x] All 6 steps delivered
- [x] Phase dropdown in PropertiesPane working
- [x] Auto-assign on plan creation working
- [x] Linter warns on missing phase for active plans
- [x] Status page groups plans by phase
- [x] 8 existing plans backfilled
- [x] `tests_defined: true` confirmed by NetYeti

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-08 | Created from approved proposal | NetYeti |
| 2026-06-08 | Filled with real implementation steps — all 6 delivered in same session | NetYeti |
| 2026-06-08 | Added Phase Gate + formal test criteria; tests_defined: true | NetYeti |
