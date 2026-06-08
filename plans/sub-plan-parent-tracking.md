---
title: Sub-plan parent tracking — formal parent-plan mechanism
status: approved
author: NetYeti
created: 2026-06-08
tags:
  - workflow
  - lifecycle
  - plans
  - governance
proposal_source: proposals/approved/sub-plan-parent-tracking.md
priority: medium
automated: guided
assigned_to: NetYeti
tests_defined: false
phase: 2
related_to:
  - plans/phase-2-foundation.md
scenario_synthesis: Dispatch module + MCP server changes; no infrastructure steps; dispatch unit-testable outside extension host
total_steps: 8
completed_steps: 1
---

# Sub-plan parent tracking — formal parent-plan mechanism

## Overview

Phase overview plans (e.g. `phase-2-foundation.md`) say "each deliverable will
be broken into its own sub-plan" — but when a sub-plan completes, nothing in
the toolchain updates the parent's deliverables table. The overview silently
drifts out of sync.

This plan introduces `parent_plan:` + `parent_deliverable:` frontmatter fields
and wires them into `transition_to_completed`, the linter, the pre-commit hook,
and the `/status` page so that sub-plan completions automatically keep parent
plans accurate. See [[proposals/approved/sub-plan-parent-tracking.md]] for the
full rationale and alternatives considered.

## Implementation Steps

| Step | Action | Details | Status |
|------|--------|---------|--------|
| 1 | Add `parent_plan:` + `parent_deliverable:` to frontmatter schema | Update `src/profiles/*/schema.json` — both optional string fields. Add to `src/dispatch/linter.ts` type map so they are recognized without warnings. | ⏳ Pending |
| 2 | Update plan templates | Add commented-out `parent_plan:` and `parent_deliverable:` fields to `templates/plan-template.md` and all profile templates in `src/profiles/*/templates/plan.md`. Document valid values. | ⏳ Pending |
| 3 | `transition_to_completed` — parent row update | In `mcp-server.py` (and future TS MCP server): when a completing plan has `parent_plan:` set, (a) read the parent file, (b) locate the deliverable row matching `parent_deliverable:`, (c) update its Status cell to ✅ Done, (d) append a history row noting the sub-plan completion, (e) recalculate `completed_steps`/`total_steps` if present. | ⏳ Pending |
| 4 | Linter rule — stale parent detection | In `src/dispatch/linter.ts`: if a plan in `plans/completed/` has `parent_plan:` set, warn when the parent's matching deliverable row is still ⏳ or ⚠️. | ⏳ Pending |
| 5 | Pre-commit hook warning | In `scripts/pre-commit.sh`: if a plan being committed has `status: completed` and `parent_plan:` is set, warn if the parent's deliverable row is still ⏳ (non-blocking warning, not an error — the MCP tool should have handled it). | ⏳ Pending |
| 6 | `/status` page — parent-plan indicator | In `/status` page active plans list: show `↳ parent-plan-name` link on any plan with `parent_plan:` set. | ⏳ Pending |
| 7 | Tests | Unit tests in `test/dispatch/`: linter warns on stale parent; `transition_to_completed` correctly updates parent row for single and multi-deliverable parents. Integration: full sub-plan completion flow updates parent table and history. | ⏳ Pending |
| 8 | Backfill existing sub-plans | Apply `parent_plan:` + `parent_deliverable:` to existing sub-plans of `phase-2-foundation.md` (research-stage-methodology was Deliverable 9; others as applicable). | ⏳ Pending |

## Testing Plan

- Unit: linter detects stale parent on completed sub-plan; passes when parent row updated
- Unit: `transition_to_completed` locates correct deliverable row by `parent_deliverable:` value
- Unit: history row appended to parent with correct date and sub-plan name
- Integration: complete a test sub-plan → verify parent deliverable flips to ✅ + history appended
- All dispatch tests pass outside extension host (invariant: no VS Code API deps)

## Rollback Procedures

`parent_plan:` and `parent_deliverable:` are optional fields — adding them to
templates and schema is fully backward-compatible. Removing the `transition_to_completed`
logic reverts the auto-update behavior; parent plans can again be updated manually.
No data migration needed to roll back.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Row-matching logic breaks on non-standard deliverable table formats | Medium | Medium | Normalize deliverable table format in a linter rule before this ships |
| Concurrent write race (two sub-plans complete simultaneously) | Low | Low | Plans complete sequentially in practice; add file-level lock if needed |
| `parent_deliverable:` row number drifts when parent table is edited | Medium | Medium | Linter warns on mismatch; pre-commit hook catches before commit |
| MCP tool update corrupts parent file (bad regex/table parse) | Low | High | Write unit tests covering edge cases; read-back verify after write |

## Out of Scope

- Recursive parent chains (grandparent plans) — no current use case
- Auto-completing parent when all deliverables done — gate crossing requires human sign-off
- Multi-parent plans (one sub-plan contributes to two parents)

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-08 | Created from approved proposal | NetYeti |
| 2026-06-08 | Filled from proposal spec — 8 steps, parent-tracking mechanism | NetYeti |
