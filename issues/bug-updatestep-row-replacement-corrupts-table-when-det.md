---
title: update_step row-replacement corrupts table when Details cell contains an unescaped pipe
status: resolved
resolved_by: src/dispatch/completion-gate.ts splitTableRow (fix/mcp-updatestep-pipe)
created: 2026-07-10
author: agent
author-role: user
category: bug
priority: high
complexity: medium
estimated_effort: S
demand_count: 1
reported_dates: [2026-07-10]
channel: dev
related:
  - plans/improve-bug-feature-reporting-tool.md
tags:
  - reported-bug
---

# update_step row-replacement corrupts table when Details cell contains an unescaped pipe

> **Resolved 2026-07-11.** Root cause: the shared `splitTableRow`
> (`src/dispatch/completion-gate.ts`) split on every `|` (only `\|` was
> protected), so a raw pipe inside an inline code span — `` `category: bug|feature` ``
> — parsed the data row with more columns than the header; `replaceStepStatus`
> then wrote the new Status into the wrong cell and left the old one. Fixed by
> making `splitTableRow` backtick-aware (no split inside `` `…|…` `` or on `\|`),
> which fixes all five callers (`replaceStepStatus`, `countSteps`, `step_issues`,
> `transitions`, `query`). Regression test `test/dispatch/table-row-pipes.test.ts`
> — **verified it fails on the old splitter and passes on the fix**; full
> `test:dispatch` (404) and `test:mcp` green, no regressions.
>
> Secondary note (the observed `tests_defined` flip) is **not** corruption — by
> design `update_step` sets `tests_defined: false` on every step edit (a step
> change invalidates prior certification), flipping it back only for a
> human-reviewed testable step. Benign/intended, not a defect.

## Description

mcp__dw-vault__update_step corrupted Step 1's row in plans/improve-bug-feature-reporting-tool.md when marking it done. The original Details cell contained a raw, unescaped `|` inside a code span: `` `category: bug|feature` `` (documenting an API accepting either literal value). The tool's row-parsing/replacement logic appears to split on every `|` character rather than only on cell-boundary pipes (or failing to respect backtick-fenced spans), which desynced the column count: the cell text got truncated right before the embedded `|`, and the tool appended a new `✅ Done` status cell without removing the original `⏳ Pending` one -- producing a row that ended in `✅ Done | ⏳ Pending |` (two status-shaped cells instead of one).

Separately, and possibly related to the same parsing pass, `tests_defined` flipped from `true` to `false` on this plan at some point across several update_step calls, with no corresponding edit made by me -- worth checking whether the same row-processing code path touches frontmatter fields it shouldn't.

Repro: create a plan with an Implementation Steps table where a step's Details cell contains a markdown code span with a literal `|` inside it (e.g. an API accepting `category: bug|feature`), then call update_step to mark that step done. Expect the row's other cells to survive intact and the Status cell to end up as a single value.

Worked around this session via write_plan (full rewrite) to repair the row and restore tests_defined: true.

## System Info

None provided
