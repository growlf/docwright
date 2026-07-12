---
title: Adopt milestone-driven roadmap discipline (lilyetibot model)
status: approved
author: NetYeti
created: 2026-07-10
tags:
  - governance
  - roadmap
  - versioning
  - lifecycle
  - process
  - dog-fooding
proposal_source: proposals/approved/adopt-milestone-driven-roadmap-discipline.md
priority: high
automated: guided
assigned_to: NetYeti
phase: 4
milestone: v0.5.0
total_steps: 28
completed_steps: 0
tests_defined: true
tests_human_reviewed: false
scenario_synthesis: "Happy path: W0 clears the six governance-debt bugs, W1 lands structured steps end-to-end (schema → writers → readers with legacy fallback), W2 pins version semantics and automates the patch bump, W3–W6 gate phase closes, testing tiers, roadmap, and agent onboarding on existing engines. Failure paths: new step validation rejects an active plan → strict mode stays feature-flagged off until step 10's migration verifies; staged bump double-fires → completed_version stamp detects and refuses; phase-close gating blocks a legitimate close → existing gate_status: waived (human-only) escape hatch; BDFL gate stalls >5 days → dependent step pauses, freeze does NOT extend (exit = step 14 merged); wave PR destabilizes main → revert that wave's merge (step 10 ships as its own PR so migrations revert independently)."
_path: plans/adopt-milestone-driven-roadmap-discipline.md
related_to:
  - proposals/approved/plan-lifecycle-enforcement-gaps.md
channel: stable
---

# Adopt milestone-driven roadmap discipline (lilyetibot model)

## Overview

Delivers the approved proposal [[proposals/approved/adopt-milestone-driven-roadmap-discipline.md]] — see it for the full *what & why*.

Steps are grouped into seven waves whose order is load-bearing: bugs first
(W0), the structured-step convention before anything that reads it (W1 before
W5), versioning semantics pinned before automation (step 13 before 14–15).
Each step is sized to one focused session and carries a *Done when* — this
plan practices the rule it introduces (steps 7 and 10 are sanctioned
exceptions, marked inline). Revised 2026-07-10 after a four-reviewer critique
cycle, and again 2026-07-10 evening after a second four-perspective cycle
(see `## Critical Review`).

**Guiding constraint (from the critique): reuse before build.** Wave 3 uses
the existing gate engine (`src/dispatch/gates.ts`, `promote.ts`, the
`phase-complete` gate in `src/profiles/org-operations/profile.json`, the
pre-commit phase-review gate) — it does NOT build a parallel sign-off
mechanism. Wave 1 reuses `scripts/migrate-mode-field.ts` and extends
`policies/frontmatter-validate/`. Wave 5 extends `src/dispatch/roadplan.ts`.

### Wave objectives and execution order

| Wave | Objective | Intra-wave order |
|---|---|---|
| W0 (1–5) | Clear governance-debt bugs that would corrupt or falsify later waves | 1–5 independent; parallel-safe |
| W1 (6–12) | Structured-step convention end-to-end: policy → schema → writers → readers | 6 and 9 free; 7 → 8 → 10 → 11 → 12 strict |
| W2 (13–15) | Version semantics pinned, bump automated, history reconciled | 13 → 14 (same PR) → 15 |
| W3 (16–19) | Phase closes gated on the existing gate engine with human proof-of-life | 16 free; 17 → 18 → 19 |
| W4 (20–22) | Testing tiers declared per plan; completion test gate tightened | 20 → 21; 22 free |
| W5 (23–26) | Living roadmap generated from plan state; sequencing gate | 23 → 24 → 25; 26 free |
| W6 (27–28) | Fresh-agent onboarding surface, verified cold | 27 → 28 |

**BDFL gates (inventory):** approval-time ratification (consumed proposals +
in-flight dispositions, below); step 13 policy sign-off; step 15 derivation
confirmation; step 19 boundary-policy amendment commit; step 23 spec
acceptance; every wave-PR merge. **Stall path:** a BDFL gate pending more
than ~5 days pauses only its dependent steps — it does NOT extend the freeze
(see freeze exit below), and independent steps in later waves may proceed.

### Freeze scope (bounded)

**Hard feature freeze on `main` covers W0–W2 only** — the waves that change
shared conventions (step format, mode field, version semantics). W3–W6
execute afterward as ordinary high-priority trunk work with in-flight plans
resumed per the dispositions below. This bounds the freeze to roughly
15 sessions instead of a month.

