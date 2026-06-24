---
title: Proposal Relationship Engine and Plan Button
author: NetYeti
created: 2026-06-05
tags:
  - workflow
  - collation
  - plans
  - relationships
  - dependencies
  - proposals
  - phases
complexity: medium
estimated_effort: L
approved: true
created_by: NetYeti@phoenix
assigned_to: NetYeti
_path: proposals/proposal-relationship-engine-and-plan-button.md
---

## Problem

The proposal-to-plan pipeline has three broken handoffs, all stemming from the same
root cause: **no shared relationship detection engine** and **no explicit human trigger
for plan creation**.

1. **New proposals land flat.** When a proposal is created, there is no automated way
   to determine where it fits relative to existing proposals — does it depend on
   something? Should it merge? Is it parallel? The list stays flat and unprioritized.

2. **Plan creation is either manual or noisy.** When a proposal is approved, either:
   (a) the user must manually scaffold a plan and remember to check for related
   proposals, or (b) an auto-create trigger fires for every approved proposal
   independently, flooding the plan list with isolated plans that should have been
   bundled.

3. **Related proposals get scattered.** When a plan is created for one proposal, other
   related proposals (even approved ones) are missed. They either get their own plan
   later (duplicate scope), or stall indefinitely because no one connected them.

4. **No feedback loop from plan completion.** When a plan that consumed multiple
   proposals is completed or canceled, the consumed proposals receive no lifecycle
   signal. They remain marked as consumed but their parent plan is gone — creating
   orphaned references.

The current "approve → auto-plan" flow is particularly problematic: it creates noise
by generating a plan for every approved proposal individually, with no awareness of
the broader proposal landscape. A human should explicitly say "make a plan now" and
at that moment the system should find everything related and bundle it together.

## Proposed Solution

A shared **Relationship Detection Engine** that powers two lifecycle trigger points,
plus a manual **"Plan" button** that replaces auto-plan-creation.

### Part 1 — Relationship Detection Engine (shared)

A common engine that scans proposals (and optionally plans) and classifies pairwise
relationships. Used by both trigger points below.

**Detection methods (layered, in order):**

| Signal | Source | Cost | Available from day one |
|--------|--------|------|----------------------|
| **Jaccard keyword similarity** | Body text token overlap | Low | ✅ |
| **Tag overlap** | `tags:` frontmatter | Free | ✅ |
| **Phase match** | `phase:` frontmatter ([PROJECT.md]($/PROJECT.md) §14 validated) | Free | ✅ |
| **Explicit `related_to`** | Frontmatter declaration | Free | ✅ |
| **Same author / same `assigned_to`** | Frontmatter fields | Free | ✅ |
| **Wikilink co-occurrence** | Both proposals link to the same third doc | Low | ✅ |
| **LLM semantic analysis** | AI backend query | High | Optional upgrade |

Multiple signals are combined into a confidence score. High-confidence matches
auto-select as bundle candidates; lower-confidence matches appear as suggestions
for human review.

**Relationship classification:**

| Relationship | Meaning | Frontmatter signal |
|-------------|---------|-------------------|
| **Depends on** | This proposal requires the matched proposal to be completed first | `depends_on: [matched-proposal]` |
| **Blocks** | This proposal must be completed before the matched proposal | `blocks: [matched-proposal]` |
| **Merge candidate** | Same scope — should be combined into one plan | `subsumes: [matched-proposal]` or prompt user |
| **Parallel** | Independent work, no ordering constraint | No action needed |
| **Supersedes** | This proposal replaces an older one | `supersedes: [old-proposal]` |
| **Related, separate** | Related but distinct enough for its own plan | `related_to: [matched-proposal]` |

**Output:** a structured relationship map (`.docwright/proposal-relationships.json`)
consumed by the status page, lifecycle graph, and plan-builder UI.

**Rebuild trigger:** The engine rebuilds incrementally on every write to a proposal
or plan file, triggered by the same file-save hook that drives the SSE live-reload
system (`/api/watch`). No separate watcher or git hook needed — the Web UI's existing
save endpoint fires the rebuild after write completes.

**Scope:** scans across all proposals (approved and unapproved), all active plans,
and `PROJECT.md` §14 for phase validation.

---

### Part 2 — Trigger A: Hierarchy Detection on New Proposal Creation

When a new proposal is created (or detected as raw and drafted via
`.opencode/skills/docwright-raw-proposal/`), the engine runs automatically against
all existing proposals.

**Flow:**
1. Proposal is created from description or template
2. Engine runs asynchronously (non-blocking, sub-100ms for Jaccard+tag+phase passes)
3. Results surface as a collation-style notification:
   > "This proposal depends on [[auth-redesign.md]] and overlaps with
   > [[sso-flow.md]] — review relationships?"
4. User opens a relationship confirmation dialog showing each detected link
5. User accepts, rejects, or adjusts each relationship
6. Accepted relationships are written to frontmatter (`depends_on`, `related_to`,
   `blocks`, etc.)

**Re-scan on updates:** When an existing proposal's body changes meaningfully,
re-run the engine for that proposal to catch new or changed relationships.

**Re-scan on approval:** When a proposal is set to `approved: true`, the engine
re-scans it. Approval changes a proposal's relationship profile — it now qualifies
for bundling and the "Plan" button becomes available.

---

### Part 3 — Trigger B: "Plan" Button on Approved Proposals (replaces auto-plan)

