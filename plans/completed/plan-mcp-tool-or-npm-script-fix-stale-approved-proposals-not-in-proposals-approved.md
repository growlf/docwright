---
title: "Plan: MCP Tool or npm Script: Fix Stale Approved Proposals Not in proposals/approved/"
status: completed
completed_date: 2026-06-08
author: NetYeti
created: 2026-06-08
tags:
  - workflow
  - lifecycle
  - mcp
  - proposals
  - tooling
proposal_source: proposals/mcp-tool-batch-fix-stale-approvals
priority: medium
automated: guided
assigned_to: NetYeti
tests_defined: true
tests_human_reviewed: false
phase: 2
total_steps: 5
completed_steps: 5
scenario_synthesis: Implement a formalized npm script + pre-commit hook that moves approved proposals to proposals/approved/ automatically; replaces the one-off bash script
_path: plans/plan-mcp-tool-or-npm-script-fix-stale-approved-proposals-not-in-proposals-approved.md
---

# Plan: MCP Tool or npm Script: Fix Stale Approved Proposals Not in proposals/approved/

## Overview

Formalizes the one-off bash script that moves `approved: true` proposals from
`proposals/` root to `proposals/approved/`. The fix runs as:

1. A `npm run lifecycle:fix-approvals` script (human-triggered, dry-run by default)
2. A pre-commit hook extension that catches any newly-approved proposals on each commit

The script is idempotent: running it twice on a clean vault produces the same result.
Files already in `proposals/approved/` are skipped.

## Implementation Steps

| Step | Action | Details | Status |
| --- | --- | --- | --- |
| 1 | Write `scripts/fix-stale-approvals.ts` | Finds `proposals/*.md` with `approved: true` in frontmatter (not already in `proposals/approved/`). Default: dry-run listing. `--fix` flag: moves files via `git mv`, updates `_path` frontmatter to new location. Uses `DOCWRIGHT_VAULT_ROOT` env var or `process.cwd()`. | ✅ Done |
| 2 | Add `npm run lifecycle:fix-approvals` to `package.json` | Dry-run by default. `lifecycle:fix-approvals:fix` alias runs with `--fix`. | ✅ Done |
| 3 | Extend pre-commit hook | Added `validate_no_stale_approval()` — blocks commits of `proposals/*.md` with `approved: true` outside `proposals/approved/`; error message includes fix command. | ✅ Done |
| 4 | Write dispatch unit test | `test/dispatch/fix-stale-approvals.test.ts`: dry-run, fix+_path update, skip-already-moved, idempotency, unapproved-not-touched — 5 tests passing. | ✅ Done |
| 5 | Run on live vault + verify | Dry-run output: `✅ No stale approved proposals found.` Live vault is clean. | ✅ Done |

## Testing Plan

- Unit: `test/dispatch/fix-stale-approvals.test.ts` — 5 tests, all passing
- Integration: pre-commit hook blocks `proposals/bad.md` with `approved: true` staged outside `proposals/approved/`
- Manual: `npm run lifecycle:fix-approvals` on live vault — clean

## Phase Gate

- [x] `scripts/fix-stale-approvals.ts` written and working
- [x] `npm run lifecycle:fix-approvals` and `:fix` alias in `package.json`
- [x] Pre-commit hook extended with `validate_no_stale_approval`
- [x] 5 unit tests passing
- [x] Live vault verified clean
- [x] `tests_defined: true` confirmed by NetYeti

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| `git mv` fails on files with spaces or special chars in name | Low | Low | Paths quoted in script |
| Script moves a file that was intentionally in proposals/ root | Very low | Medium | Dry-run default; pre-commit gives clear error with fix command |
| Pre-commit hook slows down commits | Low | Low | Shell grep is fast; only runs on staged `.md` files in proposals/ |

## Document History

| Date | Change | Author |
| --- | --- | --- |
| 2026-06-08 | Created from proposal | NetYeti |
| 2026-06-08 | Filled with 5-step implementation path | NetYeti |
| 2026-06-08 | All 5 steps complete; Phase Gate added; status → in-progress | NetYeti |
