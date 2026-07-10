---
title: release-v0.5.0 plan duplicated in plans/ and undocumented plans/approved/ directory
github_issue: https://github.com/growlf/docwright/issues/301
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

# release-v0.5.0 plan duplicated in plans/ and undocumented plans/approved/ directory

## Description

plans/release-v0.5.0.md (status: in-progress) coexists with plans/approved/release-v0.5.0.md. The documented lifecycle has no plans/approved/ location (plans live in plans/ and move to plans/completed/); this directory is invisible to get_status, the roadplan generator, and lifecycle tooling, so whichever copy is stale will silently mislead. Also related: plans/plan-ui-layout-refactor-view-container-plugin-architecture.md has no status field (get_status shows status=undefined) while its counterpart ui-layout-view-container-refactor.md is already completed — likely another orphan duplicate of the kind removed in PR #296. Fix: reconcile the two release-v0.5.0 copies into one canonical file in plans/, remove plans/approved/, and resolve or delete the undefined-status orphan.

## System Info

None provided
