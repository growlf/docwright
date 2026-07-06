---
title: Properties-pane save demotes tests_defined on an unchanged body — false positive in the body-edited heuristic
status: open
github_issue: 218
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

# Properties-pane save demotes tests_defined on an unchanged body — false positive in the body-edited heuristic

## Description

Live repro 2026-07-06 during webui-write-integrity completion: the BDFL's properties-pane save on plans/webui-write-integrity.md produced auto-commit c5e4df8 whose entire diff is one line — tests_defined: true -> false — with the body untouched. The saveFrontmatter client heuristic (src/webui/src/routes/[...path]/+page.svelte) resets tests_defined whenever `content !== prevParsed.body`, but something makes that comparison differ on a doc whose body was never edited (suspects: state staleness after an SSE fileChanged reload, or a mismatch between load-time `content` and re-split raw). Server-side /api/write updateTestsDefined was ruled out: its hasTestingPlan returns true on the exact on-disk content. Impact: certifying/completing a plan silently un-certifies tests_defined, blocking the completion gate the moment it matters and never before (demote is a no-op while tests_defined is false). Fix direction: compare normalized bodies (or drop the client heuristic entirely and let the explicit run-tests/verify flow own tests_defined per the #86/#108 demote-only design). Related: issues/bug-webui-save-silently-flips-tests-defined.md (#148, resolved for the syncTestCriteria half by PR #209 — this is the surviving demote half).

## System Info

DocWright main @ c5e4df8 (local dev instance, AUTH_MODE=none Dev User), phoenix
