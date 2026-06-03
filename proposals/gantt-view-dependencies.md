---
title: "Gantt View for Plan Dependencies and Effort"
author: NetYeti
created: 2026-06-03
tags:
  - ui
  - gantt
  - planning
  - dependencies
  - improvements
deferred: true
deferred_reason: "Depends on depends_on and estimated_effort fields being in active use across plans. Revisit after Phase 2 plans are underway."
created_by: "NetYeti@phoenix"
assigned_to: NetYeti
related_to:
  - plans/completed/collation.md
  - plans/completed/status-page.md
---

## Problem

The Vault Status page shows active plans as a flat list. It does not visualise
dependencies between plans or estimated effort, so it is impossible to see at
a glance which plans are blocked, which can run in parallel, and how long the
current phase is likely to take.

## Proposed Solution

A Gantt SVG view at `/status/gantt` (or as a tab on the existing status page)
that renders plans as horizontal bars with:

- Bar width proportional to `estimated_effort` (days or story points)
- Dependency arrows connecting plans where `depends_on` is set
- Colour coding by `status` (planned, in-progress, completed, blocked)
- Phase grouping — plans within the same `phase:` value rendered as a row group
- Clickable bars navigate to the plan document

The view is read-only and derived entirely from plan frontmatter — no
additional data store required.

A simpler first milestone is a dependency graph (nodes + edges only, no
timeline) that is useful even before `estimated_effort` is widely populated.

## Deferred Because

The view is only useful once `depends_on` and `estimated_effort` are in active
use across a meaningful number of plans. Premature to build against sparse data.
See [[plans/completed/collation.md]].

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-03 | Created — deferred from collation plan | NetYeti |
