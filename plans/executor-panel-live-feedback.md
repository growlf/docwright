---
title: "Bug/UX: Plan Executor Panel Has No Feedback During BigPickle Session — Humans Panic and Interrupt"
status: draft
author: NetYeti
created: 2026-07-03
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
tests_defined: false
tests_human_reviewed: false
_path: plans/executor-panel-live-feedback.md
---

# Bug/UX: Plan Executor Panel Has No Feedback During BigPickle Session — Humans Panic and Interrupt

## Overview

Delivers the approved proposal [[proposals/approved/executor-panel-live-feedback.md]] — see it for the full *what & why*.
Held at `status: draft`; fill in the implementation steps below before moving to `in-progress`.



## Implementation Steps

| Step | Action | Details | Status |
|------|--------|---------|--------|
| 1 | Define and emit a `HeartbeatEvent` payload `{ status: 'alive' | 'stale' | 'dead'; sessionId: string; timestamp: number; error?: string }` on an `EventEmitter<HeartbeatEvent>` injected into the poll loop, then verify via a unit test that the event fires with correct fields after three consecutive poll cycles. | Inject heartbeat status events during the polling loop in session.ts | ⏳ Pending |
| 2 | Plumb step name through params | Pass the step name through runStepSession params and display it in the Execute panel | ⏳ Pending |
| 3 | Implement a 2-second polling loop in the frontend service layer that calls `GET /api/sessions/{id}/tokens` and dispatches token-count payloads to the React state store via a custom `useTokenPolling(sessionId)` hook. Step is complete when a test session's increasing token count appears on the session detail view within 2 seconds of starting a chat, verified by an automated Playwright assertion. | Poll the session API for token counts and emit live updates during the wait loop | ⏳ Pending |

## Testing Plan
### Step Verification
- [ ] Step 1: Define and emit a `HeartbeatEvent` payload `{ status: 'alive'
- [ ] Step 2: Plumb step name through params
- [ ] Step 3: Implement a 2-second polling loop in the frontend service layer that calls `GET /api/sessions/{id}/tokens` and dispatches token-count payloads to the React state store via a custom `useTokenPolling(sessionId)` hook. Step is complete when a test session's increasing token count appears on the session detail view within 2 seconds of starting a chat, verified by an automated Playwright assertion.
- [ ] **Fix 1**: `session.ts` emits heartbeat status events every <5s during BigPickle polling. A test helper subscribes to the event stream and asserts at least 3 heartbeats arrive within 15s. When the server is unreachable or returns errors, the test verifies no false heartbeat is emitted and the polling loop terminates within 30s.
- [ ] **Fix 2**: Step name is passed through `runStepSession` parameters and displayed in the Execute panel's `<h2>` header, verified by a component test that renders `ExecutePanel` with a known step name and asserts `screen.getByRole('heading', { name: /step name/i })` is in the document. A null/undefined step name renders a fallback "Executing..." label instead of crashing.
- [ ] **Fix 3**: Token counts poll the session API and emit live updates in the Execute panel during the wait loop, verified by asserting token counter DOM elements update their text content at least twice within a 10s polling window. When the session API returns 4xx or 5xx, the counter displays a dash ("—") and the panel shows a non-blocking warning icon rather than a spinner or error overlay.

### Integration & Regression
- [ ] `npm test` (or equivalent test runner) passes with no regressions
- [ ] TypeScript type-check (`npm run typecheck` or `tsc --noEmit`) passes without new errors
- [ ] Existing Execute panel behavior is preserved for session sessions (no regressions in step navigation, cancellation, or error display)
## Rollback Procedures

| Scenario | Rollback |
|---|---|---|
| Heartbeat status events cause unexpected polling behavior in session.ts | Revert `session.ts` changes with `git checkout -- session.ts` or `git revert <commit-hash>` |
| Step name plumbing breaks Execute panel rendering or validation | Revert `runStepSession` params signature change and panel display code with `git checkout --` on affected files |
| Live token count polling introduces API rate limit errors or stalls the wait loop | Remove the polling interval call in the wait loop; revert to the previous `setTimeout`-based wait pattern |

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Heartbeat polling introduces measurable latency in the Execute panel render cycle | Low | Medium | Benchmark heartbeat dispatch overhead; keep events batched and throttled to ≤1 per 500ms |
| Step name plumbing misses a call site, leaving some Execute contexts showing no active step | Medium | Medium | Add a TypeScript-visible fallback — if step name is empty/undefined, render `"Processing..."` instead of blank |
| Token count API (polled per step) hits rate limits or adds excess load on the LLM provider | Low | High | Gate token polling behind a feature flag; implement exponential backoff and a 3-strike circuit breaker |
| Heartbeat events suppress real error messages by flooding the event bus | Low | Medium | Assign heartbeat a distinct event type; filter heartbeats out of the error-render path in the Execute panel |
| Increased event volume degrades VS Code WebView postMessage throughput | Medium | Low | Batch status + token updates into a single `{ heartbeat, stepName, tokens }` message per tick |
| Token polling fails on non-standard LLM backends (e.g., local models without token metadata) | Medium | Low | Treat missing/null token fields gracefully — emit `"N/A"` in the UI rather than crashing or blanking the panel |

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-07-03 | AI-improved via Review | NetYeti |
| 2026-07-03 | Created from approved proposal | NetYeti |
