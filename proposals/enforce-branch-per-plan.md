---
title: "Enforce Branch-Per-Plan Workflow at Session Start"
author: NetYeti
author-role: contributor
created: 2026-06-29
tags:
  - git
  - governance
  - session
  - hygiene
priority: medium
complexity: low
estimated_effort: S
approved: false
created_by: "NetYeti@phoenix"
assigned_to: ""
---

## Problem

In practice, plan work accumulates on the session branch rather than per-plan feature branches. The `docwright-session-start` skill and the plan templates both have `Branch:` fields but nothing enforces their use or prompts for branch creation before work begins.

The audit trail loses per-plan granularity: a single PR merging three plans' work cannot be reviewed, bisected, or reverted independently.

## Proposed Solution

1. **Session-start skill** — when a plan is selected as the next target, check whether a `feat/<plan-slug>` branch exists. If not, prompt to create one before the first commit.
2. **Plan template** — pre-populate the `Branch` column with `feat/<plan-slug>` on plan creation, not `—`.
3. **Pre-commit hook** — warn (not block) when committing plan-related source changes while on a non-`feat/*` branch (i.e., on a session-note or develop branch directly).
4. **Session-start skill Step 5** — when creating TaskCreate entries for active plans, include a "create branch" task if no `feat/<slug>` branch exists locally or remotely.

## Out of Scope

- Enforcing branch naming beyond the `feat/<slug>` convention
- Blocking commits on wrong branches (warn only — the BDFL sometimes intentionally batches)
- Auto-opening Forgejo PRs (separate proposal)
