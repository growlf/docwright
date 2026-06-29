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
approved: true
created_by: "NetYeti@phoenix"
assigned_to: "NetYeti"
priority: high
supersedes: chat-active-document-context.md
---

## Problem

The current chat panel has two remaining architectural gaps after the OpenCode
unification work:

1. **Single global session per vault** — one OpenCode session is shared across all
   documents. Switching documents means the AI has no awareness of the new document
   unless the user manually re-establishes context. Switching back to a previous
   document means starting over.

2. **No session persistence across navigation** — every page navigation destroys
   the conversation thread. Users must re-explain context after briefly navigating
   away and back.

The third original problem — UI action buttons (review, improve, synthesize) sharing
the chat session — is already fixed: they use ephemeral `opencodeComplete()` calls
completely independent of the chat session. This proposal is not about those.

## Proposed Architecture

### 1. Document-scoped persistent sessions

Maintain a `Map<filePath, sessionId>` in the ChatPanel. When the user opens the chat
panel while viewing a document:

- **Existing session** → reconnect to it instantly (no AI call, no context re-injection).
  The existing conversation history is displayed.
- **New document** → create a session, inject a short system message at creation:
  `"The user is viewing: <filePath>. Full path: <vaultRoot>/<filePath>. Use your read
   file tool to examine it when needed. Show proposed changes before writing."`
  No content dump — the AI reads the file on demand via its built-in read tool.
- **No active document** (status page, settings) → create a general-purpose session
  with a generic DocWright assistant system message.

Session IDs are stored in `localStorage` keyed by `filePath`, so they survive page
refresh.

### 2. Session staleness recovery

OpenCode sessions live in OpenCode's process memory. After a server restart all stored
session IDs become invalid. ChatPanel must handle this gracefully:

- On reconnect attempt: if `selectSession()` returns a 404 or error, treat the session
  as stale and create a new one for the current document.
- On stale detection: clear the stored session ID for that `filePath` from localStorage.
- This is transparent to the user — the conversation history is lost but the session
  auto-recovers rather than showing an error.

### 3. Session lifecycle rules

- **Create on chat-open** — session created only when the user opens the chat panel
  with a document active. Documents the user merely navigates through but never chats
  about get no sessions.
- **Session cap** — keep at most 20 document-scoped session IDs in localStorage; evict
  the least-recently-used when the cap is hit.
- **New session button** — a "↺ New chat" control in the panel header allows the user
  to clear the current session and start fresh for the same document (for when a
  conversation has gone off track).
- **Session indicator** — the chat panel header shows the bound document's filename
  so the user knows which document the AI has context for, especially when they've
  navigated away.

### 4. Specialist AI roles

UI action buttons and plugins use **named specialist roles** — short-lived, ephemeral
`opencodeComplete()` calls with pre-defined system prompts. These are never part of
the persistent chat session.

| Role | Trigger | System prompt focus |
|---|---|---|
| `doc-reviewer` | Review button | Identify gaps, weak reasoning, missing sections. Structured critique only. |
| `doc-improver` | Improve button | Flesh out sparse sections, preserve author intent, return only improved markdown body. |
| `plan-executor` | Execute button | Implement the specific active step. Show work. Safety-first. Streaming. |
| `doc-assistant` | Chat panel | General document assistant. Read files on demand. Show changes before writing. |

Roles are defined in `src/webui/src/lib/ai-roles.ts` — a typed config object, not a
separate JSON file. This keeps them versioned with the code and type-safe. A future
phase can move them into `profile.json` under an `aiRoles` key for per-vault
customization; the implementation is the same, the source changes.

### 5. Plugin AI specialist bridge API

Extend `window.__docwright.bridge` with `aiSpecialist()` so plugins get high-quality
AI without managing OpenCode sessions themselves:

```javascript
// Single-turn specialist (returns string when done)
const review = await window.__docwright.bridge.aiSpecialist('doc-reviewer', prompt);

// Streaming specialist (for long-running tasks like plan-execute)
const stream = window.__docwright.bridge.aiSpecialistStream('plan-executor', prompt);
stream.on('token', text => console.log(text));
stream.on('done', result => applyResult(result));
```

`aiSpecialist()` wraps `opencodeComplete()`. `aiSpecialistStream()` wraps the OpenCode
session SSE stream for multi-turn or long-running operations. DocWright manages session
creation, system prompt injection, model selection, and cleanup.

## Implementation Order

1. **Document-scoped session map** — `Map<filePath, sessionId>` with localStorage
   persistence; replace the current single-session logic in ChatPanel.
2. **Session staleness recovery** — handle 404/error on `selectSession()` by creating
   a fresh session.
3. **Session indicator + new-chat button** — show bound document name in chat header;
   add "↺ New chat" to reset the session for the current document.
4. **`ai-roles.ts` config** — define the 4 roles as a typed config. Refactor
   plan-review, apply-review, and improve to use them instead of inline prompts.
5. **`aiSpecialist()` + `aiSpecialistStream()` bridge methods** — expose roles to
   plugins via the bridge.
6. **Plugin API docs** — document the bridge extension in `docs/plugins.md`.

> **Already done (do not re-implement):** system prompt injection at session creation
> (path hint telling the AI which file the user is viewing); reverted naive content
> injection; `opencodeComplete()` separation of UI actions from chat.

## Out of Scope

- Multi-document sessions (AI reasoning across multiple files) — future
- Session sharing between users — multi-user plan covers this
- Persistent session storage on the server — localStorage is sufficient for now
- Role customization in `profile.json` — deferred to after the core architecture ships

## Alternatives Considered

**Inject a compressed summary instead of full content** — rejected. Still pollutes
message history; the AI's read file tool is the right solution and already available
via the `build` agent.

**Eager session creation on navigation** — rejected. Most navigated documents are
never chatted about; session creation has a latency cost.

**One session per browser tab** — rejected. Users expect document context to be
persistent, not tab-scoped.

## Future

- The specialist role system becomes the foundation for DocWright's AI governance
  layer: every AI action is traceable to a named role with a defined prompt contract.
  Audit logs become meaningful: "doc-reviewer ran on plans/foo.md at 14:23".
- Roles customizable per-vault via `profile.json` — an org defines specialists
  reflecting their own governance policies (e.g., a compliance-focused `doc-reviewer`
  that checks against specific regulations).
- `aiSpecialistStream()` enables the plan-execute panel to show live AI output token
  by token, with proper progress indication across multi-step tool calls.
