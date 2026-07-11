---
title: VERSION patch number diverged from completed-plan count policy
github_issue: https://github.com/growlf/docwright/issues/300
status: new
created: 2026-07-10
author: agent
author-role: user
category: bug
priority: medium
complexity: medium
estimated_effort: S
demand_count: 1
reported_dates: [2026-07-10]
channel: dev
tags:
  - reported-bug
---

# VERSION patch number diverged from completed-plan count policy

## Description

policies/core/versioning.md defines PATCH as "completed plan count within the current phase". VERSION currently reads 0.4.11, but plans/completed/ contains zero phase-4-*.md files (Phase 4 overview plan is still draft, 1/12 deliverables). In practice patch has been bumped per release (e.g. v0.4.10, v0.4.11 live-AI visibility releases), not per completed plan. Policy and practice have diverged — either the policy should be amended to patch-per-release, or patch bumps should be automated at transition_to_completed so the count stays true. Manual patch bumps are a code-over-memory violation either way.

## System Info

None provided
