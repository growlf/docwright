---
title: Chat Architecture — Document-Scoped Sessions and Specialist AI Roles
status: completed
completed_date: 2026-06-29
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
tests_human_reviewed: true
_path: plans/completed/chat-architecture-document-scoped-sessions.md
total_steps: 6
completed_steps: 6
scenario_synthesis: "Happy path: user opens plan A, chats with AI — AI reads it on demand; navigates to plan B, opens chat — fresh session, separate history; navigates back to plan A, opens chat — previous conversation restored instantly from localStorage. Failure path: OpenCode restarts — stale session ID detected on reconnect, new session auto-created transparently; user conversation lost but UI recovers without error."
---

# Chat Architecture — Document-Scoped Sessions and Specialist AI Roles

## Overview

Replaced single global OpenCode session with document-scoped sessions, fixed AI
write-back (root cause: OpenCode permission.asked event was never handled — fixed via
`~/.config/opencode/opencode.json` setting `bash/edit/write: allow`), added typed
specialist AI roles, and exposed `aiSpecialist()` bridge for plugins.

## Implementation Steps

| Step | Action | Details | Status |
| --- | --- | --- | --- |
| 1 | Document-scoped session map in ChatPanel | `Map<filePath, sessionId>` in localStorage, LRU cap 20, connects on chat-open | ✅ Done |
| 2 | Session staleness recovery | 404/410 → clear + recreate silently; network errors → preserve | ✅ Done |
| 3 | Session indicator + new-chat button | `📄 filename` badge + `↺` button in chat header | ✅ Done |
| 4 | `ai-roles.ts` typed config | 4 specialist roles; plan-review + apply-review wired up | ✅ Done |
| 5 | `aiSpecialist()` + `aiSpecialistStream()` bridge methods | `/api/ai-specialist` endpoint + bridge API for plugins | ✅ Done |
| 6 | Plugin API docs + e2e tests | `docs/plugins.md` updated; `npm run test:chat-sessions` | ✅ Done |

## Testing Plan

### Step Verification

- [x] Step 1: Opening chat on doc A then doc B gives different session IDs; re-opening A restores history
- [x] Step 2: Stale session ID cleared and fresh session created on reconnect
- [x] Step 3: Session indicator shows correct filename; ↺ creates new session
- [x] Step 4: `AI_ROLES['doc-reviewer']` accessible; review/improve routes use typed role
- [x] Step 5: `bridge.aiSpecialist('doc-reviewer', 'test')` returns non-empty text
- [x] Step 6: `/api/config` returns aiGateway; synthesize routes through OpenCode ✅ verified

### Integration & Regression

- [x] AI write-back works: user says "write X" and the file is modified ✅ verified
- [x] OpenCode permission config (`bash/edit/write: allow`) documented
- [x] `opencodeComplete()` routes (plan-review, apply-review, synthesize) working ✅

### Gate Criteria

- [x] `tests_defined` set to `true` in frontmatter
- [x] Human reviewer has verified step outcomes above
- [x] AI write-back to documents working end-to-end ✅

## Document History

| Date | Change | Author |
| --- | --- | --- |
| 2026-06-29 | All 6 steps complete. Root cause for tool-blocking found: OpenCode permission.asked event required client response. Fixed via opencode.json permission config. Write-back verified working. | NetYeti |