**Freeze exit is mechanical: the freeze lifts when step 14's PR merges.**
Step 15 is a one-time data reconciliation that changes no shared convention
and may complete after the freeze lifts. The freeze itself is procedural
(surfaced at session start via this plan's disposition table), deliberately
not mechanized: enforcement code would outlive its ~15-session usefulness.
This is a recorded, accepted exception to code-over-memory.

### Disposition of in-flight plans (BDFL ratifies with plan approval)

| Plan | State | Disposition |
|---|---|---|
| `release-v0.5.0` | in-progress | **Pause through W2.** Its step 2 (bump VERSION to 0.5.0) and step 5 (VERSION drift CI) collide with steps 13–15; fold both into W2, then resume with the reconciled semantics |
| `live-ai-visibility-event-relay` | approved, 10/14 | **Finish-first exemption.** Soak ends ~2026-07-13; land its completion PR before step 15 runs; its manual patch-bump constraint is absorbed by step 14 |
| `lifecycle-gates` | approved, 4/5 | **Reused + finished here** — its remaining step (AI gate preparation) is this plan's step 16 |
| `multi-session-work-claiming` | approved, 0/11 | **Exempt as process tooling** (recommended — it aids the freeze itself); BDFL may pause instead. **Condition:** it may not begin until step 5 lands (its executor mutates step tables, at risk from the live pipe bug), and step 10 migrates its plan file last, coordinated with its claimant |
| `executor-panel-live-feedback` | approved, 2/3 | **Pause; re-evaluate** — live-ai step 3.5 may have superseded its remaining step; check before resuming, cancel with reason if so |
| `image-based-deployment-any-directory` | in-progress (landed with v0.4.12) | **Paused under freeze** with the rest |
| All other active plans | various | **Paused under freeze**, resume after W2 |

### Consumed proposals (BDFL action at approval time)

Steps 7, 9, and 26 implement three proposals currently `approved: false`:
[[proposals/plan-steps-structured-frontmatter.md]],
[[proposals/plan-execution-mode-rename.md]],
[[proposals/formalize-roadmap-sequencing-enforcement.md]] (partial — see
step 26). Executing unapproved proposals from inside an approved plan would
bypass the lifecycle this plan strengthens. **This plan is their approval
vehicle:** when approving this plan, the BDFL also approves those three.

**Mechanics (do not leave to memory):** for each of the three — (1) flip
`approved: true`, (2) move to `proposals/approved/`, (3) set
`consumed_by: plans/adopt-milestone-driven-roadmap-discipline.md`
(the sequencing proposal is consumed *partially*; its remainder is captured
in step 26's deferred follow-up), (4) include all three in the same
HUMAN-APPROVED commit as this plan's approval, (5) verify `get_status`
shows them consumed. Steps 7, 9, and 26 each carry a Done-when precondition
that their source proposal is approved — the ratification cannot silently
slip.

## Implementation Steps

| Step | Action | Details | Status |
|------|--------|---------|--------|
| 1 | W0: Fix versioning policy develop refs (bug #299) + critique-tooling path bug (#304) | Minimal fix: replace the `develop` release-branch instructions in `policies/core/versioning.md` (line ~80) with trunk-based flow per CONTRIBUTING.md. Do NOT touch the PATCH semantics text — step 13 rewrites it and supersedes this section. Also fix `scripts/critique-plan.js` to resolve `proposal_source:` under `proposals/approved/` (bug #304 — bitten twice on this very plan). Done when: `grep -i develop policies/core/versioning.md` is empty and critique-plan.js resolves an approved-dir proposal_source in a test invocation | ⏳ Pending |
| 2 | W0: Reconcile duplicate + invalid-status plans (bug #301) | Diff `plans/approved/release-v0.5.0.md` against `plans/release-v0.5.0.md`, keep the more complete content in the canonical `plans/` file (preserve Document History); determine the correct status for `plan-ui-layout-refactor-...` (it has `approved: true` + completed dependency — likely draft or approved, NOT default-cancel) and fix `implement-consumed-issues-visibility.md`'s invalid `status: proposed`. Also correct docs/roadmap.md's stale entry listing completed webui-write-integrity as in-progress (current data bug; W5 later regenerates the file). Frontmatter mutations via write_plan/set_plan_field; **file deletions/moves are human-executed git operations reviewed in the wave PR** (no MCP tool deletes files). Done when: get_status shows no undefined **or invalid** statuses and `plans/approved/` is gone | ⏳ Pending |
| 3 | W0: Remove nested proposals/approved/approved/ (bug #302) | The stray file is `release-v0.5.0.md` — a *plan*, same incident as #301: triage its content against step 2's merge before deleting; then remove the directory (human-executed git rm, reviewed in the wave PR). Add a placement check to `scripts/pre-commit.sh` (extend `validate_location_invariant`, ~lines 267–288) as an **allowlist** (only `proposals/` and `proposals/approved/` are legal). Done when: directory gone, allowlist check rejects a test subdir | ⏳ Pending |
| 4 | W0: Fix phase-close.ts parsing (bug #303) | Replace the `raw.includes('status: completed')` grep in `findPhasePlans` (phase-close.ts — line 46 today; anchor by function name, not line) with frontmatter parsing, and verify steps are done by reusing `countSteps` from `src/dispatch/completion-gate.ts` (works on the current table format; W1's reader cutover in step 12 upgrades it transparently). Extract `findPhasePlans` into a testable export — the script currently has no tests. Done when: unit tests reject both the prose false-positive case and the pending-steps case | ⏳ Pending |
| 5 | W0: Fix step-table pipe corruption (bugs #272, #318) | `issues/bug-mcp-updatestep-appendhistory-corrupt-table-rows-wh.md` — update_step/append_history corrupt rows whose cells contain escaped pipe characters. Same defect class in a second path: plan-review `extractSteps` (src/webui/src/lib/server/plan-review-live.ts, and the legacy /api/plan-review parser) truncates piped cells, feeding reviewers cut-off prompts (issues/bug-plan-review-extractsteps-splits-table-rows-on-raw-.md, observed on this plan 2026-07-10). Fix with one shared escape-aware row parser. This sits directly under W1's migration path. Done when: regression test with piped content in Action/Details cells passes on update_step, append_history, and buildReviewPrompts | ⏳ Pending |
| 6 | W1: Write task sizing policy atom | New `policies/core/task-sizing.md`: every step completable in one focused session, requires non-empty Action + Done-when, cross-cutting decisions pinned before execution, split-don't-sprawl, **plus an explicit escape clause for sanctioned oversized steps (must be marked in the plan and justified)** — steps 7 and 10 of this plan are its first uses. Done when: policy file exists; the plan-template reference to it is explicitly step 11's scope (assigned there, not here) | ⏳ Pending |
| 7 | W1: Structured steps schema + dual-write | **Sanctioned 2-session exception to task sizing (marked per step 6's escape clause).** Implement the core of [[proposals/plan-steps-structured-frontmatter.md]] (consumed above): define the `steps:` YAML schema **including a `done_when` field** and precedence rule — `steps:` is authoritative for plans without tracked issues; when `tracked_by:` issues exist, step status derives from issues (per the shipped collaboration model) and each step carries an `issue:` backlink reusing `src/mcp/tools/step_issues.ts`. write_plan/update_step dual-write the YAML mirror alongside the table; **the table stays authoritative until step 12**. Add structural validation to `policies/frontmatter-validate/check.ts` (today it checks field presence only) and its `scripts/pre-commit.sh` mirror; verify `parseFrontmatter` (src/dispatch/frontmatter.ts) returns `steps:` as a structured object, not a raw string. Done when: source proposal is approved under proposals/approved/; a sample plan round-trips through write_plan/update_step with table and YAML in sync; a structurally invalid `steps:` block fails both validators | ⏳ Pending |
| 8 | W1: Enforce step shape in write_plan + update_step | Depends on step 7's schema (the legacy table has no Done-when column). Extend `hasPlaceholderSteps` (src/mcp/lib/steps.ts): write_plan rejects steps missing Action or done_when; update_step refuses to mark done a step with empty fields. Done when: a deliberately malformed step returns a validation error naming the offending step | ⏳ Pending |
| 9 | W1: Fix mode-field at the root cause | The automated→mode migration already ran once (commit e4a13fb) and **regressed** because emitters still write the legacy field. Implement [[proposals/plan-execution-mode-rename.md]] (consumed above) by closing the root cause. **Scope: the `automated:`→`mode:` rename only** — legacy *table-format* emitters are step 11's scope (explicit handoff). Emitter inventory for THIS step: `src/mcp/tools/transitions.ts:185` (hardcodes `automated: guided`), Web UI plan generators, and the plan template; activate the dead mode/automated branch in `policies/frontmatter-validate/check.ts` (add to PLAN_FIELDS). The migration re-run is a **human-run one-off**: the human executes `npm run migrate:mode-field -- --fix` and commits it themselves (recorded Invariant-6 exemption — the script direct-writes plans/, so AI must not run it; contrast step 10, which routes through write_plan). Deprecation posture: **warn until the v0.5.0 milestone closes, then hard-fail**; the flip is filed as a tracked follow-up issue, not left to memory. This plan's own `automated: guided` is the first migration test case. Done when: source proposal approved under proposals/approved/; no emitter in the inventory writes `automated:`; migration run is clean; validator warns on legacy field; hard-fail follow-up issue filed | ⏳ Pending |
| 10 | W1: Migrate active plans to structured steps | **Sanctioned oversized step (step 6 escape clause) — lands as its own PR** so migrations revert independently of W1 code. All active `plans/*.md` with step tables (~12 files; 8 approved/in-progress). **Governance-compliant path:** drive the migration through `write_plan` per plan (no direct-write script — AGENTS.md Invariant 6); a helper may *generate* the new content, but write_plan applies it. `multi-session-work-claiming` migrates last, coordinated with its claimant (it is exempt-active during the freeze). Distinct tooling name — `migrate:plan-steps` already exists and does something unrelated. NOTE: `testing_tier` backfill moved to step 21 (its vocabulary doesn't exist until W4 — backfilling here would invent values). Done when: dry-run diff reviewed for all plans first, then every active plan passes step-7 validation with counters matching | ⏳ Pending |
| 11 | W1: Writers stop emitting legacy step tables | Templates (`src/profiles/docwright-dev/templates/plan.md`), `buildPlanFromSections` (src/mcp/tools/transitions.ts:75–84), Web UI plan-generator + create-plan endpoint, and the apply-review AI prompt (src/webui/.../api/apply-review/+server.ts:162 — literally instructs the model to emit emoji rows). Add the task-sizing policy reference to the plan template (assigned from step 6). Done when: creating a plan via every surface emits YAML steps only, and the template references policies/core/task-sizing.md | ⏳ Pending |
| 12 | W1: Readers cut over with legacy fallback | Switch readers to YAML-first **with legacy table fallback retained for `plans/completed/`** (75 archived plans are never migrated — this preserves the backward-compat guarantee): `src/dispatch/completion-gate.ts`, `src/mcp/lib/steps.ts`, `query.ts` nextAction, `scripts/lifecycle-gate.js`, Web UI `PropertiesPane.svelte` pending-count, **and the frontmatter parsing layer both stacks share (`src/dispatch/frontmatter.ts` — structured `steps:` must surface to every consumer, or all of them silently fall back to table parsing)**. Done when: gate-parity tests pass on both formats and repo grep finds no emoji step tables in active `plans/` or templates (completed/ exempt) | ⏳ Pending |
| 13 | W2: Amend versioning policy (pins three decisions) | Rewrite `policies/core/versioning.md`: MINOR = phase; PATCH = completed-plan count, auto-maintained. **Pin (a) the phase-attribution rule** — `phase:` becomes required plan frontmatter; historical completed plans attributed by completed_date relative to phase-close tags — **(b) tag semantics**: whether each patch bump tags, and what the three deployed instances consume; **(c) monotonicity**: published tags are never re-issued or downgraded — if step 15's derived value is lower than the published version, it takes effect at the next bump with the delta documented. Must land in the same PR as step 14 (policy and code cannot disagree); sync the same claims in CLAUDE.md §Versioning. Human-gated policy change. Done when: amended policy contains all three decisions (grep-verifiable) plus a worked attribution example for one real completed plan, and BDFL sign-off is recorded in this plan's Document History | ⏳ Pending |
| 14 | W2: Auto patch bump staged at completion | Shared dispatch helper bumps VERSION + package.json + src/webui/package.json. Two surfaces (asserted by gate-parity tests): MCP `transitionToCompleted` **stages** the bump — the *human's* completion commit includes it (preserves ai-governance-boundaries rule 5: AI proposes, humans execute governance commits); the Web UI transition endpoint includes it in its existing HUMAN_APPROVED commit. **Concurrency is code-enforced, not documented:** the helper re-reads VERSION at completion time and uses the `completed_version:` stamp on the plan to detect a concurrent bump, refusing with a re-run instruction (multi-session-work-claiming runs during this window — a race is realistic, not theoretical). Done when: completing a mock plan on each surface yields exactly one bump; re-run refuses; simulated concurrent completion refuses with the documented error | ⏳ Pending |
| 15 | W2: One-time version reconciliation (bug #300) | **May run post-freeze** (data-only; changes no shared convention). Snapshot VERSION at execution start — 0.4.12 at last plan revision; do not hardcode. Apply step 13's attribution rule: backfill `phase:` on completed plans per the pinned rule **and on active plans** (step 13 makes the field required — without the active-plan backfill every plan fails validation the moment enforcement lands), derive the correct version, BDFL confirms, single commit documents the derivation and the snapshot → corrected-value rationale (respecting decision (c) monotonicity). Coordinate with the three deployed instances (dogfood/csdocs/cs-erp-images) and release notes. Done when: derivation script output matches VERSION (or the documented next-bump delta per decision (c)) and the BDFL-confirmed commit lands | ⏳ Pending |
| 16 | W3: Finish lifecycle-gates step 1 (AI gate preparation) | The one remaining step of the approved `lifecycle-gates` plan, now unblocked (its promote.ts dependency shipped): wire the AI readiness summary into `src/dispatch/promote.ts` + profile `opencode-instructions.md`, using the `ai_pre_review_prompt` already defined on the `phase-complete` gate. This IS the "AI scaffolds, human signs" behavior W3 needs. Done when: lifecycle-gates plan completes through its own lifecycle | ⏳ Pending |
| 17 | W3: Proof-of-life template as gate evidence | `docs/validation/TEMPLATE-proof-of-life.md` (lilyetibot-adapted: pre-validation checklist, demonstrable steps with expected/actual, blocker-vs-deferred triage table). **Sign-off is NOT a bespoke checkbox** — it is `gate_status: approved` frontmatter on the validation doc, evaluated by the existing `gates.ts` engine (quorum-capable). Protection stated honestly: the MCP mutation guard and the PreToolUse hook cover MCP/Write/Edit paths only — a Bash write bypasses both (AGENTS.md Invariant 6 names this vector); **the load-bearing layer is pre-commit**, which validates governance-field changes at commit time regardless of how the file was written. Convention: the phase plan's `assigned_to` human signs. Done when: template exists, AGENTS.md points to it, an AI attempt to set gate_status via MCP/Write/Edit is blocked, and a direct-write attempt is caught at commit by pre-commit | ⏳ Pending |
| 18 | W3: Define proof-of-life demos for Phases 4 + 5 | Via write_plan, each phase plan gains a "Proof of Life" section: what will be demonstrated, by whom, evidence artifact path (`docs/validation/phase-N-proof-of-life.md`). Done when: both phase plans state demo, validator, and artifact path | ⏳ Pending |
| 19 | W3: Gate phase-close on the existing phase-complete gate | `phase-close.ts` calls `evaluateGate()` on the `phase-complete` gate (org-operations profile) and requires the signed-off validation doc; verify the sign-off commit is human-authored with the HUMAN_APPROVED marker — **the git check must accept both surfaces' forms** (Web UI writes a `HUMAN_APPROVED: 1` trailer via git-commit.ts; a CLI human commit signals via the env var the hook checks, so the check specifies exactly what artifact each path leaves) — as defense-in-depth; the pre-commit phase-review gate (`validate_phase_review_gate`, pre-commit.sh:~425) remains the second layer. Update `policies/core/ai-governance-boundaries.md` with one paragraph extending rule 3 to validation docs — **AI drafts the amendment; it lands only via a human-approved commit** (rule 5 applies to boundary-policy changes themselves). Done when: a test close without gate approval fails naming the gate; with approval succeeds; the policy amendment is committed by the human | ⏳ Pending |
| 20 | W4: Document testing tiers | `docs/testing-tiers.md`: tier 1 automated (unit + CI), tier 2 semi-automated (dogfood instance smoke, :5273), tier 3 manual UI checklists (`ui-test-before-submit`). Done when: SOP exists and the plan template's Testing Plan section asks which tiers apply | ⏳ Pending |
| 21 | W4: Require tier declaration per plan | Add `testing_tier` (list) to PLAN_FIELDS in `policies/frontmatter-validate/check.ts` **and its mirror in scripts/pre-commit.sh** (dual-maintenance trap is documented in check.ts's header). **Owns the backfill** (moved from step 10): a second small write_plan pass stamps `testing_tier` on the ~12 active plans using step 20's vocabulary, before enforcement flips on. Done when: backfill pass complete; a plan without the field fails both validators | ⏳ Pending |
| 22 | W4: Tighten the existing completion test gate | The gate already blocks completion without `tests_last_result: pass` (completion-gate.ts:132–138). Close its two real holes: `verify_tests.ts` stamps the **script name** (a narrow test:dispatch run must not satisfy a full-suite requirement) and the staleness-vs-HEAD check (transitions.ts:237–248) is promoted from warn to hard-fail. Document the escape hatch for infrastructure-caused failures (human re-runs verify_plan_tests). CI-status-on-PR integration is out of scope — captured as a deferred proposal. Done when: a stale or narrow-scope test run blocks completion with an actionable error | ⏳ Pending |
| 23 | W5: Draft living-roadmap spec | BDFL-reviewed spec for `docs/roadmap.md`. Must explicitly **preserve or supersede the two-axis model** (milestone = release bucket, phase = versioning backbone — currently "don't conflate them", and `milestone:` frontmatter mirrors to GitHub milestones per the shipped collaboration model); if superseding, do it via a `decision` document and update the GH milestone mirror mapping in the same change. Current-position banner lives in a **second generated marker zone** (never hand-maintained). Reuse `src/dispatch/roadplan.ts`; prior art in completed roadplan-view and enhance-roadplan plans. Done when: BDFL accepts the spec including the axis decision | ⏳ Pending |
| 24 | W5: Extend renderer + drift guard | Extend roadplan.ts/generate-roadplan.ts for per-step state (reads step-7 YAML) and the banner zone. **Regeneration + CI fully specified:** pre-commit regenerates when frontmatter changes; the drift job (consumes the already-filed issue `roadplan-cli-add-check-drift-guard-fail-ci-if-docs`) runs `roadplan --check` on every PR **and** push to main, is a **required status check**, and hard-fails on drift — per that issue's acceptance criteria. Done when: CI drift job green and required; regenerating after any plan mutation produces zero diff | ⏳ Pending |
| 25 | W5: Migrate docs/roadmap.md to the new format | Rewrite per the accepted spec, preserving the dependency graph, moving locked decisions into Pinned Decisions. Done when: the roadmap alone answers "current version / active plan / next task" correctly against get_status | ⏳ Pending |
| 26 | W5: next_action phase gate | Narrow scope: `nextAction()` (src/mcp/tools/query.ts:325) refuses plans whose `phase:` exceeds the current phase (derived from VERSION), naming the gate; **plans without `phase:` pass with a logged warning** (defined behavior — step 15's backfill makes this rare, not load-bearing). The rest of [[proposals/formalize-roadmap-sequencing-enforcement.md]] (DAG parser, get_roadmap_status tool, Web UI graying, pre-commit roadmap linter) is **captured as a deferred follow-up proposal** per capture-deferred-ideas — not silently dropped. Done when: source proposal approved under proposals/approved/; a test asks next_action for a phase-gated plan and is refused with the gate named; a no-phase plan passes with the warning; the deferred proposal file exists in proposals/ with related_to pointing at this plan | ⏳ Pending |
| 27 | W6: AGENTS.md status header | Bounded generated zone (`<!-- START/END_STATUS -->`) at the top of AGENTS.md: current version, done / in-progress / next, reading order. Regenerated by `session:end` and pre-commit. Staleness defined as **consistency**, not freshness: CI checks header version == VERSION and active plan == get_status (a freshness check would flake on every mutation). **Prerequisite with a decision rule:** the two open end-session protected-main bugs are this step's direct blockers and are fixed as its FIRST action (recorded bugs-before-features exception: they gate only this step's regen path, no earlier wave touches session:end); if they prove unfixable in-session, halt this step and file a follow-up plan — do NOT ship an ephemeral no-commit regen that cannot satisfy the Done-when. Done when: both end-session bugs closed; session:end refreshes the zone; the CI consistency check passes | ⏳ Pending |
| 28 | W6: Fresh-agent verification run | Cold-start an agent with only AGENTS.md. **Snapshot the expected answers first** (current VERSION, active plan, next pending step — recorded in the evidence doc before the run) so "correct" is checkable, not vibes. Criterion is **correctness from AGENTS.md alone** — transcript shows no other files read before the agent states all three snapshot values correctly on first response; under two minutes as a soft target. Evidence artifact: `docs/validation/fresh-agent-run-<date>.md` (transcript + snapshot), referenced in this plan's completion evidence | ⏳ Pending |

## Testing Plan

Tiers covered: tier 1 (automated) for all tooling/gate changes; tier 2 (dogfood
smoke on :5273) for the W2 staged bump and W5 renderer before their PRs merge;
tier 3 (manual) for the fresh-agent run and BDFL spec/policy reviews.

New test targets per wave: `test/scripts/phase-close.test.ts` (steps 4, 19), pipe-corruption regression in `test/mcp/steps.test.ts` + plan-review parser (step 5), structural-steps cases in frontmatter-validate + `test/mcp/steps.test.ts` (steps 7–8), migration dry-run diff review (step 10), format-parity additions to `test/integration/gate-parity.test.ts` (steps 12, 14), bump idempotency **and concurrent-completion refusal** in `test/mcp/transitions` (step 14), gate tests for verify_tests scope/staleness (step 22), CI drift job (step 24), AGENTS.md consistency check (step 27).

### Step Verification

- [ ] **W0 bugs** — greps/gets confirm: no `develop` in versioning policy; critique-plan.js resolves approved-dir proposal_source; no undefined or invalid plan statuses; no stray directories (allowlist check proves it); phase-close unit tests reject prose false-positive and pending-steps cases; piped-cell regression test passes on MCP tools and review parser
- [ ] **W1 structured steps** — dual-write keeps table and YAML in sync; malformed steps rejected naming the step; no emitter writes legacy formats; readers pass gate-parity on both formats; legacy fallback covers plans/completed/ untouched
- [ ] **W2 version linkage** — one bump per completion on both surfaces, idempotent, concurrent-refusal proven; MCP path stages (human commit includes), Web UI path commits with HUMAN_APPROVED; derivation script matches VERSION after reconciliation
- [ ] **W3 proof-of-life** — phase-close without gate approval fails naming the `phase-complete` gate; AI attempts to set the validation doc's gate_status are blocked on MCP/Write/Edit paths and caught by pre-commit on direct-write paths; lifecycle-gates plan itself completes
- [ ] **W4 regression rule** — stale or narrow-scope test evidence blocks completion; `testing_tier` enforced by both validators after the step-21 backfill
- [ ] **W5 roadmap** — CI drift job green, required, across plan mutations; next_action refuses phase-gated plans and warns on no-phase plans; deferred follow-up proposal exists
- [ ] **W6 fresh-agent** — transcript-verified against the pre-run snapshot: correct answers from AGENTS.md alone

### Integration & Regression

- [ ] `npm test` full suite green; `npm run test:dispatch` proves no VS Code API leakage
- [ ] Existing lifecycle transitions (approved → in-progress → completed, and canceled) work end-to-end on both MCP and Web UI surfaces
- [ ] MCP tools remain backward-compatible with `plans/completed/` archives via the legacy read fallback (step 12) — completed plans are never migrated
- [ ] Pre-commit hook still enforces frontmatter validation on all document types

### Gate Criteria

- [ ] All 28 steps done with verification evidence recorded
- [ ] Full test suite green on the completion PR
- [ ] One end-to-end dry run of a phase close exercises the phase-complete gate, staged version bump, and tightened test gate together
- [ ] Bugs #299–#304 plus the two pipe-corruption bugs (#272, #318) closed (bugs-before-features gate satisfied); the two end-session bugs closed by step 27
- [ ] BDFL sign-offs recorded: roadmap spec (step 23), versioning policy + reconciliation (steps 13, 15), boundary-policy amendment (step 19), in-flight dispositions and consumed proposals (at approval)
- [ ] Deferred ideas captured as proposals (step 22 CI-on-PR, step 26 roadmap-linter remainder, step 9 hard-fail flip issue)

## Rollback Procedures

Waves are an **ordering** boundary; PRs may be finer-grained where that
strengthens rollback — step 10's migration ships as its own PR precisely so
reverting W1 code never has to fight post-freeze mutations of migrated plan
files. Each PR to `main` remains independently revertible.

| Scenario | Rollback |
|----------|----------|
| W1 validation rejects legitimately valid plans | Feature-flag strict validation off; fix schema; re-enable after all active plans pass |
| W1 migration corrupts an active plan | write_plan-applied changes are individually committed; restore the file from git history and re-apply; plans/completed/ is never touched |
| W1 reader cutover breaks completed-plan reads | Legacy fallback is retained by design; if the fallback itself regresses, revert step 12's PR — writers (step 11) can stay switched |
| W2 staged bump mis-counts or double-bumps | Revert the dispatch helper; correct VERSION/package.json in one human commit; re-land with the idempotency test strengthened |
| W2/W3 phase-close gating blocks a legitimate close | The gate engine's existing waiver path (`gate_status: waived`, human-only) is the escape hatch — no new override mechanism |
| W5 renderer emits wrong state | Revert docs/roadmap.md to last-good; generated zones are rebuildable from frontmatter, never hand-fixed in place |
| W5 next_action gate wrongly refuses work | Config-disable the phase-gate check; correct phase data; re-enable |
| Any wave destabilizes main during the freeze | Revert the offending PR(s); ordering is preserved because later waves haven't started |

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Active plans break under new step validation before migration completes | High | High | Step 10 migrates before step 11/12 flip writers/readers; enforcement behind a config flag until migration verified |
| phase-close.ts changes regress the close workflow | Medium | High | Steps 4 and 19 both touch it — sequenced, shared test fixtures land in step 4 first |
| Dual-write (step 7) lets table and YAML drift before cutover | Medium | Medium | Dual-write is tool-enforced (single code path writes both); parity asserted in tests; window is bounded to W1 |
| Concurrent plan completions race the version bump | Medium | Medium | Step 14 enforces refusal in code (completed_version stamp + VERSION re-read), not documentation |
| Version reconciliation confuses downstream instances tracking releases | Medium | Medium | Step 13 pins tag semantics + monotonicity first; step 15 coordinates dogfood/csdocs/cs-erp-images with release notes |
| Proof-of-life sign-off becomes a bottleneck | Medium | Medium | Reused gate engine supports quorum + waiver; only phase closes are gated, not plan completions |
| BDFL gate stalls freeze the org | Medium | Medium | Freeze exit = step 14 merged (mechanical); step 15 runs post-freeze; >5-day BDFL stalls pause only dependent steps |
| Freeze drags | Medium | Medium | Freeze bounded to W0–W2 (~15 sessions); W3–W6 run as normal trunk work; task-sizing rule applies to this plan itself |
| Contributor confusion during convention transition | Low | Low | Warn-first posture until v0.5.0 closes (step 9), before/after examples in CHANGELOG entry |

## Critical Review

### Cycle 1 — 2026-07-10 (pre-revision)

Four-reviewer cycle run per `/critique-plan` (multi-perspective-review policy): adversarial critic (Claude), codebase-feasibility reviewer (Claude), governance-consistency reviewer (Claude), BigPickle via opencode (model diversity). Findings and dispositions:

| # | Finding (severity) | Resolution |
|---|---|---|
| 1 | 🚫 Wave 3 rebuilt a gate mechanism that already exists 80%-shipped (gates.ts, promote.ts, phase-complete profile gate, pre-commit phase gate; lifecycle-gates plan 4/5) | **Accepted.** W3 rewritten to reuse the gate engine; sign-off = gate_status via existing protections; lifecycle-gates' last step absorbed as step 16 |
| 2 | 🚫 Steps implemented three `approved: false` proposals | **Accepted.** "Consumed proposals" section added; this plan is the approval vehicle, BDFL ratifies at approval; sequencing proposal consumed partially with remainder deferred |
| 3 | 🚫 Step 10 (retire legacy parsers) contradicted the backward-compat promise for 75 completed plans | **Accepted.** Split into writers-stop (11) / readers-cutover-with-legacy-fallback (12); completed/ never migrated; grep gate scoped to active plans + templates |
| 4 | 🚫 No disposition for five in-flight plans; release-v0.5.0 and live-ai both mutate VERSION | **Accepted.** Disposition table added; freeze bounded to W0–W2 |
| 5 | ⚠️ W1 keystone step underestimated (15+ files, 5 surfaces incl. Web UI executor + AI prompts) | **Accepted.** Step 5 rescoped to schema+dual-write; consumer cutover split across steps 11–12 with explicit file lists |
| 6 | ⚠️ Mode-field migration already ran and regressed via hardcoded emitter (transitions.ts:186); migrate-mode-field.ts + linter warn logic already exist | **Accepted.** Step 9 rewritten around root cause (emitters + dead validator branch), reusing existing script |
| 7 | ⚠️ Auto version bump "in the completion commit" conflicted with ai-governance rule 5 (AI must not author governance commits) and the MCP path creates no commit at all | **Accepted.** Step 14: MCP stages, human commit includes; Web UI path uses its existing HUMAN_APPROVED commit |
| 8 | ⚠️ Step 13's version derivation untestable — only 34/75 completed plans carry `phase:`, zero phase-4 completions | **Accepted.** Step 13 pins the attribution rule first; step 15 backfills then derives |
| 9 | ⚠️ W5 silently conflated the deliberate milestone-vs-phase two-axis model (and its GitHub milestone mirror) | **Accepted.** Step 23 must preserve or explicitly supersede via decision doc |
| 10 | ⚠️ Completion test gate already exists (tests_last_result: pass enforced); real holes are script-name stamping and warn-only staleness | **Accepted.** Step 22 rewritten to tighten, not rebuild; CI-on-PR deferred as captured proposal |
| 11 | ⚠️ Steps: source-of-truth collided with shipped collaboration model (issues own execution state via tracked_by) | **Accepted.** Step 7 defines precedence: issues win when present, steps: otherwise, with issue backlinks |
| 12 | ⚠️ Migration script would violate the direct-write prohibition this plan strengthens | **Accepted.** Step 10 routes through write_plan |
| 13 | ⚠️ BigPickle: step 4 circular (verifies steps before YAML exists) | **Partially refuted:** `countSteps` in dispatch/completion-gate.ts parses the current table format today — step 4 reuses it; reader upgrade in step 12 is transparent. Wording clarified |
| 14 | 📝 Region-level hook blocking doesn't match file-level hook architecture; hook covers only Write/Edit | **Accepted (evaporated):** sign-off state moved to frontmatter gate_status, already protected; no region blocking needed |
| 15 | 📝 Related open bugs in this plan's path: step-table pipe corruption (high), end-session protected-main pushes | **Accepted.** Pipe bug added as step 5 (W0); end-session bugs made prerequisite of step 27 |
| 16 | 📝 Critique tooling can't resolve proposal_source under proposals/approved/ | **Filed** as bug #304 via capture_bug_report |
| 17 | 📝 Plan's own frontmatter lacked phase/milestone and carries legacy `automated:` | **Accepted:** phase: 4 + milestone: v0.5.0 set; `automated:` deliberately retained as step 9's first migration test case |

### Cycle 2 — 2026-07-10 evening (pre-approval, BDFL-requested)

Second four-perspective cycle: codebase-feasibility review (Claude Fable 5 agent — ~55 claims re-verified against post-#305/#307 main), adversarial governance review (Claude Fable 5 agent), BigPickle via opencode (model diversity, 17 findings), plus triage of the recovered in-UI step review (whose own truncation artifacts exposed bug #318). Condensed findings and dispositions — all applied in this revision:

| # | Finding (severity) | Resolution |
|---|---|---|
| 1 | 🚫 Uncommitted working-tree drift after cycle 1: `automated:` had escalated guided→full (unreviewed — the Web UI approve flow's doing), invalidating step 9's text and finding 17, and semantically wrong for a plan with BDFL-gated steps | **Accepted.** Reverted to `guided`; near-miss recorded here; BDFL may deliberately choose `full` (then `scenario_synthesis` review applies) |
| 2 | 🚫 Consumed-proposal ratification relied on memory — the three proposals sat untouched at `approved: false` with nothing enforcing the approval-time flip | **Accepted.** Mechanics checklist added to the Consumed Proposals section; steps 7/9/26 gained Done-when preconditions that their source proposal is approved |
| 3 | 🚫 Step 9 mandated a direct-write migration script while step 10 forbade one (Invariant 6 contradiction) | **Accepted.** Step 9 declares the re-run a human-executed one-off with the exemption recorded; scope split vs step 11 made explicit |
| 4 | 🚫 Gate criteria required closing #304 but no step delivered it | **Accepted.** #304 folded into step 1 (both are small tooling fixes) |
| 5 | 🚫 `testing_tier` backfill (step 10, W1) preceded the tier vocabulary (W4) — executors would invent values | **Accepted.** Backfill moved to step 21, which owns a small second write_plan pass |
| 6 | ⚠️ No `phase:` backfill for ACTIVE plans (step 13 makes it required; only 1 active plan carries it) and step 26 had undefined no-phase behavior | **Accepted.** Step 15 backfills active plans too; step 26: no-phase passes with a logged warning |
| 7 | ⚠️ Freeze exit hostage to BDFL availability + external soak, no stall path; freeze also unenforced (code-over-memory) | **Accepted.** Freeze exit = step 14 merged; step 15 may run post-freeze; >5-day BDFL stalls pause only dependents; procedural-freeze exception recorded explicitly |
| 8 | ⚠️ Step 14 "document single-completion-at-a-time" was documentation-only race handling while multi-session-work-claiming runs concurrently | **Accepted.** Concurrency refusal is now code-enforced (VERSION re-read + completed_version stamp) with a test |
| 9 | ⚠️ multi-session-work-claiming exemption races W0/W1 (pipe bug live; step 10 rewrites its plan mid-execution) | **Accepted.** Exemption conditioned: starts after step 5; migrated last, coordinated with claimant |
| 10 | ⚠️ Steps 2/3 required file deletions with no sanctioned mechanism named | **Accepted.** Deletions/moves are human-executed git operations reviewed in the wave PR |
| 11 | ⚠️ Wave-sized PRs undermined the revert story (post-freeze mutations of migrated plans conflict with a W1 revert) | **Accepted.** Waves = ordering boundary; step 10 ships as its own PR; rollback table updated |
| 12 | ⚠️ "Warn for one release cycle" undefined under the new semantics; hard-fail flip unscheduled | **Accepted.** Warn until v0.5.0 milestone closes; flip filed as tracked issue in step 9's Done-when |
| 13 | ⚠️ Step 15 had no answer for a derived version LOWER than the published tag | **Accepted.** Step 13 pins decision (c) monotonicity; step 15 respects it |
| 14 | ⚠️ Steps 7/10 violate the one-session rule the plan introduces | **Accepted.** Both marked as sanctioned exceptions; step 6's policy atom must define the escape clause they use |
| 15 | ⚠️ Step 27 buried two open protected-main bugfixes in W6 (bugs-before-features tension) + no decision rule between its two paths | **Accepted.** Recorded exception (they gate only step 27's path); fixed as the step's first action; halt-and-file rule replaces the ephemeral no-commit option |
| 16 | ⚠️ Step 12's reader list omitted the shared frontmatter parsing layer; step 19's HUMAN_APPROVED check would fail every MCP-path completion; step 17 claimed three-layer protection where Bash bypasses two; step 24's CI job had no trigger/required/failure spec; step 13/28 Done-whens untestable | **Accepted.** All five steps rewritten: parsing layer added (12); dual-surface git check specified (19); honest layer statement — pre-commit is load-bearing (17); CI spec pinned to the filed issue's criteria (24); grep-verifiable policy decisions + pre-run answer snapshot (13, 28) |
| 17 | 📝 Stale figures: VERSION now 0.4.12 (v0.4.12 shipped mid-cycle), step 10 count is ~12 not ~15, pre-commit placement code is `validate_location_invariant` :267–288, phase gate at :425; new in-flight plan `image-based-deployment-any-directory` undispositioned | **Accepted.** All corrected; step 15 snapshots VERSION at execution; new plan added to disposition table |
| 18 | 📝 Step review tooling truncated its own inputs (escaped pipe in step 5's cell cut the prompt — same class as #272 in a second path; section excerpts sliced to 150–500 chars read as "truncated content") | **Filed** as bug #318 via capture_bug_report (GH-mirrored) and folded into step 5's scope (shared escape-aware parser) |
| 19 | 📝 Wave objectives, intra-wave ordering/parallelism, and the BDFL-gate inventory were unstated (also the recovered review's main valid findings) | **Accepted.** Wave objectives table, execution-order column, and BDFL gate inventory + stall path added to Overview |

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-07-10 | Created from approved proposal | NetYeti |
| 2026-07-10 | Steps restructured into waves W0–W6: bugs first, structured steps before roadmap renderer; Done-when added to every step | NetYeti@phoenix (agent-drafted, guided mode) |
| 2026-07-10 | Rewritten after four-reviewer critique cycle: W3 reuses existing gate engine instead of rebuilding; consumed-proposals + in-flight-disposition sections added; freeze bounded to W0–W2; steps 5/10 split, 8/12/13/20/24 rewritten to reuse existing machinery; Critical Review section added (17 findings, dispositions recorded) | NetYeti@phoenix (agent-drafted, guided mode) |
| 2026-07-10 | Second critique cycle (BDFL-requested, pre-approval): 19 condensed findings applied — automated: reverted to guided after unreviewed escalation; consumed-proposal mechanics made explicit with Done-when preconditions; step 9/10 Invariant-6 contradiction resolved; testing_tier backfill moved to step 21; freeze exit made mechanical (step 14 merge); step 14 concurrency code-enforced; wave objectives + BDFL gate inventory added; stale figures corrected (VERSION 0.4.12, ~12 plans); scenario_synthesis added; bug #318 filed | NetYeti@phoenix (agent-drafted, guided mode) |

---
⚠ **Governance:** mutate this plan via MCP only — update_step · update_plan_status · append_history · set_plan_field · write_plan. Direct writes to `plans/*.md` are blocked by the PreToolUse hook. Bash/Python writes bypass the hook and are equally prohibited (AGENTS.md §Invariant 6). If MCP is unavailable: halt and report, do not fall back to direct writes.