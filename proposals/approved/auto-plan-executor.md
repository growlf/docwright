---
title: Auto plan executor — per-step autonomous execution engine
author: NetYeti
created: 2026-06-09
tags:
  - autonomous
  - execution
  - plan-modes
  - opencode
  - sse
approved: true
created_by: NetYeti@phoenix
assigned_to: NetYeti
depends_on:
  - proposals/plan-execution-mode-rename.md
_path: proposals/auto-plan-executor.md
consumed_by: plans/completed/auto-plan-executor.md
---

## Problem

Plans with `automated: full` (or the proposed `mode: autonomous`) have no execution
engine. Clicking "Start" sets `status: in-progress` but does nothing else — the human
must manually work through each step. The `automated` field is metadata only.

The research proposal (`research-plan-execution-modes.md`) explicitly calls autonomous
execution "aspirational and not yet implemented." This proposal implements it.

## Proposed Solution

An auto-executor engine that runs plan steps one at a time when a plan is started
in `mode: autonomous`.

### Architecture

```
User clicks Start (mode: autonomous)
  → setPlanStatus('in-progress')
  → POST /api/plan-execute (SSE stream)
  → opens Review tab with progress

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

### Per-step OpenCode session prompt

Each step gets a fresh OpenCode session with a focused prompt:

```
You are executing Step <N> of plan "<title>".

Plan context:
<overview>

This step's action: <Action column text>
This step's details: <Details column text>

Instructions:
1. Complete the work described above in the
   /home/netyeti/Projects/DocWright repository.
2. Run verification: <auto-detected from action — e.g., npm run build>
3. When done and verified, reply with exactly:
   STEP DONE
4. If blocked and need human input, reply with:
   WAITING: <question>
5. If the step cannot be completed, reply with:
   STEP FAILED: <reason>
```

### SSE event stream

| Event | Payload | When |
|-------|---------|------|
| `status` | `{ message }` | Before each phase (connecting, step N, verifying) |
| `log` | `{ text }` | Live output tokens from the OpenCode session |
| `step_done` | `{ step, action }` | After a step is verified and marked ✅ |
| `waiting_for_user` | `{ question }` | When the agent signals it needs human input |
| `error` | `{ message, step }` | When a step fails unrecoverably |
| `done` | `{ message }` | All steps complete and plan archived |

### Verification after each step

Lightweight checks run after the session completes, before the step is marked ✅:

- **Code steps** (action mentions "create", "implement", "add"): expected files exist, `npx tsc --noEmit` or `npm run build` passes
- **Config steps**: file is valid JSON/YAML (parse check)
- **Doc steps**: file exists, is non-empty
- **Test steps**: `npm test` or relevant test command passes

If verification fails, the orchestrator re-runs the step session once. If it fails
again, the step is reported as `error` and execution stops.

### `waiting_for_user` flow

1. Agent emits `WAITING: <question>` in its response
2. Orchestrator pauses the step loop, sends SSE `waiting_for_user`
3. Web UI shows the question and an input field
4. Human types a response, hits submit
5. Response is sent as a follow-up message to the same OpenCode session
6. Agent continues, eventually emits `STEP DONE` or `WAITING` again
7. Loop repeats until the step completes or fails

### Idempotency and resume

- Already-✅ steps are skipped (orchestrator re-reads plan before each step)
- If the orchestrator crashes mid-execution, re-running the API picks up from the
  last ⏳ step
- A `POST /api/plan-execute` on a plan already being executed returns a 409 Conflict

### UI changes

**PropertiesPane.svelte:**
- When `mode === 'autonomous'` (or `automated === 'full'`) and Start is clicked:
  call `setPlanStatus('in-progress')` then `startPlanExecution()`
- `startPlanExecution()` opens the Review tab with `executionMode: true`

**PlanReviewPanel.svelte (or new PlanExecutePanel):**
- Shows `executionMode` variant when active
- Progress display: "Step 3/9 — Scaffolding TypeScript project" with status per step
- Live log area showing streaming output
- "Step 1 ✅" badges as each completes
- `waiting_for_user` prompt with input field when triggered
- Error display with retry button on failure

### OpenCode session management

- Sessions are created via existing `POST /session` endpoint
- Session messages via `POST /session/{id}/message`
- Session timeout: 300s per step (same as plan-review AI_TIMEOUT)
- On timeout: retry once; if retry times out, emit `error`

### Rollback

- Per-step: if verification fails, the step session is re-created and re-run once
- Full plan: if any step fails on retry, execution stops; human can fix manually
  and re-trigger executor (which skips ✅ steps)
- No automatic git commit/rollback — the executor changes files in place

## Dependencies

- **proposals/plan-execution-mode-rename.md** (or equivalent) — the `mode: autonomous`
  concept must exist before or alongside this executor
- OpenCode must be running on the same machine (same as plan-review already requires)
- MCP server must be available for final `update_plan_status` call

## Out of Scope

| Feature | Why deferred |
|---------|-------------|
| Parallel step execution | Risk of conflicts; sequential is simpler and safer for Phase 3 |
| Auto git commit per step | Adds complexity; manual review of changes is preferred |
| Web UI write intercept (staging queue) | Already proposed in plan-execution-mode-rename.md |
| Per-step mode overrides | Plan-level mode is sufficient for initial implementation |
| Cross-vault execution | Enterprise concern; not needed for DP1 single-vault deployments |

## Alternatives Considered

**Single OpenCode session for the entire plan:** Rejected — the session's context window
would overflow on plans with 9+ complex steps. Per-step sessions are isolated and
cheap to create.

**Dedicated subagent (@docwright-executor):** Deferred — an OpenCode subagent would
be cleaner but requires more infrastructure. The API endpoint + OpenCode session
pattern is simpler and follows the existing plan-review architecture.

**MCP tool instead of REST API:** Rejected — the execution flow is long-lived
(5+ minutes per plan), and SSE streaming maps naturally to HTTP. MCP request/response
is synchronous and would block.

**Polling instead of SSE:** Rejected — SSE provides real-time progress without
client-side polling overhead. The plan-review endpoint already demonstrates this pattern.
