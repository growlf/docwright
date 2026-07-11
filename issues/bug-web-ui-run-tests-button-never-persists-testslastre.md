---
title: Web UI Run Tests button never persists tests_last_result to plan frontmatter
status: resolved
resolved_by: src/webui/src/routes/api/lifecycle/run-tests/+server.ts (#324)
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
  - issues/bug-web-ui-complete-button-only-sets-status-field-neve.md
  - plans/completed/improve-bug-feature-reporting-tool.md
tags:
  - reported-bug
---

# Web UI Run Tests button never persists tests_last_result to plan frontmatter

> **Resolved 2026-07-11** (backlog cleanup). Fixed by #324 — the run-tests endpoint now persists tests_last_run/result/commit via the shared setFrontmatterField (same path as verify_plan_tests).


## Description

Clicking "Run Tests" on a plan in the Web UI (PropertiesPane.svelte, runTests()) only sets an in-memory `testPassed` component state used to decide whether to show the "Certify Tests" button -- it never writes `tests_last_result`/`tests_last_run`/`tests_last_commit` back to the plan's frontmatter.

This matters because `transition_to_completed` (MCP tool) hard-requires a recorded test run: "Plan has no recorded test run. Run the verify_plan_tests MCP tool ... and get a green run before completing." Since the Web UI's Run Tests never persists that record, ANY plan taken through the UI's Run Tests -> Certify Tests -> Complete flow will always fail transition_to_completed with this error, even though the human genuinely ran and certified the tests through the UI. The only way to actually complete the plan is to separately call the verify_plan_tests MCP tool by hand (which re-runs the tests) before transition_to_completed will proceed -- there's no way to do this from the Web UI at all.

Reproduced this session on plans/improve-bug-feature-reporting-tool.md: NetYeti ran tests and certified via the Web UI, but transition_to_completed still rejected with "no recorded test run" until verify_plan_tests was called manually via MCP.

Fix: have the Web UI's Run Tests button call the same server-side logic verify_plan_tests uses (or a shared function), so a passing run persists tests_last_result/tests_last_run/tests_last_commit the same way, and the two "run tests" paths (UI button, MCP tool) stay in sync instead of silently diverging.

## System Info

None provided
