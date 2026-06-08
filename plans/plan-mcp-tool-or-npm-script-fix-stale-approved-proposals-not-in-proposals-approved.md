---
title: "Plan: MCP Tool or npm Script: Fix Stale Approved Proposals Not in proposals/approved/"
status: draft
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
tests_defined: false
tests_human_reviewed: false
phase: 3
total_steps: 5
completed_steps: 0
scenario_synthesis: Implement a formalized npm script + pre-commit hook that moves approved proposals to proposals/approved/ automatically; replaces the one-off bash script
_path: plans/plan-mcp-tool-or-npm-script-fix-stale-approved-proposals-not-in-proposals-approved.md
---

# Plan: MCP Tool or npm Script: Fix Stale Approved Proposals Not in proposals/approved/

## Overview

Formalizes the one-off bash script that moves `approved: true` proposals from `proposals/` root to `proposals/approved/`. The fix runs as:
1. A `npm run lifecycle:fix-approvals` script (human-triggered, dry-run by default)
2. A pre-commit hook extension that catches any newly-approved proposals on each commit

The script is idempotent: running it twice on a clean vault produces the same result. Files already in `proposals/approved/` are skipped.

## Implementation Steps

| Step | Action | Details | Status |
|------|--------|---------|--------|
| 1 | Write `scripts/fix-stale-approvals.ts` | Finds `proposals/*.md` with `approved: true` in frontmatter (not already in `proposals/approved/`). Default: dry-run listing. `--fix` flag: moves files via `git mv`, updates `_path` frontmatter to new location. Outputs one line per file: `[moved] proposals/foo.md → proposals/approved/foo.md`. Uses the existing frontmatter parser in `src/dispatch/linter.ts` — no new parser. | ⏳ Pending |
| 2 | Add `npm run lifecycle:fix-approvals` to `package.json` | Script: `npx tsx scripts/fix-stale-approvals.ts`. Dry-run by default. `npm run lifecycle:fix-approvals -- --fix` moves files. Add `--fix` to `npm run lifecycle:fix-approvals:fix` as a convenience alias. | ⏳ Pending |
| 3 | Extend pre-commit hook to catch newly-approved proposals in wrong location | In `scripts/pre-commit.sh`: after existing validation, scan staged `.md` files in `proposals/` root for `^approved: true` in frontmatter. If found, print an error with the move command and exit 1. Message: `ERROR: proposals/foo.md has approved: true — move to proposals/approved/ or run npm run lifecycle:fix-approvals -- --fix`. | ⏳ Pending |
| 4 | Write dispatch unit test | `test/dispatch/fix-stale-approvals.test.ts`: (a) dry-run finds the stale file, reports it, does not move it; (b) `--fix` moves it, updates `_path`; (c) already-in-approved/ file is skipped; (d) idempotency: running twice yields same result. Use `tmp/` fixture directories, clean up after each test. | ⏳ Pending |
| 5 | Run on live vault + verify | Run `npm run lifecycle:fix-approvals` (dry-run), review output, then `-- --fix` if clean. Confirm `proposals/approved/` contains all moved files and index reflects new paths. | ⏳ Pending |

## Testing Plan

- Unit: `test/dispatch/fix-stale-approvals.test.ts` covers dry-run, fix, skip-already-moved, idempotency
- Integration: pre-commit hook test — stage a `proposals/bad.md` with `approved: true` and confirm commit is rejected
- Manual: run on live vault, verify no files remain in `proposals/` root with `approved: true`

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `git mv` fails on files with spaces or special chars in name | Low | Low | Quote all paths in the script; test with a fixture file containing spaces |
| Script moves a file that was intentionally in proposals/ root | Very low | Medium | Dry-run default ensures human review before any move; pre-commit hook gives a clear error with the fix command |
| Pre-commit hook slows down commits | Low | Low | Shell grep is fast; only runs on staged `.md` files in proposals/ |

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-08 | Created from proposal | NetYeti |
| 2026-06-08 | Filled with 5-step implementation path — script, npm alias, pre-commit hook, tests, live run | NetYeti |
