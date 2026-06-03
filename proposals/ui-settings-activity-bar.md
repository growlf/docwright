---
complexity: high
title: "UI Polish — Settings Access via Activity Bar / Grouped Menu"
author: NetYeti
created: 2026-06-03
tags:
  - ui
  - polish
  - activity-bar
  - settings
  - phase-1
approved: false
created_by: "NetYeti@phoenix"
assigned_to: NetYeti
---

## Problem

Meta and config files (CLAUDE.md, AGENTS.md, profile configs, templates,
CONTRIBUTING.md, etc.) have no dedicated home in the UI. They were cluttering
the file tree alongside vault documents until individually excluded from
`EXCLUDE_ROOT`. This is a maintenance burden — each new meta file must be
manually added to the exclusion list, and there is no positive access path:
the files are hidden but not surfaced anywhere useful.

The reference UIs (VS Code, OpenCode) solve this with a clear information
architecture: an **activity bar** or **top nav** provides distinct entry
points for different concerns — Files, Search, Git, Settings. Nothing
important is buried or excluded without an alternative access route.

DocWright needs the same: a **DocWright Settings** entry point that surfaces
the meta/config files in a purposeful, grouped way.

## Requirements

- **The toolbar must always be visible** — on all viewports, all screen sizes.
  It is the persistent anchor of the UI. Currently the top bar is
  `display: none` on desktop and only appears on mobile. That must change.
- **The home icon belongs to the toolbar**, not to the sidebar header. It
  should be reachable regardless of whether the sidebar is open or collapsed.
  The sidebar duplicate can be removed once the toolbar carries it.

## Proposed Solution

### Option A — Activity bar (VS Code pattern) — Recommended

A narrow icon strip on the far left edge of the layout, outside the left
sidebar. Each icon opens a different view in the left panel:

| Icon | Label | Opens |
|------|-------|-------|
| 📄 | Files | Current vault file tree (default) |
| ⚙ | Settings | DocWright config files grouped by category |
| 🔀 | Git | Git status / controls panel |
| 🔍 | Search | Full-text vault search (future) |

The **Settings view** in the left panel shows:

```
── AI Instructions ──────────────────
  CLAUDE.md
  AGENTS.md
── Profiles ─────────────────────────
  src/profiles/org-operations/
  src/profiles/doc-lifecycle/
  …
── Templates ────────────────────────
  templates/plan-template.md
  templates/…
── Project ──────────────────────────
  CONTRIBUTING.md
  SECURITY.md
  CHANGELOG.md
  NOTICE.md
```

Each item opens in the main content pane as normal. The grouping is defined
in profile.json so it is vault-configurable.

### Option B — Gear menu in sidebar header (lighter weight)

A ⚙ button in the left sidebar header that opens a dropdown or inline panel
showing the same grouped settings files. No structural change to the layout.
Lower implementation cost; lower discoverability.

### Recommendation

Option A (activity bar) for the full Phase 1 polish pass — it matches the
reference UI pattern the user cited and scales cleanly as more sections are
added (search, git panel, etc.). The activity bar is a one-time structural
change that pays for itself immediately.

### `EXCLUDE_ROOT` simplification

Once a Settings view exists, `EXCLUDE_ROOT` can be replaced by a
`settingsFiles` list in profile.json that drives both the exclusion from the
file tree AND the Settings view contents — one source of truth instead of a
hardcoded exclusion list.

## Out of Scope

| Idea | Why deferred | Deferred proposal |
|------|-------------|-------------------|
| Full-text search panel (🔍 activity bar slot) | Requires search backend (tobi/qmd planned) | [[proposals/ui-vault-search.md]] |
| Custom activity bar icons per profile | Profile engine (Phase 3) prerequisite | Post-launch |
| Drag-to-reorder activity bar sections | Not needed at launch | Post-launch |

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-03 | Created — critique from Phase 1 UI review; CLAUDE.md added to EXCLUDE_ROOT as immediate fix | NetYeti |
