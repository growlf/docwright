---
title: "Pivot issue tracking to GitHub Issues + Projects (break the self-hosting cyclic reference)"
status: in-progress
author: "NetYeti"
created: "2026-07-13"
created_by: "NetYeti@phoenix"
tags: [architecture, issues, github, github-projects, migration, separation-of-concerns]
proposal_source: "proposals/pivot-issue-tracking-to-github-issues-projects.md"
priority: high
automated: guided
assigned_to: ["NetYeti"]
verification_type: unit
related_to:
  - proposals/pivot-issue-tracking-to-github-issues-projects.md
depends_on: []
blocks: []
tests_defined: false
tests_human_reviewed: false
template_version: "1.0"
scenario_synthesis: "Governance (proposals/plans/policies/decisions) stays git-native; development work moves to GitHub Issues + a GitHub Project board. An additive, flagged read/relate layer renders GH issues and lets proposals link stable GH URLs; capture is reworked to create GH issues AND place them on the Project; existing local issues migrate with full fidelity AND two-way reconcile against issues already on GitHub (no duplicates), each on the board with the correct status column, demand_count + every reported_date preserved in Project custom fields (Bar B). A parity gate (no data lost + ranking preserved + board placement + links resolve) blocks a single clean cutover; the local issues/ folder then retires (archived, never deleted)."
total_steps: 8
completed_steps: 6
---

# Pivot issue tracking to GitHub Issues + Projects (break the self-hosting cyclic reference)

## Overview

**Separation of concerns, not an invariant-breaking pivot.** Governance/direction stays
git-native in the vault; the **actual development work** moves to **GitHub Issues + a
GitHub Project board**, where the code and PRs already live. DocWright **reads and links**
GH issues so proposals reference stable GH URLs. This breaks the self-hosting cyclic
reference (high-churn dev work-items leave the code repo) without touching the governance
model. Full rationale, fidelity table, and security notes:
[[proposals/pivot-issue-tracking-to-github-issues-projects]].

**Guiding rule: additive/reversible until the parity gate. Nothing local is deleted until
GH parity is proven; originals archived. Every migrated/new issue is on the Project board.**

## Settled decisions (BDFL, 2026-07-13)

1. **Transition = single clean cutover, ASAP.** No long dual-write; all parallel dev +
   the other instances are frozen for the duration, then resume by pulling the tagged
   release + `main`. Stages 1–5 additive/flagged; Step 7 is the one-time flip.
2. **Heatmap fidelity = Bar B.** `demand_count` + **every** `reported_date` are preserved
   in GH Project custom fields (exact time-weighted recompute always possible). The parity
   gate asserts **no data lost + ranking/hot-items preserved** — NOT byte-identical scores
   (time-weighting is relative to "now", so exact decimals legitimately drift).
3. **Priority = immediate/top.** All other DocWright dev is held. Other instances
   (csdocs/erp/msp) adopting it is a post-completion cleanup cycle, out of this plan.

## Constraints & Invariants

1. **Governance stays git-native.** Only `issues/*.md` move; proposals/plans/policies/
   decisions/friction stay. Invariant *clarified* (git canonical for governance; GitHub is
   the dev tracker), not broken.
2. **Lossless + two-way, gated on Bar B.** Step 6 is a HARD gate; removal BLOCKED until it
   passes. Reconcile against issues already on GitHub (reuse `github_issue:` ids — no dupes).
3. **GH Project kept current.** Every issue (migrated + new) on the board with the right
   status column; status transitions update the board.
4. **Additive/flagged until the one cutover; scope = code projects.** Offline/org vaults
   keep git-native issues (profile-gated). AI never self-approves; destructive steps
   dry-run first + human-gated.

## Implementation Steps

