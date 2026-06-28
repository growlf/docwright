---
title: "UI Layout Refactor — View Container Plugin Architecture"
status: completed
completed_date: 2026-06-28
author: NetYeti
author-role: operator
created: '2026-06-26'
updated: '2026-06-26'
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
  Happy path: nail the API contract first, then extract views one at a time
  (Files → Git → Policies → Tags), each as a View Container plugin using the
  unified bridge. +layout.svelte shrinks by one hardcoded case per step.
  Shell becomes pure chrome. Settings moves to footer. Shared widget library
  (TreePanel, DiffView) extracted alongside. External plugins (ERP Images)
  need zero changes throughout — they already speak the new bridge API.
  Failure path: a View Container breaks during extraction → revert that
  one step, native fallback stays in layout, others continue unaffected.
  Error boundary is in place before any extraction begins, so a broken plugin
  never crashes the shell.
_path: plans/completed/ui-layout-view-container-refactor.md
proposal_source: proposals/ui-layout-view-container-refactor.md
phase: 4
total_steps: 18
completed_steps: 18
github_epic: null
tests_defined: true
gate_note: "Changed files are untestable types: plans/ui-layout-view-container-refactor.md"
tests_human_reviewed: true
---

# UI Layout Refactor — View Container Plugin Architecture

## Overview

Refactor `+layout.svelte` from a monolithic file that hardcodes all left-panel
views into a pure shell that delegates entirely to registered View Container
plugins. Each native view (Files, Git, Policies, Tags) becomes a bundled View
Container plugin following the same contract as external plugins.

The refactor is split into **four phases**:
1. **API Contract** — define and publish the stable interface before touching views
2. **Foundation** — widgets, settings move, error boundary, per-view search
3. **Extract Core Views** — one view per step, each independently revertable
4. **Shell Cleanup + Validation** — remove hardcoded switch, Playwright, docs, merge

**Worktree:** `~/Projects/DocWright-ui` on `feat/ui-layout-refactor`

---

## UI Component Anatomy

> **UI Component Anatomy:** [`docs/design/ui-anatomy.svg`](../docs/design/ui-anatomy.svg)
> Artifact: https://claude.ai/code/artifact/99c6eb86-3b83-4840-b039-71ef765ed79c

![DocWright UI Anatomy](../docs/design/ui-anatomy.svg)

The numbered badges in the diagram correspond to the component reference table below.
Blue dashed outlines = DocWright chrome (always shell-controlled).
Green dashed outlines = plugin-controlled when a View Container is active.

| # | Component Name | CSS / ID | Who owns it |
|---|---------------|----------|-------------|
| ① | Toolbar | `.app-toolbar` | Shell chrome — always DocWright |
| ② | Activity Bar | `.activity-bar` | Shell chrome — rendered from registry, sorted by `order` |
| ③ | View Container Icon | `.act-btn` | One per registered View Container |
| ④ | Left Panel | `.panel-left` | **View Container owns it entirely** when active |
| ⑤ | Left Panel Content | `#<name>-sidebar-root` | Mounted via `vc.mount(element)` |
| ⑥ | Main Content Area | `#content` / SvelteKit routes | SvelteKit routes; View Containers may navigate here |
| ⑦ | Right Panel | `.panel-right` | Priority-based: VC claim > active doc Properties |
| ⑧ | Right Panel Header / Tab Bar | `.right-tab-bar` | DocWright tabs when VC has not claimed; VC label when claimed |
| ⑨ | Right Panel Content | `PropertiesPane` / plugin HTML | DocWright: frontmatter. Plugin: HTML via `bridge.claimRightPanel()` |
| ⑩ | Footer | `.app-footer` | Shell chrome. **Settings link lives here after refactor** |
| ⚡ | Chat Toggle | `.chat-toggle` | Shell chrome — always present |

### Panel ownership rules (priority model)

The right panel uses a **priority stack**, not binary ownership:

1. **VC claim** — if the active View Container called `bridge.claimRightPanel()`, it owns the right panel until it calls `bridge.releaseRightPanel()` or is deactivated.
2. **Active document** — if a document is open and no VC claim is active, the shell shows the standard Properties / Related / Review tabs.
3. **Empty** — if no document is open and no VC claim, the panel shows "Open a document".

