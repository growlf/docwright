---
title: Sub-plan parent tracking — formal parent-plan mechanism
status: completed
completed_date: 2026-06-09
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
tests_defined: true
phase: 3
related_to:
  - plans/phase-2-foundation.md
scenario_synthesis: Dispatch module + MCP server changes; no infrastructure steps; dispatch unit-testable outside extension host
total_steps: 9
completed_steps: 9
_path: plans/sub-plan-parent-tracking.md
---
# Sub-plan parent tracking — formal parent-plan mechanism

## Overview

Phase overview plans say "each deliverable will be broken into its own sub-plan" — but when a sub-plan completes, nothing updates the parent's deliverables table. The parent silently drifts out of sync. This plan wires `parent_plan:` + `parent_deliverable:` frontmatter fields into the completion flow so that the update happens automatically and is verified mechanically.

See \[\[proposals/approved/sub-plan-parent-tracking.md\]\] for full rationale and alternatives considered.

## Data Model

```yaml
# In a sub-plan's frontmatter:
parent_plan: phase-2-foundation.md       # filename only, no path prefix
parent_deliverable: "9"                  # row number in parent's Deliverables table
```

The parent's Deliverables table row is matched by the `#` column value (first cell). Row numbering follows the table as written — header row excluded. Status cell is the last column; the update replaces `⏳ Planned` / `⚠️ Partial` with `✅ Done`.

## Implementation Steps

| Step | Action | Details | Status |
| --- | --- | --- | --- |
| 1 | Frontmatter schema — all 4 profiles | In each `src/profiles/*/schema.json`: add `"parent_plan": { "type": "string" }` and `"parent_deliverable": { "type": "string" }` to the `plan` document type's `properties` object. Neither field is `required`. In `src/dispatch/linter.ts`: add both keys to the `KNOWN_PLAN_FIELDS` set (or equivalent allowlist) so the linter does not warn "unknown field". | ✅ Done |
| 2 | Plan templates | In `templates/plan-template.md` and `src/profiles/*/templates/plan.md`: add commented-out fields immediately after `assigned_to:`, with inline docs: `# parent_plan: phase-N-overview.md # filename of parent plan (omit if top-level)` and `# parent_deliverable: "1" # row number in parent's Deliverables table`. | ✅ Done |
| 3 | `transition_to_completed` — parent row update | In `scripts/mcp-server.py` `transition_to_completed` handler (and the future TS MCP server): (1) read `parent_plan` + `parent_deliverable` from completing plan's frontmatter; (2) if set, resolve `plans/<parent_plan>` from `REPO_ROOT`; (3) parse the parent's `## Deliverables` table with a regex that matches `| *<N> *|` in the first cell; (4) replace the last cell in that row with `✅ Done`; (5) write back; (6) read the file again to verify the change landed; (7) call `append_history` on the parent with `"Sub-plan <name> completed — Deliverable <N> marked ✅ Done"`; (8) recalculate `completed_steps` on the parent if the header row has a `Status` column and all rows are ✅. | ✅ Done |
| 4 | Linter rule — stale parent detection | In `src/dispatch/linter.ts` `lintPlan()`: if `status === 'completed'` and `parent_plan` is set, resolve the parent file. If the parent exists, find the row matching `parent_deliverable` in its Deliverables table. If that row's Status cell is not `✅`, emit a `WARN` lint message: `"sub-plan complete but parent deliverable <N> in <parent_plan> still shows <cell>"`. | ✅ Done |
| 5 | Pre-commit hook warning | In `scripts/pre-commit.sh`, new function `validate_parent_plan_sync()`: for each staged plan with `status: completed` and `parent_plan:` set, check the parent file's matching deliverable row. Print a non-blocking `[!] warning` (not an error) if the row is still ⏳. Wire into the main validation loop after the existing `validate_gate_status` call. | ✅ Done |
| 6 | `/status` page — sub-plan indicator | In `src/webui/src/routes/api/status/+server.ts`: when building the active plans list, include `parentPlan` and `parentDeliverable` from frontmatter. In `src/webui/src/routes/status/+page.svelte` active plans table: add a `↳ [[parent]]` link cell on plans with `parent_plan` set, linking to `/plans/<parent_plan_slug>`. | ✅ Done |
| 7 | PropertiesPane — parent info display | In `src/webui/src/lib/PropertiesPane.svelte` plan section: if frontmatter has `parent_plan`, show a read-only "Part of" field with a clickable link to the parent plan. This gives the author immediate context when editing a sub-plan. | ✅ Done |
| 8 | Tests | `test/dispatch/parent-tracking.test.ts`: (a) `lintStaleParent` — linter warns when completed sub-plan's parent row is ⏳; passes when row is ✅; (b) `updateParentRow` — given a parent markdown string and row number, returns the correct updated string for rows 1, 5, 10 (boundary check); (c) `appendParentHistory` — history row has correct date, sub-plan name, deliverable number; (d) `noParentField` — no-op when `parent_plan` is absent. Integration: write a fixture parent plan + sub-plan, run `transition_to_completed`, assert parent row updated and history appended. | ✅ Done |
| 9 | Backfill existing sub-plans | Apply `parent_plan: phase-2-foundation.md` + `parent_deliverable:` to existing Phase 2 sub-plans. `research-stage-methodology` → Deliverable 9 (already completed; update the completed copy in `plans/completed/`). Other Phase 2 sub-plans as they are created. Add a lint check: plans tagged `phase: 2` without `parent_plan:` emit an INFO suggesting they may be missing the field. | ✅ Done |

