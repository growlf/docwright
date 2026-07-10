---
title: bridge.test.ts suggestDuplicates flaky in CI — shells out to real gh CLI with a tight timeout
status: new
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

## Description

test/dispatch/bridge.test.ts's "suggestDuplicates is read-only and returns similar open bugs" test calls suggestDuplicates(), which calls queryGhIssues() in src/dispatch/bridge.ts -- that function shells out to the REAL `gh issue list` CLI (no mock), with a 5000ms execSync timeout. Mocha's default per-test timeout is 2000ms, so on a CI runner where `gh` is slow to authenticate/respond (or just slower than a local dev machine), the test times out before the 5s execSync timeout is even reached, failing with "Timeout of 2000ms exceeded."

Reproduced on PR #290 (a docs-only frontmatter change, completely unrelated to bridge.ts): "Lint, Typecheck & Test" failed on suggestDuplicates with exactly this timeout, then passed cleanly on an immediate rerun with no code change -- confirming it's flaky/environmental, not deterministic.

This means ANY PR, regardless of what it touches, has a nonzero chance of a red CI check purely from gh CLI latency/auth variance on the runner. Given "Branch policy check" and this "Lint, Typecheck & Test" job are both required status checks with no bypass (enforce_admins: true), a flaky required check is a real merge-blocking risk repo-wide.

Fix: mock/stub queryGhIssues in the test (inject the gh-CLI-calling function so tests can substitute a fake), or give the test itself a longer explicit timeout (this.timeout(6000)) so it's at least longer than execSync's own 5000ms ceiling, or skip the GH-querying assertion in CI entirely and test only the local-suggestion path.

## System Info

None provided
