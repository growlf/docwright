---
title: "Plan: UI — Lifecycle Graph View"
status: completed
completed_date: 2026-06-29
author: "NetYeti"
created: "2026-06-07"
created_by: "NetYeti@phoenix"
tags: [ui, graph, lifecycle, visualization]
proposal_source: "proposals/approved/ui-lifecycle-graph-view"
priority: medium
mode: guided
assigned_to: NetYeti
related_to:
  - proposals/gantt-view-dependencies.md
  - plans/phase-4-profile-acl-ai.md
  - plans/completed/collation.md
  - proposals/approved/knowledge-graph-cross-document-idea-linkage.md
depends_on: []
blocks: []
template_version: "1.0"
tests_defined: true
tests_human_reviewed: true
total_steps: 5
completed_steps: 5
phase: 5
github_epic: null
---

# Plan: UI — Lifecycle Graph View

## Overview

Funnel view on the status page visualising the full project lifecycle: deferred ideas → open proposals → approved → active plans → completed. Steps 1–5 are complete. Phase view mode and dependency graph (originally Steps 6–7) require the Phase 3 backlink index and are captured as deferred proposals.

## Implementation Steps

| Step | Action | Details | Status | Issue | Branch |
|------|--------|---------|--------| --- | --- |
| 1 | Add funnel view component to status page | Render lifecycle stages as horizontal swimlanes using existing status API. Each lane shows document cards. | ✅ Done | — | — |
| 2 | Arrow connectors between stages | `›` arrow separators between adjacent swimlanes showing progression flow. | ✅ Done | — | — |
| 3 | Click-to-navigate on cards | Each document card routes to the document path via `goto()`. | ✅ Done | — | — |
| 4 | Card metadata display | Inline complexity dot, priority, and assignee chips on each card; native title tooltip. | ✅ Done | — | — |
| 5 | Filter controls | Assignee dropdown, tag dropdown, hide-deferred toggle, and clear button in filter bar above funnel. | ✅ Done | — | — |

## Deferred (captured as proposals)

- **Phase view mode** — group nodes by `phase:` frontmatter within each swimlane. Requires backlink index (Phase 3). Deferred to proposals/deferred/.
- **Dependency graph** — force-directed D3.js graph with `proposal_source`, `related_to`, `depends_on`, `blocks` edges. Requires backlink index (Phase 3). Deferred to proposals/deferred/.

## Testing Plan

- [x] Step 1: Funnel view renders with swimlanes for each lifecycle stage — verified in status page with live vault data
- [x] Step 2: Arrow separators appear between visible stages; hidden stages (when deferred lane collapsed) suppress the arrow correctly
- [x] Step 3: Clicking any card calls `goto()` with the correct document path
- [x] Step 4: Card metadata (complexity dot, priority chip, assignee) visible inline on cards
- [x] Step 5: Assignee filter reduces cards to matching assignee across all lanes; tag filter matches `tags` and `category` fields; hide-deferred collapses the deferred lane; clear button resets all filters; active filters are reflected in real time with Svelte `$derived` state

### Gate Criteria

- [x] Funnel view is accessible from status page via the ⊙ Funnel toggle button
- [x] Filter bar appears with assignee select, tag select, and hide-deferred checkbox
- [x] Filters are reactive: changing a select or checkbox immediately updates all card lanes
- [x] Clear button appears only when a filter is active; clicking it resets to no filters
- [x] No new npm dependencies introduced
- [x] typecheck clean; no new svelte-check errors in FunnelView.svelte

## Rollback Procedures

- Revert `FunnelView.svelte` to remove filter state and filter bar markup
- Pre-existing funnel and status page wiring require no additional rollback

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Assignee/tag dropdowns empty for small vaults | Low | Low | Selects only render when data is present; empty vault shows no filter controls |
| Performance with large vaults | Low | Low | `$derived` filtering is synchronous on client-side arrays, not a network call |

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-08 | Plan filled in from proposal — funnel view, dependency graph, 7 implementation steps | NetYeti |
| 2026-06-29 | Steps 1–4 already complete (FunnelView.svelte existed). Step 5 implemented: filter bar with assignee, tag, hide-deferred. Steps 6–7 deferred (require Phase 3 backlink index). Plan scoped to Steps 1–5. | NetYeti |
