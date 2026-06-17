---
title: Auto plan executor — per-step autonomous execution engine
status: completed
completed_date: 2026-06-09
author: NetYeti
created: 2026-06-09
tags: ""
proposal_source: proposals/approved/auto-plan-executor.md
priority: medium
mode: autonomous
assigned_to: NetYeti
tests_defined: true
tests_human_reviewed: false
scenario_synthesis: Implement core execution engine, parser, and web UI integration; no production data mutation beyond plan files and src/executor directory.
_path: plans/auto-plan-executor.md
total_steps: 9
completed_steps: 9
---

# Auto plan executor — per-step autonomous execution engine

## Overview

_Plan generated from approved proposal: Auto plan executor — per-step autonomous execution engine_

Build an autonomous execution engine that runs plan steps one at a time when a plan is started in `mode: autonomous` (or `automated: full`). The orchestrator reads a plan's Implementation Steps table, spawns a per-step OpenCode session, streams output via SSE, runs verification checks after each step, and marks steps ✅ on success.

### Preconditions

- `proposals/plan-execution-mode-rename.md` must be `approved: true`, OR this plan targets `automated: full` as the trigger field with backward-compatible detection. If the rename proposal has not been approved by the time this plan begins execution, use `automated: full` detection as the primary trigger with a compatibility shim.

### Architecture

```
User clicks Start (mode: autonomous / automated: full)
  → setPlanStatus('in-progress')
  → POST /api/plan-execute (SSE stream)
  → opens Review tab / PlanExecutePanel

Orchestrator (POST /api/plan-execute):
  1. Read plan from filesystem → parse Implementation Steps table
  2. For each ⏳ step:
     a. SSE event: status → "Step N/M: action description"
     b. Create OpenCode session with per-step prompt
     c. Stream session output tokens as SSE log events
     d. After session returns:
        - Run verification checks (files exist, build passes)
        - If pass → write plan file with step ✅
        - SSE event: step_done → "Step N complete"
        - If fail → SSE event: error → abort
  3. All steps ✅ → update_plan_status('completed')
     SSE event: done → "Plan execution complete"
```

## Implementation Steps

