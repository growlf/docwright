---
title: Flaky dispatch bridge.test.ts times out (2000ms) intermittently, reddening tag/release CI
status: resolved
resolved_by: src/dispatch/bridge.ts (fix/flaky-bridge-test)
created: 2026-07-10
author: agent
author-role: user
category: bug
priority: medium
complexity: medium
estimated_effort: S
demand_count: 1
reported_dates: [2026-07-10]
channel: dev
github_issue: https://github.com/growlf/docwright/issues/314
tags:
  - reported-bug
---

# Flaky dispatch bridge.test.ts times out (2000ms) intermittently, reddening tag/release CI

> **Resolved 2026-07-11.** Root cause: `suggestDuplicates` (`src/dispatch/bridge.ts`) called `queryGhIssues`, which shells out to the real `gh issue list` (execSync 5000ms); mocha's 2000ms per-test default fired first when `gh` was slow/auth-variant in CI, so the test flaked — a merge-blocking risk on any PR since it's a required check. Fix: made the gh query **injectable** (`suggestDuplicates(root, title, category, ghQuery=queryGhIssues)`) and the tests now pass a no-network fake, so no test shells out to `gh`. `bridge.test.ts` now runs ~20ms deterministically (was flaking at 2000ms); a new test covers the injected gh-suggestion path. Verified: full `test:dispatch` 405 passing, 3 consecutive fast runs.


## Description

The dispatch suite test/dispatch/bridge.test.ts intermittently fails with "Timeout of 2000ms exceeded" under the default mocha timeout. Observed 2026-07-10 during the v0.4.11 release: the SAME commit tree (78306ef) passed all-green on the main-branch push, then failed on the v0.4.11 tag push minutes later solely because of this timeout — no code difference between the two runs. Impact: a flaky red on tag builds makes releases look broken and erodes trust in CI as a release gate (the Docker publish job is independent and succeeded, so the deploy still shipped, but a reviewer sees a red release). Likely fix: raise the per-test timeout for the affected async case (or the file) and/or make the bridge test deterministic so it does not depend on wall-clock scheduling. Repro is intermittent; CI logs show the failing case is an async test/hook that occasionally exceeds 2000ms.

## System Info

GitHub Actions ubuntu runner; mocha default 2000ms timeout; observed on tag v0.4.11 run 29079260774 (Lint/Typecheck/Test job); passed on main push of same commit 78306ef
