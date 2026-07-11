---
title: "Adopt milestone-driven roadmap discipline (lilyetibot model)"
author: NetYeti
created: 2026-07-10
tags:
  - governance
  - roadmap
  - versioning
  - lifecycle
  - process
  - dog-fooding
category:
  - governance
complexity: high
approved: true
created_by: "NetYeti@phoenix"
assigned_to: NetYeti
milestone: backlog
related_to:
  - policies/core/versioning.md
  - docs/roadmap.md
  - plans/phase-4-profile-acl-ai.md
  - proposals/approved/phase-gate-sign-off.md
  - proposals/plan-steps-structured-frontmatter.md
  - proposals/plan-execution-mode-rename.md
  - proposals/formalize-roadmap-sequencing-enforcement.md
  - proposals/phases-and-the-master-plan-are-mostly-invisible-to-the-user.md
  - issues/bug-versioning-policy-still-references-retired-develop.md
  - issues/bug-version-patch-number-diverged-from-completed-plan-.md
  - issues/bug-release-v050-plan-duplicated-in-plans-and-undocume.md
  - issues/bug-stray-nested-proposalsapprovedapproved-directory.md
  - issues/bug-phase-closets-docstring-claims-step-verification-b.md
  - proposals/approved/plan-lifecycle-enforcement-gaps.md
_path: proposals/approved/adopt-milestone-driven-roadmap-discipline
consumed_by: plans/adopt-milestone-driven-roadmap-discipline.md
---

## Problem

The sibling project `lilyetibot` (M5Stack) runs a milestone strategy that lets a
fresh agent or contributor go from cold start to productive work in minutes:
one living roadmap (milestones → sub-milestones → one-session tasks with
*Goal / Build / Done when* lines), a version number that mechanically encodes
position in that roadmap (`0.Y.Z` = sub-milestone.task, bumped in the same
commit that completes the task), a hard human-executed **proof-of-life
validation gate** between milestones, and a regression rule (the *entire*
accumulated test suite must pass to complete any task).

Comparing that against DocWright's current state (survey 2026-07-10, VERSION
0.4.11) exposes six gaps:

1. **No single "where are we" view.** Answering "what is the current task?"
   requires AGENTS.md + CLAUDE.md + `docs/roadmap.md` + two phase plans +
   `get_status` + SESSION-LOG.md. Already reported from the UX side in
   [[proposals/phases-and-the-master-plan-are-mostly-invisible-to-the-user.md]];
   the same blindness affects agents.
