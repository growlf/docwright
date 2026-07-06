---
title: Build issue generation tool (plan-start → scaffold issues)
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
  - automation
---

# Build issue generation tool (plan-start → scaffold issues)

## Acceptance Criteria

- [x] MCP tool or dispatch helper scaffolds issues from plan deliverables
- [x] One issue per deliverable with triage fields populated
- [x] Plan's `tracked_by:` list auto-populated with generated issue references
- [x] Each generated issue has `plan:` and `cross_link:` fields set
- [x] Tool integrates with plan-status transition (runs on in-progress)
- [x] Round-trip test: plan → issues → plan, no drift

## Details

Automates issue generation at plan-start per the collaboration model. Requires deliverables format locked (Issue #collaboration-lock-deliverables-format) and schema fields added (Issue #collaboration-schema-linkage-fields).

Part of Step 3 of collaboration-issue-model plan.
