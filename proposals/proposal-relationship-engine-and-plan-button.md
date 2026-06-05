---
title: "Proposal Relationship Engine and Plan Button"
author: NetYeti
created: 2026-06-05
tags:
  - workflow
  - collation
  - plans
  - relationships
  - dependencies
  - proposals
complexity: medium
estimated_effort: L
approved: false
created_by: NetYeti@phoenix
assigned_to: ""
---

## Problem

The proposal-to-plan pipeline has three broken handoffs, all stemming from the same root cause: **no shared relationship detection engine** and **no explicit human trigger for plan creation**.

1. **New proposals land flat.** When a proposal is created, there is no automated way to determine where it fits relative to existing proposals — does it depend on something? Should it merge? Is it parallel? The list stays flat and unprioritized.

2. **Plan creation is either manual or noisy.** Currently, when a proposal is approved, either: (a) the user must manually scaffold a plan and remember to check for related proposals, or (b) an auto-create trigger fires for every approved proposal independently, flooding the plan list with isolated plans that should have been bundled. Neither produces cohesive, synergetic plans.

3. **Related proposals get scattered.** When a plan is created for one proposal, other related proposals (even approved ones) are missed. They either get their own plan later (duplicate scope), or stall indefinitely because no one connected them.

The current "approve → auto-plan" flow is particularly problematic: it creates noise by generating a plan for every approved proposal individually, with no awareness of the broader proposal landscape. A human should explicitly say "make a plan now" and at that moment the system should find everything related and bundle it together.

## Proposed Solution

A shared **Relationship Detection Engine** that powers two lifecycle trigger points, plus a manual **"Plan" button** that replaces auto-plan-creation.

### Part 1 — Relationship Detection Engine (shared)

A common engine that scans proposals (and optionally plans) and classifies pairwise relationships. Used by both trigger points below.

**Detection method:** keyword similarity (Jaccard) + explicit `related_to` frontmatter, with LLM-based semantic analysis as an optional upgrade when an AI backend is available (matching the collation system in [[proposals/approved/ux-collating-proposals-into-apropriate-plans.md]]).

**Relationship classification:**

| Relationship | Meaning | Frontmatter signal |
|-------------|---------|-------------------|
| **Depends on** | This proposal requires the matched proposal to be completed first | `depends_on: [matched-proposal]` |
| **Blocks** | This proposal must be completed before the matched proposal | `blocks: [matched-proposal]` |
| **Merge candidate** | These proposals cover the same scope and should be combined | `subsumes: [matched-proposal]` or prompt user |
| **Parallel** | Independent work, no ordering constraint | No action needed |
| **Supersedes** | This proposal replaces an older one | `supersedes: [old-proposal]` |
| **Related, separate** | Related but distinct enough for its own plan | `related_to: [matched-proposal]` |

**Output:** a structured relationship map (`.docwright/proposal-relationships.json`) consumed by the status page, lifecycle graph, and plan-builder UI. Rebuilt incrementally on document changes.

**Scope:** scans across all proposals (approved and unapproved) and existing active plans.

---

### Part 2 — Trigger A: Hierarchy Detection on New Proposal Creation

When a new proposal is created (or detected as raw and drafted via `.opencode/skills/docwright-raw-proposal/`), the engine runs automatically against all existing proposals.

**Flow:**
1. Proposal is created from description or template
2. Engine runs in background (non-blocking, async)
3. Results surface as a collation-style notification:
   > "This proposal depends on [[auth-redesign.md]] and overlaps with [[sso-flow.md]] — review relationships?"
4. User opens a relationship confirmation dialog showing each detected link
5. User accepts, rejects, or adjusts each relationship
6. Accepted relationships are written to frontmatter (`depends_on`, `related_to`, `blocks`, etc.)

**Re-scan on updates:** When an existing proposal's body changes meaningfully, re-run the engine for that proposal to catch new or changed relationships.

---

### Part 3 — Trigger B: "Plan" Button on Approved Proposals (replaces auto-plan)

This replaces the current auto-create-plan-on-approval with an explicit human-triggered action.

