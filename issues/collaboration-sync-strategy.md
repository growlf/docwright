---
title: Brief sync strategy (one-way mirror, fields, timing)
status: resolved
author: NetYeti
author-role: contributor
created: 2026-07-06
created_by: NetYeti@cluster-llm
category: decision
priority: medium
complexity: low
estimated_effort: XS
plan: collaboration-issue-model-and-roadmap-sync.md
cross_link: plans/collaboration-issue-model-and-roadmap-sync.md
github_issue: null
channel: dev
tags:
  - collaboration
  - sync
---

# Brief sync strategy (one-way mirror, fields, timing)

## Acceptance Criteria

- [x] Decision: one-way direction (file→tracker confirmed)
- [x] Field mapping documented (priority→labels, milestone→milestone, assigned_to→assignees, status→state)
- [x] Trigger method chosen (on-demand CLI in v0.6.0; post-commit hook in v0.7.0)
- [x] Conflict resolution policy (file always wins; tracker treated as stale mirror)
- [x] Forgejo scope decision (same tool with different API endpoint, or defer?)
- [x] Strategy briefed in plan

## Details

Outlines the mechanics for mirroring vault issues/ to GitHub/Forgejo as a read-only projection. Full sync tool implementation deferred to v0.7.0; v0.6.0 uses manual CLI process.

Part of Step 7 of collaboration-issue-model plan.
