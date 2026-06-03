---
complexity: low
title: "Web UI Full Session Management"
author: NetYeti
created: 2026-06-03
tags:
  - ui
  - sessions
  - opencode
  - improvements
deferred: true
deferred_reason: "MVP chat panel covers the core use case. Full session management UI is post-launch polish."
created_by: "NetYeti@phoenix"
assigned_to: NetYeti
related_to:
  - proposals/web-ui-ai-chat-panel.md
---

## Problem

The MVP chat panel (Phase 2) supports creating and resuming sessions but does
not expose the full session management capabilities of the OpenCode API:
session list with history, forking a session to explore an alternative
approach, sharing a session, summarising a long session, or aborting a
running session mid-stream.

## Proposed Solution

Extend the chat panel with a full session management sidebar:

- Session list grouped by today / yesterday / older (matching OpenCode's own
  UI conventions)
- Fork session — create a branch point to explore an alternative without
  losing the original
- Session summary — trigger `POST /session/:id/summarize` to compact a long
  session's context
- Share session — `POST /session/:id/share` generates a shareable link
- Abort — cancel a running prompt mid-stream
- Delete — remove a session with confirmation

Token usage and cost tracking per session (from the OpenCode event stream).

## Deferred Because

The MVP chat panel (create session, send prompt, stream response) covers
the primary use case. Full session management is polish that belongs after
the base integration is proven in daily use.
See [[proposals/web-ui-ai-chat-panel.md]].

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-03 | Created — deferred from web-ui-ai-chat-panel proposal | NetYeti |
