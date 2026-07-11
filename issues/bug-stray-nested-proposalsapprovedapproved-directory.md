---
title: stray nested proposals/approved/approved directory
github_issue: https://github.com/growlf/docwright/issues/302
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

# stray nested proposals/approved/approved directory

## Description

proposals/approved/approved/ exists (nested duplicate of the approved directory). Documents inside it are outside every documented lifecycle path and invisible to tooling that scans proposals/approved/. Likely produced by a double move during a lifecycle transition. Fix: relocate any real documents up one level (dedup against existing approved proposals) and delete the nested directory; consider a lint/policy-atom check that rejects unexpected subdirectories under proposals/.

## System Info

None provided
