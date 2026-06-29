---
title: "Chat Panel — Inject Active Document as Context"
author: NetYeti
created: 2026-06-28
tags:
  - chat
  - ux
  - context
  - phase-4
  - bug
approved: true
created_by: "NetYeti@phoenix"
assigned_to: "NetYeti"
priority: high
---

## Problem

When a user opens the DocWright chat panel while viewing a document, the AI has no
awareness of which document is open or what it contains. Every chat session starts
with a blank context — the user must manually describe or paste the document before
the AI can help with it.

**Observed:** User opens plan `multiuser-auth-concurrent-sessions.md`, says
"Looks like Testing Plan has duplication" — the AI cannot act because it doesn't
know which file the user is referring to.

The `ChatPanel.svelte` message send (line 545) passes only the raw user text:
```js
parts: [{ type: 'text', text }]
```
No file path. No document content. No vault context beyond the directory.

## Proposed Solution

When a document is open in the main content area, inject it as a system-level context
message at the start of the OpenCode session (or prepend it to the first user message).

### Option A — Prepend to first message (simple, no session changes)

When the user sends the first message in a session and `currentDoc.filePath` is set,
prepend a context block:

```
[Active document: plans/multiuser-auth-concurrent-sessions.md]

<content of the file>

---
User message: Looks like Testing Plan has duplication
```

This requires no changes to session creation and works with any OpenCode version.

### Option B — System message on session create (cleaner)

Pass the active document as an initial system message when creating the session.
OpenCode sessions accept an `initialMessages` or `systemPrompt` field (to confirm
against the OpenCode API). The AI then has the context for the entire session without
it cluttering the user's message history.

### Option C — @mention integration (already partially built)

`ChatPanel.svelte` already has `@mention` logic (`mentions` state, lines 211–272).
If the user types `@<filename>`, the file content is included. Making this automatic
for the currently-open document is the same mechanism — just trigger it on session
open rather than requiring the user to type it.

**Recommended: Option A for speed, Option C for polish.** Option A is a 5-line
change. Option C reuses existing infrastructure and gives the user control.

## Out of Scope

- Automatically injecting ALL open documents — only the primary content area document.
- Injecting file content for non-document views (status page, settings) — skip those.
- Keeping context in sync as the user navigates — inject on session start only; user
  can use @mention to update mid-session.

## Alternatives Considered

**Require user to always use @mention** — rejected. The document is already open and
visible; requiring explicit mention creates unnecessary friction. The AI should know
what you're looking at.

## Future

- `@doc` shorthand to re-inject the current document mid-session.
- Auto-inject related documents (e.g. the proposal a plan was created from) as
  secondary context.
