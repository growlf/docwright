---
title: Issues have no forward path
status: resolved
resolved: 2026-07-09
consumed_by: proposals/add-issue-forward-path-actions.md
author: NetYeti
author-role: user
created: 2026-07-05
category: bug
priority: medium
complexity: medium
estimated_effort: S
tags: []
reported_dates: [2026-07-05]
demand_count: 1
triage_date: 2026-07-05
triage_by: NetYeti
triage_notes: Triaged as bug / medium.
scope_check_date: 2026-07-05
scope_check_by: NetYeti
scope_assessment: Issue is in active backlog.
scope_decision: in-scope
github_issue: 176
assigned_to: []
created_by: NetYeti@cluster-llm
channel: dev
---

# Issues have no forward path

## Description

After opening an issue document, I do not see a way to move it forward, make a proposal or plan out of it, etc.  I think an issue needs to be a plan next.

## System Info

None provided

## Resolution (2026-07-09)

`IssueForwardPathActions.svelte` (Create Proposal / Link Proposal buttons) was already built per `proposals/add-issue-forward-path-actions.md`, but was actually non-functional for almost every issue: it gated visibility on `frontmatter.type === 'issue'`, a field the org-operations schema never requires — only 6 of 62 existing issue files happened to set it, and no issue-creation path (capture_bug_report, GitHub sync) sets it either. Fixed by passing the document's path into the component and detecting issue documents by their `issues/` path prefix instead. Verified live: buttons render on a real issue page and the Create Proposal modal opens correctly. Tracked under `plans/improve-bug-feature-reporting-tool.md` (Wave C, Step 6).
