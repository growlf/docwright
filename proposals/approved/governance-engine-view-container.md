---
title: Governance Engine View Container — Primary Shell Experience
author: NetYeti
created: 2026-06-27
tags:
  - ui
  - governance
  - plugin-system
  - phase-4
  - layout
  - policies
complexity: high
priority: high
approved: true
created_by: NetYeti@phoenix
assigned_to: NetYeti
related_to:
  - proposals/ui-layout-view-container-refactor.md
depends_on:
  - plans/ui-layout-view-container-refactor.md
blocks: []
---

# Governance Engine View Container — Primary Shell Experience

## Summary

Replace the underscoped "Policies View Container" (Step 11 of the UI layout refactor)
with a fully-realised **Governance Engine View Container** — the primary experience of
DocWright. This VC owns the lifecycle heartbeat of the vault: active proposals and plans,
policy chain browser, outcome lineage, profile-driven views, and plugin hook status.
The Status page (`/status`) moves here as its default content area.

## Problem Statement

The current plan treats "Policies" as a peer alongside Files, Tags, and Git — effectively
a filtered file browser for `policies/`. This misrepresents DocWright's core value
proposition.

DocWright is not a document manager with a policies section. It is a **policy execution
engine**. Policies are atomic, composable, and executable — they generate hooks that
plugins and AI respond to. The Status page, the proposal/plan lifecycle, the outcome
lineage, and the profile configuration are all expressions of the same governance layer.

Naming this view "Policies" and giving it the same weight as the file browser sends the
wrong signal to every new user and every plugin developer.

## Proposed Solution

### Rename and elevate

Replace the "Policies View Container" (Step 11, order: 20) with the
**Governance Engine View Container** (order: 10 — primary). Files moves to order: 20.

The Governance Engine VC owns:

| Sub-view | Description |
|----------|-------------|
| **Lifecycle Status** | Active proposals → plans → outcomes. What the `/status` route shows today. Default landing when the VC activates. |
| **Policy Chain Browser** | Policies grouped by domain, profile, and stage. Shows which policies are active, which have hooks, which plugins are listening. |
| **Proposal → Plan → Outcome Lineage** | Traceable ancestry for every decision. Click any completed plan to see the proposal that started it and the policy that evolved from it. |
| **Profile Dashboard** | Which profile is active, what it governs, which document types and states are in scope. Switch profiles without leaving the view. |
| **Hook Status** | Which policies have generated executable hooks. Which plugins have registered listeners. Alert indicators when hooks are firing or failing. |

### Activity bar order (updated)

| Order | VC | Icon | Note |
|-------|----|------|------|
| 10 | Governance Engine | 🏛 | **Primary** — default on first open |
| 20 | Files | 📄 | File browser |
| 25 | Search | 🔍 | Ctrl+K shortcut |
| 30 | Tags | 🏷 | Tag browser |
| 40 | Git | ⎇ | Git operations |
| 100+ | External plugins | varies | External at 100+ |

Settings moves to footer (Step 7 of the refactor plan — unchanged).

### Status page transition

`/status` (the current SvelteKit route) becomes the Governance Engine VC's default
content area. On first activation, the VC navigates `#content` to `/status`. The route
continues to exist as a standalone URL (so bookmarks and links still work), but it is
now semantically owned by the Governance Engine.

Over time the Status page grows into a full governance dashboard — the VC's right panel
claim can show policy detail, hook status, or plan progress for whatever the user selects
in the sidebar.

### Profile-driven rendering

The Governance Engine VC reads the active profile (`profile.json`) to determine what
sub-views to show. Example:

| Profile | Governance Engine shows |
|---------|------------------------|
| `org-operations` | Full lifecycle: inbox → issue → proposal → plan → policy/decision |
| `doc-lifecycle` | Proposal → plan → completed/canceled |
| `infra-topology` | Planned → active → decommissioned device tracking |
| `knowledge-base` | Ingest/Lint/Wiki pipeline status |

External profiles (installed by plugins) register their governance views the same way.

### Plugin hook status

Policies can declare `hooks:` in their frontmatter — a list of event types the policy
generates signals for. Plugins register hook listeners via the bridge:

```typescript
window.__docwright.bridge.registerHookListener('policy:compliance-check', (event) => {
  // plugin responds to policy compliance check event
});
```

The Governance Engine VC surfaces which hooks are active, which plugins are listening,
and whether any hooks are alerting. This is the first step toward the full "policies
generate executable hooks that plugins and AI respond to" model.

### Svelte implementation

The Governance Engine VC is a Svelte component compiled into DocWright's own bundle
(a core VC, same as Files and Git). It may import from `$lib/` directly and use
`bridge.emit()` for shell signalling. It does NOT use the external plugin bundle contract.

Its sidebar renders a collapsible tree:
```
🏛 Governance
  ├─ 📊 Status          (navigates /status)
  ├─ 📜 Policies        (policy chain browser)
  ├─ 🔄 Lifecycle       (proposals / plans / outcomes)
  ├─ 🔌 Hooks           (hook status panel)
  └─ ⚙  Profile         (active profile + switch)
```

## Expected Outcomes

- DocWright's primary UI reflects its actual value: a governance engine, not a file manager
- New users land on the governance dashboard by default — they immediately see what's active
- Plugin developers have a clear mental model: policies generate hooks, plugins respond
- The Status page is elevated from a utility route to the governance heartbeat
- Profile switching is a first-class action, not buried in settings
- Foundation for the systems admin, org-policy, and software-dev use cases described in vision

## Resources Required

- One Svelte component: `GovernancePanel.svelte` (replaces `PoliciesPanel.svelte`)
- Sub-components: `LifecycleStatusView.svelte`, `PolicyChainBrowser.svelte`,
  `HookStatusView.svelte`, `ProfileDashboard.svelte`
- Bridge API extension: `bridge.registerHookListener()` (new method)
- Plan update: Step 11 of `ui-layout-view-container-refactor.md` rewritten to target this

## Related Documents

- `plans/ui-layout-view-container-refactor.md` — Step 11 will implement this
- `proposals/multiuser-auth-concurrent-sessions.md` — identity is required for hook audit trail

## Discussion Notes

- The right panel claim is a natural fit for policy detail: sidebar shows the policy tree,
  right panel shows the selected policy's full content, hook status, and linked plans
- The `/status` route should remain accessible standalone — the VC activates it by
  default, but does not capture it exclusively
- Hook status is MVP-minimal here: show which policies have `hooks:` declared and which
  plugins have registered listeners. Full hook execution engine is a later proposal.
- `PoliciesPanel.svelte` is retired (or renamed/repurposed as the policy chain sub-view)
