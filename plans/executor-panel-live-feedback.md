---
title: "Bug/UX: Plan Executor Panel Has No Feedback During BigPickle Session — Humans Panic and Interrupt"
status: approved
author: NetYeti
created: 2026-07-10
tags:
  - bug
  - ux
  - executor
  - feedback
  - critical
proposal_source: proposals/approved/executor-panel-live-feedback.md
priority: high
automated: guided
assigned_to: NetYeti
tests_defined: true
tests_human_reviewed: false
_path: plans/executor-panel-live-feedback.md
total_steps: 3
completed_steps: 2
---

# Bug/UX: Plan Executor Panel Has No Feedback During BigPickle Session — Humans Panic and Interrupt

## Overview

Delivers the approved proposal [[proposals/approved/executor-panel-live-feedback.md]] — see it for the full *what & why*.

Steps 1 and 2 turned out to already be implemented elsewhere in the codebase (verified by reading the actual source, not assumed) — this plan's job is now mostly to record that and land Step 3, the one genuinely missing piece.

## Implementation Steps

| Step | Action | Details | Status |
|------|--------|---------|--------|
| 1 | Heartbeat status events during polling | Already implemented in `runStepSession` (`src/executor/session.ts:107-113`): a `setInterval` emits `⏳ BigPickle thinking… ${waitSecs}s` every 5s while waiting on the AI response, cleared in a `finally` block when the response arrives. Flows through `onLog` → the SSE `log` event → `PlanExecutePanel.svelte`. | ✅ Done |
| 2 | Show current step name prominently | Already implemented in `executePlan` (`src/executor/orchestrator.ts:80`): emits `status: "Executing step {N}/{total}: {action}"` before running each step. `PlanExecutePanel.svelte` (line 81) renders it as the status bar's primary text. | ✅ Done |
| 3 | Live token count updates | Not implemented. The OpenCode message response already includes token usage at `data.info?.tokens` (`{ input, output, reasoning, cache }`) — confirmed live against the running OpenCode server. `runStepSession` (`session.ts`) currently discards this: it only extracts `data.parts`, never reads `data.info`. Thread it through: capture `data.info?.tokens` after the message response in `session.ts`, emit it via a new `onTokens` callback (or piggyback on `onLog` with a structured payload), forward it through `orchestrator.ts`'s `send`, and render it in `PlanExecutePanel.svelte`'s status bar alongside the existing heartbeat text. | ⏳ Pending |

## Testing Plan

### Step Verification

- [x] **Step 1** — Confirmed by reading `session.ts:107-113`: heartbeat `setInterval` present, correctly cleared in `finally`, message format matches the proposal exactly. Not re-verified by a live execution run this session.
- [x] **Step 2** — Confirmed by reading `orchestrator.ts:80` and `PlanExecutePanel.svelte:80-81`: status event emitted with step number/total/action, rendered as the panel's primary status text. Not re-verified by a live execution run this session.
- [ ] **Step 3** — Run a real plan through the executor with a slow AI call; confirm token counts appear in the Execute panel, update after each API response, and don't cause UI freezes.

### Integration & Regression

- [ ] Existing executor tests still pass after Step 3's changes (`session.ts`, `orchestrator.ts`)
- [ ] A step whose AI response omits `info.tokens` (older OpenCode version, different provider) doesn't crash the panel — token display degrades gracefully (e.g. hides, or shows "—")

### Gate Criteria

- [ ] Step 3 implemented and its acceptance criteria above verified live
- [ ] No regression in existing heartbeat/step-name display (Steps 1-2 continue working)
- [ ] Human test certification (`tests_human_reviewed`)

## Rollback Procedures

| Scenario | Rollback |
|----------|----------|
| Step 3's token-count plumbing causes the executor to crash or hang on a malformed `info` field | Remove the `onTokens` callback and its `send` forwarding; the panel falls back to heartbeat-only display (Steps 1-2 are unaffected since they're independent of this change). |

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Not every OpenCode provider/response shape includes `info.tokens` | Medium | Low | Treat it as optional everywhere it's read; render nothing (not an error) when absent. |
| Adding a token display element to `PlanExecutePanel.svelte` conflicts with existing status-bar layout | Low | Low | Append alongside the existing heartbeat text rather than replacing it; verify visually in both dark and light themes. |

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-07-10 | Created from approved proposal | NetYeti |
| 2026-07-10 | AI-improved via Review — introduced hallucinated implementation details (`src/session/poller.ts`, a `/api/session/{id}/metrics` endpoint, `tokens_remaining`) that don't exist anywhere in this codebase, plus duplicate Testing Plan and Rollback Procedures sections from an imperfect merge. Flagged by the human, verified against real source. | NetYeti |
| 2026-07-10 | Rewrote from scratch grounded in the actual code: Steps 1-2 were already implemented elsewhere in the codebase (confirmed by reading `session.ts` and `orchestrator.ts` directly) and are marked done; Step 3 is real, still-pending work with an implementation path grounded in OpenCode's actual message-response shape (`data.info.tokens`, confirmed live against the running server) rather than an invented polling endpoint. | Claude (on behalf of user) |
