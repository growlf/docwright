---
title: "Base Process-Flow: code-issue/governance split, docwright-dev profile, milestones, and beta channel"
status: in-progress
author: NetYeti
created: 2026-07-01
created_by: NetYeti@cluster-llm
tags:
  - governance
  - process
  - lifecycle
  - milestones
  - dogfooding
  - deployment
  - roadmap
proposal_source: proposals/approved/separate-dev-tracking-milestones-and-beta-channel.md
priority: high
phase: 2
mode: guided
automated: guided
assigned_to: NetYeti
tests_defined: false
tests_human_reviewed: false
template_version: 1.0
total_steps: 8
completed_steps: 1
_path: plans/separate-dev-tracking-milestones-and-beta-channel.md
scenario_synthesis: "Umbrella governance/process plan (no product code itself). Sequences and authorizes eight deliverables in a dependency chain: docwright-dev profile (grammar), in-vault issues/ store + backlog migration, milestone frontmatter field + lint, derived roadplan view, the first milestone-determination cycle, release-channel/beta gate, user bug-reporting bridge, and empty-image deployment. Each row becomes its own sub-plan/code-issue once the issues/ store exists, dogfooding the code-issue/governance split. Guided mode: agent drafts, human approves. No VS Code or IDE-specific steps."
gate_note: "Changed files are untestable types: plans/separate-dev-tracking-milestones-and-beta-channel.md"
---

# Base Process-Flow: code-issue/governance split, docwright-dev profile, milestones, and beta channel

