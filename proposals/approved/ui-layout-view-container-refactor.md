---
title: "UI Layout Refactor — View Container Plugin Architecture"
author: NetYeti
created: '2026-06-26'
tags:
  - ui
  - architecture
  - plugin-system
  - phase-4
  - layout
complexity: high
estimated_effort: L
approved: true
created_by: NetYeti@phoenix
assigned_to: "NetYeti"
depends_on:
  - plans/completed/plugin-system.md
author-role: operator
related_to:
  - proposals/approved/governance-engine-view-container.md
  - plans/completed/plugin-system.md
---

## Problem

The DocWright shell hardcodes its left-panel views (Files, Git, Search, Policies,
Tags, Settings) directly in `+layout.svelte`. This creates several problems:

1. **Inconsistent plugin model.** External plugins (e.g. ERP Images) get clean
   panel ownership via the plugin system. Native views are a different class of
   citizen — hardcoded, not registered, not discoverable.

2. **Coupled concerns.** The layout file mixes shell chrome (toolbar, activity
   bar, panels, footer) with view-specific logic (file tree, git panel, policy
   list). Any change to a view requires editing the monolithic layout.

3. **Search is global when it should be contextual.** The current search panel
   is a single DocWright-wide search. The right model is per-view search: the
   Files view searches files, the Policies view searches policies, ERP Images
   searches use cases. A global search panel can't know which context it's in.

4. **Settings buried in the sidebar.** The Settings view wastes an activity bar
   slot. Settings belong in the footer (next to the theme picker) or as a modal —
   not as a primary navigation destination.

5. **No shared widget library.** Files and Git will both need tree-style left
   panels, diff views in the main pane, and similar properties in the right panel.
   Without a shared widget layer, each reimplements the same patterns.

## Proposed Solution

Refactor the DocWright shell so that **every left-panel view is a View Container
plugin** — either a bundled core plugin or an installed external plugin. The shell
becomes pure chrome: toolbar, activity bar, panel slots, footer. Nothing else.

### Component anatomy (reference: docs/design/ui-anatomy.html)

| Region | Current | After refactor |
|--------|---------|----------------|
| Toolbar | Shell chrome | Shell chrome (unchanged) |
| Activity Bar | Hardcoded icons + dynamic plugin icons | All icons from registered View Containers |
| Left Panel | Hardcoded switch statement | 100% owned by active View Container |
| Main Content | SvelteKit routes | Routes contributed by View Containers |
| Right Panel | Hardcoded tabs + plugin override | 100% owned by active View Container |
| Footer | Attribution + theme | Attribution + theme + Settings link |
| Search | Global sidebar panel | Per-view: each View Container handles its own |

### View Containers to extract

| View Container | Type | Shares with |
|----------------|------|-------------|
| Files | Bundled core | — tree widget |
| Git | Bundled core | Files — tree widget, diff view |
| Policies | Bundled core | — |
| Tags | Bundled core | — |
| ERP Images | External plugin | Already implemented |
| Knowledge Graph / Assets | External plugin | — |

### Shared widget library (`src/webui/src/lib/widgets/`)

Files and Git both need:
- `TreePanel.svelte` — collapsible tree with icons, selection state, context menu
- `DiffView.svelte` — side-by-side or unified diff (Git main content)
- `PropertiesPanel.svelte` — key/value properties in right panel (already exists as PropertiesPane)

These become a shared widget layer that both core and external plugins can import.

### View Container contract

A View Container is a plugin with `"type": "view-container"` in `plugin.json`.
It provides the same interface as the current external plugin contract, plus:

```json
{
  "type": "view-container",
  "icon": "📄",
  "order": 1,
  "searchable": true
}
```

- `order` — position in the activity bar (core containers get low numbers)
- `searchable` — if true, a search input appears at the top of the left panel;
  the container handles the `search` event and filters its own content

### Settings relocation

Remove the Settings activity bar icon. Add a Settings link to the footer
alongside the theme picker. Settings open as a modal or navigate to `/settings`.

### Migration path

1. Extract `FileTree` + left panel header into a `files` View Container bundle
2. Extract `GitPanel` into a `git` View Container bundle  
3. Extract `PoliciesPanel` into a `policies` View Container bundle
4. Extract `TagsPanel` into a `tags` View Container bundle
5. Remove the hardcoded switch statement from `+layout.svelte`
6. Move Settings link to footer
7. Create `src/webui/src/lib/widgets/` with `TreePanel.svelte`, shared CSS tokens

Each step can ship independently. The layout switch statement shrinks by one
case per step — there's no big-bang cutover.

## What this is NOT

- Not a rewrite of the document editor, plan/proposal system, or AI features
- Not changing the SvelteKit routing model
- Not changing how external plugins (ERP Images, Knowledge Graph) work — they
  already follow the correct pattern and need no changes
- Not adding new features — this is purely a structural refactor

## Success criteria

- `+layout.svelte` contains zero view-specific logic (no FileTree import,
  no GitPanel import, no PoliciesPanel import)
- All activity bar icons come from the View Container registry
- Files, Git, Policies, Tags each work identically to today, just as View Containers
- External plugins (ERP Images) continue to work unchanged
- Settings accessible from the footer
- `src/webui/src/lib/widgets/` exists with at least TreePanel and shared tokens
