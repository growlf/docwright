---
title: Web UI lifecycle transitions bypass the MCP completion gate — no test-evidence or checkbox validation on Complete
status: resolved
closed_by_pr: "#195"
resolved: 2026-07-05
github_issue: 172
created: 2026-07-05
author: NetYeti
author-role: user
category: bug
priority: high
complexity: medium
estimated_effort: S
demand_count: 1
reported_dates: [2026-07-05]
milestone: future
channel: dev
related:
  - issues/bug-webui-lifecycle-actions-not-committed-to-git.md
  - issues/bug-complete-plan-stray-copy-and-no-refresh.md
tags:
  - reported-bug
---

# Web UI lifecycle transitions bypass the MCP completion gate — no test-evidence or checkbox validation on Complete

## Description

The Web UI transition-completed endpoint (src/webui/src/routes/api/lifecycle/transition-completed/+server.ts) is a separate code path from the MCP transition_to_completed and does not call checkCompletionGate. Observed live 2026-07-05: the BDFL's Complete click on plans/contribution-pipeline.md transitioned the plan without the gate running — no validation of tests_defined/tests_human_reviewed, no unchecked-Testing-Plan-box refusal, no tests_last_result check, no stale-evidence warning. Harmless in that instance (all evidence was green), but the UI can currently complete a plan the MCP layer would refuse, making the #159/PR #161 gate skippable by surface choice. Fix: the webui endpoint must call the same checkCompletionGate (src/mcp/lib/steps.ts) — or better, route through shared dispatch logic so gate parity is structural, not copied. Same family as the parseFm duplication (#144/#94): logic copied per-surface drifts.

## System Info

DocWright main @ 16fb359, webui dev, phoenix
