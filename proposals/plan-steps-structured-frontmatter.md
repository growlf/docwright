---
complexity: medium
title: Structured Step Frontmatter — YAML Steps as Source of Truth
author: NetYeti
created: 2026-06-04
tags:
  - governance
  - plans
  - schema
  - dispatch
  - deferred
approved: false
created_by: NetYeti@phoenix
assigned_to: ""
related_to:
  - policies/core/workflow-layer-governance.md
  - docs/ai-governance-enforcement.md
  - plans/phase-1-plan-step-enforcement.md
_path: proposals/plan-steps-structured-frontmatter.md
---

## Problem

The Phase 1 enforcement uses a state-machine emoji parser
(`hasPendingStepsInSection`) to detect ⏳ rows in markdown body text. This
works, but step status lives in the markdown body — not in machine-readable
frontmatter. It cannot be queried across plans without parsing every file,
and it cannot be validated by JSON Schema.

## Proposed Solution

Add a `steps:` field to plan frontmatter — a structured YAML list:

```yaml
steps:
  - id: 1
    action: "Panel.svelte created — side, collapse, overlay, scrim"
    status: done
  - id: 2
    action: "Left sidebar refactored to Panel component"
    status: pending
```

The markdown step table in the body becomes a rendered view of the
frontmatter data, not the source of truth. The dispatch linter enforces
the invariant: for each plan with `status: completed`, all steps must have
`status: done`.

**Benefits over the current approach:**
- No markdown parsing — `status: completed` with any `step.status: pending`
  is a JSON Schema violation, caught at the data layer
- Queryable across plans — "show all plans with pending steps" is a
  frontmatter scan, not a body parse
- Consistent with how `total_steps`/`completed_steps` counts already work
- Integrates naturally with `src/dispatch/linter.ts` once it is wired up

## Why deferred

Phase 1 chose the state-machine parser because it was simpler, required no
data model change, and no migration of existing plans. That solved the
immediate problem.

This proposal is the richer long-term path, appropriate when:
1. `src/dispatch/linter.ts` is integrated into the pre-commit hook and Web UI
   validation pipeline (currently unused dead code)
2. A migration script extracts existing markdown step tables into frontmatter

## Dependencies

- `src/dispatch/linter.ts` wired into pre-commit and Web UI
- One-time migration script for existing plans
- Plan template update

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-04 | Distilled from `proposals/plan-step-completion-enforcement.md` (deleted — implemented via different approach). Original proposal archived after Phase 1 plan completed. | NetYeti |
