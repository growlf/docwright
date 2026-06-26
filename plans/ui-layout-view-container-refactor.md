---
title: "UI Layout Refactor — View Container Plugin Architecture"
status: in-progress
author: NetYeti
author-role: operator
created: '2026-06-26'
type: plan
tags:
  - ui
  - architecture
  - plugin-system
  - phase-4
  - layout
priority: high
mode: mentor
assigned_to: NetYeti
depends_on:
  - plugin-system.md
scenario_synthesis: |
  Happy path: extract views one at a time (Files → Git → Policies → Tags),
  each as a View Container plugin. +layout.svelte shrinks by one hardcoded
  case per step. Shell becomes pure chrome. Settings moves to footer.
  Shared widget library (TreePanel, DiffView) extracted alongside.
  External plugins (ERP Images, KG) need zero changes throughout.
  Failure path: a View Container breaks during extraction → revert that
  one step, native fallback stays in layout, others continue unaffected.
_path: plans/ui-layout-view-container-refactor.md
proposal_source: proposals/ui-layout-view-container-refactor.md
phase: 4
total_steps: 14
completed_steps: 0
github_epic: null
---

# UI Layout Refactor — View Container Plugin Architecture

## Overview

Refactor `+layout.svelte` from a monolithic file that hardcodes all left-panel
views into a pure shell that delegates entirely to registered View Container
plugins. Each native view (Files, Git, Policies, Tags) becomes a bundled View
Container plugin following the same contract as external plugins (ERP Images).

**Reference:** `docs/design/ui-anatomy.html` — component anatomy diagram with
all regions labelled. Use this as the shared vocabulary throughout this work.

**Worktree:** `~/Projects/DocWright-ui` on `feat/ui-layout-refactor`

---

## Implementation Steps

| Step | Action | Details | Status |
|------|--------|---------|--------|
| **Phase 1 — Foundation** | | | |
| 1 | View Container contract | Add `"type": "view-container"` to `plugin.json` schema. Add `order` (activity bar position) and `searchable` (show search input) fields to `PluginManifest`. Update `scanPlugins()` to sort by `order`. | ⏳ Pending |
| 2 | Shared widget library scaffold | Create `src/webui/src/lib/widgets/`. Extract `TreePanel.svelte` from `FileTree.svelte` (generic tree, no vault-specific logic). Add `_tokens.css` with shared spacing/colour tokens already used by panels. | ⏳ Pending |
| 3 | Settings → footer | Remove Settings from the activity bar. Add a Settings link/icon to `.app-footer` alongside theme picker. Settings content becomes a modal or `/settings` route. | ⏳ Pending |
| 4 | Search → per-view | Remove the global SearchPanel from the activity bar. Add a `searchable: true` field to the contract — when set, the layout renders a search input at the top of the Left Panel and emits `search` events to the active View Container. | ⏳ Pending |
| **Phase 2 — Extract Core Views** | | | |
| 5 | Files View Container | Bundle `FileTree.svelte` + new `TreePanel.svelte` into `src/plugins/files/`. Register in `__dw_plugins`. Remove `FileTree` import and `leftView === 'files'` case from `+layout.svelte`. Verify: file browsing, file open, project section, + New menu all work. | ⏳ Pending |
| 6 | Git View Container | Bundle `GitPanel.svelte` into `src/plugins/git/`. Main content: wire `DiffView.svelte` for uncommitted/unstaged file selection. Remove `GitPanel` import and `leftView === 'git'` case from layout. Verify: stage, unstage, commit, diff view all work. | ⏳ Pending |
| 7 | `DiffView.svelte` widget | Extract diff rendering into `src/webui/src/lib/widgets/DiffView.svelte`. Used by Git View Container for main-pane diffs. Supports unified and side-by-side modes. | ⏳ Pending |
| 8 | Policies View Container | Bundle `PoliciesPanel.svelte` into `src/plugins/policies/`. Remove from layout. Verify: policy list, filtering, policy detail all work. | ⏳ Pending |
| 9 | Tags View Container | Bundle `TagsPanel.svelte` into `src/plugins/tags/`. Remove from layout. Verify: tag list, tag filtering, navigation to tagged docs all work. | ⏳ Pending |
| **Phase 3 — Shell Cleanup** | | | |
| 10 | Remove hardcoded switch | After steps 5–9, `+layout.svelte` left-panel content block should have no `{:else if leftView === ...}` cases for native views. Remove the entire switch and verify the layout only renders plugin-owned content. | ⏳ Pending |
| 11 | Activity bar from registry | Remove hardcoded activity bar buttons for Files, Search, Policies, Tags, Settings, Git. Activity bar renders exclusively from `__dw_plugins` sorted by `order`. | ⏳ Pending |
| 12 | Per-view search wiring | Implement `searchable` contract: when a View Container has `searchable: true`, layout injects a search input at the top of the left panel. View Container receives `searchQuery` prop and filters its own content. | ⏳ Pending |
| **Phase 4 — Validation** | | | |
| 13 | Playwright regression suite | Extend existing e2e checks to cover: file browse + open, git stage/commit, policy list, tag navigation, ERP Images (must be unchanged), KG graph view (must be unchanged). All must pass. | ⏳ Pending |
| 14 | Merge to develop | Open PR `feat/ui-layout-refactor` → `develop`. `+layout.svelte` must have zero view-specific imports. Anatomy diagram updated if any region names changed. | ⏳ Pending |

---

## Key Invariants

- External plugins (ERP Images, Knowledge Graph) must require **zero changes**
  at every step. Run them after each step to confirm.
- Each step is independently revertable — no step should require the next to
  be complete before it can land.
- The plugin contract (`plugin.json` schema, bridge API, panel ownership rules)
  must not break between steps.

## Definition of Done

- [ ] `+layout.svelte` imports zero view-specific components (no FileTree, GitPanel, PoliciesPanel, TagsPanel, SearchPanel)
- [ ] All activity bar icons come from `__dw_plugins` registry
- [ ] Files, Git, Policies, Tags work identically to today as View Containers
- [ ] Settings accessible from the footer
- [ ] `src/webui/src/lib/widgets/` contains TreePanel + DiffView + shared tokens
- [ ] ERP Images plugin passes Playwright tests unchanged
- [ ] PR merged to develop
