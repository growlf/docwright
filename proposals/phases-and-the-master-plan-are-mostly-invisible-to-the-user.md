---
title: "Phases and the Master Plan Are Mostly Invisible to the User"
author: NetYeti
created: 2026-06-05
tags:
  - ux
  - navigation
  - roadmap
  - phases
complexity: low
estimated_effort: S
approved: false
created_by: NetYeti@phoenix
assigned_to: ""
---

## Problem

DocWright's development is organized into phases (Phase 1, Phase 2, Phase 3, etc.) and guided by a master plan / roadmap. However, these phases and the master plan are not surfaced anywhere in the UI. A user landing on the vault sees individual proposals and plans but has no way to answer:

- What phase are we in right now?
- What's coming next?
- What's the overall roadmap?
- How does this particular proposal or plan fit into the bigger picture?

This makes DocWright's own governance structure opaque to its users, which undermines one of its core promises — making governance visible.

## Proposed Solution

### 1. Phase indicator in the status page header

The vault status page shows the current active phase (from `plans/phase-*.md` or the frontmatter convention) as a badge or label in the header: "Phase 2 — Foundation". The phase name links to the phase plan.

### 2. Roadmap section on the status page

A collapsible **Roadmap** section below the active plans list shows:
- Completed phases (Phase 0 — Spike, ✅ Phase 1 — Web UI Prototype)
- Current phase (→ Phase 2 — Foundation, active)
- Upcoming phases (Phase 3 — Profile & ACL, Phase 4 — Enterprise)
- Each entry links to the phase plan or milestone doc

### 3. Phase tag on lifecycle graph

The lifecycle graph view ([[proposals/ui-lifecycle-graph-view.md]]) already supports a **Phase view** mode that groups nodes by phase. This proposal ensures the phase data is populated and visible from the status page entry point.

### 4. Plan-to-phase mapping

Each plan can optionally declare a `phase:` field in its frontmatter. The status page and roadmap section then group plans by phase automatically.

## Relationship to Existing Work

| Feature | Relationship |
|---------|-------------|
| [[proposals/ui-lifecycle-graph-view.md]] | Phase view mode already exists; this ensures phase data is populated |
| Status page | Phase indicator and roadmap section extend the existing layout |
| Versioning policy | `0.MINOR.PATCH` — minor = phase number, patch = completed plans in phase |

## Out of Scope

| Idea | Why deferred |
|------|-------------|
| Interactive roadmap timeline (Gantt-style) | Gantt view handles timeline visualization separately |
| Auto-generating phase plans from proposals | Phase scope should be deliberately defined, not auto-derived |
| Per-user phase filtering | Single phase indicator suffices for current scale |
