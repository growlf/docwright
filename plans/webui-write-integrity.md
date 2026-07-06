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
tests_defined: true
tests_human_reviewed: false
phase: 4
total_steps: 6
completed_steps: 6
github_epic: ""
automated: full
milestone: v0.5.0
channel: dev
gate_note: "Changed files are untestable types: plans/webui-write-integrity.md"
tests_last_run: "2026-07-06T03:57:36.908Z"
tests_last_result: pass
tests_last_commit: b308e2b
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
| 3 | Auto-commit every Web UI lifecycle write | Extend the PR #111 `commitPaths` pattern to approve-sub-plan/plan-review, create-plan, transition-completed, and `/api/write`; no UI action leaves the working tree dirty. #142 resolution folded in: keep the completion doc (mirrors MCP by design) but stop re-serializing frontmatter into it. | ✅ Done | #147 | — |
| 4 | syncTestCriteria only on step-table change | Plain saves and lifecycle transitions must not rewrite the Testing Plan; sync runs only when the Implementation Steps table actually changed, and never against `plans/completed/`. Sweep archived plans for already-injected phantom blocks (contribution-pipeline has one). | ✅ Done | #148 | — |
| 5 | WYSIWYG safe round-trip | turndown: GFM task-list rule, `-` bullet marker, stop escaping underscores in table cells; body-only round-trip (frontmatter never re-serialized on save); block WYSIWYG mode on governance docs until round-trip is proven byte-stable. | ✅ Done | #149 | — |
| 6 | Approve idempotency self-heal | `approve-proposal` short-circuit validates the `consumed_by` target exists; if missing, clear the stale pointer and proceed (with audit note) instead of silently no-opping. | ✅ Done | #141 | — |

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

- [x] Step 1: no `parseFm`-style copies remain outside dispatch (grep-guard test); all suites green after consumers switch
- [x] Step 2: parity test — the same gate-failing fixture is refused by both MCP `transition_to_completed` and the webui endpoint with equivalent errors
- [x] Step 3: each UI lifecycle action leaves `git status` clean in a temp-vault test; completion doc no longer re-serializes frontmatter
- [x] Step 4: a plain document save leaves the Testing Plan byte-identical; step-table edit still syncs; archived plans untouched and swept clean
- [x] Step 5: WYSIWYG round-trip test — task-list checkboxes, `-` bullets, and underscores survive save byte-identically; governance docs refuse WYSIWYG until stable
- [x] Step 6: stale `consumed_by` fixture self-heals and approve proceeds; healthy pointer still short-circuits

> Evidence: Step 1 `test/dispatch/frontmatter-canonical.test.ts` (grep-guard; +page.svelte
> allowlist entry removed in Step 5, PR #213). Step 2 `test/integration/gate-parity.test.ts`
> (same function object + byte-identical refusal, PR #195). Step 3
> `test/integration/webui-commit.test.ts` (clean tree + user-authored commit + MCP-identical
> completion doc, PR #199). Step 4 `test/dispatch/test-criteria.test.ts` +
> `test/integration/write-sync.test.ts`; sweep removed 26 phantom lines from 3 archived plans
> (PR #209). Step 5 `test/webui/markdown-roundtrip.test.ts` (11 cases) + Playwright visual
> smoke: plan Source-only, proposal WYSIWYG intact (PR #213). Step 6
> `test/integration/approve-selfheal.test.ts` (PR #216). All suites run in CI as of PR #213
> (test:integration + test:webui added to the pipeline).

### Integration & Regression
- [x] Full `npm test` green — recorded by verify_plan_tests (see tests_last_* frontmatter); also green in CI on every step PR (#187 #195 #199 #209 #213 #216)
- [x] `tsc --noEmit` clean; webui builds — compile:mcp + webui production build verified after every step; CI Lint/Typecheck green on all six PRs

### Gate Criteria
- [x] All seven consumed issues closed by merged PRs (or explicitly re-scoped with BDFL note) — #94 (PR #187), #172 (PR #195), #147 + #142 (PR #199), #148 (PR #209), #149 (PR #213), #141 (PR #216); all verified CLOSED on GitHub, all resolved in the issue store with closed_by_pr
- [x] No Web UI write path can mutate a governance doc without the shared parser, the shared gate, and a commit — parser: grep-guard forbids copies; gate: webui transition-completed runs dispatch checkCompletionGate (parity-tested); commit: all four write endpoints commit via commitPaths (fixture-tested); WYSIWYG additionally blocked on plans/policies/decisions

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
| 2026-07-06 | Step 3 delivered (GH #147 + folded #142, PR #199): commitPaths extended to transition-completed, approve-sub-plan, create-plan, and /api/write — every UI write commits locally as the authenticated user, tree never left dirty; approve-sub-plan/create-plan/transition-completed now requireAuth; plan-review/apply-review write nothing (no commit needed). Completion doc now generated by shared src/dispatch/completion-doc.ts (extracted from MCP transition_to_completed) — both surfaces byte-identical, webui quote-wrapped re-serialization deleted. Proven by test/integration/webui-commit.test.ts in a git-initialized fixture vault. Full suite green, compile:mcp clean, webui build clean. | NetYeti |
| 2026-07-06 | Step 4 delivered (GH #148, PR #209): /api/write gates syncTestCriteria on new dispatch stepsChanged helper — plain saves never rewrite the Testing Plan, step-table changes still sync, plans/completed/ never synced (now under test). New removePhantomStepDuplicates + scripts/sweep-phantom-test-blocks.ts swept 26 phantom lines from 3 archived plans (contribution-pipeline's 3 known + 23 more in governance-engine-view-container and docwright-adopt). First test coverage for test-criteria module + write-sync integration test through the real endpoint. Full suite green, compile:mcp and webui build clean. | NetYeti |
| 2026-07-06 | Step 5 delivered (GH #149, PR #213): editor never re-serializes frontmatter — $lib/markdown-roundtrip.ts keeps the original frontmatter text block, body saves reattach it byte-identical, property edits apply per-field via dispatch setFrontmatterField (now array/block-list-aware); client parseFm/stringifyFm/buildRaw deleted, grep-guard allowlist entry removed; latent source-mode clobber fixed. turndown: tight '-' bullets, task-list checkboxes survive, underscores unescaped. WYSIWYG blocked on plans/policies/decisions until round-trip proven byte-stable there. CI gap closed: test:integration + test:webui now run in the pipeline (with src/webui npm ci). 11 round-trip unit tests + Playwright visual smoke (plan Source-only, proposal WYSIWYG intact). Full suite green. | NetYeti |
| 2026-07-06 | Step 6 delivered (GH #141, PR #216): approve-proposal short-circuits only when the consumed_by target exists; stale pointers are audit-logged (CONSUMED_BY_SELF_HEAL) and approval proceeds, overwriting the pointer with the new plan. Integration test proves both paths (valid pointer still guards #115; stale pointer heals end-to-end). ALL 6 STEPS COMPLETE — full suite green, awaiting human test review + completion. | NetYeti |
| 2026-07-06 | Testing Plan reconciled with delivered evidence: all Step Verification, Integration & Regression, and Gate Criteria boxes checked with per-step test citations and PR references. Awaiting verify_plan_tests green stamp + human review (tests_human_reviewed) before completion. | NetYeti |
| 2026-07-06 | Test run recorded via verify_plan_tests: npm test → PASS @ b308e2b | NetYeti |
