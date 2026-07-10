---
title: plan-review endpoint reviews steps sequentially for plans with a real steps table, unlike the already-fixed no-steps branch
status: new
created: 2026-07-10
author: agent
author-role: user
category: bug
priority: high
complexity: medium
estimated_effort: S
demand_count: 1
reported_dates: [2026-07-10]
channel: dev
related:
  - src/webui/src/routes/api/plan-review/+server.ts
  - src/webui/src/lib/server/opencode-complete.ts
tags:
  - reported-bug
---

# plan-review endpoint reviews steps sequentially for plans with a real steps table, unlike the already-fixed no-steps branch

## Description

src/webui/src/routes/api/plan-review/+server.ts has two branches: plans with no Implementation Steps table (the `noSteps` branch) run their 4 analysis calls in parallel via Promise.all -- fixed previously specifically because sequential calls were timing out (ERR_INCOMPLETE_CHUNKED_ENCODING). But the OTHER branch, used for any plan that actually HAS a real steps table (i.e. most real plans), still ran every step + section review call sequentially in a `for` loop with `await`, one at a time, never fixed.

opencodeComplete() (src/webui/src/lib/server/opencode-complete.ts) has a 300s (TIMEOUT_MS) AbortSignal per call. In the sequential branch, if any single call stalls, the whole review stalls behind it with zero visible progress on later steps, and the user sees a generic "OpenCode message failed: The operation was aborted due to timeout" with no indication of which call or why.

Reproduced live 2026-07-10: reviewing plans/executor-panel-live-feedback.md (which has a real 3-step Implementation Steps table) showed "Extracting plan sections... (766s)" before Step 1 failed with exactly that timeout message -- nothing else even started. A trivial OpenCode round-trip immediately afterward completed in ~2.6s, so the server wasn't down; a single call transiently stalled and blocked the entire sequential chain behind it.

Fixed this session: converted the sequential `for` loop to `Promise.all(allCalls.map(...))`, matching the pattern already used in the no-steps branch, so a slow/hung call for one step no longer blocks the others.

Separately noted but not investigated further: a trivial 6-word test prompt sent directly to OpenCode consumed 63,922 input tokens. Worth a follow-up look at whether that much baseline context/tool-schema overhead per call is expected, since it could make individual calls more likely to be slow or provider-rate-limited under load -- filing as context for whoever looks at this, not claiming it's a bug on its own.

## System Info

None provided
