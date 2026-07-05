---
title: "Web UI write integrity: shared parser, shared gate, committed transitions, safe saves"
status: in-progress
author: NetYeti
created: 2026-07-05
tags:
  - webui
  - governance
  - dispatch
  - integrity
proposal_source: ""
priority: high
mode: autonomous
scenario_synthesis: Web UI write-integrity cluster — centralize frontmatter parse/serialize in dispatch, share the completion gate across surfaces, auto-commit all UI lifecycle writes, stop syncTestCriteria save rewrites, safe WYSIWYG round-trip, approve idempotency self-heal
assigned_to: NetYeti
tests_defined: false
tests_human_reviewed: false
phase: 4
total_steps: 6
completed_steps: 2
github_epic: ""
automated: full
milestone: next
channel: dev
gate_note: "Changed files are untestable types: plans/webui-write-integrity.md"
---
# Web UI write integrity: shared parser, shared gate, committed transitions, safe saves

## Overview

Groups seven open issues that share one root cause: **Web UI surfaces re-implement
parsing, serialization, gating, and commit logic instead of sharing the dispatch
module**, so each copy drifts and corrupts or bypasses governance independently.
This bit three times on 2026-07-05 alone: a UI sign-off save corrupted a plan's
checkboxes (#148/#149), the Complete button skipped the completion gate (#172),
and every UI transition left uncommitted working-tree changes (#147).

**Issues consumed (cluster A of the 2026-07-05 backlog grouping):**
#94 (duplicated parseFm), #141 (approve stale consumed_by no-op), #142 (stray
re-serialized docs copy), #147 (UI lifecycle writes don't commit), #148
(syncTestCriteria reruns on every save), #149 (WYSIWYG corrupts documents),
#172 (UI bypasses the MCP completion gate).

**Deferred sibling clusters** (captured in
[[proposals/issue-cluster-remediation-waves]]): hooks/identity (#140 #143 #144
#160), report/intake UX (#175–#178, #112, #113), workflow tooling QoL (#93 #97
#136 #146 #166).

**Provenance:** created and started by BDFL in-session directive 2026-07-05
("group any issues together that might be easy overlaps, create a plan, and
begin") — no separate proposal; the seven linked issues are the intake record.

## Implementation Steps

| Step | Action | Details | Status | Issue | Branch |
| --- | --- | --- | --- | --- | --- |
| 1 | Centralize frontmatter parse/serialize in dispatch | One canonical parser + a byte-preserving field editor in `src/dispatch/frontmatter.ts`; every webui endpoint and script imports it; delete all local `parseFm`/`buildRaw` copies. Foundation for every later step. | ✅ Done | #94 | — |
| 2 | Share the completion gate across surfaces | Move `checkCompletionGate`/`uncheckedTestingPlanBoxes` into the dispatch module (surface-agnostic, no MCP dep); MCP re-exports; webui `transition-completed` runs the same gate and refuses identically. Parity test asserts both surfaces reject the same fixture. | ✅ Done | #172 | — |
| 3 | Auto-commit every Web UI lifecycle write | Extend the PR #111 `commitPaths` pattern to approve-sub-plan/plan-review, create-plan, transition-completed, and `/api/write`; no UI action leaves the working tree dirty. #142 resolution folded in: keep the completion doc (mirrors MCP by design) but stop re-serializing frontmatter into it. | ⏳ Pending | #147 | — |
| 4 | syncTestCriteria only on step-table change | Plain saves and lifecycle transitions must not rewrite the Testing Plan; sync runs only when the Implementation Steps table actually changed, and never against `plans/completed/`. Sweep archived plans for already-injected phantom blocks (contribution-pipeline has one). | ⏳ Pending | #148 | — |
| 5 | WYSIWYG safe round-trip | turndown: GFM task-list rule, `-` bullet marker, stop escaping underscores in table cells; body-only round-trip (frontmatter never re-serialized on save); block WYSIWYG mode on governance docs until round-trip is proven byte-stable. | ⏳ Pending | #149 | — |
| 6 | Approve idempotency self-heal | `approve-proposal` short-circuit validates the `consumed_by` target exists; if missing, clear the stale pointer and proceed (with audit note) instead of silently no-opping. | ⏳ Pending | #141 | — |

## Parallelism Map

| Step | Depends On | Parallel With | Notes |
| --- | --- | --- | --- |
| 1 | — | — | Foundation; lands first |
| 2 | 1 | 3 | Gate move rides the shared dispatch layer |
| 3 | 1 | 2 | Commit plumbing independent of gate |
| 4 | 1 | 5, 6 | Save-path fix |
| 5 | 1 | 4, 6 | Editor fix |
| 6 | 1 | 4, 5 | Approve-path fix |

## Testing Plan

### Step Verification
- [ ] Step 1: no `parseFm`-style copies remain outside dispatch (grep-guard test); all suites green after consumers switch
- [ ] Step 2: parity test — the same gate-failing fixture is refused by both MCP `transition_to_completed` and the webui endpoint with equivalent errors
- [ ] Step 3: each UI lifecycle action leaves `git status` clean in a temp-vault test; completion doc no longer re-serializes frontmatter
- [ ] Step 4: a plain document save leaves the Testing Plan byte-identical; step-table edit still syncs; archived plans untouched and swept clean
- [ ] Step 5: WYSIWYG round-trip test — task-list checkboxes, `-` bullets, and underscores survive save byte-identically; governance docs refuse WYSIWYG until stable
- [ ] Step 6: stale `consumed_by` fixture self-heals and approve proceeds; healthy pointer still short-circuits

### Integration & Regression
- [ ] Full `npm test` green
- [ ] `tsc --noEmit` clean; webui builds

### Gate Criteria
- [ ] All seven consumed issues closed by merged PRs (or explicitly re-scoped with BDFL note)
- [ ] No Web UI write path can mutate a governance doc without the shared parser, the shared gate, and a commit

## Rollback Procedures

Each step is an independent PR; revert the PR to roll back. Step 1 keeps the old
call sites' behavior (parse semantics unchanged) so a revert is mechanical. The
WYSIWYG governance-doc block (Step 5) is a feature flag-style guard — removing
the guard restores current behavior.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Parser consolidation changes parse edge-case behavior | Medium | Medium | Grep-guard + full suite; byte-preserving editor for writes |
| Gate parity blocks a legitimate UI completion | Low | Medium | Same gate = same error text; verify_plan_tests documented in UI error |
| Auto-commit commits unintended working-tree files | Medium | High | commitPaths commits only the paths the endpoint wrote, never `git add -A` |

## Document History

| Date | Change | Author |
| --- | --- | --- |
| 2026-07-05 | Created from the 2026-07-05 issue-grouping exercise by BDFL in-session directive ("group any issues together that might be easy overlaps, create a plan, and begin"); consumes #94 #141 #142 #147 #148 #149 #172. | NetYeti |
| 2026-07-05 | Approved and started per BDFL in-session directive 2026-07-05 (NetYeti: "group any issues together that might be easy overlaps, create a plan, and begin"). Sibling clusters B–D captured as deferred proposal issue-cluster-remediation-waves. | NetYeti |
| 2026-07-05 | Step 1 delivered (GH #94, PR #187): canonical parser now JSON_SCHEMA (dates stay strings — latent Date-object hazard fixed) with tolerant line-parser fallback (28 real vault docs previously parsed to {} on the strict path); 6 parseFm copies deleted (webui status/base/release-channel, 3 TS scripts); grep-guard test forbids new copies; +page.svelte serializer deferred to Step 5, plain-node .js scripts allowlisted. Full suite 668 green, webui builds, sync:skills idempotent. Side finds captured via bridge: #185 (generator emits invalid tags line), #160 demand → 2 (identity cache re-poisoned by this step's own test run). | NetYeti |
| 2026-07-05 | Step 2 delivered (GH #172, PR #195): completion gate moved to surface-agnostic src/dispatch/completion-gate.ts (checkCompletionGate, uncheckedTestingPlanBoxes, hasPendingSteps, countSteps, splitTableRow); MCP re-exports keep all import paths; webui transition-completed deletes its local splitTableRow/hasPendingSteps copies and refuses with the identical gate message. Parity proven by test/integration/gate-parity.test.ts (same function object + byte-identical refusal on both surfaces). Full suite green, compile:mcp clean, webui build clean. | NetYeti |
