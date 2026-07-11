---
title: Harden markdown table-row parsing across all surfaces
status: draft
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
assigned_to: ""
tests_defined: true
tests_human_reviewed: false
scenario_synthesis: "Happy path: a table cell containing a literal pipe (a code span like `category: bug|feature`, or history text with a `|`) round-trips through every parser/writer without corrupting the row. The shared splitTableRow is already backtick-aware (#325, fixing update_step); this plan converges the remaining surfaces — plan-review's own raw split('|') and append_history's row composition — onto the hardened helpers. Failure avoided: silent row corruption that reports success."
total_steps: 3
completed_steps: 0
---

# Harden markdown table-row parsing across all surfaces

## Overview

Table rows are parsed/rebuilt by several code paths; a literal `|` in a cell used
to corrupt rows silently. The shared `splitTableRow` (`src/dispatch/completion-gate.ts`)
was hardened in #325 (backtick + escape aware, fixing `update_step`), but other
surfaces still have their own naive splitters/writers. Converge them.
Full detail: [[proposals/harden-markdown-table-row-parsing]].

## Constraints & Invariants

1. **One splitter, escape-on-write.** Read table rows only via the shared
   `splitTableRow`; when writing user-supplied cell content, escape `|` → `\|`.
   No per-surface reimplementation.
2. Verify by round-tripping a cell with a literal `|` (code span + plain) at each
   surface; full `test:dispatch` + `test:mcp` green.

## Implementation Steps

| # | Action | Details | Status |
| --- | --- | --- | --- |
| 1 | Shared splitTableRow hardened (update_step) | DONE 2026-07-11 (PR #325). `splitTableRow` no longer splits on `\|` or on `|` inside backtick code spans; `replaceStepStatus`/`update_step` fixed; `test/dispatch/table-row-pipes.test.ts` proves fail-on-old / pass-on-fix. | ✅ Done |
| 2 | plan-review extractSteps → shared splitTableRow | `src/webui/src/routes/api/plan-review/+server.ts` uses a raw `line.split('|')` (~line 49) to parse the Implementation Steps table it feeds the reviewer — a code-span pipe in a Details cell desyncs its columns. Replace that raw split with the shared `dispatch/splitTableRow` (import via the established `../../../../../../dispatch/...` path). Verify: a plan whose step Details contains `` `a|b` `` is parsed with correct columns (unit test on the extract helper). | ⏳ Pending |
| 3 | append_history escapes pipes in cell text | `append_history` (`src/mcp/tools/mutation.ts`) composes `| date | change | author |` without escaping `|` in `change` — a pipe in the change text breaks the Document History table (the original #272 corruption class). Escape `|` → `\|` in `change` (and any user-supplied cell) before composing the row. Verify: `append_history` with a change string containing a literal `|` produces a valid single-row entry that `splitTableRow` reads back intact; unit test. | ⏳ Pending |

## Testing Plan

*   Step 1 (update_step): `test/dispatch/table-row-pipes.test.ts` fail-on-old/pass-on-fix; `test:dispatch` 405 green — DONE (#325).
*   Step 2 (plan-review): unit test — extractSteps parses a Details cell with `` `a|b` `` into the correct column count.
*   Step 3 (append_history): unit test — a change string with a literal `|` round-trips (compose → `splitTableRow` → same cells).
*   Full `test:dispatch` + `test:mcp` green (no regression to the shared splitter).

## Phase Gate

*   No surface parses/writes table rows with a naive `split('|')`/unescaped compose — all use the shared helpers.
*   Literal-pipe cells (code span + plain) round-trip at plan-review extractSteps and append_history.
*   `tests_defined` + human review confirmed; `test:dispatch` + `test:mcp` green.

## Document History

| Date | Change | By |
| --- | --- | --- |
| 2026-07-11 | Drafted from the proposal; step 1 already delivered (#325). Status draft, awaiting BDFL approval. | NetYeti |