## Testing Plan

**Unit (no filesystem, no OpenCode):**

*   `updateParentRow(markdown, rowNum)`: pure function, test rows 1 / mid / last + row-not-found case
*   `lintStaleParent(completedPlanFm, parentMarkdown)`: stale → warn; up-to-date → clean; missing parent file → warn differently
*   `appendParentHistory(parentMarkdown, subPlanName, deliverableNum, date)`: output contains all three values
*   All dispatch tests run outside extension host (invariant: zero VS Code API imports)

**Integration (real filesystem, fixture files):**

*   Write `fixtures/phase-parent.md` (parent with 3-row Deliverables table) + `fixtures/sub-plan-1.md` (with `parent_plan:` + `parent_deliverable: "2"`)
*   Run `transition_to_completed("sub-plan-1")` → assert row 2 of parent is `✅ Done`, history row appended
*   Re-run → assert idempotent (no duplicate history row, no double-update)

**Pre-commit (shell):**

*   Extend `test/hooks/test-lifecycle-hook.sh` with 2 cases: completing plan with stale parent → warning printed (exit 0); completing plan with already-updated parent → no warning

## Rollback Procedures

`parent_plan:` and `parent_deliverable:` are optional fields — no existing plan breaks if the feature is absent. The `transition_to_completed` parent-update block is a self-contained `if parent_plan:` branch; removing it restores the prior behavior. No data migration needed.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Table row regex matches wrong row (e.g. row 1 inside a code block) | Low | High | Restrict match to the `## Deliverables` section only; unit-test the parser |
| `parent_deliverable` row number drifts when rows are inserted/reordered | Medium | Medium | Linter warns on mismatch at every lint pass; pre-commit hook catches before commit |
| `transition_to_completed` write corrupts parent if regex replaces wrong cell | Low | High | Read-back verify after write; unit tests with multi-column tables |
| Concurrent MCP calls update the same parent simultaneously | Low | Low | Plans complete sequentially in normal use; file-level write is atomic on most filesystems |

## Out of Scope

*   Recursive parent chains (grandparent plans) — no current use case
*   Auto-completing parent when all deliverables done — gate crossing requires human sign-off
*   Multi-parent plans (one sub-plan contributes to two parents)

## Document History

| Date | Change | Author |
| --- | --- | --- |
| 2026-06-08 | Created from approved proposal | NetYeti |
| 2026-06-08 | Filled from proposal spec — 8 steps | NetYeti |
| 2026-06-08 | Improved — data model section, step 7 added (PropertiesPane), regex/verify detail, test fixtures | NetYeti |
| 2026-06-09 | All 9 steps completed — schema, templates, MCP parent update, linter, pre-commit, status page, PropertiesPane, tests, backfill | NetYeti |