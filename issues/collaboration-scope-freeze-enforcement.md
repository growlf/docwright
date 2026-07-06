---
title: Scope-freeze enforcement (block proposal_source edits post-Start)
status: new
author: NetYeti
author-role: contributor
created: 2026-07-06
created_by: NetYeti@cluster-llm
category: feature
priority: medium
complexity: medium
estimated_effort: M
plan: collaboration-issue-model-and-roadmap-sync.md
cross_link: plans/collaboration-issue-model-and-roadmap-sync.md
github_issue: null
channel: dev
tags:
  - collaboration
  - governance
---

# Scope-freeze enforcement (block proposal_source edits post-Start)

## Acceptance Criteria

- [ ] Pre-commit hook detects plan in in-progress state
- [ ] Blocks edits to `proposal_source` field (or requires decision doc + override)
- [ ] Error message explains scope-freeze policy
- [ ] Allows other field edits (status, history, etc.)
- [ ] Fixture test: blocked edit attempt, decision doc permits override

## Details

Prevents silent scope drift after plan-start. Once execution begins, scope changes must be auditable and explicit (via decision doc). 

Optional v0.6.0 (can implement as manual convention); required v0.7.0. See collaboration model for full flow.

Part of Step 6 of collaboration-issue-model plan.
