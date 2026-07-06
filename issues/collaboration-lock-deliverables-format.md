---
title: Lock plan deliverables format (YAML array vs markdown table)
status: resolved
author: NetYeti
author-role: contributor
created: 2026-07-06
created_by: NetYeti@cluster-llm
category: decision
priority: high
complexity: low
estimated_effort: XS
plan: collaboration-issue-model-and-roadmap-sync.md
cross_link: plans/collaboration-issue-model-and-roadmap-sync.md
github_issue: null
channel: dev
tags:
  - collaboration
  - process
---

# Lock plan deliverables format

## Acceptance Criteria

- [x] Decision: YAML array or markdown table?
- [x] Format documented in org-operations profile
- [x] Example in plan templates
- [x] Issue-generation tool design locked against format

## Details

The deliverables format determines how the issue-generation tool extracts work items from a plan when it moves to in-progress. Recommend YAML array for simpler parsing.

Part of Step 2 of collaboration-issue-model plan.