| Step | Action | Details | Status |
|------|--------|---------|--------|
| 1 | GH Issues + Projects API foundation | `src/dispatch/github-issues.ts`: least-privilege client (issues CRUD; Project v2 board read/write via GraphQL — status field + demand/dates custom fields). Auth via a scoped GH token (env, per instance). Cache reads; degrade read-only if GH unreachable. Unit-tested vs a mocked API. Additive — nothing wired. | ✅ Done |
| 2 | Define the GH Project + field schema | Create the DocWright Project; map the issue lifecycle (new→triaged→scope-checked→awaiting-proposal→proposal-linked→resolved/deferred/duplicate) to a board status field; store demand_count + EVERY reported_date + channel + scope_* in Project custom fields (raw dates retained → exact heatmap recompute, Bar B). Document the mapping. | ✅ Done |
| 3 | Read/relate layer (flagged, additive) | Behind `ISSUES_SOURCE=github` (default off), the Web UI + `/api/status` (heatmap, "needs attention") read issues from GH; proposals resolve `related`/links to GH issue URLs. Local issues stay canonical. | ✅ Done |
| 4 | Rework capture onto GH + board (flagged) | `capture_bug_report` suggest/confirm/create → creates a GH issue, adds it to the Project with the right status, sets demand fields (count + date); dedup via GH search + two-way reconcile with existing GH issues. | ✅ Done |
| 5 | Lossless + two-way migration (dry-run first) | `scripts/migrate-issues-to-github.ts`: idempotent, records `local-path→gh-url`. Ports every field incl. all reported_dates → custom fields; reconciles against issues already on GitHub (reuse `github_issue:` id; never duplicate); adds each to the Project with the correct column; rewrites `related`/`consumed_by`/wikilinks in proposals/plans to GH URLs; archives originals to `issues.archive/`. `--dry-run` reports the diff first. | ✅ Done |
| 6 | PARITY GATE (Bar B) — no lost juice, board correct | Verification: every local issue has exactly one GH counterpart (no dupes) carrying demand_count + ALL reported_dates + status/scope/body/history; heatmap hot-items + ranking from GH match pre-migration; every issue on the Project with the right column; every proposal→issue link resolves. BLOCKS Step 7. | ✅ Done |
| 7 | Cutover — GH canonical for dev issues | One-time flip: `ISSUES_SOURCE=github` default on. Local `issues/` retained (archived), no longer written. Parallels/instances resume by pulling the tagged release + `main`. | ⏳ Pending |
| 8 | Retire local issue machinery + clarify docs | Retire `validate_issue_workflow` (pre-commit), dispatch linter issue rules, the local `github_issue:` convention. Clarify CLAUDE.md invariant + PROJECT.md issue-model + AGENTS.md capture directive. | ⏳ Pending |

## Parallelism Map

| Step | Depends On | Parallel With | Notes |
| --- | --- | --- | --- |
| 1 | — | 2 | client + Project schema independent |
| 2 | — | 1 | board + custom fields |
| 3 | 1, 2 | 4 | read layer |
| 4 | 1, 2 | 3 | capture + board placement |
| 5 | 1, 2, 3, 4 | — | migration needs plumbing |
| 6 | 5 | — | the gate |
| 7 | 6 (pass) | — | single cutover |
| 8 | 7 | — | retire after cutover |

## Testing Plan

- Step 1: GH client unit tests (issues CRUD + Project read/write) vs mocked API; graceful-degrade path.
- Step 2: field-mapping doc + fixture asserting demand_count + all reported_dates round-trip through custom fields.
- Step 3: heatmap + "needs attention" render identically from GH vs local for a fixture (flagged).
- Step 4: capture creates a GH issue, places it on the board with the right status; dedup + two-way reconcile.
- Step 5: dry-run migration ports all fields incl. every date, reconciles (no dupes), places on board, rewrites links; idempotent re-run is a no-op.
- Step 6 (gate, Bar B): parity harness — count + all dates present, heatmap RANKING === pre-migration, 100% board placement, all proposal→issue links resolve.
- Step 8: repo has no `issues/` churn; hooks/linter/CI green without issue rules.

## Rollback Procedures