**The "Plan" button:**
- Appears on proposals with `approved: true` in the properties pane, document toolbar, and status page
- Label: "Plan →" with a count badge showing related proposals found
- Only visible to the assigned contributor (based on `assigned_to`)

**When clicked:**

1. **Engine scans** all proposals (approved and unapproved) and active plans for relationships to the source proposal
2. **Results panel** appears:

   **Bundle candidates** (auto-selected, high confidence):
   - Proposals classified as merge candidates (same scope)
   - Proposals in the same dependency chain
   - Approved proposals that are related and unplanned
   - Shown with checkboxes, pre-checked

   **Suggestions** (optional, lower confidence):
   - Related proposals that may belong but need human judgment
   - Existing plans that overlap — offer to merge into existing plan instead

3. **User confirms the bundle** — adjust checkboxes, add/remove proposals
4. **User clicks "Generate Plan"**

5. **Plan is scaffolded:**
   - Created from the profile's plan template
   - Frontmatter pre-populated from the source proposal
   - `proposal_source` set to the primary proposal
   - Each consumed proposal gets `consumed_by: <plan-slug>` in its frontmatter
   - The plan receives `status: draft` — it does not skip the approval gate

6. **Optional: AI critique pass** on the draft plan (via `skill-plan-critique.md`) surfaced as a non-blocking notification

**Edge cases handled:**

- **No related proposals found:** proceed with single-proposal plan (normal scaffolding)
- **Existing plan overlap:** offer to merge into existing plan instead of creating new one
- **Dependency chains:** automatic `depends_on` population between bundled proposals and existing plans
- **Already planned proposals:** excluded from scan results

---

### Part 4 — Per-Profile Configuration

```json
{
  "relationship_engine": {
    "auto_detect_on_create": true,
    "auto_detect_on_update": true,
    "similarity_threshold": 0.35,
    "show_plan_button": true
  }
}
```

Profiles can disable auto-detection at creation for lightweight use cases. The "Plan" button is always visible on approved proposals unless explicitly disabled.

---

## Relationship to Existing Work

| Feature | Relationship |
|---------|-------------|
| [[proposals/approved/ux-collating-proposals-into-apropriate-plans.md]] | Foundation collation feature — this proposal evolves it from passive panel to active trigger with auto-bundling |
| [[proposals/approved/core-classifying-proposals-when-created-or-updating.md]] | Category/complexity/effort fields feed the relationship engine's similarity scoring |
| [[proposals/related-docs-ux-improvements.md]] | Collation UX improvements (threshold, explicit related_to, ack state) are prerequisites for the engine |
| [[proposals/new-proposals-should-check-before-actual-creation.md]] | Pre-creation dup check uses the same engine but at a different trigger point |
| [[proposals/ui-lifecycle-graph-view.md]] | Relationship data powers dependency ordering and cluster visualization |
| [[proposals/gantt-view-dependencies.md]] | Dependencies surfaced by the engine feed Gantt timeline |
| [[proposals/skill-plan-critique.md]] | Optional critique pass on draft plans |
| `.opencode/skills/docwright-raw-proposal/` | Raw proposal detection feeds into creation-time hierarchy detection |

## Subsumed Proposals

| Proposal | What was absorbed |
|----------|-------------------|
| `doc-automations.md` (item 3 — auto-plan) | Replaced by manual "Plan" button (Part 3); items 1-2 (auto-edit-mode, auto-AI-drafting) remain in that proposal |
| `making-plans-scans-proposals-and-existing-plans.md` | Fully absorbed — pre-creation scan + merge/depend/consume actions (Part 3) |
| `new-proposals-should-automaticly-look-to-set-their-hierarchy-position.md` | Fully absorbed — relationship detection engine + creation-time hierarchy (Part 1 + Part 2) |

## Out of Scope

| Idea | Why deferred |
|------|-------------|
| Auto-approving proposals based on criteria | Governance principle: only humans approve |
| Auto-merging without human confirmation | Human decides scope and priority |
| Cross-vault relationship scanning | Requires remote registry sync (Phase 3+) |
| ML-based priority scoring | Heuristic + LLM-assisted detection suffices for Phase 2 |
| Suggesting plan splits (when a proposal is too broad) | Requires scope analysis — propose separately |