| Step | Action | Details | Status |
| --- | --- | --- | --- |
| 1 | Parsing engine — extract steps from plan file | Create `src/executor/plan-parser.ts` that reads a plan markdown file, locates the `## Implementation Steps` section, parses the table rows into structured `{ step_number, action, details, status }` objects. Must handle multi-line action/details cells (pipe-escaped), tables with missing cells (default to empty string), and plans with no Implementation Steps section (return empty array, no crash). **Done when**: Parsing a plan with 3 steps returns 3 objects; parsing a plan with 0 steps returns `[]`; parsing a malformed table returns a descriptive error message; all file I/O wraps errors with the plan filename. | ✅ Done |
| 2 | Orchestrator — SSE endpoint + step loop | Create `src/executor/orchestrator.ts` with a `POST /api/plan-execute` handler that: (a) reads the plan file fresh, (b) skips already-✅ steps, (c) iterates ⏳ steps sequentially, (d) calls `createSession()` for each step, (e) emits SSE events (status, log, step_done, waiting_for_user, error, done) via a Node `EventEmitter` or `AsyncIterator`. Must support concurrent executions for different plan files but reject duplicate execution on the same plan (409 Conflict via an in-memory Map of active plan names). Add `src/executor/index.ts` to register the route. **Done when**: A call with no ⏳ steps immediately emits `done`; a call with 2 ⏳ steps emits 2 `step_done` events; a duplicate call on the same plan returns 409; SSE events are valid `text/event-stream` format per the spec. | ✅ Done |
| 3 | Session lifecycle — OpenCode session per step | In `src/executor/session.ts`, implement `createSession(step, planContext)`: (a) calls `POST /session` to create a session, (b) sends the per-step prompt (plan context, step action/details, execution instructions), (c) reads the response for `STEP DONE`, `WAITING:`, or `STEP FAILED:` markers, (d) streams intermediate tokens as SSE `log` events. Timeout: 300s per step via `AbortController`. On timeout: retry once with a new session; if retry also times out, emit `error`. On `WAITING:`: pause the step loop, emit `waiting_for_user` SSE event, wait for a follow-up message to be posted to the same session, then resume reading. **Done when**: Session creation with a valid prompt returns a stream of tokens followed by `STEP DONE`; timeout triggers exactly one retry then `error`; `WAITING:` pauses and resumes after human input; `STEP FAILED:` emits `error` immediately. | ✅ Done |
| 4 | Verification checks — per-step validation | In `src/executor/verify.ts`, implement `verify(action, details)`: (a) code steps ("create", "implement", "add") — check expected files exist via glob, run `npx tsc --noEmit` or `npm run build` and assert exit code 0; (b) config steps — parse file as JSON/YAML, assert no parse error; (c) doc steps — file exists and is non-empty; (d) test steps — run `npm test <relevant-scope>` and assert exit code 0; (e) fallback — if detection fails, accept human callback via `verify_manual: true` in the plan's frontmatter. All verification runs inside a 60s timeout. On failure: log the verification output to `.docwright/executor-verify-log.md`, signal the orchestrator to re-run the step session once. **Done when**: A code step where the build fails triggers re-run; a code step where the build passes marks ✅; a doc step with missing file triggers failure; a config step with invalid JSON triggers failure; the 60s timeout aborts hanging verification. | ✅ Done |
| 5 | State persistence — crash recovery and idempotency | In `src/executor/state.ts`, implement an ephemeral state store: (a) `acquireLock(planName)` — acquires a file-based lock at `.docwright/executor-locks/<plan-name>.lock` (advisory, `mkdir`-based atomic create), returns false if already held; (b) `writeCheckpoint(planName, stepNumber, sessionId)` — writes to `.docwright/executor-checkpoints/<plan-name>.json` with `{ current_step, session_id, started_at }`; (c) `readCheckpoint(planName)` — reads the checkpoint for resume; (d) `releaseLock(planName)` — removes lock and checkpoint. On orchestrator start: if a checkpoint exists, read the plan fresh (which will show already-✅ steps as ✅) and resume from the last ⏳ step. If the MCP server is unavailable when trying to write step ✅, queue the mutation and retry at 5s intervals for up to 60s before failing. **Done when**: Simulated crash mid-execution → re-running the same plan resumes from the last ⏳ step, not step 1; two concurrent `POST /api/plan-execute` on the same plan — second returns 409; MCP server outage during step-completion queues and retries. | ✅ Done |
| 6 | Web UI — PropertiesPane trigger | Modify `src/components/PropertiesPane.svelte` (or create if absent): when the plan's mode is `autonomous` (or `automated === 'full'`) and Start is clicked: (a) call `setPlanStatus('in-progress')` via the MCP tool, (b) if successful, call `startPlanExecution()` which opens the Review tab or PlanExecutePanel with `{ executionMode: true, planName }`. Add a `mode` indicator badge in the pane: grey=mentor, blue=guided, amber=autonomous. If no PropertiesPane.svelte exists, create the execution trigger in the existing plan toolbar. **Done when**: Clicking Start on a `mode: autonomous` plan triggers SSE call; clicking Start on a `mode: mentor` plan does NOT trigger SSE call; mode indicator badge shows correct colour. | ✅ Done |
| 7 | Web UI — PlanExecutePanel | Create `src/components/PlanExecutePanel.svelte` that renders when `executionMode: true`: (a) progress bar "Step N/M — action description", (b) status badges per step (⏳ pending, ✅ done, ❌ failed), (c) live log area with auto-scroll showing SSE `log` event content, (d) WAITING prompt — when `waiting_for_user` event arrives, show the question text in an input panel with a text field and Submit button; POST the human response back to the orchestrator's follow-up endpoint, (e) error state — show error message with a Retry button that re-POSTs `/api/plan-execute` for the same plan (skipping ✅ steps), (f) completion state — show "Plan complete" banner with link to the archived plan. If the SSE connection drops, show a reconnection notice and auto-retry up to 3 times with exponential backoff (1s, 2s, 4s). **Done when**: Panel renders all states correctly in Storybook or dev server; WAITING prompt accepts input and resumes; error state retry button resumes from failed step; SSE disconnect reconnects within 5s. | ✅ Done |
| 8 | API route registration + integration | Wire the orchestrator into the web UI's HTTP server. Add `src/executor/index.ts` that registers `POST /api/plan-execute` and `POST /api/plan-execute-followup` routes on the same Express/Koa/Polka server used by the web UI. Add `.docwright/` subdirectories: `executor-locks/`, `executor-checkpoints/`. Update CSP headers to allow `text/event-stream` content type. Add `DOCWRIGHT_EXECUTOR_TIMEOUT_SECONDS` env var (default 300) and `DOCWRIGHT_EXECUTOR_MAX_RETRIES` (default 1). Log all step transitions to `.docwright/audit.jsonl` with event type `executor_step_done`. **Done when**: `POST /api/plan-execute` returns SSE stream; `POST /api/plan-execute-followup` accepts `{ planName, sessionId, message }` and delivers the message to the running session; audit log shows executor entries; env var controls timeout and retries. | ✅ Done |
| 9 | Test suite | Write `test/executor/` test files: (a) `plan-parser.test.ts` — parse known-good plan, parse empty table, parse malformed table; (b) `orchestrator.test.ts` — mock session and verify SSE event ordering for 2-step plan, mock failure and verify re-run, mock duplicate and verify 409; (c) `session.test.ts` — mock OpenCode API, verify timeout + retry, verify WAITING flow, verify STEP FAILED flow; (d) `verify.test.ts` — mock filesystem and build commands, verify all detection categories; (e) `state.test.ts` — lock contention, checkpoint write/read, crash resume; (f) `ui.test.ts` — component tests for PlanExecutePanel states (loading, step_done, waiting, error, done) using Vitest + jsdom or Playwright. Add `npm run test:executor` script to root `package.json`. **Done when**: `npm run test:executor` passes all tests; CI pipeline includes the new test script; no regressions in existing tests (`npm run test:dispatch`). | ✅ Done |

