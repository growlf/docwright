---
title: bridge.test.ts suggestDuplicates flaky in CI — shells out to real gh CLI with a tight timeout
status: resolved
resolved_by: src/dispatch/bridge.ts (fix/flaky-bridge-test)
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
  - test/dispatch/bridge.test.ts
  - src/dispatch/bridge.ts
tags:
  - reported-bug
---

# bridge.test.ts suggestDuplicates flaky in CI — shells out to real gh CLI with a tight timeout

> **Resolved 2026-07-11.** Root cause: `suggestDuplicates` (`src/dispatch/bridge.ts`) called `queryGhIssues`, which shells out to the real `gh issue list` (execSync 5000ms); mocha's 2000ms per-test default fired first when `gh` was slow/auth-variant in CI, so the test flaked — a merge-blocking risk on any PR since it's a required check. Fix: made the gh query **injectable** (`suggestDuplicates(root, title, category, ghQuery=queryGhIssues)`) and the tests now pass a no-network fake, so no test shells out to `gh`. `bridge.test.ts` now runs ~20ms deterministically (was flaking at 2000ms); a new test covers the injected gh-suggestion path. Verified: full `test:dispatch` 405 passing, 3 consecutive fast runs.


## Description

test/dispatch/bridge.test.ts's "suggestDuplicates is read-only and returns similar open bugs" test calls suggestDuplicates(), which calls queryGhIssues() in src/dispatch/bridge.ts -- that function shells out to the REAL `gh issue list` CLI (no mock), with a 5000ms execSync timeout. Mocha's default per-test timeout is 2000ms, so on a CI runner where `gh` is slow to authenticate/respond (or just slower than a local dev machine), the test times out before the 5s execSync timeout is even reached, failing with "Timeout of 2000ms exceeded."

Reproduced on PR #290 (a docs-only frontmatter change, completely unrelated to bridge.ts): "Lint, Typecheck & Test" failed on suggestDuplicates with exactly this timeout, then passed cleanly on an immediate rerun with no code change -- confirming it's flaky/environmental, not deterministic.

This means ANY PR, regardless of what it touches, has a nonzero chance of a red CI check purely from gh CLI latency/auth variance on the runner. Given "Branch policy check" and this "Lint, Typecheck & Test" job are both required status checks with no bypass (enforce_admins: true), a flaky required check is a real merge-blocking risk repo-wide.

Fix: mock/stub queryGhIssues in the test (inject the gh-CLI-calling function so tests can substitute a fake), or give the test itself a longer explicit timeout (this.timeout(6000)) so it's at least longer than execSync's own 5000ms ceiling, or skip the GH-querying assertion in CI entirely and test only the local-suggestion path.

## System Info

None provided
