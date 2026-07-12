---
title: Harden capture_bug_report output — emit schema-valid issue frontmatter
status: in-progress
author: NetYeti
created: 2026-07-11
tags:
  - mcp
  - governance
  - tooling
proposal_source: proposals/harden-capture-bug-report-output-schema.md
priority: medium
complexity: low
automated: guided
assigned_to: NetYeti
tests_defined: true
tests_human_reviewed: false
scenario_synthesis: "Happy path: capture_bug_report --action create writes an issue whose frontmatter passes the same validation the pre-commit hook runs — status: new, no milestone — so the AI can commit it with zero hand-edits. Failure path avoided: the current tool emits status: open + milestone: future, which the linter rejects, breaking the zero-friction capture loop (hit ~4x in one session). Code-over-memory: the tool emits valid output, not a human remembering to fix it."
total_steps: 3
completed_steps: 3
tests_last_run: "2026-07-12T09:17:31.574Z"
tests_last_result: pass
tests_last_commit: 828a247
---

# Harden capture_bug_report output — emit schema-valid issue frontmatter

## Overview

`capture_bug_report --action create` emits frontmatter the issue schema/pre-commit
hook rejects (`status: open` — invalid; `milestone: future` on a `new` issue — not
allowed), so every filed bug needs a manual hand-fix before it can be committed —
a code-over-memory violation. Make the tool emit schema-valid output. Full detail:
[[proposals/harden-capture-bug-report-output-schema]].

## Constraints & Invariants

1. **Parity with the linter.** The created file must pass the SAME validation the
   pre-commit hook / dispatch linter runs — assert this in a test so the tool and
   the linter cannot drift.
2. Plan mutations via MCP tools only; verify by RUNNING the MCP tool + committing
   the result with no hand-edit.

## Implementation Steps

| # | Action | Details | Status |
| --- | --- | --- | --- |
| 1 | Default status: new, drop milestone | In the `create` action of `capture_bug_report` (`src/mcp/tools/` — grep `capture_bug_report`/`createReportedBug`), emit `status: new` (not `open`) and DO NOT write a `milestone` field for new issues (milestone is only valid for proposal-linked/resolved/deferred per the issue schema). Verify: `grep -nE "status:|milestone" src/dispatch/bridge.ts` shows `new` and no unconditional milestone. | ✅ Done |
| 2 | Parity test against the linter | Add a unit test: create a bug via the tool, then run the created frontmatter through the same `validateIssueFrontmatter`/linter the pre-commit hook uses; assert zero errors (status ∈ allowed set; no milestone on a `new` issue). This guards against future drift between the tool and the schema. | ✅ Done |
| 3 | Runtime verify: file + commit with no hand-edit | Call the MCP `capture_bug_report create` on a throwaway title, then `git add` + attempt the pre-commit hook — it must pass with NO manual status/milestone edit. Record the output. | ✅ Done |

## Testing Plan

*   Unit: created-bug frontmatter passes the linter (status=new, no milestone) — the parity test (step 2).
*   Runtime: a bug filed via the MCP tool commits cleanly through the pre-commit hook with no hand-edit (step 3).
*   Full `test:mcp` green.

## Phase Gate

*   `capture_bug_report create` emits `status: new` and no `milestone` for new issues.
*   Parity test asserts the tool's output passes the linter (no future drift).
*   A freshly-filed bug commits with zero hand-edits (verified at runtime).
*   `tests_defined` + human review confirmed; `test:mcp` green.

## Document History

| Date | Change | By |
| --- | --- | --- |
| 2026-07-11 | Drafted from the proposal. Status draft, awaiting BDFL approval. | NetYeti |
| 2026-07-12 | Test run recorded via verify_plan_tests: npm run test:dispatch → PASS @ 828a247 | NetYeti |
| 2026-07-12 | Delivered via PR #333 (merged). Root cause was linter/hook drift, not the tool: createReportedBug already emitted status:new + no milestone; the live status:open+milestone:future was the stale MCP server. Fixed dispatch linter VALID_ISSUE_STATUS to the canonical enum, corrected docwright-dev templates, added parity test. 3/3 done, test:dispatch PASS. Staged for completion. | NetYeti |
