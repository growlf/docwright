---
title: Modular AI Review — parallel micro-calls for free-tier model reliability
author: NetYeti
created: 2026-06-11
tags:
  - ai
  - review
  - architecture
  - performance
priority: high
approved: true
created_by: netyeti@phoenix
assigned_to: NetYeti
_path: proposals/modular-ai-review.md
consumed_by: plans/modular-ai-review.md
---

## Problem

The plan review endpoint (`/api/plan-review`) sends the **entire plan** plus
referenced proposals, dependencies, and core policies to OpenCode in a single
AI call (~6.6KB). Free-tier models (DeepSeek V4 Flash, Big Pickle) consistently
time out on prompts over ~1KB of substantive content. Only trivial prompts
("say hello") complete reliably.

This means the Review button is broken on every plan for anyone using a
free or limited AI backend. Since DocWright explicitly supports constrained
environments (CPU-only Ollama, free cloud tiers), the review pipeline must
work within those constraints — not assume a fast, large-context model.

## Root Cause

The current design is **monolithic**: one AI call does everything — reads the
plan, reads proposals, reads policies, produces findings, produces changes,
produces an improved plan. This requires the model to:

1. Ingest 6K+ chars of context
2. Understand the full document structure
3. Cross-reference across sections
4. Generate structured output in a specific format

Each of these adds latency. Combined, they exceed free-tier capacity.

## Proposed Solution — Parallel Micro-calls

Replace the single monolithic call with **N+2 parallel micro-calls**:

```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ Step 1 review │  │ Step 2 review │  │ Step 3 review │  ...  (~200 chars each)
│  (structured) │  │  (structured) │  │  (structured) │
└──────────────┘  └──────────────┘  └──────────────┘
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ Testing review    │  │ Risk review       │  │ Rollback review   │  (~200 chars each)
│  (structured)     │  │  (structured)     │  │  (structured)     │
└──────────────────┘  └──────────────────┘  └──────────────────┘
┌──────────────────────┐
│ Overview synthesis    │  (~800 chars)
│  (needs step/section  │
│   summaries as input) │
└──────────────────────┘
```

### 1. Section extraction (local, no AI)

Before any AI call, the server extracts:

- **Steps:** each Implementation Step row → `{ number, action, details }`
- **Testing Plan body** → plain text
- **Risk Assessment body** → plain text
- **Rollback Procedures body** → plain text
- **Plan metadata** → title, status, priority

This is pure string parsing — no AI needed, instant.

### 2. Per-step micro-calls (parallel)

For each step, fire a single AI message:

```
Prompt: "Review this implementation step.
Is it concrete enough? Does it have a clear definition of done?
Missing preconditions or dependencies? Be specific.

Step {n}: {action}
Details: {details}"

→ Response: "{step_number}: {analysis text}"
```

**Expected input:** ~200 chars
**Expected output:** ~200 chars
**Expected time:** < 10 seconds per step (all fire in parallel)

### 3. Per-section micro-calls (parallel)

For Testing, Risk, Rollback:

```
Prompt: "Review this section of a plan.
What's missing? What are the gaps? Specific improvements?

{section_name}:
{section_body}"

→ Response: "{section_name}: {analysis text}"
```

**Expected input:** ~200 chars
**Expected output:** ~200 chars
**Expected time:** < 10 seconds per section (all fire in parallel)

### 4. Overview synthesis (after steps + sections complete)

Once all step and section reviews return, send a **compact overview prompt**:

```
Prompt: "Review this plan overview. Does the overall plan hold together?
Are the steps coherent with the testing, risk, and rollback sections?

Plan: {title} ({status}, {priority})
Steps: {step headlines as bullet list}
Testing: {testing summary} (1 sentence)
Risk: {risk summary} (1 sentence)
Rollback: {rollback summary} (1 sentence)

→ Response: "Overview analysis text"
```

**Expected input:** ~800 chars
**Expected output:** ~400 chars
**Expected time:** < 15 seconds (runs once)

### 5. SSE streaming

The server streams results as each micro-call completes:

```
event: step-review
data: {"type": "step", "number": 1, "text": "Step 1 is well-defined but..."}

event: section-review
data: {"type": "section", "name": "testing", "text": "Testing plan covers..."}

event: overview
data: {"text": "The plan holds together overall but..."}

event: done
data: {}
```

### 6. Client-side rendering

`PlanReviewPanel.svelte` renders progressively:

- Steps appear first (they're the fastest/first to return)
- Sections appear next
- Overview appears last
- Each section is rendered in its own group with a heading
- No "improved plan" auto-generation — that was unreliable anyway

## Dependencies

- Existing `/api/plan-review` SSE endpoint (rewrite internals)
- Existing OpenCode session/message API (same, just multiple calls)
- Existing `PlanReviewPanel.svelte` (update props + rendering)

## Files to Change

| File | Change |
|------|--------|
| `src/webui/src/routes/api/plan-review/+server.ts` | Rewrite: extract sections locally, fire parallel micro-calls, stream structured SSE events |
| `src/webui/src/routes/+layout.svelte` | Update `handleReview()` SSE parser for new event types (`step-review`, `section-review`, `overview`) |
| `src/webui/src/lib/PlanReviewPanel.svelte` | Update to render structured review data (grouped steps, sections, overview) |

## Acceptance Criteria

1. Plan review triggers N+2 parallel micro-calls (not 1 monolithic call)
2. Each individual prompt is < 1KB
3. All calls complete within 60 seconds total on free-tier model
4. Results stream in progressively (steps first, sections, overview last)
5. "Accept Improvements" button is removed (no improved_plan generated)
6. Review works reliably on the vault migration sub-plan

## Out of Scope

- Generating an improved plan body (removed — unreliable on constrained models)
- AI-powered proposal improvement (separate endpoint)
- Caching or pre-computation of reviews (future optimization)

## Future

- Rate-limit parallel calls if the backend can't handle concurrency
- Fall back to serial calls if parallel causes errors
- Add a "review depth" slider: Quick (just overview) / Full (all micro-calls)
