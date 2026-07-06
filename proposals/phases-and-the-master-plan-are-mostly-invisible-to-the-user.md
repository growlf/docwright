---
title: "Phases and the Master Plan Are Mostly Invisible to the User"
author: NetYeti
created: 2026-06-05
tags:
  - ux
  - navigation
  - roadmap
  - phases
  - status-page
  - draft-plans
complexity: low
estimated_effort: M
approved: false
created_by: NetYeti@phoenix
assigned_to: ""
milestone: backlog
---

## Problem

DocWright's development is organized into phases (Phase 1, Phase 2, etc.) and guided
by a master plan ([PROJECT.md](/PROJECT.md)) at the root of the repo. However, these
are not surfaced anywhere in the UI. A user landing on the vault sees individual
proposals and plans but has no way to answer:

- What phase are we in right now?
- What's coming next?
- What's the overall roadmap?
- How does this particular proposal or plan fit into the bigger picture?

Additionally, plans with `status: draft` (scaffolded but not yet approved) are
completely invisible on the status page. There is no way to see in-flight work
that hasn't passed the approval gate yet.

This makes DocWright's own governance structure opaque to its users, which
undermines one of its core promises — making governance visible.

## Proposed Solution

### 1. Phase indicator in the status page header

Parse `PROJECT.md` §14 (Phased Delivery) to determine the current phase by reading
checkbox state — the first section with any `[ ]` (incomplete) item is the current
phase. Display as a badge in the status page header:

> **Phase 2 — Foundation** (link to `PROJECT.md`)

Clicking navigates to `PROJECT.md` §14 anchored at the current phase heading.

**Why PROJECT.md is the canonical source:** It already tracks per-phase completion
via checkboxes. Duplicating this state into a separate phases registry or frontmatter
field creates drift. Reading it directly ensures the status page always reflects
the true phase state.

### 2. Draft plans visible on status page

Plans with `status: draft` (scaffolded but not yet approved) currently have no
presence in the UI. The status page should surface them in a **Draft Plans** section
between active plans and completed, showing:

- Plan title (linked to plan file)
- Source proposal (linked via `proposal_source:` frontmatter)
- Date drafted
- **Approve** action button to transition to `approved` and promote to Active Plans

This applies to all draft plans regardless of phase — the Proposal Relationship
Engine scaffolds plans with `status: draft`, and without this visibility they are
dead ends. Stewards need to see and approve them; contributors need to know they
exist.

### 3. Roadmap section on the status page

A collapsible **Roadmap** section below active plans shows the phase timeline,
parsed from `PROJECT.md` §14:

- Phase 0 — Spike ✅
- → **Phase 2 — Foundation** ← *(current, 2–3 weeks)*
- Phase 3 — Intelligence, Promote, LLM Wiki & Web UI (upcoming)
- Phase 4 — Polish & Distribution (upcoming)
- Phase B — Shared Team Daemon (post-Phase 4)
- Phase C — Live Co-Editing (aspirational)

Completed phases show a checkmark. The current phase is highlighted. Upcoming
phases link to their section in `PROJECT.md`. Each phase shows its effort estimate
from the source.

### 4. Plan-to-phase mapping

Each plan declares its phase via a `phase:` frontmatter field (e.g., `phase: "Phase 2"`,
`phase: "Phase B"`). Plans without a `phase` field go into a **Cross-Phase / Unassigned**
catch-all group.

The roadmap section groups approved and in-progress plans under their phase:

- **Phase 2 (current):** plan-A ✅, plan-B ✅, plan-C ⏳
- **Phase 3 (upcoming):** plan-D (not started)
- **Unassigned:** plan-X, plan-Y

**Why frontmatter over filename convention:** Filenames change during lifecycle
transitions (e.g., `plan-` prefix vs `phase-` prefix), creating drift. A dedicated
`phase:` field is explicit, survives renames, and is queryable by the Relationship
Engine for cross-phase dependency detection. The existing `phase-*.md` filename
pattern remains available as a naming convention but is not the source of truth.

**Validation:** The frontmatter linter ([[proposals/approved/core-classifying-proposals-when-created-or-updating.md]])
should validate that `phase:` matches a known phase from `PROJECT.md` §14.

### 5. Phase tag on lifecycle graph *(blocked)*

The lifecycle graph view ([[proposals/approved/ui-lifecycle-graph-view.md]]) already
supports a Phase view mode that groups nodes by phase. Once that proposal is
approved and implemented, this proposal ensures the phase data from `PROJECT.md`
is populated and the status page links into the graph view.

**Blocked on:** approval/implementation of [[proposals/approved/ui-lifecycle-graph-view.md]].

## Relationship to Existing Work

| Feature | Relationship |
|---------|-------------|
| [[proposals/proposal-relationship-engine-and-plan-button.md]] | Creates draft plans — this proposal makes them visible on the status page (Part 2) |
| [[proposals/approved/ui-lifecycle-graph-view.md]] | Phase grouping exists; blocked until approved |
| [[proposals/approved/ux-collating-proposals-into-apropriate-plans.md]] | Collation foundation — status page layout reference |
| [[proposals/related-docs-ux-improvements.md]] | Status page UX improvements — prerequisites for layout changes |
| `PROJECT.md` §14 | Canonical source of phase state and completion |
| Versioning policy | `0.MINOR.PATCH` — minor = phase number, patch = completed plans in phase |

## Out of Scope

| Idea | Why deferred |
|------|-------------|
| Interactive roadmap timeline (Gantt-style) | Gantt view handles timeline visualization separately |
| Auto-generating phase plans from proposals | Phase scope should be deliberately defined, not auto-derived |
| Per-user phase filtering | Single phase indicator suffices for current scale |
| Editing phase state from the UI | `PROJECT.md` is the canonical source — edit the file |
