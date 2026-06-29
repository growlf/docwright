---
title: "Chat Architecture — Document-Scoped Sessions and Specialist AI Roles"
author: NetYeti
created: 2026-06-29
tags:
  - chat
  - architecture
  - ai
  - opencode
  - phase-4
  - performance
approved: false
created_by: "NetYeti@phoenix"
assigned_to: ""
priority: high
supersedes: chat-active-document-context.md
---

## Problem

The current chat implementation has a fundamental architectural mismatch:

1. **Single global session per vault** — one OpenCode session shared across all documents
   and all UI actions. Switching documents or running a review corrupts the conversation
   history for the interactive chat.

2. **Naive context injection** — the active document's full content is dumped into the
   first message's text payload (8KB+), making the first user message ugly, token-wasteful,
   and potentially hitting context limits on long plans.

3. **UI action buttons share the chat session** — plan-review, apply-review, and the
   improve button all currently use ephemeral `opencodeComplete()` calls, but there is
   no principled boundary between those and the interactive chat. As features are added,
   this will blur.

4. **No session persistence across navigation** — every document switch loses the
   conversation with the AI about that document. Users must re-explain context after
   navigating away and back.

## Proposed Architecture

### 1. Document-scoped persistent sessions

Maintain a `Map<filePath, sessionId>` in the ChatPanel. When the user opens the chat
panel while viewing a document:

- If a session already exists for that `filePath` → reconnect to it (fast, no AI call)
- If no session exists → create one, inject a short system message:
  `"The user is viewing: <filePath>. The file is in the vault at <vaultRoot>/<filePath>.
   Use your read file tool to examine it when needed."`
  (No content dump — the AI reads the file itself via its built-in read tool)
- Session ID is persisted in `localStorage` keyed by file path so it survives page refresh

Benefits:
- Switching back to a previously-opened document instantly restores the conversation
- No 8KB content injection — the AI reads on demand
- Different documents have independent conversation histories

### 2. Session lifecycle rules

- **Create on chat-open** — session is created only when the chat panel is opened with a
  document active. Opening chat on the status page, settings, or with no document open
  creates a general-purpose session with no document binding.
- **No eagerly-created sessions** — do not pre-create sessions on document navigation.
  A session is valuable only if the user actually opens chat.
- **Session cap** — keep at most N (e.g. 20) document-scoped sessions in localStorage;
  evict the oldest when the cap is hit.

### 3. Specialist AI roles for UI actions

UI action buttons (plan review, apply review, improve, plan execute) should use
**short-lived sub-agent sessions** with specialist system prompts, completely separate
from the interactive chat session. Each specialist role has a defined purpose and
persona:

| Role | Trigger | System prompt focus |
|---|---|---|
| `doc-reviewer` | Review button | Identify gaps, weak reasoning, missing sections. Structured critique output. |
| `doc-improver` | Improve button | Flesh out sparse sections, preserve author intent, return only improved markdown. |
| `plan-executor` | Execute button | Step-by-step implementation of the active plan step. Safety-first. |
| `doc-assistant` | Chat panel | General document assistant. Reads files on demand. Shows changes before writing. |

These roles are defined as configuration (a JSON or YAML file in DocWright) — not
hardcoded. Plugins can reference them by name to get a pre-configured AI connection
optimized for their use case.

### 4. Plugin AI specialist API (bridge extension)

Extend `window.__docwright.bridge` with an `aiSpecialist(role, prompt)` method:

```javascript
// Plugin usage — get a doc-reviewer AI without configuring OpenCode yourself
const review = await window.__docwright.bridge.aiSpecialist('doc-reviewer', content);
```

DocWright handles session creation, system prompt injection, model selection, and
cleanup. Plugins get high-quality AI responses without needing to know about OpenCode
internals. This is a platform feature — every plugin that ships with DocWright or
integrates with it gets consistent, optimized AI without reinventing the wheel.

### 5. Revert naive context injection

The `[Active document: ...]` prefix injected in Step 2 of `chat-active-document-context`
should be removed. The new architecture replaces it cleanly: the AI reads the file
via its own tools when needed, guided by the short system message at session creation.

## Implementation Order

1. **Revert naive injection** — remove the content prefix from first message
2. **Document-scoped session map** — `Map<filePath, sessionId>` with localStorage persistence
3. **System message at session creation** — short path hint, not content dump
4. **Specialist role config** — define the 4 roles as JSON in `src/webui/`
5. **`aiSpecialist()` bridge method** — calls `opencodeComplete()` with role system prompt
6. **UI buttons use roles** — plan-review, apply-review, improve switch to `aiSpecialist()`
7. **Plugin API docs** — document the bridge extension in `docs/plugins.md`

## Out of Scope

- Multi-document sessions (AI reasoning across files simultaneously) — future
- Session sharing between users — future (multi-user is a separate plan)
- Persistent session storage on the server — sessions live in localStorage for now

## Alternatives Considered

**Keep content injection but compress it** — inject a summary instead of full content.
Rejected: still pollutes message history; the AI's read tool is the right solution.

**Create sessions eagerly on navigation** — pre-create a session for every document
opened. Rejected: sessions have a cost; most opened documents never get a chat session.

## Future

- The specialist role system becomes the foundation for DocWright's AI governance layer:
  every AI action is traceable to a named role, making audit logs meaningful.
- Roles can be customized per-vault via `profile.json` — an org can define its own
  specialist with a custom system prompt reflecting their governance policies.
