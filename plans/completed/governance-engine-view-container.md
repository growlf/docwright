---
title: Governance Engine View Container — Primary Shell Experience
status: completed
completed_date: 2026-06-30
author: NetYeti
created: 2026-06-27
type: plan
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
automated: full
assigned_to: NetYeti
tests_defined: true
tests_human_reviewed: true
_path: plans/completed/governance-engine-view-container
total_steps: 9
completed_steps: 9
scenario_synthesis: "Happy path: build GovernancePanel.svelte with sub-views (Status, Policies, Lifecycle, Hooks, Profile), wire as primary VC at order 10, Status page becomes its default content, PoliciesPanel retired. Failure path: a sub-view fails to load — GovernancePanel shows that sub-view in error state, other sub-views unaffected; ViewContainerMount error boundary prevents shell crash."
---

# Governance Engine View Container — Primary Shell Experience

## Overview

_Plan generated from approved proposal: Governance Engine View Container — Primary Shell Experience_

### Summary

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

### Expected Outcomes

- DocWright's primary UI reflects its actual value: a governance engine, not a file manager
- New users land on the governance dashboard by default — they immediately see what's active
- Plugin developers have a clear mental model: policies generate hooks, plugins respond
- The Status page is elevated from a utility route to the governance heartbeat
- Profile switching is a first-class action, not buried in settings

### Resources Required

- `src/webui/src/lib/GovernancePanel.svelte` — main VC component
- `src/webui/src/lib/govVc.ts` — shared search query store
- `src/webui/src/lib/coreVCs.ts` — register governance VC at order 10
- `src/webui/src/routes/+layout.svelte` — default leftView → governance
- `test/webui/e2e-check.ts` — Playwright checks for all 5 sub-views

### Discussion Notes

- The right panel claim is a natural fit for policy detail in a future iteration
- The `/status` route remains accessible standalone; the VC activates it by default
- Hook status is MVP-minimal: placeholder showing the concept, execution engine deferred
- `PoliciesPanel.svelte` absorbs into the Policies sub-view (not deleted — repurposed)

## Implementation Steps

| Step | Action | Details | Status |
| --- | --- | --- | --- |
| 1 | `govVc.ts` — shared search store | Create `src/webui/src/lib/govVc.ts` exporting `govSearchQuery: Writable<string>`. Shared between the shell registration in `coreVCs.ts` and `GovernancePanel.svelte` so the activity bar search input filters governance content without coupling layout to panel internals. | ✅ Done |
| 2 | `GovernancePanel.svelte` — scaffold + tab bar | Create the component with 5 sub-view tabs: Status (📊), Policies (📜), Lifecycle (🔄), Hooks (🔌), Profile (⚙). Tab bar renders `.gov-nav-btn` buttons with `.gov-nav-label` spans. `activeTab` state drives which sub-view is visible. Loads all data in parallel: `/api/status`, `/api/list`, `/api/profile-config`. | ✅ Done |
| 3 | Status sub-view | Renders vault stat blocks (`.gov-stat-n`) for: active plans, open proposals, pending approval, completed plans. Below stats: active plans list (`.gov-item` rows) with title, status badge, and click-to-navigate. Wires into the existing `/api/status` response shape. | ✅ Done |
| 4 | Policies sub-view | Absorbs policy tree from `PoliciesPanel.svelte`. Renders `.pol-list` with expandable directory nodes. Items are `.pol-item` links navigating to the policy document. `govSearchQuery` filters both dir names and item titles. | ✅ Done |
| 5 | Lifecycle sub-view | Lists proposals and plans from `/api/list` filtered to `proposals/` and `plans/` paths, rendered as `.gov-item` rows grouped by type. Gives a single-pane funnel view of what's in flight. | ✅ Done |
| 6 | Hooks sub-view (MVP placeholder) | `.gov-placeholder` panel explaining the concept: policies will declare `hooks:` in frontmatter; plugins register listeners via `bridge.registerHookListener()`. No live data yet — full hook execution engine is a future plan. | ✅ Done |
| 7 | Profile sub-view | Fetches `/api/profile-config` and renders: profile name, version, and document types list. Foundation for profile switching. Shows "Unknown" gracefully when the endpoint is unavailable. | ✅ Done — required fixing `/api/profile-config` (was omitting name/version/documentTypes). name+version now UI-verified; documentTypes empty in this lightweight-adopted vault (no profile configured) — VC wiring correct |
| 8 | Register as primary VC at order 10 | `coreVCs.ts`: register governance via `dw.registerView('governance', { mount, unmount, onSearch })` at order 10. Update `+layout.svelte` default `leftView` from `files` to `governance` so new users land on the governance dashboard. | ✅ Done |
| 9 | Playwright e2e coverage | Extend `test/webui/e2e-check.ts` with governance-specific checks: VC mounts without error banner, 5 sub-view tabs present, stat blocks render (≥4), active plans listed, policies sub-view has ≥1 item, lifecycle has ≥1 item, hooks placeholder renders, profile name/version/doc-types shown. | ✅ Done |

## Testing Plan

### Step Verification
- [ ] Step 1: `govVc.ts` — shared search store
- [ ] Step 2: `GovernancePanel.svelte` — scaffold + tab bar
- [ ] Step 3: Status sub-view
- [ ] Step 4: Policies sub-view
- [ ] Step 5: Lifecycle sub-view
- [ ] Step 6: Hooks sub-view (MVP placeholder)
- [ ] Step 7: Profile sub-view
- [ ] Step 8: Register as primary VC at order 10
- [ ] Step 9: Playwright e2e coverage

- [x] Step 1: `govVc.ts` exports `govSearchQuery`; layout wires it to VC registration
- [x] Step 2: GovernancePanel mounts; 5 tabs visible in activity bar
- [x] Step 3: Status sub-view shows stat blocks and active plans list
- [x] Step 4: Policies sub-view renders policy tree; search filters results
- [x] Step 5: Lifecycle sub-view shows proposals and plans
- [x] Step 6: Hooks sub-view shows placeholder panel without crash
- [x] Step 7: Profile sub-view shows name, version, document types — endpoint fixed (was omitting fields); name+version UI-verified 2026-06-30; documentTypes empty here (lightweight vault, no profile)
- [x] Step 8: Governance is first in activity bar; default view on fresh load
- [x] Step 9: All governance e2e checks pass; no regressions in other VCs

### Integration & Regression

- [x] Full e2e suite passes with no regressions (`npm run test:e2e`) — 33/33 on 2026-06-30
- [x] TypeScript compiles cleanly (`npm run typecheck`) — clean on 2026-06-30
- [x] Files, Tags, Git, Search VCs unaffected — confirmed by e2e

### Gate Criteria

- [x] `tests_defined` set to `true` in frontmatter
- [x] Human reviewer has verified step outcomes above
- [x] No regressions introduced to adjacent workflows

## Rollback Procedures

Revert `leftView` default in `+layout.svelte` from `governance` back to `files`. The
previous `PoliciesPanel.svelte` remains on disk and can be re-registered if needed.

## Risk Assessment

**LOW** — GovernancePanel is an additive component registered via the existing VC
registry. The `ViewContainerMount` error boundary isolates any failures. No existing
routes or API endpoints are changed.

## Document History

| Date | Change | Author |
| --- | --- | --- |
| 2026-06-28 | Wrote full implementation steps (9 steps) from proposal scope and existing code reference. | NetYeti |
| 2026-06-27 | Created from approved proposal | NetYeti |
