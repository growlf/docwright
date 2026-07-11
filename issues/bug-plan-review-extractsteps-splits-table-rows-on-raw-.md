---
title: plan-review extractSteps splits table rows on raw pipe — cells containing escaped pipes truncate the review prompts
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
github_issue: https://github.com/growlf/docwright/issues/318
related:
  - issues/bug-mcp-updatestep-appendhistory-corrupt-table-rows-wh.md
tags:
  - reported-bug
---

# plan-review extractSteps splits table rows on raw pipe — cells containing escaped pipes truncate the review prompts

## Description

`buildReviewPrompts()`/`extractSteps()` in src/webui/src/lib/server/plan-review-live.ts (line ~39) split step-table rows with a naive `line.split('|')`, so a cell containing an escaped pipe (backslash-pipe, legal in markdown tables) is cut at the pipe and the remainder of the cell is silently dropped from the review prompt. Observed 2026-07-10 on plans/adopt-milestone-driven-roadmap-discipline.md: step 5 — which is *about* pipe corruption and contains an escaped pipe — reached the reviewer truncated mid-sentence, and the model dutifully reported "step description truncated, cannot determine fix strategy," producing noise findings. Same defect class as the MCP update_step/append_history pipe-corruption bug (#272 / issues/bug-mcp-updatestep-appendhistory-corrupt-table-rows-wh.md) in a second code path; the legacy /api/plan-review server shares the same parsing. Fix both alongside #272 (a shared escape-aware row parser), or as part of the structured-steps migration that retires table parsing. Also note extractSection() slices Testing/Risk/Rollback to 500 chars and the overview to 150 — the reviewer flags these as "truncated content," so either raise the slice or tell the model the excerpt is intentional.

## System Info

dev instance vite :5173 on phoenix, main @ 2e49923
