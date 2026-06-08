---
title: Phase 1 — UI Polish
status: completed
completed_date: 2026-06-04
author: NetYeti
created: 2026-06-03
phase: 1
gate_reviewer: NetYeti
gate_status: waived
gate_note: "Waived retroactively — plan completed before strict gate enforcement; NetYeti authorized 2026-06-07"
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
scenario_synthesis: UI prototype — all work is SvelteKit components and CSS; no shell execution or deployment steps
tags:
  - phase-1
  - ui
  - polish
_path: plans/phase-1-ui-polish.md
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

### Task 1 — Immutable H1 from frontmatter title ✅

**Proposal:** [[proposals/ui-immutable-title-h1.md]]
**Commit:** 17551ca
**Status:** ✅ Complete

Frontmatter title rendered as `<h1 class="doc-h1">` above document body in
read and WYSIWYG modes. Outside `contenteditable`. Proposals, plans, docs only.
Source mode unaffected. Styled with bottom border and 1.75em weight.

---

### Task 2 — Unified Panel System (Panel.svelte) ✅

**Proposal:** [[proposals/ui-sidebar-consistency.md]]
**Commit:** b93756a
**Status:** ✅ Complete

Three separate panel implementations (left sidebar, right properties pane,
CollationPanel fixed overlay) replaced by a single `Panel.svelte` component
with consistent slide animation, shared mobile scrim, and CollationPanel
promoted to a tab on the right panel.

| Step | Action | Status |
|------|--------|--------|
| 1 | `Panel.svelte` created — `side: 'left'\|'right'`, desktop strip collapse, mobile overlay, per-panel scrim | ✅ Done |
| 2 | Left sidebar refactored to `<Panel side="left">` | ✅ Done |
| 3 | Right panel moved to layout level; Properties/Related tabs; `currentDoc` store syncs page → layout | ✅ Done |
| 4 | CollationPanel: `position: fixed` removed; inline in Related tab; ↺ recheck button | ✅ Done |
| 5 | Mobile scrim: each Panel provides its own scrim; both panels close on navigation | ✅ Done |
| 6 | Toggle icons: chevrons `‹`/`›` on panel edges replacing `◀▶⊞` mix | ✅ Done |
| 7 | Mobile defaults: panels start closed; desktop starts open | ✅ Done |
| + | PropertiesPane actions (Start/Complete/Cancel/Approve) fixed to pass frontmatter through callbacks | ✅ Done |

---

### Task 3 — Activity Bar and Always-Visible Toolbar ✅

**Proposal:** [[proposals/ui-settings-activity-bar.md]]
**Commit:** 60874c4
**Status:** ✅ Complete

An always-visible top toolbar (desktop and mobile) anchoring the home icon
and an activity bar providing distinct entry points for Files, Settings, and
Git. The mobile-only top bar becomes a permanent layout element.

| Step | Action | Status |
|------|--------|--------|
| 1 | `.app-toolbar` always visible on all viewports (CSS grid: left / center-brand / right) | ✅ Done |
| 2 | Brand logo centered in toolbar, acts as home button; duplicate home icon removed | ✅ Done |
| 3 | Activity bar: 📄 Files, ⚙ Settings, ⎇ Git — switches left panel content | ✅ Done |
| 4 | Settings view: grouped links (AI Instructions, Templates, Project, Brand) | ✅ Done |
| 5 | Git view: `GitPanel.svelte` shown inline when ⎇ active | ✅ Done |
| 6 | Layout: activity bar is a 40px flex column before `<Panel side="left">` | ✅ Done |
| + | Props-toggle button removed from document toolbar (right sidebar covers it) | ✅ Done |
| + | Button icons added: ✏ Edit, ⟨/⟩ Source, 👁 Preview, ✓ Save, ✕ Cancel, 🗑 Delete | ✅ Done |

---

### Task 4 — Funnel View (Lifecycle Swimlanes) ✅

**Proposal:** [[proposals/ui-lifecycle-graph-view.md]]
**Commit:** a47887c
**Status:** ✅ Complete

A visual representation of the governance pipeline — swimlane columns per
lifecycle stage, document cards clickable to navigate. Served as a tab on
the status page or at `/status/funnel`. No graph library needed: SVG or
CSS-only layout. The "wow" demo that makes DocWright's model immediately
legible to a new user.

| Step | Action | Status |
|------|--------|--------|
| 1 | `FunnelView.svelte` — 5 swimlane columns, color-coded per stage | ✅ Done |
| 2 | Cards: title (2-line clamp), complexity dot, priority, assignee, clickable | ✅ Done |
| 3 | `›` arrow connectors between column headers | ✅ Done |
| 4 | `≡ List / ⊙ Funnel` toggle on status page, persisted in `sessionStorage` | ✅ Done |
| 5 | Mobile: vertical stack with rotated arrows | ✅ Done |

---

## Phase Gate

This plan is gated. When all tasks above are `✅ Complete`, the phase gate
fires and the following question is put to the gate reviewer before Phase 2
begins:

> "Are you satisfied with the Phase 1 Web UI? Is there anything that still
> needs addressing before Phase 2 (VSCodium extension + profile engine) begins?
> You may either sign off or open a final critique round."

**Gate reviewer:** NetYeti
**Gate status:** `pending` (all tasks complete — awaiting NetYeti sign-off)

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
| 2026-06-04 | All 4 tasks complete; step tables updated to reflect actual implementation | NetYeti |
