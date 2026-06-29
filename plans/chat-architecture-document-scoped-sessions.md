---
title: Chat Architecture — Document-Scoped Sessions and Specialist AI Roles
status: approved
author: NetYeti
created: 2026-06-29
type: plan
tags:
  - chat
  - architecture
  - ai
  - opencode
  - phase-4
  - performance
proposal_source: proposals/approved/chat-architecture-document-scoped-sessions.md
priority: high
complexity: medium
automated: full
assigned_to: NetYeti
tests_defined: true
tests_human_reviewed: false
_path: plans/chat-architecture-document-scoped-sessions.md
total_steps: 6
completed_steps: 0
scenario_synthesis: "Happy path: user opens plan A, chats with AI — AI reads it on demand; navigates to plan B, opens chat — fresh session, separate history; navigates back to plan A, opens chat — previous conversation restored instantly from localStorage. Failure path: OpenCode restarts — stale session ID detected on reconnect, new session auto-created transparently; user conversation lost but UI recovers without error."
---

# Chat Architecture — Document-Scoped Sessions and Specialist AI Roles

## Overview

Replace the single global OpenCode session with a `Map<filePath, sessionId>` so each
document gets its own persistent chat history. Add staleness recovery for server restarts,
a session indicator and new-chat button in the UI, a typed `ai-roles.ts` config for
the four specialist roles, and `aiSpecialist()` / `aiSpecialistStream()` bridge methods
so plugins can access specialist AI without managing OpenCode themselves.

Already done and in scope (do not re-implement): system prompt injection at session
creation; `opencodeComplete()` separation of UI actions from chat.

## Implementation Steps

| Step | Action | Details | Status |
| --- | --- | --- | --- |
| 1 | Document-scoped session map in ChatPanel | Replace the single `currentID` + `sessions[]` pattern with a `Map<filePath, sessionId>` stored in localStorage (key: `dw-chat-sessions`). On chat-open: if `filePath` has a stored session ID, call `selectSession(id)` to reconnect; if none, create a new session. A null/empty `filePath` (status page, settings) creates a general-purpose session keyed as `__general`. Session map capped at 20 entries — evict least-recently-used on overflow. | ⏳ Pending |
| 2 | Session staleness recovery | When `selectSession(id)` returns a 404 or throws, treat it as stale: delete the entry from the map and localStorage, then create a fresh session for the current document. This must be silent — the user sees the chat panel open fresh, not an error. Also handle the case where the stored session list is empty or the session has been archived. | ⏳ Pending |
| 3 | Session indicator + new-chat button | In the ChatPanel header, show the filename (not full path) of the document the current session is bound to: e.g. `📄 multiuser-auth-concurrent-sessions.md`. Add a `↺` (new chat) button that clears the session for the current document from the map, creates a fresh one, and resets `messages`. Position near the model picker. Hide both when session is general-purpose (no document). | ⏳ Pending |
| 4 | `ai-roles.ts` — typed specialist role config | Create `src/webui/src/lib/ai-roles.ts` with a `RoleConfig` interface and an `AI_ROLES` map for the four roles: `doc-reviewer`, `doc-improver`, `plan-executor`, `doc-assistant`. Each role has `systemPrompt: string` and `streaming: boolean`. Refactor the inline system prompts in `improve/+server.ts`, `plan-review/+server.ts`, and `apply-review/+server.ts` to reference the typed config rather than ad-hoc strings. | ⏳ Pending |
| 5 | `aiSpecialist()` + `aiSpecialistStream()` bridge methods | Add two methods to `window.__docwright.bridge`: `aiSpecialist(role, prompt)` → `Promise<string>` (wraps `opencodeComplete()` with the role's system prompt prepended); `aiSpecialistStream(role, prompt)` → `EventEmitter`-like with `on('token')` and `on('done')` (wraps the OpenCode session SSE path for streaming/multi-turn use cases like plan-execute). Expose role names as `window.__docwright.bridge.aiRoles` — a string array so plugins can discover available roles. | ⏳ Pending |
| 6 | Plugin API docs + e2e test | Document `aiSpecialist()` and `aiSpecialistStream()` in `docs/plugins.md` with usage examples. Add an e2e test that: (a) opens chat on two different documents and verifies they get different session IDs; (b) simulates a stale session (bad ID in localStorage) and verifies auto-recovery; (c) calls `window.__docwright.bridge.aiSpecialist('doc-reviewer', prompt)` in a Playwright page eval and verifies a non-empty string response. | ⏳ Pending |

## Testing Plan

### Step Verification

- [ ] Step 1: Opening chat on doc A then doc B gives different session IDs; re-opening A restores history
- [ ] Step 2: Manually setting a bad session ID in localStorage → chat opens fresh without error
- [ ] Step 3: Session indicator shows correct filename; ↺ button creates a new session for the same doc
- [ ] Step 4: `AI_ROLES['doc-reviewer'].systemPrompt` accessible; review/improve routes use typed role
- [ ] Step 5: `bridge.aiSpecialist('doc-reviewer', 'test')` returns non-empty string from Playwright eval
- [ ] Step 6: e2e tests pass; plugin docs updated

### Integration & Regression

- [ ] Existing e2e suite passes (`npm run test:e2e`)
- [ ] Existing chat functionality (send message, SSE stream, model picker) unaffected
- [ ] `opencodeComplete()` routes (plan-review, apply-review, synthesize) unaffected

### Gate Criteria

- [ ] `tests_defined` set to `true` in frontmatter
- [ ] Human reviewer has verified step outcomes above
- [ ] No regressions in chat, review, improve, or plan-execution flows

## Rollback Procedures

Revert `ChatPanel.svelte` to single-session behavior. The `ai-roles.ts` module is
additive and can remain without breaking anything. The bridge methods can stay unused.

## Risk Assessment

**LOW** — All changes are contained to `ChatPanel.svelte`, `ai-roles.ts`, and the
bridge. The `opencodeComplete()` routes and the SSE watcher are untouched.

**MEDIUM** — localStorage session map could get out of sync with OpenCode state.
Staleness recovery (Step 2) is the primary mitigation; keep the implementation simple
and well-tested.

## Document History

| Date | Change | Author |
| --- | --- | --- |
| 2026-06-29 | Wrote full implementation steps (6 steps). | NetYeti |