- Before Step 7: flip `ISSUES_SOURCE=local` — GH support inert, local system intact.
- After Step 7: reverse-migrate from `issues.archive/` + the `local-path→gh-url` map; GH issues created after cutover would need a GH→local export (not perfectly clean post-cutover — accepted, low-risk since parallels are frozen through cutover).
- Doc/invariant changes revert by git.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Demand heatmap signal flattened | Low | High | All reported_dates in custom fields; Bar B gate asserts ranking equivalence before removal |
| Proposal→issue links orphaned | Medium | High | Step 5 rewrites links; Step 6 verifies each resolves |
| Duplicates vs existing GH issues | Medium | High | Two-way reconcile: reuse `github_issue:` ids, dedupe against GH search |
| Issues created but not on the board | Medium | Medium | Board placement in capture (4), migration (5), and the gate (6) |
| GH API rate limits / outage | Medium | Medium | Cache reads; degrade read-only; UI never blocks on GH |

## Phase Gate

- [ ] All implementation steps resolved (delivered or formally deferred with captured proposals)
- [ ] Migration proven lossless + two-way under Bar B (Step 6 gate green) before any removal; originals archived
- [ ] Every issue (migrated + new) on the GitHub Project with the correct status column
- [ ] Single clean cutover done; proposals link stable GH URLs; offline vaults unaffected
- [ ] Docs (invariant, PROJECT.md, AGENTS.md) clarified; hooks/linter no longer reference `issues/`
- [ ] Test coverage defined and human-reviewed (`tests_human_reviewed: true`)
- [ ] Rollback procedures documented

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-07-13 | Created from the approved proposal (approve flow) — prose only, empty steps. | NetYeti |
| 2026-07-13 | Consolidated the hand-crafted staged content (8 steps, settled decisions, Bar B gate, parallelism, testing/rollback/risk) into this canonical plan (chown fix on the root-owned UI file); duplicate draft pivot-issue-tracking-to-github.md retired. | NetYeti |
| 2026-07-13 | Step 1 done (PR #348 merged): src/dispatch/github-issues.ts — GH Issues (REST) + Projects v2 (GraphQL) client, cached/degrading reads, env config, 12 mocked tests. Additive, nothing wired. Plan → in-progress. Next: Step 2 (create the GH Project + field schema) once the BDFL provides the project-scoped token + Project node id. | NetYeti |
| 2026-07-13 | Step 2 done: created GH Project "DocWright Dev" (growlf #3, node PVT_kwHOABJHO84BdPEu) + 7 fields — Lifecycle (8-state single-select = linter enum), Priority, Demand (number), Reported Dates (text, all dates for Bar B), Channel, DocWright ID (reversibility/dedup key), Scope Decision. Native Milestone/Labels/Linked-PRs reused; built-in Status left non-authoritative (API can't edit its options). Mapping documented in docs/github-project-schema.md; code resolves field ids by name at runtime. SECURITY: board created with the BDFL's broad primary classic PAT as a temporary session token (exposed in-session) — must rotate it after session, and swap the instance runtime token to a fine-grained growlf/docwright Issues+Projects PAT (stored in Bitwarden) before cutover. Next: Step 3/4 (read + capture, both flagged) — parallelizable. | NetYeti |
| 2026-07-13 | Steps 3+4 done (committed to dogfood 1708128, flagged/additive, default local). Step 3: src/dispatch/issue-source.ts — readIssueDocs() reads local issues/*.md OR the GH Project board (ISSUES_SOURCE=github), reconstructing demand_count + EVERY reported_date from the Demand/Reported Dates fields so the heatmap math is unchanged (Bar B); /api/status routed through it (async GET, single hoisted read); flag-off output unchanged; degrades to local if GH unconfigured. Step 4: src/dispatch/capture-github.ts + capture.ts facade — suggest/confirm/create route local vs GH by flag; GH create makes issue + adds to board + stamps Lifecycle/Demand/Reported Dates/DocWright ID/Priority/Channel; confirm two-way reconciles (+1 Demand, append date, bump demand:N label, comment); MCP capture_bug_report + 3 Web-UI report endpoints call the facade. Client extended: getProjectFields (resolve-by-name), listProjectItemsDetailed, setProjectFieldByName, setProjectNumberField, addComment. Verified: tsc clean; 461 dispatch tests (30 new) + MCP suite green; webui vite build ok. Next: Step 5 (lossless + two-way migration script, dry-run first) — needs the fine-grained token + live board to exercise; Steps 3/4 build+test without it. | NetYeti |
| 2026-07-13 | Step 5 done (committed dogfood 6026ee4). src/dispatch/migrate-issues.ts + scripts/migrate-issues-to-github.ts (npm run migrate:issues): idempotent, DRY-RUN BY DEFAULT (--execute to write), NON-DESTRUCTIVE (originals retained until the Step 6 gate). Ports demand_count + EVERY reported_date → Demand/Reported Dates (Bar B), status→Lifecycle (enum-folded), scope_*/related → body verbatim, category/demand → labels. Two-way reconcile: github_issue backlink OR title match reuses the existing issue (never duplicates); mirrored+on-board+fields-match → skip (no-op re-run). Rewrites governance-doc links to migrated issues → stable GH URLs; writes reversible issues.migration-map.json. Client: paginated listIssues (state=all, so resolved/closed mirrors aren't re-created) + cursor-paginated listProjectItemsDetailed (no silent cap for the parity gate). Verified: tsc clean; 471 dispatch tests (10 new); CLI typechecks. Next: Step 6 (PARITY GATE, Bar B) — build the verify harness (unit-testable on mocks); RUNNING migration + gate live needs the fine-grained token + board. Then Step 7 cutover, Step 8 retire. | NetYeti |
| 2026-07-13 | Step 6 HARNESS done (committed dogfood 9d073c9). src/dispatch/parity-check.ts + scripts/parity-check-issues.ts (npm run parity:issues): read-only Bar B gate — (1) exactly one GH counterpart per local issue (no dupes), (2) demand_count + EVERY reported_date + status→Lifecycle + scope + body preserved, (3) demand RANKING from GH matches pre-migration (order, not exact scores), (4) every counterpart on board with a Lifecycle column, (5) governance-doc links to migrated issues resolve. CLI exits 1 on failure → cutover stays BLOCKED. Verified: tsc clean; 481 dispatch tests (10 new — clean pass + one failure mode per check); CLI typechecks. IMPORTANT: the harness is built + unit-tested, but the LIVE gate run (npm run parity:issues against the real board, which must be GREEN before Step 7) has NOT happened — it needs the fine-grained token + the actual migration to have run. Steps 1-6 are all the mock-testable work; Steps 7 (cutover) + the live migrate→parity run are token-gated. Step 8 (retire local machinery + clarify docs) is mostly doable now but should follow a green live gate. | NetYeti |
| 2026-07-13 | LIVE MIGRATION EXECUTED + PARITY GATE GREEN (dogfood 24ae128 fix, e828cf7 output). Ran npm run migrate:issues --execute against growlf/docwright + the DocWright Dev board (PVT_kwHOABJHO84BdPEu) using the in-session token: 95 local issues now on GitHub Issues + the Project. npm run parity:issues → PARITY OK, all 5 checks: 95 issues, 0 missing, 0 duplicated, demand_count + EVERY reported_date + status→Lifecycle + scope + body preserved (Bar B), demand ranking preserved, all on board with Lifecycle column, governance-doc links resolve. Migration output committed: 36 github_issue backlinks, 25 link-rewritten governance docs, issues.migration-map.json. INCIDENT + FIX: run 1 died at the link-rewrite step on a root-owned plan file (chowned); run 2 re-created 6 issues because empty-title issues were created titled-by-slug but reconciled on ''-key — a matcher bug (fixed in migrate-issues.ts, regression test added, 482 dispatch tests). The 6 dups (#396-401) were caught by the parity gate (proving it works), deleted (user-authorized), backlinks/map repointed to originals; re-parity green. Local issues/ retained. NEXT: Step 7 cutover (flip ISSUES_SOURCE=github default-on + wire the token on instances) — a deliberate BDFL go; then Step 8 (retire issues/ linter+hook rules, clarify CLAUDE.md/PROJECT.md/AGENTS.md). | NetYeti |
