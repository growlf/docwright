---
complexity: low
title: "Web UI Terminal / PTY Panel"
author: NetYeti
created: 2026-06-03
tags:
  - ui
  - terminal
  - pty
  - opencode
  - improvements
deferred: true
deferred_reason: "High complexity. Governance app does not need a terminal in MVP. Revisit post-launch."
created_by: "NetYeti@phoenix"
assigned_to: NetYeti
related_to:
  - proposals/web-ui-ai-chat-panel.md
---

## Problem

OpenCode's `opencode serve` API exposes a WebSocket PTY endpoint that provides
a full interactive terminal session. DocWright's Web UI has no terminal panel.
Contributors who need to run git commands, inspect files, or run scripts must
leave the browser.

## Proposed Solution

A collapsible terminal panel in the DocWright Web UI, powered by the OpenCode
PTY WebSocket endpoint. Use `xterm.js` (MIT) for the browser-side terminal
renderer — the same library used by VS Code and many web terminals.

The PTY is scoped to the vault directory. Commands run in the vault context.

## Deferred Because

A terminal panel is a significant security surface. In a governance app used
by non-developer contributors, a visible terminal is more likely to cause
confusion than provide value. The AI chat panel (via OpenCode + MCP) covers
the automation use case without exposing a raw shell.
See [[proposals/web-ui-ai-chat-panel.md]].

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-03 | Created — deferred from web-ui-ai-chat-panel proposal | NetYeti |
