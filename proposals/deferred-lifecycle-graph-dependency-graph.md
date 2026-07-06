---
title: "Deferred: Lifecycle Graph — Dependency Graph View (D3.js)"
author: NetYeti
author-role: contributor
created: 2026-06-29
tags:
  - ui
  - graph
  - lifecycle
  - visualization
  - d3
  - phase-3
complexity: high
estimated_effort: L
approved: false
created_by: "NetYeti@phoenix"
assigned_to: ""
related_to:
  - plans/completed/lifecycle-graph.md
  - plans/phase-4-profile-acl-ai.md
  - proposals/approved/knowledge-graph-cross-document-idea-linkage.md
deferred_reason: "Requires Phase 3 backlink index for edge traversal. D3.js dependency adds bundle weight — deferred until backlink index ships. Deferred from lifecycle-graph.md Step 7."
milestone: backlog
---

## Problem

The funnel view shows lifecycle progression but not document relationships. A team working on a large vault needs to see how a feature request became a proposal became a plan became completed work — including forks, merges, and dependencies between documents.

## Proposed Solution

Force-directed dependency graph using D3.js (lazy-loaded, Phase 3 only):

1. Load `_backlinks.json` to resolve edges: `proposal_source`, `related_to`, `depends_on`, `blocks`, `subsumed_by`
2. Render nodes as document cards; colour by lifecycle stage (matching funnel view palette)
3. Edges as directed arrows with label (relation type)
4. Click node to navigate to document; hover shows frontmatter summary tooltip
5. Controls: zoom/pan, filter by edge type, highlight path from selected node

## Gate Condition

Phase 3 backlink index (`_backlinks.json`) must be available and populated. D3.js should be lazy-loaded (dynamic `import()`) so it does not inflate the initial bundle.

## Out of Scope

- Editing relationships from the graph view
- 3D rendering
- Export to image/SVG (add as a follow-on once the view is stable)
