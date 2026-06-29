---
title: "Chat Panel — AI Should Apply Changes to the Active Document"
author: NetYeti
created: 2026-06-28
tags:
  - chat
  - ux
  - write
  - phase-4
  - bug
approved: false
created_by: "NetYeti@phoenix"
assigned_to: ""
priority: high
---

## Problem

When a user asks the DocWright chat AI to fix something in the current document,
it advises but does not act. The document is unchanged after the conversation.

**Observed:** User opens a plan, says "Looks like Testing Plan has duplication" —
the AI identifies the issue but the Testing Plan section remains duplicated.

OpenCode's `build` agent *has* bash and file write tools. The problem is that:

1. It doesn't know which file is active (see `chat-active-document-context` proposal).
2. It has no instruction to prefer writing back to DocWright's write API over direct
   file system edits.
3. There is no "apply" step — the chat is implicitly advisory-only with no affordance
   for the AI to propose and commit a change.

## Proposed Solution

Two complementary changes:

### 1. System prompt for the DocWright chat session

When creating an OpenCode session for the DocWright chat, inject a system prompt that
tells the AI it is operating as a DocWright document assistant:

```
You are a DocWright document assistant. The user is viewing a governance document
in the DocWright web UI.

When the user asks you to fix, update, or improve the current document:
1. Show the user a diff or the proposed new content first.
2. If they confirm, write the change to disk using the write tool.
   The file is at: <absolute path to active document>
3. DocWright's SSE watcher will detect the change and refresh the UI automatically.

Do not make changes without showing them first. Do not modify frontmatter fields
that require human approval (approved:, gate_status:, status: completed).
```

This turns the chat from an advisor into an actor, with a built-in show-then-apply
pattern that preserves human oversight.

### 2. Post-write toast / refresh signal

After OpenCode writes a file, DocWright's SSE file watcher fires and the document
page reloads automatically (this already works — confirmed in the SSE watch tests).
No additional plumbing needed. Add a toast notification: "Document updated by AI chat."

## Implementation Notes

- The system prompt is injected at session creation time via the `system` or
  `initialMessages` field on the OpenCode session API.
- The absolute file path must be passed so OpenCode's file tools can address it
  correctly (OpenCode works relative to the session directory, which is the vault root).
- This pairs with `chat-active-document-context` — context injection and write-back
  should ship together as a single plan.

## Out of Scope

- Undo/rollback of AI-made edits — git history + the existing git undo feature covers this.
- Governance gate enforcement in chat — the pre-commit hook enforces this at commit time.
  The AI is instructed not to modify governance-gated fields, but the hook is the backstop.
- Streaming diffs in the chat UI — showing a text diff before applying is sufficient.

## Alternatives Considered

**Keep chat advisory-only, add a separate "Apply AI suggestion" button** — valid but
creates a two-step UX where one step is sufficient. The show-then-confirm pattern
built into the system prompt achieves the same safety with less friction.

**Route writes through `/api/write`** — would add ETag/conflict detection. Deferred:
direct file tool writes trigger the SSE watcher and git history captures the change.
Can be added later if concurrent-edit conflicts become an issue in practice.

## Future

- Automatic commit after AI edit with message "chore: AI chat — <user's instruction>".
- Conflict detection: if the document changed since the AI read it, warn before writing.
- Multi-file edits: AI can propose changes across related documents (plan + proposal).
