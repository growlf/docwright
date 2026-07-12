---
title: Enforce branch-per-plan workflow at session start
status: draft
author: NetYeti
created: 2026-07-11
tags:
  - workflow
  - hooks
  - governance
proposal_source: proposals/enforce-branch-per-plan.md
priority: low
complexity: low
automated: guided
assigned_to: ""
tests_defined: true
tests_human_reviewed: false
scenario_synthesis: "Happy path: when a plan is selected as the next target, tooling prompts to create/checkout feat/<plan-slug> before the first commit; plans are created with Branch pre-populated to feat/<slug>; a pre-commit WARNS (not blocks) when committing plan source changes on a non-feat/* branch. Failure avoided: plan work accumulates on the session branch, losing per-plan review/bisect/revert granularity, because nothing prompts for or nudges toward per-plan branches."
total_steps: 3
completed_steps: 0
---

# Enforce branch-per-plan workflow at session start

## Overview

Per-plan feature branches are the intended model, but nothing enforces or prompts
them, so work accumulates on the session branch and the audit trail loses per-plan
granularity. Add gentle enforcement (prompt at start, pre-populate the template,
warn — not block — on commit). Full detail: [[proposals/enforce-branch-per-plan]].

## Constraints & Invariants

1. **Warn, don't block.** The pre-commit nudge is a warning, not a hard block —
   branch discipline is guidance, not a gate (avoid bricking legitimate work).
2. Reuse the existing session-start skill + plan template; small additions only.

## Implementation Steps

| # | Action | Details | Status |
| --- | --- | --- | --- |
| 1 | Plan template pre-populates Branch | On plan creation (approve/write_plan/generator), pre-populate the plan's `Branch` field/column with `feat/<plan-slug>` instead of `—`. Verify: a newly-generated plan shows `feat/<slug>`. | ⏳ Pending |
| 2 | Session-start skill: prompt for the branch | In `docwright-session-start`, when a plan is selected as the next target, check whether a `feat/<plan-slug>` branch exists (local/remote); if not, prompt to create it before the first commit, and (Step 5) include a "create branch" task in the TaskCreate entries. Verify: selecting a plan with no branch surfaces the create-branch prompt/task. | ⏳ Pending |
| 3 | Pre-commit WARN on non-feat branch | In `.githooks/pre-commit`, when committing plan-related source changes while on a non-`feat/*` branch (e.g. a session-note branch or main directly), print a warning naming the expected `feat/<slug>` branch — WARN only, never block. Verify: committing plan source on `main`/session branch prints the warning; on `feat/*` it's silent; the commit still proceeds either way. | ⏳ Pending |

## Testing Plan

*   Step 1: a generated plan's Branch field is `feat/<slug>` (generator test).
*   Step 2: session-start surfaces the create-branch prompt/task when the branch is missing (skill dry-run).
*   Step 3: hook test — warning printed on non-feat branch, silent on feat/*, commit never blocked.

## Phase Gate

*   New plans ship with `feat/<slug>` in Branch; session-start prompts for the branch.
*   The pre-commit nudge warns (never blocks) on a non-feat branch.
*   `tests_defined` + human review confirmed; hook tests green.

## Document History

| Date | Change | By |
| --- | --- | --- |
| 2026-07-11 | Drafted from the proposal. Status draft, awaiting BDFL approval. | NetYeti |