This means the Files View Container can coexist with the Properties panel — it doesn't need to claim the right panel at all. Only plugins that have a genuine secondary view (e.g. ERP Images showing deployment details) should claim it.

### Unified bridge API

`window.__docwright` is the **single entry point** for all plugin↔shell interaction.
Both the registration API and the bridge methods live here.

```typescript
// Plugin registers itself on load (replaces __dw_plugins Map)
window.__docwright.registerView('my-view', {
  mount(el: HTMLElement): void { /* render sidebar into el */ },
  unmount(): void              { /* cleanup */ },
  onSearch?(query: string): void { /* optional — only if searchable:true */ },
  onActivate?(): void          { /* optional — called each time this VC becomes active */ },
  onDeactivate?(): void        { /* optional — called when user switches away */ },
});

// Bridge methods — available immediately after registerView()
// window.__docwright.bridge is populated by the shell before any bundle executes
window.__docwright.bridge.toast(message: string, duration?: number): void
window.__docwright.bridge.notify(opts: DWNotifyOpts): void
window.__docwright.bridge.claimRightPanel(html: string, label?: string): void
window.__docwright.bridge.releaseRightPanel(): void
window.__docwright.bridge.navigate(path: string): void
window.__docwright.bridge.openDocument(vaultPath: string): void
window.__docwright.bridge.apiBase: string        // '/api' — for fetch calls
window.__docwright.bridge.vaultRoot: string      // vault root path
window.__docwright.bridge.apiVersion: string     // '1' — bump on breaking change
```

**Why unified:** `window.__dw_plugins` (Map) and `window.__docwright_host` (bridge object)
were two separate globals. Plugin developers had to know about both. The unified API
keeps one well-documented entry point.

**`mount(el)` replaces `mountSidebar()`:** the shell calls `vc.mount(containerElement)`
with the actual DOM node. No `requestAnimationFrame` timing hacks — the element is
guaranteed to be in the DOM before the call.

### TypeScript types

`src/webui/src/lib/plugin-api.d.ts` (exported as a deliverable — plugin devs can copy it):

```typescript
interface DWViewContainer {
  mount(el: HTMLElement): void;
  unmount(): void;
  onSearch?(query: string): void;
  onActivate?(): void;
  onDeactivate?(): void;
}

interface DWBridge {
  toast(message: string, duration?: number): void;
  notify(opts: DWNotifyOpts): void;
  claimRightPanel(html: string, label?: string): void;
  releaseRightPanel(): void;
  navigate(path: string): void;
  openDocument(vaultPath: string): void;
  apiBase: string;
  vaultRoot: string;
  apiVersion: string;
}

interface DWDocwright {
  bridge: DWBridge;
  registerView(name: string, vc: DWViewContainer): void;
}

declare const __docwright: DWDocwright;
```

### `plugin.json` additions for this refactor

```json
{
  "apiVersion": "1",
  "type": "view-container",
  "name": "files",
  "displayName": "Files",
  "icon": "📄",
  "order": 10,
  "searchable": true,
  "capabilities": []
}
```

- `type: "view-container"` — opts into sidebar presence + activity bar icon
- `order` — integer; activity bar position (core views: 10/20/30/40; external: 100+)
- `searchable` — shell injects a search input above the left panel when this VC is active
- `capabilities` — reserved for future permission gating; empty list = no special access

### Shell operations via bridge

View Containers that need to trigger shell-owned operations (currently only used by
core plugins) do so through the bridge, **not** by importing from `pane.ts`:

```typescript
// How Files VC signals "show Related tab for this document"
window.__docwright.bridge.emit('shell:show-related', { path: vaultPath });

// How Files VC signals "open Improve panel for this document"
window.__docwright.bridge.emit('shell:improve', { path: vaultPath });
```

`bridge.emit()` is a thin typed event bus — the shell subscribes in `onMount`, handles
the event, and updates its own stores. External plugins never call `emit()` — it's only
available to core plugins that are part of DocWright's source tree. (See Privilege
Exceptions below.)

### Privilege exceptions for core plugins

Core plugins (Files, Git, Policies, Tags) are Svelte components compiled into
DocWright's own bundle, not external `bundle.js` files. They may:

- Import from `$lib/` directly (Svelte components, stores)
- Use `bridge.emit()` for shell signalling

