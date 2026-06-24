---
title: Assign Plans to Phases on Creation and Allow Editing
author: NetYeti
created: 2026-06-08
tags:
  - governance
  - plans
  - phases
  - ux
complexity: low
estimated_effort: S
priority: medium
approved: true
created_by: NetYeti@phoenix
assigned_to: NetYeti
consumed_by: plans/completed/assign-plans-to-phases.md
_path: proposals/assign-plans-to-phases.md
---

## Problem

When a plan is created from an approved proposal, it is not assigned to a phase. This means:

- The status page cannot group active plans by phase — they all land in "Unassigned"
- There is no clear signal of when a plan is expected to ship
- Plans created weeks apart may be invisibly targeting different phases, causing scheduling surprises

The `phase:` frontmatter field already exists on phase overview plans (`phase-N.md`) but is absent from most work plans. Nothing in the creation flow sets it, and the Properties Pane renders it as a free-text input with no validation or autocomplete.

## Proposed Solution

### 1. Auto-assign on plan creation

When the `create-plan` API scaffolds a new plan, it reads the current active phase (the lowest-numbered in-progress or approved `phase-N.md` plan) and sets `phase:` automatically. This is a best-guess default — the user can override it.

### 2. Phase field as a dropdown in Properties Pane

Replace the free-text input for `phase:` with a select dropdown. Valid values mirror the known phases: `1`, `2`, `3`, `4`, `post-alpha`. The user can change the phase at any time by editing the plan's frontmatter.

### 3. Linter warns on active plans without a phase

Plans with `status: approved` or `status: in-progress` that have no `phase:` field get a lint warning. Draft plans are not warned — phase is optional until a plan is activated.

### 4. Status page groups active plans by phase

The Active Plans section on the status page groups plans under phase subheadings (Phase 2, Phase 3, Unassigned) so it's immediately visible what phase each plan targets.

### 5. Plan template includes phase field

The plan template gains a `phase:` placeholder so plans created via any path (template fill, create-plan API) always start with the field present.

## Out of Scope

| Idea | Why deferred |
|------|-------------|
| Dynamic phase list from vault | Phase values change rarely; static list is adequate |
| AI-suggested phase based on content | Useful but requires AI inference; manual override suffices for now |
| Phase locking (prevent change after approval) | Too restrictive; re-phasing is legitimate during planning |
| Per-phase capacity tracking | Roadmap / Gantt feature — separate proposal |

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-08 | Created from raw idea | NetYeti |
| 2026-06-08 | Implemented: create-plan auto-assign, dropdown, linter, status page grouping, template, phase backfill on 8 plans | NetYeti |
