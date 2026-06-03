---
complexity: medium
title: "Chat Panel — Dual Mode for Enterprise (Personal + Server AI)"
author: NetYeti
created: 2026-06-03
tags:
  - enterprise
  - ai
  - chat
  - opencode
  - improvements
deferred: true
deferred_reason: "Requires server-side AI (enterprise-server-ai). Single direct/proxy toggle covers team server scenario adequately."
created_by: "NetYeti@phoenix"
assigned_to: NetYeti
related_to:
  - proposals/enterprise-server-ai.md
  - proposals/web-ui-ai-chat-panel.md
  - docs/deployment.md
---

## Problem

In enterprise deployments, both a personal AI (developer's local OpenCode)
and a server AI (shared, for automation context) should be simultaneously
accessible. The current mode toggle (direct vs proxy) forces a choice between
them rather than making both available.

## Proposed Solution

A named connection system in the chat panel — multiple configured OpenCode
endpoints, switchable by name:

```
[ My OpenCode ▾ ]   ← dropdown shows all configured connections
  ✓ My OpenCode     (direct, localhost:4096)
    Server AI        (proxy, /api/opencode)
    Team Claude      (direct, claude.internal:4096)
```

Each connection has:
- A display name
- A URL (direct) or `proxy` for the server
- Optional notes (e.g. "use for automation context", "Claude Opus only")
- Stored in localStorage

Switching connections changes the active base URL for all API calls. Sessions
are per-connection — switching does not lose the current session.

## HTTPS / localhost mixed content

For team server and enterprise scenarios on HTTPS, connecting to HTTP localhost
from the browser has browser-specific behaviour:

- Chrome/Edge 94+: allowed (localhost is a "potentially trustworthy origin")
- Firefox: allowed with `network.websocket.allowInsecureFromHTTPS`
- Safari: restricted — recommend proxy mode or localhost HTTPS cert

The chat panel settings should detect and warn about potential mixed content
issues based on `window.location.protocol` and the configured URL.

## Deferred Because

Current single direct/proxy toggle handles the team server scenario.
Enterprise dual-mode requires server-side AI to be available.
See [[proposals/enterprise-server-ai.md]].

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-03 | Created — enterprise deployment scenario | NetYeti |