They must NOT:
- Import `pane.ts` stores directly and write to them from an external bundle
- Bypass the `plugin.json` contract for activity bar registration
- Use `window.__docwright_host` (old bridge — remove after this refactor)

External plugins get only the `bridge` API. No store access, no `emit()`.

### Mobile

The activity bar is `display:none` on mobile. View Container icons are instead
shown in a horizontal scroll strip at the top of the left panel overlay (hamburger
open). This is implemented by the shell in Step 2 (error boundary + mobile strip) and
requires no changes to View Container implementations.

---

## Implementation Steps

| Step | Action | Details | Status |
|------|--------|---------|--------|
| **Phase 0 — API Contract** | | | |
| 1 | `plugin-api.d.ts` + `window.__docwright` scaffold | Create `src/webui/src/lib/plugin-api.d.ts` with full TypeScript interface (DWViewContainer, DWBridge, DWDocwright). In `+layout.svelte` onMount, replace `window.__docwright_host` and `window.__dw_plugins` with a single `window.__docwright` object. `registerView()` stores VCs in a Map; bridge methods delegate to existing layout functions. **Backward compat shim:** keep `window.__docwright_host` pointing at `window.__docwright.bridge` for one release — remove in Step 11. | ✅ Done |
| 2 | Error boundary + mobile VC strip | Add `ViewContainerMount.svelte` — wraps each VC `mount()` call in a try/catch; shows an error panel with the plugin name on throw, does NOT propagate to layout. Add a horizontal icon strip inside the mobile left panel overlay for activity bar equivalent. | ✅ Done |
| 3 | `mount(el)` migration | Update the layout's VC activation effect: instead of `requestAnimationFrame(() => plugin.mountSidebar())`, call `vc.mount(containerEl)` directly (element is in DOM at call site). Update `cs-erp-images` stub to use `mount(el)` — one-line change. | ✅ Done |
| 4 | Right panel priority model | Replace `{#if leftView.startsWith('plugin-')} {@html prHtml}` binary switch with a priority store: `rightPanelClaim = { html, label }` (null = no claim). Shell renders: claim present → plugin view, else → standard tabs. `bridge.claimRightPanel()` sets the store; `bridge.releaseRightPanel()` clears it. `onDeactivate()` auto-clears claim. | ✅ Done |
| **Phase 1 — Foundation** | | | |
| 5 | `plugin.json` schema additions | Add `order`, `searchable`, `capabilities` to `PluginManifest` TypeScript interface and JSON schema. Update `scanPlugins()` to sort by `order`. Core bundled VCs (registered without a `plugin.json` file) use defaults: `order` by registration sequence. | ✅ Done |
| 6 | Shared widget library scaffold | Create `src/webui/src/lib/widgets/`. Extract `TreePanel.svelte` from `FileTree.svelte` (generic tree, no vault-specific logic). Move `_tokens.scss` into `widgets/_tokens.scss` — import from all panels. | ✅ Done |
| 7 | Settings → footer | Remove Settings from the activity bar. Add Settings icon/link to `.app-footer`. Settings content: `/settings` route (simple static page, links to config files and a theme picker form). No modal needed — a route is simpler and linkable. | ✅ Done |
| 8 | Per-view search wiring | When a VC has `searchable: true`, the shell renders a search `<input>` at the top of the left panel. On input, calls `vc.onSearch(query)`. `Ctrl+K` sets `leftView = 'files'` and focuses the search input via a `searchFocusTrigger` store (eliminates the `bind:this={searchPanel}` reference). | ✅ Done |
| **Phase 2 — Extract Core Views** | | | |
| 9 | Files View Container | Convert `FileTree.svelte` + project section to use `mount(el)` pattern (Svelte component mounted imperatively into the provided element). Register as core VC with `order: 20`, `searchable: true`. Remove `leftView === 'files'` case and `FileTree` import from layout. Verify: file browsing, file open, project section, + New menu via `bridge.emit('shell:new-menu')`. | ✅ Done |
| 10 | Git View Container + DiffView widget | Extract `DiffView.svelte` into `widgets/DiffView.svelte` (unified + side-by-side modes). Bundle `GitPanel.svelte` as core VC with `order: 40`. Remove from layout. Verify: stage, unstage, commit, diff view. | ✅ Done |
| 11 | Governance Engine View Container | Build `GovernancePanel.svelte` as the primary core VC (`order: 10`). Sub-views: Lifecycle Status (active proposals/plans — replaces `/status` default), Policy Chain Browser, Outcome Lineage, Profile Dashboard, Hook Status. Register `searchable: true`. Remove `PoliciesPanel.svelte` from layout. Remove `window.__docwright_host` backward compat shim. See `proposals/governance-engine-view-container.md`. Verify: status view, policy list, lifecycle trail. | ✅ Done |
| 12 | Tags View Container | Bundle `TagsPanel.svelte` as core VC with `order: 30`. Remove from layout. Verify: tag list, filter, tagged-doc navigation. | ✅ Done |
| **Phase 3 — Shell Cleanup** | | | |
| 13 | Remove hardcoded switch | After steps 9–12, the left-panel `{#if leftView === ...}` switch has no cases. Remove it. The panel renders only: `ViewContainerMount` for the active VC, or the per-view search input when `searchable: true`. | ✅ Done |
| 14 | Activity bar from registry | Remove hardcoded `act-btn` elements for Files, Search, Policies, Tags, Settings, Git. The activity bar renders from the registered VC list sorted by `order`. Plugins at `order: 100+` appear after core views, separated by a thin divider. | ✅ Done |
| 15 | Lazy-load plugin bundles | Remove the startup preload loop (`for plugin in plugins: append script`). Instead, load `bundle.js` on first activation of that VC — append script tag, await `window.__docwright` registration, then call `mount()`. Cache: don't reload if already registered. | ✅ Done |
| **Phase 4 — Validation + Docs** | | | |
| 16 | Playwright regression suite | Extend e2e suite to cover: file browse + open, git stage/commit, policy list, tag navigation, ERP Images (zero changes required), search (`Ctrl+K` focus), mobile hamburger + VC strip. All must pass. | ✅ Done |
| 17 | Plugin developer guide | `docs/plugins.md`: full API reference (plugin.json schema, bridge methods, mount lifecycle, searchable contract, right panel claim, TypeScript types, example plugin skeleton). Link `plugin-api.d.ts` from the guide. | ✅ Done |
| 18 | Merge to develop | Open PR `feat/ui-layout-refactor` → `develop`. `+layout.svelte` must have zero view-specific component imports. Anatomy diagram updated if any region names changed. | ✅ Done |

