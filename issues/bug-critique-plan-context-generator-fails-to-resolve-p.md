---
title: critique-plan context generator fails to resolve proposal_source under proposals/approved
github_issue: https://github.com/growlf/docwright/issues/304
status: new
created: 2026-07-10
author: agent
author-role: user
category: bug
priority: low
complexity: medium
estimated_effort: S
demand_count: 1
reported_dates: [2026-07-10]
channel: dev
tags:
  - reported-bug
---

# critique-plan context generator fails to resolve proposal_source under proposals/approved

## Description

scripts/critique-plan.js reports "proposal_source: — 0 found / no traceable origin" for plans whose proposal_source points at proposals/approved/<name>.md, even when that file exists and is approved: true (reproduced 2026-07-10 critiquing plans/adopt-milestone-driven-roadmap-discipline.md; its proposal exists at proposals/approved/adopt-milestone-driven-roadmap-discipline.md, 193 lines). Every future critique of a properly-approved plan will falsely flag a missing origin, weakening the adversarial-critique signal. Fix: resolve proposal_source paths against both proposals/ and proposals/approved/ (and follow the documented lifecycle move).

## System Info

None provided
