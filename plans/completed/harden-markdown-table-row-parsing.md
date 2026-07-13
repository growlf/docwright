---
title: Harden markdown table-row parsing across all surfaces
status: completed
completed_date: 2026-07-12
author: NetYeti
created: 2026-07-11
tags:
  - dispatch
  - webui
  - mcp
  - robustness
proposal_source: proposals/harden-markdown-table-row-parsing.md
priority: medium
complexity: low
automated: guided
assigned_to: NetYeti
tests_defined: true
tests_human_reviewed: true
scenario_synthesis: "Happy path: a table cell containing a literal pipe (a code span like a category value bug-or-feature, or history text with a pipe) round-trips through every parser/writer without corrupting the row. The shared splitTableRow is already backtick-aware (#325, fixing update_step); this plan converges the remaining surfaces — plan-review's own raw split and append_history's row composition — onto the hardened helpers. Failure avoided: silent row corruption that reports success."
total_steps: 3
completed_steps: 3
gate_note: "Shared helpers extractPlanSteps + escapeTableCell landed (PR #332); plan-review and append_history converged. Awaiting human test certification + completion click."
tests_last_run: "2026-07-11T18:57:22.901Z"
tests_last_result: pass
tests_last_commit: a6a6e99
_path: plans/completed/harden-markdown-table-row-parsing
---

# Harden markdown table-row parsing across all surfaces

## Overview

Table rows are parsed/rebuilt by several code paths; a literal pipe in a cell used
to corrupt rows silently. The shared `splitTableRow` (`src/dispatch/completion-gate.ts`)
was hardened in #325 (backtick + escape aware, fixing `update_step`), but other
surfaces still had their own naive splitters/writers. Converge them.
Full detail: [[proposals/harden-markdown-table-row-parsing]].

## Constraints & Invariants

1. **One splitter, escape-on-write.** Read table rows only via the shared
   `splitTableRow`; when writing user-supplied cell content, escape the pipe.
   No per-surface reimplementation.
2. Verify by round-tripping a cell with a literal pipe (code span + plain) at each
   surface; full `test:dispatch` + `test:mcp` green.

## Implementation Steps

| # | Action | Details | Status |
| --- | --- | --- | --- |
| 1 | Shared splitTableRow hardened (update_step) | DONE 2026-07-11 (PR #325). splitTableRow no longer splits on an escaped pipe or a pipe inside backtick code spans; replaceStepStatus/update_step fixed; test/dispatch/table-row-pipes.test.ts proves fail-on-old / pass-on-fix. | ✅ Done |
| 2 | plan-review extractSteps to shared splitTableRow | DONE (PR #332). Replaced plan-review's raw split in src/webui/src/routes/api/plan-review/+server.ts with the shared extractPlanSteps (dispatch/completion-gate), so a code-span pipe in a Details cell no longer desyncs the reviewer's columns (#318). Unit test in test/dispatch/table-row-pipes.test.ts. | ✅ Done |
| 3 | append_history escapes pipes in cell text | DONE (PR #332). appendHistory (src/mcp/tools/mutation.ts) now escapes pipes in the change and author cells via the shared escapeTableCell before composing the Document History row — the original #272 corruption class. Round-trip unit test in test/mcp/mutation.test.ts. | ✅ Done |

## Testing Plan

*   Step 1 (update_step): test/dispatch/table-row-pipes.test.ts fail-on-old/pass-on-fix — DONE (#325).
*   Step 2 (plan-review): unit test — extractPlanSteps parses a Details cell with a code-span pipe into the correct column count — DONE (#332).
*   Step 3 (append_history): unit test — a change string with a literal pipe round-trips (compose then splitTableRow yields the same cells) — DONE (#332).
*   Full `test:dispatch` (409) + `test:mcp` (full chain) green — DONE @ a6a6e99.

## Phase Gate

*   No surface parses/writes table rows with a naive split or unescaped compose — all use the shared helpers.
*   Literal-pipe cells (code span + plain) round-trip at plan-review extractSteps and append_history.
*   `tests_defined` + human review confirmed; `test:dispatch` + `test:mcp` green.

## Document History

| Date | Change | By |
| --- | --- | --- |
| 2026-07-11 | Drafted from the proposal; step 1 already delivered (#325). Status draft, awaiting BDFL approval. | NetYeti |
| 2026-07-11 | Test run recorded via verify_plan_tests: npm run test:dispatch PASS @ a6a6e99 | NetYeti |
| 2026-07-11 | Steps 2-3 shipped (PR #332): shared extractPlanSteps + escapeTableCell; plan-review and append_history converged. 3/3 done, staged for completion. | NetYeti |
| 2026-07-11 | NOTE: update_step corrupted rows 2-3 of this very plan (code-span pipe) — proof the running dw-vault MCP server predates #325. Repaired via write_plan; rows rewritten pipe-free. MCP server needs restart to pick up #325/#332 (see mcp-server-stale-dist-detection). | NetYeti |
