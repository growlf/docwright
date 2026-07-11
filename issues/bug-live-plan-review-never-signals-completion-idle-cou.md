---
title: Live plan review never signals completion — idle-count detection is fragile, leaving no done indicator or next-step action
status: proposal-linked
created: 2026-07-11
author: NetYeti
author-role: user
category: bug
priority: high
complexity: medium
estimated_effort: S
demand_count: 1
reported_dates: [2026-07-11]
channel: dev
github_issue: https://github.com/growlf/docwright/issues/311
related:
  - issues/bug-improve-flow-discards-finished-results-panel-clear.md
tags:
  - reported-bug
---

# Live plan review never signals completion — idle-count detection is fragile, leaving no done indicator or next-step action

> **Proposal-linked 2026-07-11** (backlog cleanup) → captured by `proposals/harden-plan-proposal-lifecycle-tooling.md` (plan/review completion-signalling). Not lost.


## Description

**Observed 2026-07-10 ~20:35–20:41 PDT (BDFL, dev instance :5173, LIVE_AI_REVIEW live path)** on plans/adopt-milestone-driven-roadmap-discipline.md: clicked review, watched thinking stream correctly through all 28 steps + Testing/Risk/Rollback + Overview. All content rendered and SURVIVED in the right panel (the discard bug fixed in PR #279 did not recur). But the UI never entered a finished state: no completion indicator, no Apply/next-step affordance — the user could not tell whether it was done or what to do next.

**Backend verified complete:** OpenCode session ses_0b0c1494bffe26HinSSax7f561 finished cleanly at 20:41:34 — 32/32 assistant turns, zero errors. Nothing was persisted (expected — apply never became available).

**Root cause (code-confirmed):** completion detection in `startLiveReview()` (src/webui/src/routes/+layout.svelte:484-528) counts `session.idle` events against `expected = info.prompts` from the start response. This has no reconciliation or fallback:
1. Any single missed `session.idle` (SSE reconnect over a ~6-minute run, relay hiccup, vite dev proxy buffering) leaves `idleCount < expected` forever — `finishLive()` never runs, `planReviewLoading` stays true indefinitely.
2. If the start response fails to parse, `expected` stays `Infinity` — same permanent-stuck outcome.
3. `es.onerror` only finishes when the count already reached expected, so a dropped stream cannot recover.
4. Server side, `runLiveReview()` (src/webui/src/lib/server/plan-review-live.ts:166-182) simply returns after the last turn — it never emits an explicit review-complete event onto the relay bus, so the client has nothing authoritative to key off.

**Suggested direction:** emit an explicit terminal event from the server when runLiveReview finishes (and on error), and have the client treat it as authoritative, keeping idle-counting only as a progress heuristic; plus a client-side stall fallback (e.g. query turn count or finish after N seconds of idle silence). Same pattern applies to startLiveImprove() (+layout.svelte:532+), which uses identical idle-counting.

**Impact:** review output is effectively unusable in the primary flow — users watch a successful 6-minute run end in ambiguity, don't know it succeeded, and get no path to apply findings. Second occurrence of the 'review/improve flow ends in uncertainty' class (prior: bug-improve-flow-discards-finished-results, resolved PR #279 — different mechanism, panel survived this time).

## System Info

dev instance vite :5173 on phoenix, opencode :4096 (external), LIVE_AI_IMPROVE/REVIEW default ON, main @ post-PR#305
