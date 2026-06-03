---
title: "Chat Session History Scoped to Vault"
author: NetYeti
created: 2026-06-03
tags:
  - ui
  - chat
  - sessions
  - multi-vault
  - improvements
deferred: true
deferred_reason: "Post-MVP. Useful for multi-vault users; single-vault users can use OpenCode's own session list."
created_by: "NetYeti@phoenix"
assigned_to: NetYeti
related_to:
  - proposals/web-ui-ai-chat-panel.md
  - proposals/approved/project-registry.md
---

## Problem

OpenCode's session list shows all sessions across all projects. A DocWright
user with multiple vaults open has no way to filter sessions to the current
vault. Finding a previous conversation about a specific vault's proposals
requires scrolling through unrelated sessions.

## Proposed Solution

Tag sessions created by DocWright with the vault path (stored in the session's
metadata or title prefix). The DocWright chat panel's session list filters to
show only sessions tagged to the current vault by default, with a toggle to
show all sessions.

Session naming convention: `[vault-name] document-title YYYY-MM-DD` auto-set
by DocWright when creating a session.

## Deferred Because

Single-vault users (the majority at launch) are not affected by this.
Multi-vault session filtering is a polish item for after the base panel
is proven in use.
See [[proposals/web-ui-ai-chat-panel.md]].

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-03 | Created — deferred from web-ui-ai-chat-panel proposal | NetYeti |