## Testing Plan

| Test | Scope | Method |
| --- | --- | --- |
| Plan parser — happy path | `plan-parser.ts` | Parse a fixture plan with 3 standard steps → returns array of 3 objects with correct fields |
| Plan parser — edge cases | `plan-parser.ts` | Empty table → `[]`; malformed table → descriptive error; multi-line cells (pipe-escaped) → correct parsing; no `## Implementation Steps` → `[]` |
| Orchestrator — event ordering | `orchestrator.ts` | Full cycle on a 2-step fixture plan: events emitted in order status, log, step_done, status, log, step_done, done |
| Orchestrator — duplicate reject | `orchestrator.ts` | Concurrent POST on same plan → second call returns 409 |
| Orchestrator — all-done skip | `orchestrator.ts` | Plan with all steps ✅ → immediately emits `done` |
| Session — timeout + retry | `session.ts` | Mock OpenCode endpoint with 310s delay → first session aborts, second session created; if second also times out → error emitted |
| Session — WAITING flow | `session.ts` | Session emits `WAITING: What port?` → orchestrator pauses, emits `waiting_for_user`; follow-up message delivered → session continues, emits STEP DONE |
| Session — STEP FAILED | `session.ts` | Session emits `STEP FAILED: missing dependency` → orchestrator emits `error` with message, does NOT retry |
| Verification — code step | `verify.ts` | Step with action "Create src/foo.ts" → file missing → fail; file exists + build passes → pass |
| Verification — config step | `verify.ts` | Step with action "Configure nginx" → invalid JSON/YAML → fail; valid config → pass |
| Verification — timeout | `verify.ts` | Build command hangs >60s → timeout triggers, returns fail |
| State — lock contention | `state.ts` | Simultaneous `acquireLock` from two callers → one succeeds, one returns false |
| State — crash resume | `state.ts` | Write checkpoint for step 2, simulate crash, read checkpoint → resume from step 2 |
| UI — PlanExecutePanel states | `PlanExecutePanel.svelte` | Render each state: loading (progress bar visible, log empty), step_done (badge flips to ✅), waiting (input field shows question), error (retry button visible), done (completion banner) |
| UI — SSE reconnect | `PlanExecutePanel.svelte` | SSE connection drops → reconnection notice appears; auto-retry succeeds within 5s → normal state resumes; 3 retries fail → error state |
| Integration — end-to-end | All components | Deploy fixture plan, POST `/api/plan-execute`, verify SSE event stream completes, verify plan file has steps ✅, verify audit log entry |
| Integration — mode gate | PropertiesPane | `mode: mentor` plan → Start does NOT trigger execution; `mode: autonomous` plan → Start triggers execution |

## Rollback Procedures

