---
title: Chat Panel — Inject Active Document as Context
status: canceled
author: NetYeti
created: 2026-06-28
type: plan
tags:
  - chat
  - ux
  - context
  - phase-4
  - bug
proposal_source: proposals/approved/chat-active-document-context.md
priority: high
complexity: low
automated: full
assigned_to: NetYeti
tests_defined: false
tests_human_reviewed: false
_path: plans/completed/chat-active-document-context.md
total_steps: 3
completed_steps: 2
scenario_synthesis: "Happy path: user opens a plan, types in chat — AI receives the file path and content prepended to the first message, responds with specific line-level suggestions. Failure path: no document open (status page, settings) — chat sends the message as-is with no context prefix; AI responds in general terms."
gate_note: "Changed files are untestable types: plans/chat-active-document-context.md"
canceled_date: 2026-06-29
cancellation_reason: Superseded by chat-architecture-document-scoped-sessions. Steps 1-2 implemented and kept (currentDocPath prop, system prompt injection); Step 3 (test) absorbed into the architecture plan's e2e test step.
---

# Chat Panel — Inject Active Document as Context

## Overview

When the user opens the DocWright chat panel while viewing a document, the currently-open
file path and content should be automatically prepended to the first message sent in that
session. This gives the AI the context it needs to make specific, actionable suggestions
without the user having to describe or paste the document manually.

Ships together with `chat-document-write-back` — context injection is a prerequisite
for write-back since the AI needs to know the file path to write to it.

## Implementation Steps

| Step | Action | Details | Status |
| --- | --- | --- | --- |
| 1 | Pass `currentDoc` into `ChatPanel` | `ChatPanel.svelte` receives no document prop today. Add `currentDocPath: string` and `currentDocContent: string` props, populated from the `$currentDoc` store in `+layout.svelte` where the ChatPanel is mounted. Pass `filePath` and the raw markdown content. | ✅ Done |
| 2 | Inject context on first message in a new session | In `ChatPanel`'s send handler (around line 544), detect whether this is the first message in the current session (`messages.length === 1` after the optimistic push) AND `currentDocPath` is set AND the path is a `.md` file (not the status page or settings). If so, prefix the `parts` text with a context block: `[Active document: <path>]\n\n<content>\n\n---\nUser: <original message>`. Keep the displayed message as just the user's text — only the sent payload includes the context. | ✅ Done |
| 3 | Test: context appears in AI responses | Open a plan with a known issue (e.g. `plans/multiuser-auth-concurrent-sessions.md`), send "What does this plan cover?" — AI should answer with specific step names from the plan, not a generic response. Also test: navigate to `/status` and open chat — AI should respond without referencing any specific document. | ⏳ Pending |

## Testing Plan

### Step Verification

- [ ] Step 1: `currentDocPath` and `currentDocContent` props wired in layout
- [ ] Step 2: First message in a new session includes context prefix in the sent payload; displayed message is unchanged
- [ ] Step 3: AI references specific content from the open document; no context injected on non-document pages

### Gate Criteria

- [ ] `tests_defined` set to `true` in frontmatter
- [ ] Human reviewer has verified step outcomes above
- [ ] No regressions in chat send flow

## Document History

| Date | Change | Author |
| --- | --- | --- |
| 2026-06-28 | Wrote implementation steps. | NetYeti |
