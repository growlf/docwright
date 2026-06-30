---
title: "Governance Engine VC — Deferred Enhancements"
author: NetYeti
author-role: contributor
created: 2026-06-30
category: feature
priority: medium
complexity: medium
estimated_effort: M
tags:
  - ui
  - governance
  - profile
  - core-engine
approved: false
created_by: "NetYeti@cluster-llm"
assigned_to: ""
related_to:
  - proposals/approved/governance-engine-view-container.md
  - plans/phase-4-profile-acl-ai.md
  - proposals/approved/ui-lifecycle-graph-view.md
---

> Captured from the Governance Engine VC MVP. The Governance VC shipped (as Step
> 11 of the UI layout refactor) as a deliberate MVP slice of the approved
> proposal. Four capabilities described in that proposal were **not built** and
> would be lost when the `governance-engine-view-container` plan is closed. This
> proposal preserves them. (A fifth deferral — the hook execution engine — is its
> own proposal: [[proposals/policy-hook-execution-engine]]. A sixth — lineage —
> is already covered by [[proposals/approved/ui-lifecycle-graph-view]].)

## Problem

The shipped Governance VC delivers the MVP: Status stats, a flat policy tree, a
flat lifecycle list, a Hooks placeholder, and a read-only Profile panel. The
approved proposal described a richer governance dashboard. Four of those
capabilities have no home outside the (now-closing) plan and would be lost.

## Proposed Solution

Four scoped enhancements to `GovernancePanel.svelte`, each independently
shippable:

1. **Profile-driven rendering.** The Governance VC reads the active profile
   (`profile.json`) and adapts which sub-views/pipeline it shows — e.g.
   `org-operations` shows inbox→issue→proposal→plan→policy/decision, while
   `knowledge-base` shows the Ingest/Lint/Wiki pipeline. Today the five sub-views
   are static regardless of profile.

2. **In-view profile switching.** Switch the active profile from the Profile
   sub-view without a restart — "profile switching is a first-class action, not
   buried in settings." Depends on the profile-engine runtime in
   [[plans/phase-4-profile-acl-ai]] (the engine layer; this is its governance-VC surface).

3. **Right-panel policy detail.** Selecting a policy in the Policies tree opens
   the VC's right-panel claim showing that policy's full content, its declared
   hooks, and the plans linked to it.

4. **Policy-chain-browser enrichment.** Group policies by domain / profile /
   stage with indicators for *active*, *has-hooks*, *has-listeners* — instead of
   the current plain `policies/` directory tree.

## Out of Scope

- The shipped MVP (Status / policy tree / lifecycle list / hooks placeholder /
  profile info) — already done.
- The **hook execution engine** itself — [[proposals/policy-hook-execution-engine]]
  (#3/#4 indicators here merely *display* hook state once that engine exists).
- **Proposal→Plan→Outcome lineage** — already captured by
  [[proposals/approved/ui-lifecycle-graph-view]]; the Governance VC can surface
  that view when it ships, no separate work needed here.

## Alternatives Considered

- **Leave them in the governance-engine plan.** Rejected — that plan is being
  closed as superseded; ideas recorded only there are lost on archive. This is
  the exact "deferred ideas not captured are ideas lost" failure mode.
- **One mega-proposal with the hook engine.** Rejected — the hook engine is a
  distinct core subsystem with its own security surface; bundling it with UI
  refinements would muddle prioritization.

## Related

- [[proposals/approved/governance-engine-view-container]] — source proposal (MVP shipped, superseded)
- [[plans/phase-4-profile-acl-ai]] — profile-engine runtime that #2 depends on
- [[proposals/policy-hook-execution-engine]] — sibling deferral (#1 engine)
- [[proposals/approved/ui-lifecycle-graph-view]] — covers the lineage deferral
