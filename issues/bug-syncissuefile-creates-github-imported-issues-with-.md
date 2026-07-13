---
title: syncIssueFile creates GitHub-imported issues with invalid status/milestone defaults
status: resolved
created: 2026-07-09
author: agent
author-role: user
category: bug
priority: medium
complexity: medium
estimated_effort: S
demand_count: 1
reported_dates: [2026-07-09]
channel: dev
tags:
  - reported-bug
github_issue: 381
---

# syncIssueFile creates GitHub-imported issues with invalid status/milestone defaults

## Description

src/mcp/tools/issue_workflow.ts's syncIssueFile() (the "create new file" branch, importing a GitHub issue into issues/ for the first time) had its own hardcoded frontmatter template with `status: open` and `milestone: future` -- the same invalid-defaults defect as capture_bug_report's stale dist/ build, but this one was a genuine unfixed source bug in a separate function. Fixed directly this session: status changed to `new`, `milestone: future` line removed (matching the already-correct createReportedBug() template in src/dispatch/bridge.ts), and dist/ rebuilt via `npm run compile`.

## System Info

None provided
