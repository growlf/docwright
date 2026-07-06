---
title: Certify Tests button unreachable when tests were verified out-of-band — no UI affordance for tests_human_reviewed
status: open
github_issue: 220
created: 2026-07-06
author: NetYeti
author-role: user
category: bug
priority: high
complexity: medium
estimated_effort: S
demand_count: 1
reported_dates: [2026-07-06]
milestone: future
channel: dev
tags:
  - reported-bug
---

# Certify Tests button unreachable when tests were verified out-of-band — no UI affordance for tests_human_reviewed

## Description

Live repro 2026-07-06 (BDFL completing webui-write-integrity): the PropertiesPane renders Certify Tests only when tests_defined is FALSE and testPassed===true (client state set only by the pane's own Run Tests flow in the current browser session). When tests were recorded via the verify_plan_tests MCP tool — the canonical evidence path since PR #161 — tests_defined is already true, so the pane shows only the disabled Complete (N blockers) button and there is no control anywhere that sets tests_human_reviewed. The human is told to certify but given no way to do it; the only rendered escape (the ✓ Tests button) DEMOTES tests_defined to re-enter the UI-only Run Tests loop. Fix direction: render Certify Tests whenever tests_human_reviewed is false and tests_last_result: pass exists on the plan (server-recorded evidence should count at least as much as session-local testPassed), and/or always show a certify affordance next to the blocker list. Workaround: tick the tests_human_reviewed checkbox in the pane's field list and Save. Related: issues/bug-properties-pane-save-demotes-testsdefined-on-an-un.md (#218 — the demote heuristic that compounds this).

## System Info

DocWright main @ 57bdf9a (local dev instance), phoenix
