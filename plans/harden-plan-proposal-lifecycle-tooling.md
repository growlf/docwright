---
title: Harden AI-agent plan/proposal lifecycle tooling
status: in-progress
author: NetYeti
created: 2026-07-11
tags:
  - lifecycle
  - mcp
  - webui
  - tooling
proposal_source: proposals/harden-plan-proposal-lifecycle-tooling.md
priority: high
complexity: medium
automated: full
assigned_to: NetYeti
tests_defined: true
tests_human_reviewed: false
scenario_synthesis: "Root cause across all items: the MCP tools and their Web-UI counterparts drifted apart, each implementing partial/divergent lifecycle logic, and gates report success while silently doing the wrong thing. Happy path after this plan: a plan taken through the Web UI (Run Tests -> Certify -> Complete) records real evidence and archives correctly; approving a proposal produces exactly one plan at the correct path; the PreToolUse/pre-commit gates actually enforce (block the write, check only frontmatter); end-session is not bricked by unrelated working-tree debt; runtime-verified plans can be certified; live plan-review signals completion deterministically. Failure paths: each gate refuses loudly with the reason, never a silent no-op. Fix pattern: extract shared TypeScript functions used by BOTH the MCP tool and the Web-UI route (code-over-memory), never reimplement per surface."
total_steps: 11
completed_steps: 3
---

# Harden AI-agent plan/proposal lifecycle tooling

## Overview

A cluster of lifecycle-tooling bugs share one root cause: the **MCP tools and their
Web-UI counterparts have drifted apart** — each side implements partial or divergent
logic, and several gates *report success while silently doing the wrong thing or
corrupting state*. Fix pattern throughout: factor the real logic into a **shared
function both surfaces import** (per [[policies/core/code-over-memory]]), never a
second reimplementation. Full rationale + alternatives:
[[proposals/harden-plan-proposal-lifecycle-tooling]].

Three items were already delivered earlier this session (2026-07-11) and are marked
Done below with their PRs; the rest are the remaining work.

## Constraints & Invariants (read before executing ANY step)

1. **Shared-function principle.** For every fix that touches both an MCP tool and a
   Web-UI route, extract ONE TypeScript function (ideally in `src/dispatch/`, the
   surface-agnostic layer) and have both call it. Do NOT reimplement per surface —
   that drift is the root cause. Add a test that exercises the MCP + Web-UI paths
   agree.
2. **Gates must enforce, not narrate.** A gate that reports "blocked" must actually
   prevent the mutation; a gate that reports success must have done the work.
3. **Plan mutations via MCP tools only** (`update_step`/`update_plan_status`/
   `append_history`/`set_plan_field`/`write_plan`); direct writes to `plans/*.md`
   are blocked. Keep history text pipe-free.
4. **Git flow:** each step (or coherent sub-cluster) on a `fix/<slug>` branch off
   `main`, PR to `main`, CI green before the next; governance-state commits are the
   human's to attest (do NOT self-attest HUMAN_APPROVED).
5. **Verify by running the real surface** (MCP tool call, Web-UI endpoint, or the
   pre-commit/PreToolUse hook), not by reading the code.

## Implementation Steps

