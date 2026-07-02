---
title: "Developer collaboration model: issue store of record, GitHub/Forgejo sync, and the ticket hierarchy"
author: "NetYeti"
created: "2026-07-01"
tags:
  - governance
  - process
  - collaboration
  - issues
  - milestones
  - roadmap
category:
  - governance
complexity: medium
approved: false
priority: high
created_by: "NetYeti@cluster-llm"
assigned_to: []
related_to:
  - proposals/approved/separate-dev-tracking-milestones-and-beta-channel.md
  - policies/core/code-over-memory.md
  - policies/core/multi-perspective-review.md
depends_on: []
blocks: []
author-role: contributor
---

# Developer collaboration model: issue store of record, GitHub/Forgejo sync, and the ticket hierarchy

> **Tracked by:** [GitHub #104](https://github.com/growlf/docwright/issues/104) (priority:high) —
> the gated checklist for approving and building this direction. Approving this proposal is that
> issue's first step.
>
> **Discussion proposal.** Filed via the proposal → plan → issue flow: the *direction* is
> discussed and approved here before it is broken into issues and added to the roadmap /
> milestones. Not a code change — a durable process decision.

## Summary

DocWright now tracks work in **two places** and this ambiguity already caused a concrete
failure. This proposal picks a **single store of record** for developer work, defines how the
other surface **mirrors** it, and codifies the **prioritized hierarchy** that lets independent
contributors take clearly-scoped chunks without colliding.

## Problem statement

1. **Two issue homes, unclear relationship.** #68 established an in-vault `issues/` markdown
   store (git-canonical, no auxiliary DB, no telemetry) with GitHub Issues as a *public intake*
   channel. But real developer collaboration wants assignable, labeled, milestoned tickets —
   which pushed us to create GitHub Issues (#91–#98) for the post-merge review findings. We now
   have both, with no defined source of truth or sync direction.
2. **Parallel-work collision, observed.** On 2026-07-01, the roadplan view (Step 4 of #68) was
   built **twice at once** — once merged as #89, once on a local branch — because there was no
   shared, visible signal of what was in flight. Redundant work + a discarded branch resulted.
3. **No enforced prioritization or hierarchy.** Nothing linked the #68 steps into an ordered,
   assignable structure, so work happened out of order and out of sight.

## Proposed direction (for discussion)

### 1. Single store of record + a mirror

The invariants from #68 (**git is canonical; no auxiliary database; no telemetry; works
air-gapped on self-hosted Forgejo**) mean an external tracker cannot be *authoritative*.
Recommendation: **in-vault `issues/` stays the store of record**, and **GitHub/Forgejo Issues
are a projection** of it (generated/synced), not the source. This keeps offline/self-hosted
orgs whole while still giving contributors the assignable-ticket UX where they already work.

Alternatives to weigh:
- **(A) In-vault canonical, tracker mirrors it** *(recommended)* — preserves invariants; needs
  a sync tool (issue ⇄ markdown). More build.
- **(B) Tracker canonical for dev work** — best ticket UX; **breaks** git-canonical / air-gap /
  no-external-dep. Rejected unless the invariants are explicitly relaxed.
- **(C) Dual with a hard boundary** — GitHub Issues for the public *product* (bridge intake),
  in-vault `issues/` for governed dev work; a documented one-way flow intake → triage → `issues/`.

### 2. The ticket hierarchy (prevents collisions)

- **Chunk:** every workable unit is one issue with a clear deliverable + acceptance criteria.
- **Priority:** `priority:high|medium|low` labels (created 2026-07-01).
- **Hierarchy:** an **epic** (tracking) issue links its children as an ordered checklist
  (see #98). Epics come from an approved **plan**; children are the plan's deliverables.
- **Coordination rule:** **assign yourself before starting** a child issue — the missing signal
  that would have prevented the #89 collision. Enforce via convention now; automate later
  (code-over-memory) if it recurs.

### 3. Roadmap / milestone mapping

- `milestone:` frontmatter (#68 Step 3) is the source of truth; **GitHub/Forgejo milestones
  mirror it**. The derived roadplan view (#89) already renders current / next / `future`.
- New **directions** enter via `proposal → plan`; only once approved are they broken into issues
  and assigned a milestone. This is the gate that keeps the roadmap intentional.

## Security / Verification

- **Security / invariants:** option (A) touches no external store as source of truth — no new
  telemetry, no air-gap break. A sync tool must treat the tracker as write-target only.
- **Verification:** a round-trip test (markdown issue → tracker → back) with no drift; a lint
  that every open issue has priority + milestone + (if part of a plan) an epic link.

## Out of scope / follow-ups (become issues once this is approved)

- Build the `issues/` ⇄ tracker sync tool.
- Formalize the "assign before start" and "epic per plan" conventions (lint/CI).
- Decide Forgejo parity for self-hosters (mirror of the GitHub projection).
