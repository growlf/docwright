---
title: Add enforcement linting (priority, epic link, tracked_by list)
status: resolved
author: NetYeti
author-role: contributor
created: 2026-07-06
created_by: NetYeti@cluster-llm
category: feature
priority: high
complexity: medium
estimated_effort: M
plan: collaboration-issue-model-and-roadmap-sync.md
cross_link: plans/collaboration-issue-model-and-roadmap-sync.md
github_issue: null
channel: dev
tags:
  - collaboration
  - enforcement
---

# Add enforcement linting (priority, epic link, tracked_by list)

## Acceptance Criteria

- [x] Pre-commit hook rejects issue without priority (if planned)
- [x] Pre-commit hook rejects planned issue without epic/cross_link
- [x] Pre-commit hook rejects in-progress plan without `tracked_by:` list
- [x] CI check enforces same rules
- [x] Error messages are clear and actionable
- [x] Fixture tests: all violations caught

## Details

Enforces "assign before start" convention and schema linkage. Prevents the #89 collision (parallel work undetected) by requiring explicit issue tracking on plans.

Part of Step 5 of collaboration-issue-model plan.
