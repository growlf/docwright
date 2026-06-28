---
title: Governance Engine View Container — Primary Shell Experience
status: completed
completed_date: 2026-06-28
author: NetYeti
created: 2026-06-27
tags:
  - ui
  - governance
  - plugin-system
  - phase-4
  - layout
  - policies
proposal_source: proposals/approved/governance-engine-view-container.md
priority: high
complexity: high
automated: guided
assigned_to: NetYeti
tests_defined: true
tests_human_reviewed: true
total_steps: 12
completed_steps: 12
_path: plans/completed/governance-engine-view-container.md
scenario_synthesis: "Happy path: build GovernancePanel.svelte with sub-views (Status, Policies, Lifecycle, Hooks, Profile), wire as primary VC at order 10, Status page becomes its default content. Failure path: a sub-view fails to load — GovernancePanel shows that sub-view in error state, other sub-views unaffected; ViewContainerMount error boundary prevents shell crash."
---

# Governance Engine View Container — Primary Shell Experience

## Overview

Replace the underscoped "Policies View Container" (Step 11 of the UI layout refactor)
with a fully-realised **Governance Engine View Container** — the primary experience of
DocWright. This VC owns the lifecycle heartbeat of the vault: active proposals and plans,
policy chain browser, outcome lineage, profile-driven views, and plugin hook status.
The Status page (`/status`) moves here as its default content area.

### Problem Statement

The current plan treats "Policies" as a peer alongside Files, Tags, and Git — effectively
a filtered file browser for `policies/`. This misrepresents DocWright's core value
proposition.

DocWright is not a document manager with a policies section. It is a **policy execution
engine**. Policies are atomic, composable, and executable — they generate hooks that
plugins and AI respond to. The Status page, the proposal/plan lifecycle, the outcome
lineage, and the profile configuration are all expressions of the same governance layer.

Naming this view "Policies" and giving it the same weight as the file browser sends the
wrong signal to every new user and every plugin developer.

### Expected Outcomes

- DocWright's primary UI reflects its actual value: a governance engine, not a file manager
- New users land on the governance dashboard by default — they immediately see what's active
- Plugin developers have a clear mental model: policies generate hooks, plugins respond
- The Status page is elevated from a utility route to the governance heartbeat
- Profile switching is a first-class action, not buried in settings
- Foundation for the systems admin, org-policy, and software-dev use cases described in vision

## Implementation Steps

| Step | Action | Details | Status |
| --- | --- | --- | --- |
| 1 | GovernancePanel.svelte — sub-view shell + nav strip | 5 sub-views: Status, Policies, Lifecycle, Hooks, Profile. Nav strip with icon + label. Error-isolated per sub-view. | ✅ Done |
| 2 | govVc.ts shared store | Writable `govSearchQuery` store shared between coreVCs.ts and GovernancePanel — drives per-VC search. | ✅ Done |
| 3 | Register governance VC at order 10 in coreVCs.ts | `dw.registerView('governance', ...)` with `onSearch` and `onDeactivate` wired to `govSearchQuery`. | ✅ Done |
| 4 | Activity bar default = governance | `leftView` defaults to `'governance'` from localStorage; persists across page refresh. | ✅ Done |
| 5 | Status sub-view | Stat grid: active plans, open proposals, approved-pending, completed count. Active plans list. "Open full dashboard →" link to /status. | ✅ Done |
| 6 | Policies sub-view | Policy tree browser absorbed from PoliciesPanel — collapsible category dirs, file list, active highlight, search filtering. | ✅ Done |
| 7 | Lifecycle sub-view | Combined proposals (approved-pending first, then open) + active plans. Badge per status. Search-filtered. | ✅ Done |
| 8 | Hooks sub-view | MVP placeholder — explains future hook system. Policies declare `hooks:` in frontmatter; plugins register via bridge API. | ✅ Done |
| 9 | Profile sub-view — component | Shows active profile name, version, and document types list from `/api/profile-config`. | ✅ Done |
| 10 | Fix /api/profile-config to return name, version, documentTypes | Endpoint previously returned only `features` and `relationshipEngine`. Added `name`, `version`, `documentTypes` from `getActiveProfile()`. Also fixed vault `profile.json` clobbering `documentTypes` with `[]`. | ✅ Done |
| 11 | Delete orphaned PoliciesPanel.svelte | PoliciesPanel functionality fully absorbed into GovernancePanel. File removed. | ✅ Done |
| 12 | Playwright e2e tests for governance VC | 35/35 checks passing: governance panel loads by default, all 5 nav tabs render, stat grid, policy tree, profile name/version/document types. | ✅ Done |

## Testing Plan

- [x] Governance VC loads by default on fresh page load (leftView = 'governance')
- [x] All 5 sub-view nav buttons are visible and clickable
- [x] Status sub-view: stat grid shows 4 count tiles; active plans list renders
- [x] Policies sub-view: policy directory tree renders with at least one category
- [x] Lifecycle sub-view: proposals and/or plans appear
- [x] Profile sub-view: profile name shown, version shown, document types listed (7 types)
- [x] Search input filters items in Status and Policies sub-views
- [x] Switching leftView away and back preserves state (localStorage)
- [x] `npm run test:webui` — 36/36 passing
- [x] `npm run test:dispatch` — 277/277 passing
- [x] `npm run test:e2e` — 35/35 passing

### Gate Criteria

- [x] All 12 implementation steps marked ✅ Done
- [x] All e2e UI checks passing (35/35) — confirmed 2026-06-28
- [x] All unit tests passing (36 webui, 277 dispatch) — confirmed 2026-06-28
- [x] PR #42 merged to develop — merged 2026-06-28
- [x] No regressions in other VCs (Files, Git, Tags, Search all pass)
- [x] tests_defined: true — confirmed by NetYeti 2026-06-28
- [x] tests_human_reviewed: true — confirmed by NetYeti 2026-06-28

## Rollback Procedures

Revert coreVCs.ts to restore PoliciesPanel registration. GovernancePanel can be left
in place as it has no side effects when not mounted. PoliciesPanel.svelte recoverable
from git history.

## Risk Assessment

- Low risk: GovernancePanel is a self-contained panel component with no side effects
- Profile sub-view depends on `/api/profile-config` — gracefully degrades if endpoint fails
- PoliciesPanel deletion is irreversible within the branch; recoverable via git

## Document History

| Date | Change | Author |
| --- | --- | --- |
| 2026-06-27 | Created from approved proposal | NetYeti |
| 2026-06-28 | Populated 12 implementation steps; steps 1–9 already delivered in VC refactor | NetYeti |
| 2026-06-28 | All 12 steps complete; PR #42 merged to develop; tests confirmed; Gate Criteria added | NetYeti |
