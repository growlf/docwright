---
title: "Separate dev-tracking (GitHub Issues + Projects) from governance (vault)"
status: draft
author: NetYeti
created: 2026-07-13
tags: [architecture, issues, github, github-projects, migration, separation-of-concerns]
proposal_source: proposals/pivot-issue-tracking-to-github-issues-projects.md
priority: high
mode: guided
assigned_to: NetYeti
verification_type: unit
tests_defined: true
tests_human_reviewed: false
scenario_synthesis: "Happy path: DocWright keeps governance (proposals/plans/policies/decisions) git-native in the vault while development work moves to GitHub Issues + a GitHub Project board. An additive, flagged read/relate layer renders GH issues and lets proposals link stable GH URLs; capture is reworked to create GH issues AND place them on the Project; existing local issues migrate with full fidelity AND two-way reconcile against issues already on GitHub (no duplicates), each landing on the board with the correct status column. A parity gate (fidelity + heatmap-ranking + board-placement) must pass before the local issues/ folder retires (archived, never deleted). Failure avoided: a one-way, board-less dump that flattens the demand heatmap, orphans proposal->issue links, or duplicates existing GH issues."
total_steps: 8
completed_steps: 0
---

# Separate dev-tracking (GitHub Issues + Projects) from governance (vault)

## Overview

Not an invariant-breaking pivot — a **separation of concerns**. Governance/direction
(proposals, plans, policies, decisions, friction) stays git-native in the vault; the
**actual development work** moves to **GitHub Issues + a GitHub Project board**, where the
code and PRs already live. DocWright **reads and links** GH issues so proposals reference
stable GH URLs. This breaks the self-hosting cyclic reference (high-churn dev work-items
leave the code repo) without touching the governance model. Full rationale:
[[proposals/pivot-issue-tracking-to-github-issues-projects]].

**Guiding rule: additive and reversible until the parity gate. Nothing local is deleted
until GH parity is proven; originals are archived. Every migrated/new issue is placed on
the GitHub Project board — not left as a bare issue.**

## Constraints & Invariants

1. **Governance stays git-native.** Only `issues/*.md` (dev work-items) move. Proposals/
   plans/policies/decisions/friction remain in the vault. The core invariant is *clarified*
   (git canonical for governance; GitHub is the dev tracker), not broken.
2. **Lossless + two-way or it doesn't ship.** The parity gate (Step 6) is a HARD GATE:
   demand_count + reported_dates (heatmap fuel), status, scope fields, history, and
   proposal->issue links all survive; migration reconciles against issues ALREADY on GitHub
   (reuse `github_issue:` ids — no duplicates). Removal is BLOCKED until it passes.
3. **GH Project is kept current.** Every issue (migrated and newly captured) is added to the
   DocWright GitHub Project with the correct status column; status transitions update the board.
4. **Additive/flagged until cutover; scope = code projects.** Org/offline vaults keep
   git-native issues (profile-gated). AI never self-approves; destructive steps dry-run first + human-gated.

## Implementation Steps

| # | Action | Details | Status |
| --- | --- | --- | --- |
| 1 | GH Issues + Projects API foundation | `src/dispatch/github-issues.ts`: least-privilege client (list/search/create/update issues; read/write a Project v2 board via GraphQL — status field + demand/dates custom fields). Auth via a scoped GH token (env, per instance). Cache reads; degrade read-only if GH is unreachable. Unit-tested vs a mocked API. Additive — nothing wired. | ⏳ Pending |
| 2 | Define the GH Project + field schema | Create the DocWright Project; map the issue lifecycle (new→triaged→scope-checked→awaiting-proposal→proposal-linked→resolved/deferred/duplicate) to a board status field; map demand_count + reported_dates + channel + scope_* to Project custom fields (so the time-weighted heatmap can be recomputed, not just a lossy `demand:N` label). Document the mapping. | ⏳ Pending |
| 3 | Read/relate layer (flagged, additive) | Behind `ISSUES_SOURCE=github` (default off), the Web UI + `/api/status` (heatmap, "needs attention") read issues from GH; proposals resolve `related`/links to GH issue URLs. Local issues stay canonical. | ⏳ Pending |
| 4 | Rework capture onto GH + board (flagged) | `capture_bug_report` suggest/confirm/create → creates a GH issue, **adds it to the Project** with the right status, sets demand fields; dedup uses GH search AND reconciles with existing GH issues (two-way). | ⏳ Pending |
| 5 | Lossless + two-way migration (dry-run first) | `scripts/migrate-issues-to-github.ts`: idempotent, re-runnable, records `local-path→gh-url`. Ports every field per the fidelity table; **reconciles against issues already on GitHub** (reuse `github_issue:` id; never duplicate); **adds each issue to the Project** with the correct status column; rewrites `related`/`consumed_by`/wikilinks in proposals/plans to GH URLs; archives originals to `issues.archive/` (committed once). `--dry-run` reports the full diff first. | ⏳ Pending |
| 6 | **PARITY GATE — no lost juice, board correct** | Verification: every local issue has a single GH counterpart (no dupes) carrying demand_count/reported_dates/status/scope/body/history; the heatmap's hot-items + ranking from GH match pre-migration; **every issue is on the Project with the right column**; every proposal->issue link resolves. BLOCKS Step 7. **[DECISION: exact-signal match vs equivalent-ranking — see critique]** | ⏳ Pending |
| 7 | Cutover — GH canonical for dev issues | Flip `ISSUES_SOURCE=github` default on; GH + Project is the dev-tracking source of truth. Local `issues/` retained (archived), no longer written. | ⏳ Pending |
| 8 | Retire local issue machinery + clarify docs | Retire `validate_issue_workflow` (pre-commit), dispatch linter issue rules, the local `github_issue:` convention (inverted). Clarify CLAUDE.md invariant (git canonical for governance; GitHub is the dev tracker) + PROJECT.md issue-model section + AGENTS.md capture directive. | ⏳ Pending |

