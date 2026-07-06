---
title: Add plan/issue linkage schema fields to org-operations
status: resolved
author: NetYeti
author-role: contributor
created: 2026-07-06
created_by: NetYeti@cluster-llm
category: feature
priority: high
complexity: low
estimated_effort: S
plan: collaboration-issue-model-and-roadmap-sync.md
cross_link: plans/collaboration-issue-model-and-roadmap-sync.md
github_issue: null
channel: dev
tags:
  - schema
  - collaboration
---

# Add plan/issue linkage schema fields to org-operations

## Acceptance Criteria

- [x] Add `tracked_by: []` field to plan type in org-operations schema
- [x] Add `plan:` field to issue type in org-operations schema
- [x] Add `cross_link:` field to issue type in org-operations schema
- [x] Fields are optional initially (backward-compat)
- [x] Pre-commit validation accepts lists of issue references
- [x] Schema passes validation tests

## Details

Enables bidirectional linking between plans and their tracked issues per the collaboration model. Plans list their issues in `tracked_by:`; issues reference their plan in `plan:` + `cross_link:`.

Part of Step 1 of collaboration-issue-model plan.