> **DRAFT — pending BDFL approval of this plan's content.**
> The umbrella proposal [[proposals/approved/separate-dev-tracking-milestones-and-beta-channel]]
> (GitHub #68) is approved; **this plan is not**. It stays `draft` until the BDFL reviews and
> approves *this plan's* steps; only then does it promote to `approved`/`in-progress`. AI drafted
> it; no approval, gate, or completion field is set by AI.
>
> **Provenance note (2026-07-01):** the Web UI Approve button auto-generated a plan that dumped
> the whole proposal into Overview, mangled frontmatter, and mis-stamped it `approved`. That
> content was replaced with this reviewed 8-step body (recovered from #80); the generator bugs
> are captured in [[proposals/bug-plan-generator-from-approved-proposal]] and
> [[proposals/bug-approve-not-idempotent-stale-consumed-by]].

## Mode

**GUIDED MODE — agent drafts, human approves.**

## Overview

This is the **umbrella plan** for the process redesign #68 authorizes. It does not itself
ship product code; it **sequences and authorizes** a set of sub-plans, and its own first
milestone-determination cycle (Step 5) is the first real exercise of the code-issue↔governance
split it establishes.

The ordering is a genuine dependency chain, not a preference: the **grammar** (`docwright-dev`
profile) must exist before code-issues have a type; the **store** (`issues/`) must exist before
the backlog can be migrated; the **`milestone:` field** must exist before the **roadplan view**
can be derived; and all three must exist before the first **milestone-determination cycle** can
sort the backlog. The bridge, the beta channel, and the empty-image build hang off those
foundations and can proceed in parallel once the store exists.

**Phase assignment is provisional (`phase: 2`)** — the `docwright-dev` profile dogfoods the
Phase-2 profile engine, and the empty-image build is Phase-2 containerization/FOSS-hygiene work.
Confirm or correct at approval.

**Per the proposal, each deliverable below becomes a code-issue or sub-plan _once the `issues/`
store exists_ (Steps 1–2).** Until then this table is the tracking surface; after Step 2 the
remaining rows migrate into `issues/` — dogfooding the split.

## Implementation Steps

> Each row is a deliverable that will be split into its own sub-plan (`parent_plan:
> separate-dev-tracking-milestones-and-beta-channel.md`). Statuses here track the sub-plan's
> lifecycle, not code steps.

| Step | Action | Details | Status |
|------|--------|---------|--------|
| 1 | **`docwright-dev` profile (grammar)** | New profile under `src/profiles/docwright-dev/`: `profile.json`, `schema.json`, `opencode-instructions.md`, and templates for first-class document types `code-issue`, `bug`, `proposal`, `plan`, `policy`, `decision` (all templates carry `author-role:`, default `contributor`). Additive; dogfoods the Phase-2 profile engine. No existing document is forced to migrate. | ✅ Done |
| 2 | **`issues/` store + templates + backlog migration** | Create in-vault `issues/` markdown store (git-canonical, no DB, no telemetry — invariants intact). Add `code-issue`/`bug` templates. Migrate existing `bug-*.md` out of `proposals/` into `issues/`, cross-linking governance halves back to their proposals per the "is the deliverable a diff?" sorting test. GitHub Issues becomes public intake → `inbox → issue`. | ⏳ Pending |
| 3 | **`milestone:` frontmatter field + lint** | Add `milestone:` to issue/plan schema. Lint: every open item has a milestone — a real one or the literal `future` (no orphans; `code-over-memory`). Milestone sits **below** a phase; phases stay `phase-close`-owned. | ⏳ Pending |
| 4 | **Derived roadplan view** | Generated view (never hand-maintained) computed from `milestone:` fields: current milestone, next milestone, `future` pool. Replaces hand-maintained sections of `docs/roadmap.md`. Resolves [[proposals/phases-and-the-master-plan-are-mostly-invisible-to-the-user]] and feeds [[proposals/formalize-roadmap-sequencing-enforcement]]. (Also the durable fix for the "no prioritized/hierarchical list" finding that the `/status` priority-sort patch only bandaged.) | ⏳ Pending |
| 5 | **First milestone-determination cycle** | The first real use of the new machinery: sort the existing backlog into current / next / `future`, assign `milestone:` to every open item, and generate the roadplan. Recurring cadence thereafter (re-run at each milestone close, analogous to `phase-close`). | ⏳ Pending |
| 6 | **Release-channel field + beta gate** | `channel: dev\|beta\|stable` field, orthogonal to version number. Readiness dashboard: `0 open in-scope blockers` + `0 in-scope majors above demand-threshold` + minimum dogfood window + non-negative burn-down. `beta → stable` is **BDFL-only, never AI-automated** — code surfaces the dashboard; the human flips the switch. Enforces `bugs-before-features` at release level. | ⏳ Pending |
| 7 | **User bug-reporting bridge** | Capture surface + suggest-style dedup (reuse the Phase-1 collation/overlap stub, not a new subsystem). Exact dupe → `+1` demand count; related → association only. Harvest repro/context. **Explicit reports only — passive detection is telemetry and is forbidden.** Never auto-send private context; redaction + explicit confirm; offline queue. | ⏳ Pending |
| 8 | **Empty-image deployment** | `.dockerignore` excludes DocWright-project content (`proposals/`, `plans/`, `policies/`, `issues/`) from the image; engine + bundled profiles + templates stay baked in. Verify the image boots empty of project content and mounts the user's folder as the vault. | ⏳ Pending |

## Sub-Plan Breakdown & Sequencing

| Deliverable | Depends On | Parallel With | Becomes |
|---|---|---|---|
| 1 `docwright-dev` profile | — | 8 | sub-plan |
| 2 `issues/` store + migration | 1 | 8 | sub-plan |
| 3 `milestone:` field + lint | 1 | 7, 8 | sub-plan (or code-issue) |
| 4 Derived roadplan view | 3 | 6, 7 | sub-plan |
| 5 Milestone-determination cycle | 2, 3, 4 | — | recurring cadence (manual first; `milestone-close` formalized later) |
| 6 Release-channel + beta gate | 3 | 4, 7 | sub-plan |
| 7 Bridge | 2 | 3, 4, 6 | sub-plan |
| 8 Empty-image | — | 1, 2 | code-issue |

**Critical path:** 1 → 2 → 3 → 4 → 5. Steps 6, 7, 8 branch off once their prerequisite lands.

## Testing Plan

Per-deliverable, defined in each sub-plan before its work starts (`tests_defined` gates completion):

- **1 profile:** profile engine loads `docwright-dev/profile.json`; schema validates each new
  document type; templates lint clean and contain `author-role:`.
- **2 store:** dispatch/linter recognizes `issues/`; migrated `bug-*.md` validate under the new
  schema; cross-links resolve; no `bug-*.md` left orphaned in `proposals/`.
- **3 milestone:** lint fails an open item with no `milestone:`; passes with a real one or `future`.
- **4 roadplan:** view regenerates deterministically from fixtures; drift is impossible (derived,
  invariant #2). Snapshot test over a fixture vault.
- **5 cycle:** after the cycle, zero open items lack a milestone; roadplan renders current/next/future.
- **6 gate:** readiness dashboard computes the gate correctly; `beta → stable` cannot be set by AI
  (hook enforces, mirroring the existing `HUMAN_APPROVED` gate).
- **7 bridge:** dedup suggests (never auto-rejects); demand count increments only on explicit
  reports; offline queue drains; redaction confirmed before any network send. Assert no passive
  telemetry path exists.
- **8 image:** built image contains engine + profiles but **not** `proposals/plans/policies/issues/`;
  boots and mounts a host vault; health check passes.

Overall verification: `npm run test` (atoms, dispatch, mcp, hooks, integration) stays green after
each deliverable; dispatch retains **zero** VS Code API dependencies (invariant #1).

## Rollback Procedures

- Every deliverable ships on its own `feat/`/`fix/` branch and PR; revert the PR to roll back.
- Steps 1–2 are additive — the existing `proposals/`-only flow keeps working until Step 5 migrates
  the backlog, so partial adoption is safe.
- Backlog migration (Step 2) is a content move under git; `git revert` restores prior locations.
- No destructive operations on the canonical store; no schema field is *removed*, only added.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Migration (Step 2) mislabels a bug vs governance half | Medium | Medium | Apply the "is the deliverable a diff?" test per file; cross-link both halves; human reviews the migration PR |
| Demand count drifts into telemetry | Low | High | Explicit reports only; passive detection forbidden and asserted in tests (invariant #4) |
| Roadplan view rots like today's hand-maintained roadmap | Low | Medium | View is *derived* from `milestone:`, never hand-edited (invariant #2) |
| Over-planning / analysis paralysis | Medium | Medium | `future` bucket; only current + next milestone planned in detail |
| Bridge leaks private client context to public tracker | Low | High | Never auto-send; redaction + explicit confirm step |
| Sub-plans tracked before `issues/` exists recreate the old conflation | Medium | Low | Umbrella table is the interim tracker; rows migrate into `issues/` immediately after Step 2 |
| Provisional `phase: 2` is wrong | Low | Low | Confirmed by BDFL at approval |

## Phase Gate

- [ ] All implementation steps resolved (delivered or formally deferred with captured proposals)
- [ ] Test coverage defined and human-reviewed (`tests_human_reviewed: true`)
- [ ] Deferred ideas captured as proposals before closing (see [[policies/core/capture-deferred-ideas.md]])
- [ ] Rollback procedures documented
- [ ] Risk assessment completed

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-07-01 | Reset to `draft` and restored the reviewed 8-step body after the Web UI Approve button generated a divergent, prematurely-`approved` plan. Generator bugs captured in [[proposals/bug-plan-generator-from-approved-proposal]] + [[proposals/bug-approve-not-idempotent-stale-consumed-by]]. | NetYeti |
| 2026-07-01 | Drafted (AI, for review) from proposal #68's §Implementation + §bootstrap; status `draft` pending proposal approval. | NetYeti |
| 2026-07-01 | Step 1 delivered: docwright-dev profile (profile.json, schema.json, opencode-instructions.md, 6 templates with author-role, unit test). tsc clean, 297 dispatch tests pass. Plan → in-progress. | NetYeti |