## Parallelism Map

| Step | Depends On | Parallel With | Notes |
| --- | --- | --- | --- |
| 1 | — | 2 | client + Project schema independent |
| 2 | — | 1 | board + custom fields |
| 3 | 1, 2 | 4 | read layer |
| 4 | 1, 2 | 3 | capture + board placement |
| 5 | 1, 2, 3, 4 | — | migration needs plumbing |
| 6 | 5 | — | the gate |
| 7 | 6 (pass) | — | cutover |
| 8 | 7 | — | retire after cutover |

## Testing Plan

- Step 1: GH client unit tests (issues CRUD + Project read/write) vs mocked API; graceful-degrade path.
- Step 2: field-mapping doc + a fixture asserting demand/dates round-trip through custom fields.
- Step 3: heatmap + "needs attention" render identically from GH vs local for a fixture (flagged).
- Step 4: capture creates a GH issue, places it on the board with the right status; dedup + two-way reconcile.
- Step 5: dry-run migration ports all fields, reconciles (no dupes), places on board, rewrites links; idempotent re-run is a no-op.
- **Step 6 (gate): parity harness — GH-signal === local-signal (incl. time-weighted heatmap ranking) + 100% board placement + all links resolve.**
- Step 8: repo has no `issues/` churn; hooks/linter/CI green without issue rules.

## Phase Gate

- Governance stayed git-native; only dev issues moved (separation of concerns, invariant clarified not broken).
- Migration proven lossless + two-way (Step 6 gate green) BEFORE any removal; originals archived.
- Every issue (migrated + new) is on the GitHub Project with the correct status column.
- Proposals link stable GH issue URLs; scope respected (offline vaults keep git-native issues).
- Docs (invariant, PROJECT.md, AGENTS.md) clarified; hooks/linter no longer reference `issues/`.
- `tests_defined` + human review confirmed.

## Rollback Procedures

- Before Step 7: flip `ISSUES_SOURCE=local` — GH support inert, local system intact.
- After Step 7: reverse-migrate from `issues.archive/` + the `local-path→gh-url` map; note that GH issues created AFTER cutover would need a GH→local export (rollback is not perfectly clean post-cutover — accepted risk, called out).
- Doc/invariant changes revert by git.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Demand heatmap signal flattened | Medium | High | Custom fields preserve dates; parity gate asserts ranking equivalence before removal |
| Proposal->issue links orphaned | Medium | High | Step 5 rewrites links; Step 6 verifies each resolves |
| Duplicates vs existing GH issues | Medium | High | Two-way reconcile: reuse `github_issue:` ids, dedupe against GH search |
| Issues created but not on the board | Medium | Medium | Board placement is part of capture (4), migration (5), and the gate (6) |
| GH API rate limits / outage | Medium | Medium | Cache reads; degrade read-only; UI never blocks on GH |
| Rollback imperfect post-cutover | Low | Medium | Additive/reversible until Step 7; post-cutover loss called out |

## Document History

| Date | Change | Author |
| --- | --- | --- |
| 2026-07-13 | Drafted (staged, lossless) from the pivot proposal for pre-execution critique. | NetYeti |
| 2026-07-13 | Reframed to separation-of-concerns per BDFL clarification (governance stays git-native; dev issues → GH); made GH Project population a first-class requirement (migrated + new issues on the board); added two-way reconcile against existing GH issues. | NetYeti |
