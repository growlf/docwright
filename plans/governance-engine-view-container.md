---
title: Governance Engine View Container — Primary Shell Experience
status: approved
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
tests_human_reviewed: false
_path: plans/governance-engine-view-container.md
total_steps: 9
completed_steps: 0
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
| 1 | `govVc.ts` — shared search store | Create `src/webui/src/lib/govVc.ts` exporting `govSearchQuery: Writable<string>`. Shared between the shell registration in `coreVCs.ts` and `GovernancePanel.svelte` so the activity bar search input filters governance content without coupling layout to panel internals. | ⏳ Pending |
| 2 | `GovernancePanel.svelte` — scaffold + tab bar | Create the component with 5 sub-view tabs: Status (📊), Policies (📜), Lifecycle (🔄), Hooks (🔌), Profile (⚙). Tab bar renders `.gov-nav-btn` buttons with `.gov-nav-label` spans. `activeTab` state drives which sub-view is visible. Loads all data in parallel: `/api/status`, `/api/list`, `/api/profile-config`. | ⏳ Pending |
| 3 | Status sub-view | Renders vault stat blocks (`.gov-stat-n`) for: active plans, open proposals, pending approval, completed plans. Below stats: active plans list (`.gov-item` rows) with title, status badge, and click-to-navigate. Wires into the existing `/api/status` response shape. | ⏳ Pending |
| 4 | Policies sub-view | Absorbs policy tree from `PoliciesPanel.svelte`. Renders `.pol-list` with expandable directory nodes. Items are `.pol-item` links navigating to the policy document. `govSearchQuery` filters both dir names and item titles. | ⏳ Pending |
| 5 | Lifecycle sub-view | Lists proposals and plans from `/api/list` filtered to `proposals/` and `plans/` paths, rendered as `.gov-item` rows grouped by type. Gives a single-pane funnel view of what's in flight. | ⏳ Pending |
| 6 | Hooks sub-view (MVP placeholder) | `.gov-placeholder` panel explaining the concept: policies will declare `hooks:` in frontmatter; plugins register listeners via `bridge.registerHookListener()`. No live data yet — full hook execution engine is a future plan. | ⏳ Pending |
| 7 | Profile sub-view | Fetches `/api/profile-config` and renders: profile name, version, and document types list. Foundation for profile switching. Shows "Unknown" gracefully when the endpoint is unavailable. | ⏳ Pending |
| 8 | Register as primary VC at order 10 | `coreVCs.ts`: register governance via `dw.registerView('governance', { mount, unmount, onSearch })` at order 10. Update `+layout.svelte` default `leftView` from `files` to `governance` so new users land on the governance dashboard. | ⏳ Pending |
| 9 | Playwright e2e coverage | Extend `test/webui/e2e-check.ts` with governance-specific checks: VC mounts without error banner, 5 sub-view tabs present, stat blocks render (≥4), active plans listed, policies sub-view has ≥1 item, lifecycle has ≥1 item, hooks placeholder renders, profile name/version/doc-types shown. | ⏳ Pending |

## Testing Plan

### Step Verification

- [ ] Step 1: `govVc.ts` exports `govSearchQuery`; layout wires it to VC registration
- [ ] Step 2: GovernancePanel mounts; 5 tabs visible in activity bar
- [ ] Step 3: Status sub-view shows stat blocks and active plans list
- [ ] Step 4: Policies sub-view renders policy tree; search filters results
- [ ] Step 5: Lifecycle sub-view shows proposals and plans
- [ ] Step 6: Hooks sub-view shows placeholder panel without crash
- [ ] Step 7: Profile sub-view shows name, version, document types
- [ ] Step 8: Governance is first in activity bar; default view on fresh load
- [ ] Step 9: All governance e2e checks pass; no regressions in other VCs

### Integration & Regression

- [ ] Full e2e suite passes with no regressions (`npm run test:e2e`)
- [ ] TypeScript compiles cleanly (`npm run typecheck`)
- [ ] Files, Tags, Git, Search VCs unaffected

### Gate Criteria

- [ ] `tests_defined` set to `true` in frontmatter
- [ ] Human reviewer has verified step outcomes above
- [ ] No regressions introduced to adjacent workflows

## Rollback Procedures

Revert `leftView` default in `+layout.svelte` from `governance` back to `files`. The
previous `PoliciesPanel.svelte` remains on disk and can be re-registered if needed.

## Risk Assessment

**LOW** — GovernancePanel is an additive component registered via the existing VC
registry. The `ViewContainerMount` error boundary isolates any failures. No existing
routes or API endpoints are changed.

## Closure — Superseded

**This plan never executed; its work shipped under another plan.** The Governance
Engine VC was built as **Step 11 of `ui-layout-view-container-refactor`** (commit
`c9ab97c`, released in v0.4.1 / `2711e82`). This document was created and had its
9 steps authored in parallel, describing work that was already being built — so
its checkboxes were never ticked (`completed_steps: 0` = orphaned, not pending).

**Verified done (2026-06-30):** all 9 steps confirmed implemented in code
(`GovernancePanel.svelte`, `govVc.ts`, `coreVCs.ts` order 10, `+layout.svelte`
default `governance`); `typecheck` clean; e2e **33/33 pass** incl. 12 governance
checks.

### Deferred scope (captured before close — nothing lost)

The 9 steps were an MVP slice of [[proposals/approved/governance-engine-view-container]].
Richer scope from that proposal was deliberately not built and is preserved in:

- [[proposals/policy-hook-execution-engine]] — full hook engine (Step 6 shipped a placeholder only)
- [[proposals/governance-engine-vc-deferred-enhancements]] — profile-driven rendering, in-view profile switching, right-panel policy detail, policy-chain-browser enrichment
- [[proposals/approved/ui-lifecycle-graph-view]] — already covers the Proposal→Plan→Outcome lineage idea

### Pending human-gated close

AI cannot set `status: completed`/`canceled` or `tests_human_reviewed: true`.
Recommended: mark **`canceled` (superseded by ui-layout-refactor Step 11)** — more
accurate than `completed`, since this doc never executed — and move to
`plans/completed/`.

## Document History

| Date | Change | Author |
| --- | --- | --- |
| 2026-06-30 | Verified 9/9 already implemented via ui-layout-refactor Step 11; captured deferred scope to 3 proposals; prepped for superseded-close. | NetYeti (AI-assisted) |
| 2026-06-28 | Wrote full implementation steps (9 steps) from proposal scope and existing code reference. | NetYeti |
| 2026-06-27 | Created from approved proposal | NetYeti |