2. **The version number no longer means anything.** Policy says PATCH =
   completed-plan count in the current phase; VERSION is 0.4.11 with **zero**
   completed Phase 4 plans — patch has drifted into an informal release
   counter. The policy also still instructs branching releases from the
   retired `develop` branch. (Bugs #300, #299.)
3. **No proof-of-life gate at phase close.** `phase-close.ts` greps for the
   string `status: completed` — no step verification, no human demo, no
   sign-off artifact. (Bug #303.) The approved
   [[proposals/approved/phase-gate-sign-off.md]] identified exactly this
   ("Phase 1 plans all showed completed... but the developer still had
   unresolved critiques") but the phase-level validation ritual was never
   specified.
4. **Tasks are epic-sized and under-specified.** Phase 4 has 12 deliverables
   as one-line table rows ("ACL controller enforcement") with no *Done when*,
   no sizing rule, and design decisions left to be made mid-implementation.
   lilyetibot's rule — every task completable by a smaller model in one
   focused session, all cross-cutting decisions pinned *before* the task
   starts — is what makes autonomous execution safe. This is directly
   relevant to our plan execution modes and agent-roles work.
5. **No stated regression rule.** Plans complete when their steps are ✅;
   nothing requires the full accumulated suite green at
   `transition_to_completed` (the `verify_plan_tests` tool exists but is not
   a gate).
6. **Convention drift.** Three step-tracking systems (YAML counters,
   checkboxes, emoji tables), two mode fields (`mode:` vs `automated:`),
   duplicate/orphan plan files, a stray `proposals/approved/approved/`
   directory. (Bugs #301, #302; renames already proposed in
   [[proposals/plan-execution-mode-rename.md]] and
   [[proposals/plan-steps-structured-frontmatter.md]].)

## Proposed Solution

Adopt the lilyetibot milestone discipline, translated into DocWright's
governance machinery (frontmatter as source of truth, MCP-gated mutations,
code over memory). Six workstreams, executed as a dedicated plan on `main`
with feature work frozen (BDFL has offered this):

### A. One living roadmap

Rework `docs/roadmap.md` into the single tracker: milestone overview table
(phases = M-levels with theme + task counts), current-position banner
(version, active plan, next task), per-phase sub-milestone sections listing
their plans, and a **Pinned Decisions** section so no plan re-litigates
cross-cutting choices. Keep machine-generated sections generated (extend
`generate-roadplan` to render plan/step state from frontmatter) — the
roadmap must never be a second source of truth that can drift from plans.
Subsumes the enforcement side of
[[proposals/formalize-roadmap-sequencing-enforcement.md]] (roadmap linter /
`next_action` phase-gating).

### B. Version ↔ work linkage restored

Amend `policies/core/versioning.md` to match one mechanically-enforceable
rule: **MINOR = phase, PATCH = auto-bumped by `transition_to_completed`**
(completed-plan count, restored as truth), releases tagged from `main`
(remove all `develop` references). One-time reconciliation commit documents
why 0.4.11 → whatever the corrected number is. `phase-close.ts` parses
frontmatter properly instead of grepping.

### C. Task sizing rule + structured steps

Every plan step gets *Action / Done when* (Build list optional), sized to one
focused session; anything bigger must be split before execution. Enforce in
`write_plan`/`update_step` validation and the pre-commit frontmatter check.
Adopt [[proposals/plan-steps-structured-frontmatter.md]] (YAML steps as
source of truth) as the single step-tracking convention and migrate active
plans; retire emoji tables and ad-hoc checkboxes. Fold in
[[proposals/plan-execution-mode-rename.md]] so the mode field is unified in
the same migration pass.

### D. Proof-of-life validation gates

Create `docs/validation/TEMPLATE-proof-of-life.md` (adapted from lilyetibot:
pre-validation checklist, demonstrable steps, issues table with
blocker/deferred triage, human sign-off block). Each phase plan must define
its proof-of-life demo up front. `phase-close.ts` refuses to run without a
signed-off `docs/validation/phase-N-proof-of-life.md`. Sign-off is
human-only — AI may scaffold the checklist but never mark it passed
(consistent with [[policies/core/ai-governance-boundaries.md]]; this is the
phase-level completion of the approved
[[proposals/approved/phase-gate-sign-off.md]]).

### E. Regression rule

`transition_to_completed` requires a green full-suite run (via
`verify_plan_tests` or CI status on the completion PR) — not just the plan's
own tests. Document the three testing tiers DocWright already implicitly has:
automated (unit + CI), semi-automated (dogfood instance smoke on :5273),
manual UI checklists (per `ui-test-before-submit` rule) — and state which
tier(s) each plan's Testing Plan covers.

### F. Normalization sweep + AGENTS.md status header

Fix bugs #299–#303 (bugs before features — this wave goes first). Add a
lilyetibot-style **Status** section at the top of AGENTS.md: current version,
what's done, what's in progress, what's next, and a numbered reading order
for fresh agents — regenerated by session-end/phase tooling, not maintained
by memory.

## Alternatives Considered

- **Copy lilyetibot's hand-checked roadmap verbatim.** Rejected: checkboxes
  hand-edited in a markdown file are exactly the drift DocWright's MCP layer
  exists to prevent. The roadmap must be a *rendering* of plan frontmatter.
- **Version scheme change to lilyetibot's Y-per-sub-milestone.** Rejected for
  now: DocWright's MINOR = phase is established across tags, CI patterns, and
  three deployed instances; restoring the patch rule + automation fixes the
  meaninglessness without a renumbering migration.
- **Do nothing / fix only the bugs.** Rejected: the bugs are symptoms; without
  the sizing rule, gates, and single tracker, the same drift re-accumulates.

## Verification

- **Fresh-agent test:** a cold-started agent, given only AGENTS.md, states the
  current version, active plan, and next task correctly in under two minutes.
- **Drift test:** `generate-roadplan` output committed vs regenerated shows no
  diff in CI (roadmap cannot drift from frontmatter).
- **Gate test:** attempting `phase-close.ts` without a signed-off
  proof-of-life doc fails; attempting `transition_to_completed` with a failing
  suite or unsized steps fails.
- **Version test:** `VERSION` is derivable from repo state (phase number +
  completed-plan count) by a script; CI asserts it.

## Security Implications

Process-only change; no new runtime surface. Net effect strengthens the
governance posture: human-only proof-of-life sign-off extends the existing
AI-governance boundary to phase closure, and moving patch bumps + roadmap
rendering into code removes two manual-edit vectors.

## Future

- Surface the roadmap/current-position banner in the Web UI status page
  (completes [[proposals/phases-and-the-master-plan-are-mostly-invisible-to-the-user.md]]).
- Ship the proof-of-life template + roadmap discipline in bundled profiles so
  adopting organizations inherit it (philosophy transmission).
- Backport the structured-steps roadmap renderer to the csdocs and
  cs-erp-images instances once stable.
