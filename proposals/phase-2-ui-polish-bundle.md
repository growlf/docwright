---
title: "Phase 2 UI Polish Bundle — Navigation, Search, Tags, Theming, Shortcuts"
author: NetYeti
created: 2026-06-06
tags:
  - ui
  - ux
  - phase-2
  - polish
  - navigation
  - search
  - tags
  - theming
complexity: medium
estimated_effort: L
approved: false
created_by: NetYeti@phoenix
assigned_to: NetYeti
related_to:
  - proposals/ui-keyboard-panel-shortcuts.md
  - proposals/ui-resizable-panels.md
  - proposals/ui-vault-search.md
  - proposals/ui-theme-picker.md
  - proposals/tags-more-useful-to-humans.md
  - proposals/phases-and-the-master-plan-are-mostly-invisible-to-the-user.md
  - proposals/policies-should-be-a-button-on-the-leftmost-button-bar.md
---

## Problem

Phase 1 shipped a functional Web UI prototype. Seven deferred proposals
represent the next layer of polish needed before DocWright is comfortable for
daily use by contributors beyond the core team:

1. **Vault search is missing entirely** — no way to find a document by content
2. **Policies are buried in the file tree** — no dedicated navigation entry point
3. **Phase/roadmap context is invisible** — users can't see what phase they're in
   or how a proposal fits into the overall plan
4. **Tags serve no discovery purpose** — applied but never browsable or filterable
5. **Panels have fixed widths** — no resize handles; layout forces don't suit all workflows
6. **Keyboard shortcuts are absent** — no keyboard way to toggle the sidebar or properties pane
7. **Theme is hardcoded dark** — no in-app picker; customization requires editing source

None of these block core governance workflows, but all of them create friction
that reduces daily adoption. Phase 2 is the right time to resolve them — after
the foundation is solid and before the enterprise/multi-user phase begins.

## Proposed Solution

Seven self-contained deliverables, all SvelteKit UI work with no dispatch module
dependency. Estimated total effort: L (1–2 weeks).

### 1. Vault search panel

Full-text search across all vault markdown files, accessed via a 🔍 button in
the activity bar. Results show document title, type badge, and a matched excerpt.
Powered by a server-side `/api/find` endpoint scanning vault files (no external
search backend required for Phase 2 — deferred to qmd/Meilisearch in Phase 3).

**Source:** [[proposals/ui-vault-search.md]]

### 2. Policies activity bar button

Dedicated "Policies" button in the left activity bar (alongside Files and Status).
Opens a panel showing only `policies/` documents, organized by subdirectory with
collapsible categories and alphabetical sort. A `+` button creates a new policy
using the active profile's policy template.

**Source:** [[proposals/policies-should-be-a-button-on-the-leftmost-button-bar.md]]

### 3. Phase and roadmap visibility on the status page

The `/status` page gains a "Current Phase" section showing: phase number and name,
progress (N/M plans complete), and a collapsible list of in-progress and upcoming
plans. Links from the status page into `plans/*.md` and `plans/completed/*.md` for
drill-down. Sourced entirely from the filesystem — no AI tokens, zero latency.

**Source:** [[proposals/phases-and-the-master-plan-are-mostly-invisible-to-the-user.md]]

### 4. Tag management and discovery

- Tags autocomplete in the properties pane (suggestions from existing tags in the vault)
- Tag consistency: normalise to lowercase-hyphenated on save
- Tag browser panel: list all tags with document counts; click to filter the file tree
- Tags on all document types (not just proposals)

**Source:** [[proposals/tags-more-useful-to-humans.md]]

### 5. Resizable panels

Drag handles on the sidebar and properties pane dividers. Width persisted to
`localStorage` per panel. Min/max constraints prevent panels from becoming unusably
narrow. Double-click the handle to snap back to the default width.

**Source:** [[proposals/ui-resizable-panels.md]]

### 6. Keyboard shortcuts for panel toggles

| Shortcut | Action |
|---|---|
| `Ctrl+\` | Toggle sidebar |
| `Ctrl+Shift+\` | Toggle properties pane |
| `Ctrl+K` | Focus vault search |
| `Escape` | Close focused panel / search |

Shortcuts use `document.addEventListener('keydown')` in the layout. A keyboard
shortcut reference is accessible via `?` key or a help link in the sidebar footer.

**Source:** [[proposals/ui-keyboard-panel-shortcuts.md]]

### 7. In-app theme picker

A theme selector in the sidebar footer (sun/moon icon or gear → appearance).
Persisted to `localStorage`. Phase 2 ships: Dark (current), Light, and System
(matches OS preference). Full white-label/brand theming is deferred to Phase 3.

**Source:** [[proposals/ui-theme-picker.md]]

## Relationship to Existing Work

- [[proposals/ui-theming-system.md]] (approved) — full CSS variable theming system;
  the theme picker (deliverable 7) is the user-facing surface for that work
- [[proposals/ui-sidebar-consistency.md]] (approved) — panel layout foundation
  that keyboard shortcuts and resize handles build on
- [[proposals/ui-settings-activity-bar.md]] (approved) — activity bar design
  that policies button (deliverable 2) plugs into

## Out of Scope

| Idea | Why deferred |
|------|-------------|
| Full-text search backend (qmd/Meilisearch) | Phase 3 — server-side grep is sufficient for Phase 2 |
| White-label brand settings (logo, colors) | Phase 3 — CSS variables cover it; full brand UI is enterprise |
| Tag graph view | Phase 3 — needs backlinks index and dispatch module integration |
| Web UI terminal panel | Phase 3+ — PTY is a significant security surface |
| Chat session management UI | Phase 3 — depends on AI chat panel shipping first |

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-06 | Created — consolidates 7 deferred Phase 2 UI proposals | NetYeti |
