---
title: "Sub-plan parent tracking — formal parent-plan mechanism"
author: NetYeti
created: 2026-06-07
tags:
  - workflow
  - lifecycle
  - plans
  - governance
category:
  - ENGINE
complexity: M
estimated_effort: "~1w"
approved: false
created_by: "NetYeti@phoenix"
assigned_to: ""
priority: medium
related_to:
  - plans/phase-2-foundation.md
---

## Problem

DocWright's plan lifecycle has no formal concept of a parent-plan / sub-plan
relationship. Phase overview plans (e.g. `phase-2-foundation.md`) explicitly
say "each deliverable will be broken into its own sub-plan" — but when a sub-plan
completes, nothing in the toolchain updates the parent plan's deliverables table.
The parent plan silently drifts out of sync.

This was discovered when `phase-2-foundation.md` still showed all deliverables
as ⏳ Planned despite the Research Stage sub-plan being fully complete.
The fix required a manual `write_plan` rewrite — a one-off that should be code.

## Current workaround

Sub-plan completions must be manually reflected in the parent plan's deliverables
table via `write_plan`. This relies on AI memory / human discipline — a known
failure mode per `policies/core/code-over-memory.md`.

## Proposed Solution

### Frontmatter field: `parent_plan:`

Add an optional `parent_plan:` field to plan frontmatter:

```yaml
parent_plan: phase-2-foundation.md
parent_deliverable: "9"   # row number in parent's Deliverables table
```

### Enforcement on sub-plan completion

When a plan with `parent_plan:` is transitioned to `status: completed`:

1. The `transition_to_completed` MCP tool reads `parent_plan` and
   `parent_deliverable` from the completing plan's frontmatter.
2. It locates the matching row in the parent plan's Deliverables table.
3. It updates that row's Status cell from ⏳/⚠️ to ✅ Done.
4. It appends a history row to the parent plan noting the sub-plan completion.
5. The parent plan's `completed_steps` / `total_steps` are recalculated
   (or a new `completed_deliverables` count field is maintained separately).

### Linter rule

Add a lint warning when a plan in `plans/completed/` has `parent_plan:` set
but the parent's Deliverables table row is still ⏳ — flagging the drift.

### Status page

The `/status` page Active Plans section shows a sub-plan indicator on plans
with `parent_plan:` set (e.g. "↳ phase-2-foundation").

### Pre-commit hook

Add a check: if a plan being committed has `status: completed` and
`parent_plan:` is set, warn if the parent's row is still ⏳.

## Expected Outcomes

- Completing a sub-plan automatically keeps the parent plan accurate
- No manual `write_plan` rewrites needed for routine sub-plan completions
- Phase overview plans are always an accurate reflection of delivered work
- Drift is caught mechanically, not by memory

## Out of Scope

- Recursive parent chains (grandparent plans)
- Automatic status rollup (parent auto-completes when all deliverables done)
- Multi-parent plans (a sub-plan contributes to two parents)

These can be addressed in follow-on proposals if the need arises.

## Acceptance Criteria

- `transition_to_completed` MCP tool updates parent deliverable row on completion
- Linter warns on completed sub-plan with stale parent row
- Pre-commit hook warns on same condition
- `/status` page shows parent-plan relationship
- `phase-2-foundation.md` Deliverable 9 was the first case; future sub-plan
  completions require no manual write_plan
