---
title: Governance Engine View Container — Primary Shell Experience
status: approved
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
tests_defined: false
tests_human_reviewed: false
_path: plans/governance-engine-view-container.md
scenario_synthesis: "Happy path: build GovernancePanel.svelte with sub-views (Status, Policies, Lifecycle, Hooks, Profile), wire as primary VC at order 10, Status page becomes its default content, PoliciesPanel retired. Failure path: a sub-view fails to load — GovernancePanel shows that sub-view in error state, other sub-views unaffected; ViewContainerMount error boundary prevents shell crash."
---

# Governance Engine View Container — Primary Shell Experience

## Overview

_Plan generated from approved proposal: Governance Engine View Container — Primary Shell Experience_

### Overview

# Governance Engine View Container — Primary Shell Experience

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

Naming this view "Policies" and giving it the same weight as the file browser sends the
wrong signal to every new user and every plugin developer.

### Expected Outcomes

- DocWright's primary UI reflects its actual value: a governance engine, not a file manager
- New users land on the governance dashboard by default — they immediately see what's active
- Plugin developers have a clear mental model: policies generate hooks, plugins respond
- The Status page is elevated from a utility route to the governance heartbeat
- Profile switching is a first-class action, not buried in settings
- Foundation for the systems admin, org-policy, and software-dev use cases described in vision

### Resources Required

- One Svelte component: `GovernancePanel.svelte` (replaces `PoliciesPanel.svelte`)
- Sub-components: `LifecycleStatusView.svelte`, `PolicyChainBrowser.svelte`,
  `HookStatusView.svelte`, `ProfileDashboard.svelte`
- Bridge API extension: `bridge.registerHookListener()` (new method)
- Plan update: Step 11 of `ui-layout-view-container-refactor.md` rewritten to target this

### Related Documents

- `plans/ui-layout-view-container-refactor.md` — Step 11 will implement this
- `proposals/multiuser-auth-concurrent-sessions.md` — identity is required for hook audit trail

### Discussion Notes

- The right panel claim is a natural fit for policy detail: sidebar shows the policy tree,
  right panel shows the selected policy's full content, hook status, and linked plans
- The `/status` route should remain accessible standalone — the VC activates it by
  default, but does not capture it exclusively
- Hook status is MVP-minimal here: show which policies have `hooks:` declared and which
  plugins have registered listeners. Full hook execution engine is a later proposal.
- `PoliciesPanel.svelte` is retired (or renamed/repurposed as the policy chain sub-view)


## Implementation Steps

| Step | Action | Details | Status |
| --- | --- | --- | --- |
| 1 | | | ⏳ Pending |

## Testing Plan

_Testing plan TBD_

## Rollback Procedures

_Rollback procedures TBD_

## Risk Assessment

_Risk assessment TBD_

## Document History

| Date | Change | Author |
| --- | --- | --- |
| 2026-06-27 | Created from approved proposal | NetYeti |
