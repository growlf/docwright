---
title: "Plan: UI — Lifecycle Graph View"
status: draft
author: "NetYeti"
created: "2026-06-07"
created_by: "NetYeti@phoenix"
tags: [ui, graph, lifecycle, visualization]
proposal_source: "proposals/approved/ui-lifecycle-graph-view"
priority: medium
mode: guided
assigned_to: ["NetYeti"]
related_to:
  - proposals/gantt-view-dependencies.md
  - plans/phase-4-profile-acl-ai.md
  - plans/completed/collation.md
  - proposals/knowledge-graph-cross-document-idea-linkage.md
depends_on: []
blocks: []
template_version: "1.0"
tests_defined: true
total_steps: 7
completed_steps: 0
phase: 5
github_epic: null
---

# Plan: UI — Lifecycle Graph View

## Overview

Build a lifecycle graph view on the status page that visualises the full project lineage: how a feature request became a proposal, how a proposal became a plan, how a plan became completed work. Phase 1 delivers a funnel view (horizontal swimlanes per stage, SVG arrows, no new infra) using the existing status API. Phase 3 adds dependency graph with D3.js and backlink traversal.

## Implementation Steps

| Step | Action | Details | Status | Issue | Branch |
|------|--------|---------|--------| --- | --- |
| 1 | Add funnel view component to status page | Render lifecycle stages as horizontal swimlanes (open proposals, approved proposals, active plans, completed) using existing status API data. Each lane shows document cards. | ⏳ Pending | — | — |
| 2 | SVG arrow connectors between stages | Simple SVG lines connecting adjacent swimlanes showing the progression flow. No graph library needed. | ⏳ Pending | — | — |
| 3 | Click-to-navigate on cards | Each document card opens the document in the main content pane at its lifecycle path. | ⏳ Pending | — | — |
| 4 | Hover tooltip with frontmatter summary | Tooltip on hover showing title, status, assigned_to, complexity from frontmatter. | ⏳ Pending | — | — |
| 5 | Filter controls | Filter by phase, status, assigned contributor, or tag. Collapse completed work to focus on active/upcoming. | ⏳ Pending | — | — |
| 6 | Phase view mode (Phase 3) | Group nodes by phase: frontmatter, showing Phase 1 through Phase N as column groups within each swimlane. Requires backlink index. | ⏳ Pending | — | — |
| 7 | Dependency graph (Phase 3) | Force-directed graph using D3.js showing full document lineage with proposal_source, related_to, depends_on, blocks, subsumed_by edges. Requires backlink index from Phase 3. | ⏳ Pending | — | — |

## Parallelism Map

Steps that share no overlapping files can be worked simultaneously on separate `feat/` branches.
Fill in Depends On and Parallel With based on reviewing the step details above.

| Step | Depends On | Parallel With | Notes |
| --- | --- | --- | --- |
| 1 | — | — | |
| 2 | — | — | |
| 3 | — | — | |
| 4 | — | — | |
| 5 | — | — | |
| 6 | — | — | |
| 7 | — | — | |

## Testing Plan

- [ ] Step 1: Add funnel view component to status page
- [ ] Step 2: SVG arrow connectors between stages
- [ ] Step 3: Click-to-navigate on cards
- [ ] Step 4: Hover tooltip with frontmatter summary
- [ ] Step 5: Filter controls
- [ ] Step 6: Phase view mode (Phase 3)
- [ ] Step 7: Dependency graph (Phase 3)
1. Funnel view renders correctly for empty vault (no proposals yet)
2. Funnel view renders correctly for vault with docs at every lifecycle stage
3. Clicking each card navigates to the correct document path
4. Hover tooltip shows correct frontmatter fields
5. Filters correctly reduce visible cards
6. Phase 3: graph library renders nodes and edges correctly

## Rollback Procedures

- Revert the funnel view component addition
- Remove SVG arrow rendering from status page
- For Phase 3: remove D3.js dependency, revert graph component

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| New dependency (D3.js for Phase 3) increases bundle size | Medium | Medium | Funnel view (Phase 1) requires no new deps; D3.js loaded lazily only for Phase 3 |
| Status API doesn't return enough data for full graph | Low | High | Funnel view uses existing API; Phase 3 graph requires backlink index which is separate work |
| Performance with large vaults | Low | Medium | Paginate or virtualize card rendering if needed |

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-08 | Plan filled in from proposal — funnel view, dependency graph, 7 implementation steps with testing and risk assessment | NetYeti |
