---
title: "Bug/UX: Plan Executor Panel Has No Feedback During BigPickle Session — Humans Panic and Interrupt"
author: NetYeti
author-role: contributor
created: 2026-06-17
tags:
  - bug
  - ux
  - executor
  - feedback
  - critical
complexity: low
estimated_effort: S
approved: true
priority: high
created_by: NetYeti@phoenix
assigned_to: NetYeti
related_to:
  - src/webui/src/routes/api/plan-execute/+server.ts
  - src/executor/session.ts
  - proposals/deferred-watcher-presence-indicator.md
_path: proposals/approved/executor-panel-live-feedback
consumed_by: plans/executor-panel-live-feedback.md
---

## Problem

When the plan executor starts a step and BigPickle begins processing, the Execute
panel in the Web UI goes completely blank for up to 120 seconds. No spinner, no
"waiting...", no token count, no step name — nothing. From a human perspective,
the system appears frozen or broken.

**Real consequence observed:** Multiple times during this session, the human
concluded execution had stalled and took disruptive actions (clicking Start again,
restarting services, interrupting sessions) while BigPickle was actively working.
Every interruption caused wasted work, lock file cleanup, and confusion.

**Root cause:** `plan-execute/+server.ts` emits SSE events at session creation
and message send, then enters the polling loop in `session.ts`. During polling
(3-second intervals, up to 120 seconds), no events are emitted to the client.
The Execute panel SSE stream is open but silent.

```
[executor] Creating session...           ← SSE event emitted ✓
[executor] Sending prompt to AI...       ← SSE event emitted ✓
[executor] (polling every 3s)            ← SILENT for 9–120 seconds
[executor] Step complete.                ← SSE event emitted ✓
```

## Proposed Fix

### Fix 1 — Heartbeat status events during polling (minimal, high impact)

In `session.ts`, inside the polling loop, emit a status event every poll:

```typescript
// In the polling loop
for (let i = 0; i < MAX_POLLS; i++) {
  await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
  events.onLog(`⏳ BigPickle thinking… (${i * 3}s)\n`);  // ← add this
  // ... existing poll logic
}
```

This gives the human a ticking clock: "⏳ BigPickle thinking… 3s", "⏳ BigPickle
thinking… 6s", etc. They know it's working. They don't panic.

### Fix 2 — Show current step name prominently

The Execute panel should display which step is currently being processed:

```
▶ Executing Step 3/3: Template heading cleanup (cosmetic)
⏳ BigPickle thinking… 42s
```

This requires the step name to be passed through the executor and emitted in an
early SSE event so the panel can display it.

### Fix 3 — Token count live update (optional enhancement)

If the session polling retrieves token counts, emit them:
```
⏳ BigPickle thinking… 42s | 25,000 tokens in → 473 out
```

This is the most informative signal — growing token output means the model is
generating. Stalled output means the model is stuck.

## Implementation order

1. **Fix 1 immediately** — one line in `session.ts`, minimal risk, maximum panic reduction
2. **Fix 2** — requires plumbing the step name through `runStepSession` params
3. **Fix 3** — requires polling the session API for token counts during the wait loop

## Why this is high priority

"No feedback means humans get confused and scared, and start to assume it is not
working... then do stupid things." — Observed directly during this session.

A governance tool that causes humans to take destructive actions out of uncertainty
is failing at its primary job. The executor panel must be an honest window into what
the AI is doing, not a black box. This is a trust issue, not just a UX issue.

## Related

- [[proposals/deferred-watcher-presence-indicator.md]] — similar problem for Claude
  Code monitoring sessions; shares the "human needs to see activity" root cause
- `src/executor/session.ts` — polling loop is where Fix 1 lands
- `src/webui/src/routes/api/plan-execute/+server.ts` — SSE stream orchestration
