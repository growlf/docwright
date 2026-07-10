---
title: Bug/UX: Plan Executor Panel Has No Feedback During BigPickle Session — Humans Panic and Interrupt
status: draft
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
| 1 | Add heartbeat status events | Emit "⏳ BigPickle thinking… (Ns)" in the polling loop every cycle in session.ts | ⏳ Pending |
| 2 | Plumb step name to panel | Pass current step name through runStepSession params and display it prominently in Execute panel | ⏳ Pending |
| 3 | Emit live token counters | Poll session API for token counts during wait loop and emit live token-in/token-out counters | ⏳ Pending |

## Testing Plan

### Step Verification

- [ ] **Step 1 — Heartbeat status events emit during polling.** During a long-running session with a slow LLM call, observe the Execute panel logs and confirm a `⏳ BigPickle thinking… (Ns)` message appears at each poll cycle interval, with the elapsed-seconds value incrementing monotonically.
- [ ] **Step 2 — Current step name displays in the Execute panel.** Run a multi-step session and verify the panel renders the step name from `runStepSession` params (e.g. "Step 2/5: Summarizing document") rather than a generic placeholder, updating as each step begins.
- [ ] **Step 3 — Live token counters poll and display.** During an active session, verify token-in and token-out counters appear in the Execute panel and increment (or hold at 0 until the first API response returns data) without causing UI freezes or excessive console errors.

### Integration & Regression

- [ ] `npm test` passes with zero failures and zero new warnings.
- [ ] TypeScript compilation (`npm run typecheck` or `tsc --noEmit`) succeeds with no new errors.
- [ ] Existing Execute panel functionality (step list rendering, completion checkmarks, error display) is unchanged — run the manual test suite from the existing testing plan and confirm no regressions.
- [ ] Heartbeat events do not duplicate or appear after a session completes or errors out — verify the polling loop terminates cleanly on all exit paths (success, error, cancellation).
- [ ] Token count polling does not fire after the session ends and does not leak open API handles or timers (check via devtools for lingering network requests after session close).

### Gate Criteria

- [ ] All three Step Verification checkboxes above are checked.
- [ ] No open bugs with priority `high` or `medium` exist in the issue tracker that are introduced by this changeset (file via `capture_bug_report` if any are discovered during testing).
- [ ] The heartbeat interval, step-name display, and token counter are all covered by at least one automated test (unit or integration) that asserts the expected output.
- [ ] A human has visually confirmed in the VSCodium Execute panel that heartbeat messages, step names, and token counters render correctly during a live long-running session.
- [ ] All Implementation Steps rows in the plan are marked ✅ before calling `update_plan_status('completed')`.

## Rollback Procedures

## Rollback Procedures

| Scenario | Rollback |
|----------|----------|
| Fix 1 — Heartbeat polling loop causes excessive CPU or log spam | Remove the `emit("⏳ BigPickle thinking…")` call from the poll cycle and delete the associated `setInterval`/timer. Revert the session manager to its prior silent poll behavior. |
| Fix 2 — Step name plumbing breaks parameter typing or passes undefined to the Execute panel | Revert `runStepSession` params to exclude `stepName`; remove the step-name display element from the Execute panel. The panel falls back to showing no step context. |
| Fix 3 — Token-count polling saturates the API or produces incorrect counters | Remove the token-count fetch call from the wait loop and strip the live counter UI elements. The panel reverts to showing elapsed time only. |

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Heartbeat events flood the output panel, degrading UI responsiveness on slow connections | Medium | Medium | Throttle heartbeat emissions to max 1/sec; batch with deduplication; cap displayed history lines |
| Token-count polling adds measurable latency to the polling loop, extending total wait time | Low | Low | Use non-blocking async fetch; fall back silently on API timeout; cache counts and only update display on change |
| Exposing live token counts misleads users into over-optimizing mid-session, interrupting a healthy run | Medium | High | Display counts as informational only, clearly labeled as provisional; add tooltip stating counts are approximate until completion |
| Step-name plumbing leaks internal implementation details (internal step IDs) instead of human-readable names | Low | Medium | Maintain a name-resolution map from step keys to display labels; log and gracefully fall back to step index if unmapped |
| Heartbeat status text persists in the panel after session failure, giving false impression of success | Medium | High | Clear or strike-through heartbeat lines on error/cancellation; append explicit failure indicator; tie status lifecycle to session state transitions |
| New event emissions introduce unhandled promise rejections or memory leaks from unreleased listeners | Low | High | Wrap all new async handlers in try/catch; use AbortController for in-flight token polls; verify listener cleanup in session dispose path |

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-07-10 | Created from approved proposal | NetYeti |