---

## Key Invariants

- External plugins (ERP Images) must require **zero changes** at every step.
  Run them after each step to confirm.
- Each step is independently revertable — no step requires the next to be
  complete before it can land.
- The plugin contract (`plugin.json` schema, bridge API, panel ownership rules)
  must not break between steps.
- Error boundary (`ViewContainerMount`) must be in place before Step 9 (first extraction).
- Core plugins get the same `mount(el)` / bridge contract as external plugins.
  Direct store access is the narrow exception and stays inside the source tree.

## Definition of Done

- [x] `+layout.svelte` imports zero view-specific components (no FileTree, GitPanel, PoliciesPanel, TagsPanel, SearchPanel)
- [x] `window.__docwright` is the only plugin global (`__dw_plugins` and `__docwright_host` removed)
- [x] `plugin-api.d.ts` exists and matches the live bridge implementation
- [x] All activity bar icons come from the registered VC list sorted by `order`
- [x] Files, Git, Governance Engine, Tags work as View Containers; Governance Engine is primary (order: 10)
- [x] Settings accessible from footer via `/settings` route
- [x] `src/webui/src/lib/widgets/` contains TreePanel + DiffView + shared tokens
- [x] Plugin bundles load lazily on first activation
- [x] ERP Images plugin passes Playwright tests unchanged
- [x] `docs/plugins.md` written and links `plugin-api.d.ts`
- [x] PR merged to develop

### Gate Criteria

- [x] All 18 implementation steps marked ✅ Done
- [x] 33/33 Playwright e2e checks pass (run: `npx tsx test/webui/e2e-check.ts`)
- [x] No regressions in error count (30 pre-existing TypeScript errors, unchanged)
- [x] PR #37 merged to develop by NetYeti
- [x] Tests reviewed and approved by NetYeti 2026-06-28

