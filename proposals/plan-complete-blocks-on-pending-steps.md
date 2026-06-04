---
complexity: medium
title: Block Plan Completion When Steps Are Still Pending
author: NetYeti
created: 2026-06-04
tags:
  - governance
  - plans
  - lifecycle
  - enforcement
  - ui
approved: true
created_by: NetYeti@phoenix
assigned_to: NetYeti
related_to:
  - proposals/plan-step-completion-enforcement.md
  - policies/core/code-over-memory.md
_path: proposals/plan-complete-blocks-on-pending-steps.md
---
## Problem

The "Complete" button in the plan properties pane is available regardless of whether the plan's implementation steps are done. A reviewer can mark a plan completed while steps still show ⏳ Pending. This is a governance gap: the system allows an invalid state (completed plan, incomplete steps) when it should prevent it.

This is a direct application of the "code over memory" policy — the constraint must be enforced by the UI, not by human discipline.

## Proposed Solution

### 1\. UI enforcement (PropertiesPane)

The **Complete** button is disabled (greyed out, not clickable) when the plan has any `⏳ Pending` steps in its implementation table. A tooltip explains why:

```
Complete — disabled: 2 implementation steps still show ⏳ Pending.
Update the step table before marking this plan complete.
```

Detection: count `⏳` occurrences in the plan body (or in the `## Implementation Steps` section specifically). If count > 0, disable the button.

**Exception:** if `## Implementation Steps` section does not exist (simple plans without step tables), the button is not blocked.

### 2\. Pre-commit hook enforcement

`scripts/gate-check.ts` (already planned for the plan-step-completion-enforcement proposal) is extended to also block commits that:

*   Set `status: completed` on a plan
*   While the plan body contains `⏳ Pending` step rows

This catches completions done outside the UI (direct YAML edits, AI mutations).

### 3\. MCP tool enforcement

`transition_status` (dispatch module) rejects a `completed` transition for plans that have pending steps, returning a clear error message.

## Interaction with the gate mechanism

The phase gate fires when ALL plans in a phase are `completed`. This proposal ensures a plan can only be completed when its own steps are done — making the gate a genuine quality check, not a checkbox exercise.

## Out of Scope

Idea

Why deferred

Automatic step completion from git diff

Complex heuristic; manual update is more trustworthy

Step completion percentage progress bar

Nice UX, post-launch polish

## Document History

Date

Change

Author

2026-06-04

Created — direct application of code-over-memory policy