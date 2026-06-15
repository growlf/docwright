---
title: Modular AI Review — parallel micro-calls for free-tier model reliability
status: completed
completed_date: 2026-06-14
author: NetYeti
created: 2026-06-12
tags: ""
proposal_source: proposals/approved/modular-ai-review.md
priority: medium
automated: full
assigned_to: NetYeti
tests_defined: true
tests_human_reviewed: false
total_steps: 3
completed_steps: 3
_path: plans/completed/modular-ai-review.md
---
# Modular AI Review — parallel micro-calls for free-tier model reliability

## Overview

Replace the single monolithic AI call in `/api/plan-review` with N+2 parallel micro-calls, each < 1KB. Stream results progressively: steps → sections → overview.

## Implementation Steps

| Step | Action | Details | Status |
| --- | --- | --- | --- |
| 1 | Rewrite `+server.ts` — extract sections, fire parallel micro-calls, stream SSE | Parse plan markdown locally for steps + sections. Fire one OpenCode call per step + per section in parallel. Stream each result via `step-review`/`section-review` SSE events. After all complete, fire overview call | ✅ Done |
| 2 | Update `handleReview()` + add stores in `+layout.svelte` | Replace SSE parser: handle `step-review`, `section-review`, `overview` events. Add `planReviewSteps`, `planReviewSections`, `planReviewOverview` writable stores. Remove old handlers for `token`/`changes`/`improved_body` | ✅ Done |
| 3 | Rewrite `PlanReviewPanel.svelte` | Render grouped: Steps → Sections → Overview. Remove "Accept Improvements" button, `changes`/`improved` props, tabs. Progressive fill-in. New props: `steps`, `sections`, `overview`, `loading` | ✅ Done |

## Testing Plan

*   Verify each individual micro-call prompt is < 1KB
*   Verify all calls complete within 60s on free-tier model
*   Verify progressive streaming (steps appear before sections, sections before overview)
*   Verify error isolation: one step call failure doesn't kill other calls
*   Manual smoke test on the vault migration sub-plan

## Risk Assessment

*   **Parallel session creation rate limit:** OpenCode may throttle. Mitigation: fire sessions sequentially but messages in parallel (reuse sessions), or add 200ms stagger between session creates.
*   **Overview call fails:** Steps + sections still useful on their own. Mitigation: render whatever results we got.
*   **Plan has no steps:** No micro-calls to fire — send immediate `done` with message "No steps to review".

## Rollback Procedures

*   Revert `+server.ts` to previous version (git checkout)
*   Revert `+layout.svelte` SSE handler
*   Revert `PlanReviewPanel.svelte`

## Document History

| Date | Change | Author |
| --- | --- | --- |
| 2026-06-12 | Created from approved proposal | NetYeti |
| 2026-06-12 | Populated implementation steps, testing, risk, rollback | NetYeti |
| 2026-06-12 | Implemented all 3 steps: parallel micro-calls, SSE handler, grouped rendering | NetYeti |
| 2026-06-14 | Plan marked complete — all 3 steps verified | NetYeti |