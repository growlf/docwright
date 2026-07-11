---
title: Guard against committing machine-specific absolute paths
status: draft
author: NetYeti
created: 2026-07-11
tags:
  - hooks
  - ci
  - portability
proposal_source: proposals/guard-committed-machine-paths.md
priority: medium
complexity: low
automated: guided
assigned_to: ""
tests_defined: true
tests_human_reviewed: false
scenario_synthesis: "Happy path: a scanner flags machine-specific absolute paths (/home/<user>/, /Users/<user>/, C:\\Users\\<user>\\) and absolute-target symlinks that point outside the repo, in staged files (pre-commit) and tracked files (CI), with a clear message naming the file + offending path + fix. Failure avoided: the recurring class where a committed absolute path or dangling symlink breaks/churns on every other clone (plugins/erp-images symlink #163, opencode.jsonc paths #194)."
total_steps: 3
completed_steps: 0
---

# Guard against committing machine-specific absolute paths

## Overview

Two breakages this cycle shared one root cause — a machine-specific absolute path
(or an absolute-target symlink) committed to the repo, which dangles or churns on
every other clone (`plugins/erp-images` symlink #163; `opencode.jsonc` abs MCP
paths #194). Add a scanner that catches this class at commit + CI time. Full
detail: [[proposals/guard-committed-machine-paths]].

## Constraints & Invariants

1. **Belt-and-suspenders:** pre-commit hook (fail fast locally) AND a CI job (not
   every clone installs hooks).
2. Clear failure message: name the file, the offending path, and the fix (relative
   path / env var / gitignore).
3. Don't false-trigger on legitimate absolute paths in docs/examples (scope to
   real home-path patterns + symlink targets).

## Implementation Steps

| # | Action | Details | Status |
| --- | --- | --- | --- |
| 1 | Scanner script | Add `scripts/check-machine-paths.sh` (or .ts) that, given a set of files, flags: (a) absolute home paths — `/home/<user>/`, `/Users/<user>/`, `C:\\Users\\<user>\\`; (b) symlinks whose target is an absolute path outside the repo (the plugins/erp-images case). Exits non-zero with a per-hit message (file + offending path + fix hint). Verify: run it against a fixture containing each pattern → flags all; against a clean tree → passes. | ⏳ Pending |
| 2 | Wire into pre-commit | Call the scanner on STAGED files from `.githooks/pre-commit` (fail fast). Verify: staging a file with `/home/someuser/x` is blocked with the clear message; a clean staged set passes. | ⏳ Pending |
| 3 | CI job over tracked files | Add a CI step that runs the scanner over TRACKED files (belt-and-suspenders for clones without hooks installed). Verify: CI fails on a tracked machine-path (test on a throwaway branch or a unit of the scanner); passes clean. | ⏳ Pending |

## Testing Plan

*   Step 1: fixture-based test — the scanner flags home-paths + external-absolute symlinks, passes a clean tree.
*   Step 2: staging an offending file is blocked by the hook (run the hook).
*   Step 3: the CI job fails on a tracked offender, passes clean.

## Phase Gate

*   Machine-specific absolute paths + external-absolute symlinks are caught in both pre-commit and CI, with a clear fix message.
*   No false-positives on legitimate absolute paths in docs.
*   `tests_defined` + human review confirmed.

## Document History

| Date | Change | By |
| --- | --- | --- |
| 2026-07-11 | Drafted from the proposal. Status draft, awaiting BDFL approval. | NetYeti |
