---
title: Compute plan completion from issue state (derived progress)
status: new
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
  - automation
---

# Compute plan completion from issue state (derived progress)

## Acceptance Criteria

- [ ] Plan's completion status computed from linked issues' state
- [ ] All issues resolved → plan eligible for completion
- [ ] Step-table no longer hand-updated once issues exist
- [ ] Derived view computes completed_steps from issue count
- [ ] Fixture test: issues → plan completion, no manual edits
- [ ] Retirement: hand-updated step-table becomes read-only

## Details

Replaces error-prone manual step updates with automated progress tracking. Once issues are generated, the plan's progress becomes a derived view of issue state.

Part of Step 4 of collaboration-issue-model plan.
