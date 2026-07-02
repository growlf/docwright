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

> **Coordination:** [GitHub #104](https://github.com/growlf/docwright/issues/104) (priority:high)
> is the gated checklist for approving this direction and standing up the plan it becomes.
> (Per §2, proposals themselves aren't issue-tracked — #104 tracks the resulting *plan*.)
> Approving this proposal is that issue's first step.
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

**Issues track *plans*, not proposals.** A proposal is a discussion artifact — it is *not*
issue-tracked. Once approved it becomes a **plan**, and the plan's deliverables become
**issues**. A plan is tracked by **one or many** issues (its deliverables); an issue belongs
to at most one plan.

- **Chunk:** every workable unit is one issue with a clear deliverable + acceptance criteria.
- **Priority:** `priority:high|medium|low` labels (created 2026-07-01).
- **Plan → issues (one-to-many):** the linkage field lives on the **plan** as a *list* of
  tracking issues (e.g. `tracked_by: [#NN, #MM]`), superseding the vestigial single-scalar
  `github_epic:`. Each issue names its plan (`plan:` / `cross_link:`) — a bidirectional link.
- **Hierarchy:** an **epic** (tracking) issue may group a plan's children as an ordered
  checklist (see #98) when a plan has several deliverables; the epic corresponds to the plan.
- **Coordination rule:** **assign yourself before starting** an issue — the missing signal
  that would have prevented the #89 collision. Enforce via convention now; automate later
  (code-over-memory) if it recurs.

### 3. Execution lifecycle & source of truth

A plan moves through three phases; collaboration is open early and **frozen** once code is in motion.

1. **Discuss** — proposal → plan. Direction is open; refine freely. No issues yet.
2. **Start** (`plan status → in-progress`) — the trigger to **generate the plan's issues** from its
   deliverables (one issue per deliverable; the plan lists them in `tracked_by:`). Scope is now set.
3. **Execute** — code in motion. Scope is **frozen**: the direction is not re-litigated ad hoc.

**Source of truth = the issues.** Once issues exist, the in-vault `issues/` files (git-canonical)
own execution state — status, assignee, closing PR. GitHub/Forgejo issues **mirror** them for dev
UX. The **plan** becomes the frozen **scope/spec**, and its progress is a **derived** view of issue
state (like the roadplan) — the plan's step-table is **no longer hand-updated** once its issues
exist. One source of truth; no plan↔issue drift.

**Change control once in motion.** A scope/direction change after Start is not a quiet edit:
- it is recorded as a **`decision`** document (what changed and why);
- the affected **issue(s) and the plan's `tracked_by:` list are updated together** (kept in sync);
- the change is **annotated / history-stamped**, so the audit trail shows work was already in motion.

This is `bugs-before-features` + `code-over-memory` applied to *scope*: execution never drifts silently.

### 4. Roadmap / milestone mapping

- `milestone:` frontmatter (#68 Step 3) is the source of truth; **GitHub/Forgejo milestones
  mirror it**. The derived roadplan view (#89) already renders current / next / `future`.
- New **directions** enter via `proposal → plan`; only once approved are they broken into issues
  and assigned a milestone. This is the gate that keeps the roadmap intentional.

## Security / Verification

- **Security / invariants:** option (A) touches no external store as source of truth — no new
  telemetry, no air-gap break. A sync tool must treat the tracker as write-target only.
- **Verification:** a round-trip test (markdown issue → tracker → back) with no drift; a lint
  that every open issue has priority + milestone + (if part of a plan) an epic link.

## Out of scope / follow-ups (become the plan's issues once this is approved)

- **Issue generation at plan-start:** on `plan status → in-progress`, scaffold one issue per
  deliverable and populate the plan's `tracked_by:` list (+ each issue's back-link).
- **Derived plan progress:** compute the plan's completion from its issues' state (retire the
  hand-updated step-table + the single-scalar `github_epic`).
- **Scope-change control:** a `decision`-backed flow for changing scope after Start (updates
  issue(s) + plan `tracked_by:` together, history-stamped).
- Build the `issues/` ⇄ tracker sync tool (issues = source of truth; tracker = mirror).
- Formalize the "assign before start" and "one epic per plan" conventions (lint/CI).
- Decide Forgejo parity for self-hosters (mirror of the GitHub projection).
