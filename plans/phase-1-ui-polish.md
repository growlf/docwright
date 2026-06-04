---
title: "Phase 1 — UI Polish"
status: approved
author: NetYeti
created: 2026-06-03
phase: 1
gate_reviewer: NetYeti
gate_status: pending
proposal_source:
  - proposals/ui-sidebar-consistency.md
  - proposals/ui-settings-activity-bar.md
  - proposals/ui-lifecycle-graph-view.md
  - proposals/ui-immutable-title-h1.md
  - proposals/ui-document-title-in-toolbar.md
priority: high
automated: guided
assigned_to: NetYeti
depends_on:
  - phase-1-opencode-embed
scenario_synthesis: "UI prototype — all work is SvelteKit components and CSS; no shell execution or deployment steps"
tags:
  - phase-1
  - ui
  - polish
---

# Phase 1 — UI Polish

## Overview

Phase 1 delivered a functional Web UI prototype. This plan addresses the
remaining polish work identified during the Phase 1 UI critique session
(2026-06-03) before the phase gate fires and Phase 2 begins.

A significant amount of polish was completed inline during the critique
session and is recorded here as already done.

## Completed This Session

These items were identified and implemented during the critique session.
They are recorded for the audit trail.

| Item | Commit | What changed |
|------|--------|--------------|
| Document title in toolbar | session | `frontmatter.title` shown as `.doc-title` span; file path demoted to secondary |
| Redundant frontmatter dump removed | session | `.fm` block removed from read mode; `depends_on` links preserved |
| CLAUDE.md hidden from file tree | session | Added to `EXCLUDE_ROOT` in `FileTree.svelte` |
| Status page vault name | session | `vaultName` from `path.basename(REPO_ROOT)` in status API |
| Status page full width | session | `max-width: 900px` removed |
| Global scrollbar theme | session | `::-webkit-scrollbar` + Firefox `scrollbar-width: thin` in `app.html` |
| Button tooltips | session | CollationPanel insert/subsume, PropertiesPane actions, mode toggle |
| Toast flood fix | session | N toasts → 1 summary toast opening the collation panel |
| Category/complexity pick-lists | session | `SELECT_OPTIONS` + `PREDEFINED_CHIPS` in PropertiesPane |
| Heuristic complexity estimator | session | `/api/estimate-complexity` + ⟳ button; batch-applied to all proposals |
| Drop-in theming (Phase A) | session | `/api/brand/theme` serves `brand/theme.css`; loaded in `app.html` |
| Brand system | session | `brand.json`, `brand/logo.svg`, `/api/brand`, footer attribution |
| Sticky footer | session | `body` flex column; footer `flex-shrink: 0` |
| Brand logo links to status | session | `<a href="/status">` wraps the brand area |
| Page title casing | session | `docwright` → `DocWright` in `app.html` |
| Favicon uses brand logo | session | `<link rel="icon" href="/api/brand/logo">` |
| Deployment scenarios documented | session | `docs/deployment.md` — standalone, team server, enterprise |
| Chat panel (direct mode) | session | `ChatPanel.svelte` — browser connects directly to client's OpenCode |
| Chat panel send bug fixed | e0df5e9 | `message.part.updated` event structure corrected (p.part.messageID, p.delta); directory now `?directory=` query param so EventSource can carry it |
| MCP auto-registration | e0df5e9 | `/api/opencode-config` writes DocWright MCP entry into `opencode.json` on ChatPanel mount; settings panel shows registration status |
| Chat panel rendering fixed | 49b38ba | Base `.msg` color added; `.msg.model` rule; `normalizeRole()` maps OpenCode's 'model'/'human' to 'assistant'/'user' |
| POST response as primary source | 00a68d2 | Send uses response body as fallback; `sending` cleared in `finally` block so it can never get stuck |
| URL self-pointing guard | 470cea6 | Warning shown in settings when OpenCode URL matches DocWright's own host |
| Svelte 5 fixes + cancel button | 1915fdc | `msgEnd` declared as `$state()`; label `for=` attrs; elapsed timer; cancel button after 1s; heartbeats excluded from event count |
| Chat panel working end-to-end | f0b18e9 | Confirmed working: direct mode, `http://localhost:4096`, `opencode serve --cors http://localhost:5173` |

## Remaining Tasks

### Task 1 — Immutable H1 from frontmatter title

**Proposal:** [[proposals/ui-immutable-title-h1.md]]
**Effort:** XS (~30 min)
**Status:** ⏳ Pending

Render `frontmatter.title` as a non-editable `<h1>` at the top of the document
body in read and WYSIWYG modes. Title is outside `contenteditable`. Title
changes go through the properties pane only. Source mode unaffected.

| Step | Action | Details | Status |
|------|--------|---------|--------|
| 1 | Add H1 to read mode | Insert `<h1 class="doc-h1">{frontmatter.title}</h1>` above `<MarkdownRenderer>` in `+page.svelte`, only when `frontmatter.title` is set and `docType !== 'page'` | ⏳ Pending |
| 2 | Exclude from WYSIWYG | Place H1 above the `wysiwyg` div, not inside `contenteditable` | ⏳ Pending |
| 3 | Style | `.doc-h1` — consistent with document typography; clear visual separation from toolbar title | ⏳ Pending |

---

### Task 2 — Unified Panel System (Panel.svelte)

**Proposal:** [[proposals/ui-sidebar-consistency.md]]
**Effort:** L (1–2 days)
**Status:** ⏳ Pending

