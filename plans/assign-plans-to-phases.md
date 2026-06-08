---
title: "Assign Plans to Phases on Creation and Allow Editing"
status: in-progress
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
automated: guided
assigned_to: NetYeti
tests_defined: false
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
| 2 | create-plan API auto-assigns current phase | Added `detectCurrentPhase()` to `create-plan/+server.ts`: scans `plans/phase-N*.md` for the lowest-numbered in-progress/approved overview plan, injects the result into newly scaffolded plans via template substitution and the fallback content path. | ✅ Done |
| 3 | Plan template adds `phase:` field; fixes `automated:` comment | Added `phase:` placeholder after `priority:` in `templates/plan-template.md`. Removed inline YAML comment from `automated: off` — the pre-commit hook's bash parser was reading the comment as part of the value, breaking validation on plans created from the template. | ✅ Done |
| 4 | Linter warns on active plans missing phase | Added check in `src/dispatch/linter.ts`: plans with `status: approved` or `status: in-progress` that have no `phase:` field get a `warn`-level lint result. Excludes phase overview plans themselves (basename starts with `phase-`). | ✅ Done |
| 5 | Status API exposes phase on active plan entries | Added `phase` field to the `entry()` function in `src/webui/src/routes/api/status/+server.ts` so active plan rows carry their phase value to the client. | ✅ Done |
| 6 | Status page groups active plans by phase | Added `activePlansByPhase` derived value in `status/+page.svelte`: groups plans by phase key, sorted numerically with `post-alpha` last and Unassigned at the bottom. Active Plans section now renders phase subheadings (blue, uppercase) with count badges before each group's table. Backfilled `phase:` on 8 previously unassigned plans. | ✅ Done |

## Testing Plan

- Linter: add test cases to `test/dispatch/linter.test.ts` — approved plan missing `phase:` → warn; draft plan missing `phase:` → no warn; `phase-N.md` overview plan missing `phase:` → no warn.
- Manual: create a plan via the Plan button, confirm `phase:` is set to current phase in frontmatter. Open PropertiesPane, confirm phase shows as dropdown, change it, save, confirm it persists.
- Manual: status page shows Phase 2 / Phase 3 groups with correct plan counts.

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-08 | Created from approved proposal | NetYeti |
| 2026-06-08 | Filled with real implementation steps — all 6 delivered in same session | NetYeti |