- **API/orchestrator rollback**: `git revert HEAD` on `src/executor/` files. Delete `.docwright/executor-locks/` and `.docwright/executor-checkpoints/` directories. Restore previous PropertiesPane behavior. No vault config changes needed.
- **UI rollback**: `git revert HEAD` on `src/components/PlanExecutePanel.svelte` and any `PropertiesPane.svelte` changes. Restore previous Review tab behavior. No API changes needed.
- **Config rollback**: Remove `DOCWRIGHT_EXECUTOR_TIMEOUT_SECONDS` and `DOCWRIGHT_EXECUTOR_MAX_RETRIES` from env config if they were added. Remove new CSP headers.
- **Full rollback**: `git revert HEAD` on the feature merge commit; remove `src/executor/` directory; remove `test/executor/` directory; remove `npm run test:executor` from `package.json`; remove `.docwright/executor-locks/`, `.docwright/executor-checkpoints/`; restore `PropertiesPane.svelte` and delete `PlanExecutePanel.svelte`.
- **Partial rollback — verification only**: If verification checks are too aggressive, set `DOCWRIGHT_EXECUTOR_SKIP_VERIFY=true` (fallback env var) to bypass verification and mark steps ✅ automatically after session completion. This is a temporary escape hatch — file a bug for the verification check that is failing.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| SSE connection drops mid-execution | Medium | High | Client-side auto-reconnect with 3 retries (1s, 2s, 4s exponential backoff). Orchestrator continues execution regardless of SSE client disconnection — the step loop is server-authoritative. Reconnecting client resumes receiving events from the current step. |
| OpenCode session unavailable (server down, port changed) | Low | High | Session creation returns 503 with descriptive error. Orchestrator polls OpenCode health endpoint (`GET /health`) before starting execution; if unhealthy, returns 503 immediately rather than starting and failing mid-stream. |
| Per-step 300s timeout insufficient for a complex step | Medium | Low | Configurable via `DOCWRIGHT_EXECUTOR_TIMEOUT_SECONDS` env var (default 300). Human can also set `timeout_per_step: 600` in plan frontmatter for outlier plans. |
| Plan file contention (human edits plan while executor running) | Low | High | File-based lock at `.docwright/executor-locks/<plan-name>.lock`. If lock cannot be acquired, return 409. Lock is released on completion or error. Human can force-release lock by deleting the lock file manually. |
| Verification false negative (build passes locally but CI would fail) | Medium | Medium | Verification runs the same commands as CI (`npx tsc --noEmit`, `npm run build`). CI runs these too — a CI failure after executor success indicates CI config drift, not executor error. |
| Verification false positive (build fails due to unrelated env issue) | Medium | Medium | Re-run once mitigates transient failures. If re-run also fails, human can manually mark the step ✅ and retry the executor, which then skips the manually-marked step. |
| `mode: autonomous` not yet implemented (rename proposal unapproved) | High | High | If `proposals/plan-execution-mode-rename.md` is not approved, fall back to detecting `automated: full` as the trigger. Both detection paths are implemented and tested. A frontmatter check in the orchestrator handles both fields. |
| Human does not respond to WAITING prompt within a reasonable time | Medium | Low | No hard timeout on WAITING. The UI shows "Awaiting your input" indefinitely. Human can close the browser tab and return later — the checkpoint persists the session ID and current step. Re-opening the plan re-attaches to the running session if still active. |

## Document History

| Date | Change | Author |
| --- | --- | --- |
| 2026-06-09 | Created from approved proposal | NetYeti |
| 2026-06-09 | Step 1 — Plan parsing engine (src/executor/plan-parser.ts) implemented with 10/10 tests passing | NetYeti |
| 2026-06-09 | Step 2 — Orchestrator (src/executor/orchestrator.ts + src/webui/.../plan-execute/+server.ts) with SSE streaming, duplicate detection, and 17/17 tests | NetYeti |
| 2026-06-09 | Step 3 — Session lifecycle (src/executor/session.ts + waiting.ts) with timeout/retry, WAITING flow, 6/6 tests; refactored plan-execute endpoint | NetYeti |
| 2026-06-09 | Step 4 — Verification checks (src/executor/verify.ts) with category detection and auto-build/test/doc checks, 10/10 tests | NetYeti |
| 2026-06-09 | Step 5 — State persistence (src/executor/state.ts) with file-based locks and checkpoints, integrated into orchestrator, 4/4 tests | NetYeti |NetYeti |
| 2026-06-09 | Step 6 — Web UI PropertiesPane trigger added with Execute tab and autonomous mode detection | NetYeti |
| 2026-06-09 | Step 7 — Web UI PlanExecutePanel implemented for streaming SSE logs and handling WAITING states | NetYeti |
| 2026-06-09 | Step 8 — API routes for /api/plan-execute and /api/plan-execute-followup added via standard SvelteKit endpoints | NetYeti |
| 2026-06-09 | Step 9 — Test suite finalized, test:executor registered in package.json, 37/37 tests passing | NetYeti |