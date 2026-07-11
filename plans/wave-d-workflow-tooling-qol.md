---
title: Wave D — workflow tooling QoL (dogfood signal, roadplan drift-guard, session-end + complete_issue_branch)
status: draft
author: NetYeti
created: 2026-07-11
tags:
  - tooling
  - automation
  - ci
  - backlog
proposal_source: proposals/issue-cluster-remediation-waves.md
priority: medium
complexity: medium
automated: guided
assigned_to: ""
tests_defined: true
tests_human_reviewed: false
scenario_synthesis: "Wave D of the issue-cluster remediation waves: sharp edges in the automation that force manual dances. Happy path after this plan: the release dogfood-window is driven by a real signal not a fixed clock; a CI roadplan drift-guard fails when docs and derived roadplan disagree; session-end handles a protected-main push by auto-branching+PRing instead of failing; complete_issue_branch waits for required checks before merging. (#136 plan-doc date is covered by fix-completion-doc-generator-yaml-bugs; excluded here.)"
total_steps: 4
completed_steps: 0
---

# Wave D — workflow tooling QoL

## Overview

Wave D of [[proposals/issue-cluster-remediation-waves]] — "sharp edges in the
automation that force manual dances." Each item becomes one step. (#136 plan-doc
raw-date is covered by [[plans/fix-completion-doc-generator-yaml-bugs]] and is
excluded here to avoid overlap.)

## Constraints & Invariants

1. Automation changes are code — add a test/CI check per item; verify by RUNNING
   the tool/hook/CI path, not by reading.
2. Never force-push; session-end must never push straight to protected `main`.
3. Plan mutations via MCP tools only.

## Implementation Steps

| # | Action | Details | Status |
| --- | --- | --- | --- |
| 1 | Release dogfood-window: real signal, not a fixed 7-day clock (#93) | Replace the hardcoded 7-day dogfood window (`release-dogfood-window-uses-a-fixed-7-day-clock`) with a real dogfood signal — e.g. "soak since the tag was deployed AND health green AND no new blocker bugs filed against it" — rather than wall-clock arithmetic. Locate the window logic (`grep -rn "7" + "dogfood\|soak\|window" scripts/ src/`), define the signal, implement. Verify: a tag with an unmet signal is reported not-ready; a met signal is ready (unit test on the predicate). | ⏳ Pending |
| 2 | roadplan CLI `--check` drift guard for CI (#97) | Add a `--check` mode to the roadplan generator (`scripts/generate-roadplan.ts`) that regenerates in-memory and exits non-zero if the committed `docs/roadmap.md` (or roadplan) differs from the derived output — so CI fails on drift. Wire into CI. Verify: a deliberate roadplan edit fails `--check`; regenerating passes. | ⏳ Pending |
| 3 | session-end auto-branch+PR on protected-main rejection (#146) | `session:end` pushes to the current branch; on `main` (protected) the push is rejected and the shutdown fails. Make `end-session.ts` detect it's on (or would push to) a protected branch and instead create a `docs/session-<date>` branch + open a PR, never force-pushing. Verify: running session:end while on main produces a branch + PR (dry-run asserts the intended action). | ⏳ Pending |
| 4 | complete_issue_branch waits for required checks (#166) | `complete_issue_branch` with merge=true merges without waiting for required status checks, so it races/fails. Make it poll the PR's required checks to green (with a timeout) before merging, and report clearly if they don't pass. Verify: a PR with pending checks is not merged until green; integration/guarded unit test. | ⏳ Pending |

## Testing Plan

*   Step 1: unit test on the dogfood-ready predicate (unmet vs met signal).
*   Step 2: `generate-roadplan --check` fails on a deliberate drift, passes when regenerated (run both ways).
*   Step 3: session:end on `main` branches + PRs instead of pushing to main (dry-run + a guarded real run).
*   Step 4: complete_issue_branch waits for required checks before merging (guarded test).
*   Relevant suites green.

## Phase Gate

*   Release readiness uses a real dogfood signal, not a fixed clock.
*   CI fails on roadplan drift.
*   session-end never fails/force-pushes on protected main — it branches + PRs.
*   complete_issue_branch merges only after required checks are green.
*   `tests_defined` + human review confirmed; suites green.

## Document History

| Date | Change | By |
| --- | --- | --- |
| 2026-07-11 | Drafted from Wave D of issue-cluster-remediation-waves (#93/#97/#146/#166; #136 in fix-completion-doc-generator). Status draft, awaiting BDFL approval. | NetYeti |
