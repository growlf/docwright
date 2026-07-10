---
title: "Plan: Bug/UX: Plan Executor Panel Has No Feedback During BigPickle Session — Humans Panic and Interrupt"
status: draft
author: "NetYeti"
created: "2026-07-10"
created_by: "NetYeti@phoenix"
tags: [planning]
proposal_source: "proposals/executor-panel-live-feedback"
priority: medium
phase: 
automated: guided
waiting_reason:  # Populated when status = waiting-for-user
assigned_to: ["NetYeti"]
# parent_plan: phase-N-overview.md   # filename of parent plan (omit if top-level)
# parent_deliverable: "1"            # row number in parent's Deliverables table
related_to: []
depends_on: []
blocks: []
reviewed_by:
reviewed_date:
canceled_date:  # Populated when plan is canceled
cancellation_reason:  # Populated when plan is canceled
template_version: "1.0"
tests_defined: true
tests_human_reviewed: false  # Set to true after human certifies AI-generated tests
# Gate fields — populated when a lifecycle gate applies to this document
gate_reviewer:  # Who must review (set automatically by gate rules)
gate_status:    # pending | approved | waived
gate_date:      # Stamped when gate_status is set
gate_note:      # Optional reviewer note
gate_reviews: []  # Phase 1a — array of {reviewer, role, status, date, note}
gate_quorum: 1    # Phase 1a — minimum approvals needed
---

# Plan: Bug/UX: Plan Executor Panel Has No Feedback During BigPickle Session — Humans Panic and Interrupt

## Mode

Plan modes: `off` (mentorship), `guided` (agent drafts, human approves), `full` (autonomous).

**MENTORSHIP MODE — Human leads, LLM advises**

- Human carries out tasks their own way
- LLM provides SOP compliance checks and safety warnings
- LLM offers suggestions when human asks for help

## Overview

### Problem

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

### Proposed fix

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

### Implementation order

1. **Fix 1 immediately** — one line in `session.ts`, minimal risk, maximum panic reduction
2. **Fix 2** — requires plumbing the step name through `runStepSession` params
3. **Fix 3** — requires polling the session API for token counts during the wait loop

### Why this is high priority

"No feedback means humans get confused and scared, and start to assume it is not
working... then do stupid things." — Observed directly during this session.

A governance tool that causes humans to take destructive actions out of uncertainty
is failing at its primary job. The executor panel must be an honest window into what
the AI is doing, not a black box. This is a trust issue, not just a UX issue.

### Related

- [[proposals/deferred-watcher-presence-indicator.md]] — similar problem for Claude
  Code monitoring sessions; shares the "human needs to see activity" root cause
- `src/executor/session.ts` — polling loop is where Fix 1 lands
- `src/webui/src/routes/api/plan-execute/+server.ts` — SSE stream orchestration


## Implementation Steps

> When marking a task ✅ Complete, update every step row in this table
> to reflect what was actually built. Stale ⏳ rows mislead reviewers.

| Step | Action | Details | Status |
|------|--------|---------|--------|
| 1 | | | ⏳ Pending |

## Testing Plan



## Rollback Procedures



## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| | | | |

## Phase Gate

- [ ] All implementation steps resolved (delivered or formally deferred with captured proposals)
- [ ] Test coverage defined and human-reviewed (`tests_human_reviewed: true`)
- [ ] Deferred ideas captured as proposals before closing (see [[policies/core/capture-deferred-ideas.md]])
- [ ] Rollback procedures documented
- [ ] Risk assessment completed

## Testing Plan

### Step Verification

- [ ] All implementation steps complete and outcomes verified

### Integration & Regression

- [ ] Existing tests pass without modification (`npm test`)
- [ ] TypeScript compiles cleanly (`npm run typecheck`)
- [ ] Plan: Bug/UX: Plan Executor Panel Has No Feedback During BigPickle Session — Humans Panic and Interrupt functionality works end-to-end

### Gate Criteria

- [ ] `tests_defined` set to `true` in frontmatter
- [ ] Human reviewer has verified step outcomes above
- [ ] No regressions introduced to adjacent workflows

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-07-10 | Created | NetYeti |