This replaces the current auto-create-plan-on-approval with an explicit
human-triggered action.

**The "Plan" button:**
- Appears on proposals with `approved: true` in the properties pane, document
  toolbar, and status page
- Label: "Plan →" with a count badge showing related proposals found
- **Gated by ACL tier, not `assigned_to`** — any user with Steward or Governance
  tier can trigger plan creation. `assigned_to` controls who is notified, not who
  can act. (Contributors see the button but the action checks ACL before executing.)
- If the approval flow in [[proposals/approval-need-assigned-to-picklist.md]] adds
  a picklist for `assigned_to`, the button shows the assignee's name alongside the
  count badge

**When clicked:**

1. **Engine scans** all proposals (approved and unapproved), active plans, and
   `PROJECT.md` for phase data, detecting relationships to the source proposal
2. **Results panel** appears:

   **Bundle candidates** (auto-selected, high confidence):
   - Proposals classified as merge candidates (same scope)
   - Proposals in the same dependency chain
   - Approved proposals that are related and unplanned
   - Same-phase proposals with significant signal overlap
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
   - **Phase inherited from source proposal** (`phase:` field, validated against
     `PROJECT.md` §14)
   - Each consumed proposal gets `consumed_by: <plan-slug>` in its frontmatter
     (single string, not array — a proposal can only be consumed by one plan. If a
     proposal appears in multiple scan results, it is already planned and excluded.)
   - The plan receives `status: draft` — it does not skip the approval gate.
     This integrates with the Draft Plans section on the status page
     ([[proposals/phases-and-the-master-plan-are-mostly-invisible-to-the-user.md]]).

6. **Optional: AI critique pass** on the draft plan (via `skill-plan-critique.md`)
   surfaced as a non-blocking notification

**Lifecycle feedback loop:** When a plan is completed or canceled, the engine
re-scans all proposals that reference it via `consumed_by`. Those proposals have
their `consumed_by` field cleared (the plan is no longer consuming them) and
re-enter the available-for-planning pool. The proposals get a notification:
"Plan [[completed-plan]] has been completed — your proposal is now available
for re-assignment."

**Edge cases handled:**

- **No related proposals found:** proceed with single-proposal plan (normal scaffolding)
- **Existing plan overlap:** offer to merge into existing plan instead of creating new one
- **Dependency chains:** automatic `depends_on` population between bundled proposals
  and existing plans; chains are ordered correctly in the scaffolded plan
- **Already planned proposals:** excluded from scan results
- **Proposal consumed by a now-completed plan:** `consumed_by` cleared, proposal
  returns to available pool

---

### Part 4 — Per-Profile Configuration

```json
{
  "relationship_engine": {
    "auto_detect_on_create": true,
    "auto_detect_on_update": true,
    "auto_detect_on_approval": true,
    "similarity_threshold": 0.35,
    "show_plan_button": true
  }
}
```

Profiles can disable auto-detection at creation for lightweight use cases. The
"Plan" button respects `show_plan_button` but defaults to `true` on approved
proposals regardless of profile, as plan creation is a core lifecycle action.

`auto_detect_on_approval` controls re-scan when a proposal is approved (C8).

---

## Coordination with the Phase Visibility Proposal

| Concern | Resolution |
|---------|------------|
| Both modify status page layout | Phase Visibility adds a Draft Plans section; this proposal populates it with `status: draft` plans from the "Plan" button. Layout is additive, not conflicting |
| Phase data source | **PROJECT.md** §14 is the canonical source. This proposal reads phase from there for validation; the Phase Visibility proposal reads it for the roadmap section. Shared read pattern, no conflict |
| `phase:` frontmatter on plans | This proposal sets it on scaffolded plans; Phase Visibility proposal groups plans by it. Same field, same source |
| Toolbar real estate | "Plan" button goes in the document action bar (properties pane), not the status page toolbar, to avoid crowding the phase indicator |

## Relationship to Existing Work

| Feature | Relationship |
|---------|-------------|
| [[proposals/approved/ux-collating-proposals-into-apropriate-plans.md]] | Foundation collation — this evolves passive panel to active trigger |
| [[proposals/approved/core-classifying-proposals-when-created-or-updating.md]] | Category/complexity/effort fields feed similarity scoring |
| [[proposals/related-docs-ux-improvements.md]] | Threshold config, explicit related_to, ack state — prerequisites |
| [[proposals/new-proposals-should-check-before-actual-creation.md]] | Pre-creation dup check uses same engine, different trigger point |
| [[proposals/phases-and-the-master-plan-are-mostly-invisible-to-the-user.md]] | Draft Plans section consumes scaffolded plans; phase field shared |
| [[proposals/approved/ui-lifecycle-graph-view.md]] | Relationship data powers dependency ordering and cluster visualization |
| [[proposals/gantt-view-dependencies.md]] | Dependencies surfaced by the engine feed Gantt timeline |
| [[proposals/approved/skill-plan-critique.md]] | Optional AI critique pass on draft plans |
| [[proposals/approval-need-assigned-to-picklist.md]] | `assigned_to` picklist integration for button display |
| `PROJECT.md` §14 | Canonical phase list for validation and grouping |
| `.opencode/skills/docwright-raw-proposal/` | Raw proposal detection feeds creation-time hierarchy detection |

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
| ML-based priority scoring | Multi-signal heuristic + LLM suffices for Phase 2 |
| Suggesting plan splits (when a proposal is too broad) | Requires scope analysis — propose separately |
