---
title: "Flaky CI: test/dispatch/bridge.test.ts intermittently exceeds 2000ms mocha timeout, failing docs-only PRs"
status: new
created: 2026-07-11
author: NetYeti
author-role: user
category: bug
priority: medium
complexity: medium
estimated_effort: S
demand_count: 1
reported_dates: [2026-07-11]
channel: dev
github_issue: https://github.com/growlf/docwright/issues/321
tags:
  - reported-bug
---

# Flaky CI: test/dispatch/bridge.test.ts intermittently exceeds 2000ms mocha timeout, failing docs-only PRs

## Description

Observed 2026-07-10 on PR #320 (docs-only change — 14 markdown governance files, zero code): the "Lint, Typecheck & Test" job failed with "Error: Timeout of 2000ms exceeded. For async tests and hooks, ensure done() is called" in test/dispatch/bridge.test.ts, with 399 other tests passing in 7s. A docs-only diff cannot cause a dispatch-module test failure, so the test is timing-flaky on CI runners (async work near the default 2s mocha budget). Re-run passed/pending at filing time. Impact: intermittent red CI on unrelated PRs erodes trust in the required check and trains people to rerun-until-green. Fix directions: identify the async test in bridge.test.ts that can exceed 2s on a slow runner and either mock the slow dependency, extend that test's timeout deliberately (this.timeout), or make its completion deterministic.

## System Info

GitHub Actions ubuntu runner, run 29141209997, PR #320, main @ 2e49923 era
