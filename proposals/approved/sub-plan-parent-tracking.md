---
title: Sub-plan parent tracking — formal parent-plan mechanism
author: NetYeti
created: 2026-06-07
tags:
  - workflow
  - lifecycle
  - plans
  - governance
category:
  - ENGINE
complexity: M
estimated_effort: ~1w
approved: true
created_by: NetYeti@phoenix
assigned_to: netyeti
priority: medium
related_to:
  - plans/completed/phase-2-foundation.md
_path: proposals/sub-plan-parent-tracking.md
consumed_by: plans/completed/sub-plan-parent-tracking.md
---
## Problem

DocWright's plan lifecycle has no formal concept of a parent-plan / sub-plan
relationship. Phase overview plans (e.g. `phase-2-foundation.md`) explicitly
say "each deliverable will be broken into its own sub-plan" — but when a sub-plan
completes, nothing in the toolchain updates the parent plan's deliverables table.
The parent plan silently drifts out of sync.

This was discovered when `phase-2-foundation.md` still showed all deliverables
as ⏳ Planned despite the Research Stage sub-plan being fully complete.
The fix required a manual `write_plan` rewrite — a one-off that should be code.

Without a parent-plan mechanism, every phase overview plan is inherently
unreliable: the moment the first sub-plan completes, the overview is stale.
This undermines the `/status` page, phase gate reviews, and any report that
consumes plan metadata. The drift compounds with each sub-plan completion,
turning the overview into a misleading artifact rather than a source of truth.

## Current workaround

Sub-plan completions must be manually reflected in the parent plan's deliverables
table via `write_plan`. This relies on AI memory / human discipline — a known
failure mode per `policies/core/code-over-memory.md`.

In practice this means: every sub-plan completion requires an AI to (a) remember
the parent plan exists, (b) know the correct deliverable row number, (c) construct a valid
`write_plan` call that changes exactly one cell without corrupting the rest, and
(d) update `completed_steps` / `total_steps` to match. Step (c) is particularly
brittle — a `write_plan` that replaces the full file content risks overwriting
concurrent changes, mangling frontmatter, or dropping unrelated deliverables.

The workaround is also invisible: there is no indicator that a parent update is
pending, no validation that the update was correct, and no rollback path if the
wrong row was touched. The MCP server cannot help because it has no concept of
parent-child relationships — the information simply doesn't exist in the data model.

## Proposed Solution

### Frontmatter field: `parent_plan:`

Add an optional `parent_plan:` field to plan frontmatter:

```yaml
parent_plan: phase-2-foundation.md
parent_deliverable: "9"   # row number in parent's Deliverables table
```

### Enforcement on sub-plan completion

When a plan with `parent_plan:` is transitioned to `status: completed`:

1. The `transition_to_completed` MCP tool reads `parent_plan` and
   `parent_deliverable` from the completing plan's frontmatter.
2. It locates the matching row in the parent plan's Deliverables table.
3. It updates that row's Status cell from ⏳/⚠️ to ✅ Done.
4. It appends a history row to the parent plan noting the sub-plan completion.
5. The parent plan's `completed_steps` / `total_steps` are recalculated
   (or a new `completed_deliverables` count field is maintained separately).

### Linter rule

Add a lint warning when a plan in `plans/completed/` has `parent_plan:` set
but the parent's Deliverables table row is still ⏳ — flagging the drift.

### Status page

The `/status` page Active Plans section shows a sub-plan indicator on plans
with `parent_plan:` set (e.g. "↳ phase-2-foundation").

### Pre-commit hook

Add a check: if a plan being committed has `status: completed` and
`parent_plan:` is set, warn if the parent's row is still ⏳.

## Expected Outcomes

- Completing a sub-plan automatically keeps the parent plan accurate
- No manual `write_plan` rewrites needed for routine sub-plan completions
- Phase overview plans are always an accurate reflection of delivered work
- Drift is caught mechanically, not by memory

## Alternatives Considered

**Embedded deliverable status in sub-plan files.** Instead of a back-reference to the
parent's row, each sub-plan could embed a copy of its deliverable status. This
reverses the dependency direction and still requires a sync mechanism — any
change would need to propagate back to the parent anyway. Rejected: adds
redundancy without solving the update problem.

**Parent plan queries sub-plan completion via glob.** The parent could scan
`plans/` for plans with matching `parent_plan:` at read time. This removes the
update-on-completion burden but makes every parent-plan read expensive and
time-dependent — a sub-plan could complete while someone is viewing the page.
Rejected: violates the invariant that plan files are the canonical store and
introduces temporal inconsistency.

**Tag-based grouping (e.g. `tag: phase-2`).** Plans already support tags, and
a status page could group by tag to simulate parent-child. This requires no
schema change but has no explicit row mapping — a tag can't express "this sub-plan
completes deliverable 9 specifically." Rejected: too coarse for automated
deliverable-level updates.

**Manual write_plan with pre-commit validation only.** Keep the current approach
but add a pre-commit hook that warns if parent deliverables are out of sync.
This is better than nothing but still relies on the AI to write a correct
`write_plan` — the hook can only detect, not prevent, the manual effort.
Rejected: does not satisfy code-over-memory policy for the update itself.

## Out of Scope

- **Recursive parent chains (grandparent plans).** A sub-plan's parent may
  itself be a sub-plan of another plan. Resolving updates up an arbitrary chain
  adds complexity with no current use case. Covered if a follow-on proposal
  demonstrates a concrete need.

- **Automatic status rollup (parent auto-completes when all deliverables done).**
  A phase is complete only when the phase gate is signed off, not when all
  sub-plans happen to be done. Auto-completion would skip the human review
  step. Deliberate gate crossing is a separate concern
  (see `proposals/approved/phase-gate-sign-off.md`).

- **Multi-parent plans (a sub-plan contributes to two parents).** A single
  sub-plan servicing two overview plans is ambiguous — which parent owns the
  deliverable? This would require a `parent_deliverable` per parent or a
  shared-deliverable abstraction. Not needed for the current phase structure.

These can be addressed in follow-on proposals if the need arises.

## Acceptance Criteria

- `transition_to_completed` MCP tool updates parent deliverable row on completion
- Linter warns on completed sub-plan with stale parent row
- Pre-commit hook warns on same condition
- `/status` page shows parent-plan relationship
- `phase-2-foundation.md` Deliverable 9 was the first case; future sub-plan
  completions require no manual write_plan

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-08 | AI-improved via Improve | NetYeti |
| 2026-06-08 | AI-improved via Improve | NetYeti |


*(AI improvement timeout — showing original body)*