| # | Action | Details | Status |
| --- | --- | --- | --- |
| 1.0 | update_step pipe corruption | DONE 2026-07-11 (PR #325). Made the shared `splitTableRow` (`src/dispatch/completion-gate.ts`) backtick-and-escape aware so a raw `\|` inside a code span in a Details cell no longer desyncs the row; regression test `test/dispatch/table-row-pipes.test.ts`. The `tests_defined` flip was confirmed intended (update_step resets certification on step edits), not corruption. | ✅ Done |
| 1.1 | Web UI Run Tests persists evidence | DONE 2026-07-11 (PR #324). `/api/lifecycle/run-tests` now records `tests_last_run/result/commit` via the shared `dispatch/setFrontmatterField` (same fields the MCP `verify_plan_tests` writes), so the UI Run Tests satisfies the completion gate. | ✅ Done |
| 1.2 | Web UI Complete archives | DONE 2026-07-11 (PR #324). `completePlan()` sets `status: completed` then calls `/api/lifecycle/transition-completed` (move + doc + commit), surfaces gate refusals as a toast, and navigates to `/status`. | ✅ Done |
| 2.1 | Proposal→plan transition: stop `approved/` double-nesting | In the approve/transition path-construction (grep the transition + approve code for where the destination path is built: `grep -rn "approved" src/mcp/tools/transitions.ts src/dispatch/vault-write.ts src/webui/src/routes/api/approve-proposal`), replace any unconditional `+ 'approved/'` concatenation with a check: if the source relative path already contains an `approved/` segment, do NOT add another. Verify: transition a proposal whose path is already `proposals/approved/x.md` (fixture) and assert the result is `proposals/approved/x.md`, never `proposals/approved/approved/x.md`. Add a unit test. | ⏳ Pending |
| 2.2 | Dedupe plan generation (skeleton-orphan) | Approve currently can emit BOTH a thin skeleton plan at `plans/approved/<name>.md` (empty steps) AND a fully-authored `plans/<name>.md`. Find why plan-generation runs twice per transition (`grep -rn "generatePlan\|plan-generator\|write_plan\|plans/approved" src/mcp/tools src/webui/src/routes/api/approve-proposal`) and dedupe to a single invocation producing exactly ONE plan at `plans/<name>.md`. Verify: approving a proposal yields exactly one plan file and no `plans/approved/` skeleton; unit test asserts the file count. | ⏳ Pending |
| 2.3 | Make the approve pipeline idempotent across surfaces | Parallel UI + MCP approval of the same proposal double-nests + duplicates (bug-approve-pipeline-not-idempotent). After 2.1/2.2, make approve idempotent: re-approving an already-approved proposal is a no-op self-heal (already partly done in #216/#222 for consumed_by); extend to path + plan-file idempotency. Verify: approving twice (sequentially, and simulated-concurrent) leaves exactly one correctly-placed proposal + one plan. Integration test. | ⏳ Pending |
| 3.1 | pre-commit `validate_location_invariant`: frontmatter-only | The check greps the WHOLE file for `approved:`, so a plan/proposal whose BODY mentions `approved:` in prose false-triggers. Scope the grep to the YAML frontmatter block only (between the first two `---`). Verify: a doc with `approved:` in its body but not frontmatter passes; a real frontmatter `approved: true` in the wrong location still fails. Hook test under `test/hooks/`. | ⏳ Pending |
| 3.2 | PreToolUse plan-edit gate must actually block the write | The gate reports "block" but the direct edit still persists to disk (bug-pretooluse-plan-edit-lifecycle-gate). Make the PreToolUse hook return the correct non-zero/deny signal so the harness actually prevents the Write/Edit, not just prints a message. Verify: attempt a direct Edit to a `plans/*.md` file → the file on disk is unchanged AND the block is reported. Hook test. | ⏳ Pending |
| 4.1 | end-session not bricked by unrelated validation debt | `session:end` aborts when the working tree has pre-existing UNRELATED validation debt (e.g. another file's invalid frontmatter), silently dropping the session note (bug-end-session-shutdown-bricked). Per the skill's failure-handling: isolate — commit the session note + only the session's own changes, and REPORT unrelated debt rather than aborting the whole shutdown. Verify: with an unrelated invalid file staged-out, `session:end --dry-run` still renders + a real run writes the note. Test under `test/hooks/` or a script test. | ⏳ Pending |
| 4.2 | Completion gate: certify runtime-verified plans + scaffold gate structure | Two coupled fixes (bug-completion-gate-deadlocks-runtime): (a) let a plan declare a verification type (runtime\|unit\|none) so a human can record runtime verification as the gate's test evidence WITHOUT the whole-repo unit suite (or let `verify_plan_tests` accept a runtime attestation), and (b) scaffold the `## Testing Plan` + `## Phase Gate` sections at plan-creation (approve/write_plan) so a plan can never reach all-steps-done yet be uncompletable. Verify: a runtime-verified plan can be completed from the UI with no unit-suite run; a freshly-generated plan already has the gate sections. Tests for the gate + generator. | ⏳ Pending |
| 4.3 | live plan-review: deterministic completion signal | Live plan-review completion is inferred from a fragile idle-count, leaving no reliable done indicator/next-step (bug-live-plan-review-never-signals-completion). Replace idle-count inference with a definitive completion signal from the relay (e.g. the terminal `session.idle` after the final prompt, tracked against the known prompt count) and surface a clear done state + next action in the UI. Verify: drive a live review e2e and confirm the UI shows a definitive "done" exactly once. | ⏳ Pending |

## Testing Plan

Verification is per-surface + runtime (run the MCP tool / Web-UI endpoint / hook),
plus unit/integration tests for each fix. Evidence recorded per step in Document
History.

*   1.0 update_step pipe: `test/dispatch/table-row-pipes.test.ts` (fails on old splitter, passes on fix); full `test:dispatch` green — DONE (#325).
*   1.1/1.2 Web-UI Run-Tests/Complete: logic-verified + compiles into the adapter-node prod build — DONE (#324); full UI click-through to confirm on a deploy.
*   2.1/2.2/2.3 approve/transition: unit + integration tests asserting single correctly-placed proposal + exactly one plan, idempotent under repeat/concurrent approve.
*   3.1/3.2 gates: hook tests — location-invariant checks only frontmatter; PreToolUse plan-edit actually leaves the file unchanged on block.
*   4.1 end-session: a run with unrelated working-tree debt still writes + commits the session note.
*   4.2 completion gate: a runtime-verified plan completes from the UI; a generated plan ships with Testing Plan + Phase Gate sections.
*   4.3 live review: e2e shows a single definitive done signal.
*   Cross-cutting: an integration test that a UI-certified plan is one `transition_to_completed` will accept (guards MCP↔UI drift).

## Phase Gate

*   All step rows complete and verified at their real surface (MCP tool / Web-UI endpoint / hook).
*   The MCP↔Web-UI drift is closed: shared functions, with a test asserting the two paths agree (no reimplementation).
*   Every gate enforces (blocks the mutation / does the work), never a silent no-op.
*   The proposal→plan path can never double-nest or emit a skeleton orphan; approve is idempotent.
*   A runtime-verified plan is completable from the Web UI; generated plans ship with the gate sections.
*   `tests_defined` + human review confirmed; full `test:dispatch`/`test:mcp`/hook suites green.

## Document History

| Date | Change | By |
| --- | --- | --- |
| 2026-07-11 | Drafted from the approved proposal harden-plan-proposal-lifecycle-tooling. Items 1.0-1.2 already delivered this session (PRs #325, #324); 2.1-4.3 remain. Status draft, awaiting BDFL approval. | NetYeti |
