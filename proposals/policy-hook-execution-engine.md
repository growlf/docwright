---
title: "Policy Hook Execution Engine"
author: NetYeti
author-role: contributor
created: 2026-06-30
category: feature
priority: high
complexity: high
estimated_effort: L
tags:
  - governance
  - plugin-system
  - policy
  - hooks
  - core-engine
approved: false
created_by: "NetYeti@cluster-llm"
assigned_to: ""
related_to:
  - proposals/approved/governance-engine-view-container.md
  - plans/completed/ui-layout-view-container-refactor.md
---

> Captured from the Governance Engine VC MVP. The shipped Governance VC (built as
> Step 11 of the UI layout refactor) includes only a **Hooks placeholder**; the
> approved governance-engine proposal explicitly deferred the "full hook
> execution engine" to a later proposal. This is that proposal.

## Problem

DocWright's stated identity is a **policy execution engine** — "policies are
atomic, composable, and executable; they generate hooks that plugins and AI
respond to." Today that is not true: policies are documents, and the Governance
VC's Hooks sub-view is a static placeholder. Nothing fires, nothing listens.

Without a hook engine, DocWright's core differentiator — governance that *reacts*
(a policy change triggering a compliance check, a plugin responding to a
lifecycle event, an AI prompted to verify) — does not exist. The governance
layer can only display state, not enforce or propagate it. This blocks the
systems-admin, org-policy, and software-dev use cases the vision describes.

## Proposed Solution

A surface-agnostic hook engine in the dispatch module, surfaced through the
existing Governance VC Hooks sub-view.

1. **Declaration.** Policies declare `hooks:` in frontmatter — a list of event
   types the policy emits (e.g. `policy:compliance-check`, `lifecycle:promoted`).
2. **Registry + dispatch.** A dispatch-layer registry (`src/dispatch/hooks.ts`)
   collects declared hooks from the vault index and dispatches events on the
   triggers that already exist (lifecycle transitions in `gates.ts`/`promote.ts`,
   policy-atom evaluations). State lives in frontmatter + index, never in memory
   between calls (per dispatch invariants).
3. **Listener API.** Plugins register via the bridge:
   `window.__docwright.bridge.registerHookListener('policy:compliance-check', handler)`.
   AI listeners route through the ACL controller and carry `ai-last-action:` stamps.
4. **Live status.** The Governance VC Hooks sub-view replaces its placeholder with
   real data: which hooks are declared, which plugins are listening, and
   fire/success/fail indicators with alerts.

### Security

- Hook handlers run within the existing plugin sandbox; a hook may **never**
  bypass a governance gate or set human-gated frontmatter (`approved`,
  `status: completed`, `gate_status`). This is enforced in code, not convention.
- AI-triggered hooks respect the ACL controller and are auditable.

## Verification

- Unit tests for the registry (declaration parsing, dispatch fan-out, listener
  (de)registration), runnable outside the extension host.
- An e2e check: the Hooks sub-view renders ≥1 declared hook and a registered
  listener against a fixture vault; a fired hook updates status.
- Negative test: a hook handler attempting to set `approved: true` is rejected.

## Out of Scope

- The shipped MVP placeholder (already done).
- A redesign of the plugin sandbox itself (assumed to exist; this composes with it).
- Cross-org / federated hook propagation (a much later concern).

## Alternatives Considered

- **Keep the placeholder.** Rejected — leaves the core "execution engine" vision
  permanently unrealized; the product stays a viewer.
- **Hardcode the reactions** (e.g. always run a compliance check on promote).
  Rejected — violates the policy-driven invariant; behavior must be governed by
  policy declarations, not baked-in logic.

## Related

- [[proposals/approved/governance-engine-view-container]] — source; Hooks sub-view is the surface
- [[policies/core/code-over-memory]] — the enforce-in-code principle this honors
- [[proposals/governance-engine-vc-deferred-enhancements]] — sibling deferred-scope capture
