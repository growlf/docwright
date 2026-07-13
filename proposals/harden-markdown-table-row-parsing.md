---
title: "Harden markdown table-row parsing across all surfaces (shared splitTableRow / pipe escaping)"
author: NetYeti
author-role: contributor
created: 2026-07-11
tags:
  - dispatch
  - webui
  - mcp
  - bug
  - robustness
approved: false
created_by: "NetYeti@cluster-llm"
assigned_to: ""
priority: medium
milestone: backlog
related_to:
  - https://github.com/growlf/docwright/issues/373
  - https://github.com/growlf/docwright/issues/367
---

## Problem

Markdown table rows (Implementation Steps, Document History) are parsed/rebuilt
by several code paths that split on `|` naively and corrupt rows when a cell
contains a literal pipe (e.g. a code span `` `category: bug|feature` `` or history
text with a `|`). The shared `splitTableRow` (`src/dispatch/completion-gate.ts`)
was made backtick-and-escape aware in #325 (fixing `update_step`/`replaceStepStatus`),
but **other surfaces still have their own naive splitters or writers**:

- **`plan-review` `extractSteps`** (`src/webui/.../api/plan-review/+server.ts`) uses a
  raw `line.split('|')` — a code-span pipe in a Details cell desyncs the columns
  it feeds to the reviewer (still broken; not covered by #325).
- **`append_history`** (`src/mcp/tools/mutation.ts`) builds `| date | change | author |`
  without escaping pipes in `change` — a `|` in the change text breaks the
  Document History table (the original GH #272 corruption class).

## Proposed Solution

Converge on the hardened, shared helpers everywhere:
- Replace `plan-review`'s raw `split('|')` with the shared `splitTableRow`.
- Have `append_history` escape `|` → `\|` in the `change` text (and any
  user-supplied cell content) before composing the row.
- Audit remaining table-writing call sites for the same class and route them
  through a single escape-on-write / split-on-read pair.

## Verification

- Unit tests: `plan-review` extractSteps and `append_history` round-trip a cell
  containing a literal `|` (code span and plain) without column desync.
- Full `test:dispatch` + `test:mcp` green (no regression to the shared splitter).
