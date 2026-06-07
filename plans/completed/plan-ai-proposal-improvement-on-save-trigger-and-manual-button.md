---
title: "Plan: AI Proposal Improvement — On-Save Trigger and Manual Button"
status: completed
completed_date: 2026-06-07
author: NetYeti
created: 2026-06-07
created_by: NetYeti@phoenix
tags: [planning]
proposal_source: proposals/approved/ai-proposal-improve-on-save
priority: medium
automated: off
waiting_reason: ""
assigned_to: ["NetYeti"]
related_to: []
depends_on: []
blocks: []
reviewed_by: ""
reviewed_date: ""
canceled_date: ""
cancellation_reason: ""
template_version: 1.0
tests_defined: true
gate_reviewer: ""
gate_status: ""
gate_date: ""
gate_note: ""
gate_reviews: []
gate_quorum: 1
total_steps: 8
completed_steps: 8
_path: plans/plan-ai-proposal-improvement-on-save-trigger-and-manual-button.md
---

# Plan: AI Proposal Improvement — On-Save Trigger and Manual Button

## Mode

**MENTORSHIP MODE — Human leads, LLM advises**

- Human carries out tasks their own way
- LLM provides SOP compliance checks and safety warnings
- LLM offers suggestions when human asks for help

## Overview

Implements the AI Proposal Improvement feature end-to-end: the two dispatch
stubs (`fillProposal` / `critiqueDocument`), a new `/api/improve` route, an
`ImprovementPanel.svelte` diff view, an "Improve" button in the properties
pane, and an on-save trigger for newly created proposals.

The pattern follows `OpenCodeEngine.gatePreReview()` exactly — POST prompt to
`${OPENCODE_URL}/api/session`, parse the text response, fall back to the
`KeywordEngine` stub when OpenCode is unavailable. No new npm dependencies.

## Implementation Steps

| Step | Action | Details | Status |
|------|--------|---------|--------|
| 1 | Implement `OpenCodeEngine.fillProposal()` | `src/dispatch/ai.ts`. Build a prompt with frontmatter context + body, POST to `${this.url}/api/session`, return improved markdown body. Prompt instructs AI to flesh out sparse sections, keep author intent, return ONLY the improved body with no preamble. `KeywordEngine` fallback already returns a stub string — leave as-is. | ✅ Done |
| 2 | Implement `OpenCodeEngine.critiqueDocument()` | Same file. Build a critique prompt — ask AI to identify missing sections, weak reasoning, unstated assumptions, governance gaps. Return structured critique as plain markdown. Fall back to `KeywordEngine` stub on error. | ✅ Done |
| 3 | Add `POST /api/improve` route | New file `src/webui/src/routes/api/improve/+server.ts`. Accepts `{ path: string }` in body. Reads file from disk, extracts frontmatter + body, calls `engine.fillProposal(fm, body)` and `engine.critiqueDocument(raw)` in parallel. Returns `{ original: string, improved: string, critique: string }`. Pattern mirrors `gate-pre-review/+server.ts`. | ✅ Done |
| 4 | Create `ImprovementPanel.svelte` | New file `src/webui/src/lib/ImprovementPanel.svelte`. Shows improved text in a scrollable panel. Header: "AI Suggestions" with a loading spinner while fetching. Body: improved text rendered as markdown (reuse `MarkdownRenderer`). Footer actions: "Accept" (replaces document body and saves), "View Critique" toggle (shows critique text), "Dismiss" (closes panel). No line-level diff in Phase 1 — show improved text in full; diff is a Phase 2 enhancement. Prop interface: `{ improved, critique, loading, onaccept, ondismiss }`. | ✅ Done |
| 5 | Add `onimprove` prop and "Improve" button to PropertiesPane | `src/webui/src/lib/PropertiesPane.svelte`. Add `onimprove?: () => void` to the props interface. Add `<button class="act improve" onclick={() => onimprove?.()}>✨ Improve</button>` in the `{#if docType === 'proposal'}` action block, alongside Find Related and Complexity. Add `improving = $state(false)` for loading state; button shows "Improving…" when in-flight. | ✅ Done |
| 6 | Wire improve flow in `[...path]/+page.svelte` | Add `handleImprove()` async function: sets improving state, calls `POST /api/improve`, receives `{ original, improved, critique }`, stores in local state, shows `ImprovementPanel`. `onaccept` handler: replace `content` with improved body, call `save()`, close panel. Wire `onimprove: handleImprove` into `currentDoc.set(...)` call. Mount `ImprovementPanel` conditionally when `improveResult` is set. | ✅ Done |
| 7 | Add on-save trigger for new proposals | In `save()` in `+page.svelte`, after existing `checkOverlap()` call: if `lastBodyLen === 0` (first save of a new proposal) AND OpenCode is reachable, also call `handleImprove()` in the background. Surface result as a toast: "AI suggestions ready — Review improvements" with an action button that opens the panel. Do not block save or show the panel automatically — keep it non-blocking. | ✅ Done |
| 8 | Unit tests | `test/dispatch/ai.test.ts` (new or extend): mock `fetch` to return a controlled response, assert `OpenCodeEngine.fillProposal()` returns the LLM text and falls back to the `KeywordEngine` stub on fetch failure. Add a parallel test for `critiqueDocument()`. Integration smoke test for `/api/improve` endpoint using the existing vault fixture pattern. | ✅ Done |

## Testing Plan

- **Unit**: Mock `fetch` in ai.ts tests. Verify `fillProposal` extracts the
  response body and returns it. Verify fallback to stub on network error.
  Same for `critiqueDocument`.
- **API**: Smoke test `POST /api/improve` with a real proposal file from the
  vault (requires `OPENCODE_URL` set, or mocked). Verify shape of response
  `{ original, improved, critique }`.
- **UI (manual)**: Open a proposal in the Web UI. Click "✨ Improve". Verify
  ImprovementPanel appears with improved text. Click "Accept" — verify document
  body updates and saves. Open a new proposal, save once — verify the on-save
  toast appears without blocking the save. Click toast — verify panel opens.
- **Offline**: With `OPENCODE_URL` unset, click "✨ Improve". Verify
  ImprovementPanel shows the `KeywordEngine` fallback stub message gracefully
  (not an error toast).

## Rollback Procedures

All changes are additive — no existing behaviour is modified.
- Remove the "Improve" button from PropertiesPane to disable the UI entry point.
- Delete `/api/improve/+server.ts` to remove the endpoint.
- The `fillProposal` and `critiqueDocument` stubs in ai.ts were already
  returning content unchanged — reverting to the stub bodies is safe.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| OpenCode returns non-markdown noise (preamble, commentary) | Medium | Improved text looks garbled | Prompt explicitly instructs "return ONLY the improved body"; add a body-extraction heuristic that strips lines before the first `#` heading if the response starts with prose |
| On-save trigger fires on every save (not just first) | Low | Annoying repeated AI calls | `lastBodyLen === 0` guard is already used by `checkOverlap()` for the same purpose — same condition applies |
| Accept replaces content user is mid-editing | Low | Lost work | "Accept" is an explicit user action in the panel; panel does not auto-open or auto-accept |
| LLM changes author intent | Low–Medium | Worse proposal | Prompt constrains the AI; user reviews before accepting; Dismiss keeps original |

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-07 | Created | NetYeti |
| 2026-06-06 | Filled in implementation steps, testing plan, rollback, and risk assessment | NetYeti |

## Critical Review

*Pending — run `/critique-plan` before approving.*
