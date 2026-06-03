---
complexity: medium
title: "UI — Lifecycle Graph View"
author: NetYeti
created: 2026-06-03
tags:
  - ui
  - graph
  - lifecycle
  - visualization
  - improvements
deferred: true
deferred_reason: "Requires Phase 3 backlink index and dispatch module relationship data. Revisit after those are stable."
created_by: "NetYeti@phoenix"
assigned_to: NetYeti
related_to:
  - proposals/gantt-view-dependencies.md
  - plans/phase-3-profile-acl-ai.md
  - plans/completed/collation.md
---

## Problem

The vault status page shows each lifecycle stage as a flat list — open
proposals, active plans, completed plans. There is no view that shows the
full lineage: how a feature request became a proposal, how a proposal became
a plan, how a plan became completed work. You cannot see the shape of the
project at a glance or trace how any piece of work came to be.

## Proposed Solution

A **lifecycle graph view** accessible from the status page (or activity bar)
that visualises the full project hierarchy as a connected graph:

```
Project
 └── Completed Plans ─────── (what shipped)
 └── Active Plans ─────────── (what is in progress)
      └── Plans ─────────────── (what is approved and upcoming)
           └── Approved Proposals ── (approved, awaiting plans)
                └── Proposals ──────── (under consideration)
                     └── Features / Deferred Ideas ── (the backlog)
```

Each node is clickable and opens the document in the main content pane.
Edges show the relationships: `proposal_source`, `related_to`, `depends_on`,
`blocks`, `subsumed_by`.

### View modes

**Funnel view** — the default. Horizontal swimlanes per lifecycle stage,
documents as cards, relationships as connecting lines. Shows the full
pipeline from ideas to shipped work. Makes it immediately visible where
work is piling up or stalling.

**Dependency graph** — nodes and edges only, force-directed layout. Useful
for tracing a specific document's full lineage: what it depends on, what
it blocks, what it relates to.

**Phase view** — groups nodes by `phase:` frontmatter, showing Phase 1
through Phase N as column groups within each swimlane. Makes the roadmap
visible as a connected structure rather than a list.

### Navigation

- Click any node to open the document
- Hover to see frontmatter summary (title, status, assigned_to, complexity)
- Filter by phase, status, assigned contributor, or tag
- Collapse completed work to focus on active and upcoming

### Rendering

Candidate library: D3.js (MIT) for force-directed graphs, or a simpler
SVG-only implementation for the funnel view. The funnel view may not need
a graph library at all — it is essentially the status page with visual
relationship arrows between stages.

## Relationship to other proposals

- **Gantt view** ([[proposals/gantt-view-dependencies.md]]) — shows plan
  timelines and effort estimates. Complementary: Gantt is the timeline view,
  this is the lineage view.
- **Wikilink graph** (Phase 3) — the backlink index that makes this
  performant on large vaults.
- **Collation panel** — already shows related proposals inline. This
  proposal is the vault-wide version of that concept.

## Deferred Because

Meaningful graph data requires:
1. The backlink index (`_backlinks.json`) from Phase 3 dispatch work —
   without it, a vault-wide relationship scan on every load is too slow
2. The `proposal_source`, `related_to`, and `depends_on` fields to be
   consistently populated — currently sparse on older documents
3. A graph rendering strategy to be chosen

The funnel view (swimlanes without edges) could ship earlier as a visual
upgrade to the status page, without requiring the full graph infrastructure.
See [[plans/phase-3-profile-acl-ai.md]].

## Out of Scope

| Idea | Why deferred | Deferred proposal |
|------|-------------|-------------------|
| 3D graph / immersive view | Fun but not useful for governance | — |
| Real-time collaborative cursors on the graph | Phase 4+ | Post-launch |
| Export graph as PNG/SVG | Nice-to-have, post-launch | Post-launch |

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-03 | Created — captured from end-of-session user request | NetYeti |