Three separate panel implementations (left sidebar, right properties pane,
CollationPanel fixed overlay) replaced by a single `Panel.svelte` component
with consistent slide animation, shared mobile scrim, and CollationPanel
promoted to a tab on the right panel.

| Step | Action | Details | Status |
|------|--------|---------|--------|
| 1 | Create `Panel.svelte` | Props: `side: 'left'\|'right'`, `defaultOpen`, `tabs?`. Desktop: docked inline. Mobile: fixed overlay with scrim. Animate via `transform: translateX()` | ⏳ Pending |
| 2 | Refactor left sidebar | Replace `aside#sidebar` in `+layout.svelte` with `<Panel side="left">` | ⏳ Pending |
| 3 | Refactor right panel | Replace `PropertiesPane` direct mount with `<Panel side="right" tabs={['Properties','Related']}>` | ⏳ Pending |
| 4 | Move CollationPanel into right panel | CollationPanel becomes the "Related" tab. Remove `position: fixed` from it. "Find Related" action switches to that tab | ⏳ Pending |
| 5 | Unified mobile scrim | One `<div class="scrim">` in layout, controlled by either panel's open state | ⏳ Pending |
| 6 | Standardise toggle icons | Replace `☰`, `◀`, `▶`, `⊞` with consistent chevrons (`‹`, `›`) throughout | ⏳ Pending |
| 7 | Mobile defaults | Both panels start closed on mobile; both start open on desktop | ⏳ Pending |

---

### Task 3 — Activity Bar and Always-Visible Toolbar

**Proposal:** [[proposals/ui-settings-activity-bar.md]]
**Effort:** L (1–2 days)
**Status:** ⏳ Pending

An always-visible top toolbar (desktop and mobile) anchoring the home icon
and an activity bar providing distinct entry points for Files, Settings, and
Git. The mobile-only top bar becomes a permanent layout element.

| Step | Action | Details | Status |
|------|--------|---------|--------|
| 1 | Make top bar always visible | Remove `display: none` on `.mobile-topbar`; rename to `.app-toolbar`. Style for desktop. | ⏳ Pending |
| 2 | Move home icon to toolbar | Remove home icon from sidebar header; it lives in the toolbar only | ⏳ Pending |
| 3 | Activity bar strip | Vertical icon strip on far-left edge (outside sidebar). Icons: 📄 Files, ⚙ Settings, 🔀 Git. Clicking an icon switches the left panel's active view | ⏳ Pending |
| 4 | Settings view in left panel | When ⚙ is active: show grouped config files (AI Instructions, Profiles, Templates, Project). Reads `EXCLUDE_ROOT` list, replaces hardcoded exclusions with `settingsFiles` in profile | ⏳ Pending |
| 5 | Git view in left panel | When 🔀 is active: surface the existing `GitPanel.svelte` inline (currently only in sidebar footer) | ⏳ Pending |
| 6 | Adjust layout for activity bar | `#app` gains a left margin or the activity bar is part of the flex layout (not overlapping sidebar) | ⏳ Pending |

---

### Task 4 — Funnel View (Lifecycle Swimlanes)

**Proposal:** [[proposals/ui-lifecycle-graph-view.md]]
**Effort:** M (1 day)
**Status:** ⏳ Pending

A visual representation of the governance pipeline — swimlane columns per
lifecycle stage, document cards clickable to navigate. Served as a tab on
the status page or at `/status/funnel`. No graph library needed: SVG or
CSS-only layout. The "wow" demo that makes DocWright's model immediately
legible to a new user.

| Step | Action | Details | Status |
|------|--------|---------|--------|
| 1 | Create `FunnelView.svelte` | Swimlane columns: Deferred Ideas → Open Proposals → Approved → Active Plans → Completed. Data from existing `/api/status` response | ⏳ Pending |
| 2 | Document cards | Each card: title, status badge, assigned_to, complexity chip. Clickable → navigate to document | ⏳ Pending |
| 3 | Stage connectors | Simple SVG arrows between column headers indicating flow direction | ⏳ Pending |
| 4 | Add to status page | Tab toggle at top of `/status`: "List" (current) / "Funnel". Persisted in `sessionStorage` | ⏳ Pending |
| 5 | Responsive | On narrow screens: vertical stack instead of horizontal swimlanes | ⏳ Pending |

---

## Phase Gate

This plan is gated. When all tasks above are `✅ Complete`, the phase gate
fires and the following question is put to the gate reviewer before Phase 2
begins:

> "Are you satisfied with the Phase 1 Web UI? Is there anything that still
> needs addressing before Phase 2 (VSCodium extension + profile engine) begins?
> You may either sign off or open a final critique round."

**Gate reviewer:** NetYeti
**Gate status:** `pending` (awaiting task completion)

See [[proposals/phase-gate-sign-off.md]].

## Out of Scope

These items were identified during Phase 1 but deferred:

| Item | Deferred proposal |
|------|-------------------|
| Resizable panels | [[proposals/ui-resizable-panels.md]] |
| Keyboard shortcuts for panels | [[proposals/ui-keyboard-panel-shortcuts.md]] |
| Brand settings UI (in-app) | [[proposals/ui-white-label-brand-settings.md]] |
| CSS variable foundation (Phase B) | [[proposals/ui-theming-system.md]] |
| In-app theme picker | [[proposals/ui-theme-picker.md]] |
| Full-text vault search | [[proposals/ui-vault-search.md]] |
| WYSIWYG on mobile | [[proposals/mobile-wysiwyg-editing.md]] |

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-03 | Created — Phase 1 critique session complete, remaining tasks identified | NetYeti |
