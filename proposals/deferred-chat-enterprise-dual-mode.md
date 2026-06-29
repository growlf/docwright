---
title: "Deferred: Chat Panel Enterprise Dual-Mode (Named Connections, Mixed Content)"
author: NetYeti
author-role: contributor
created: 2026-06-29
tags:
  - ui
  - chat
  - enterprise
  - opencode
  - phase-future
complexity: medium
estimated_effort: M
approved: false
created_by: "NetYeti@phoenix"
assigned_to: ""
related_to:
  - plans/chat-session-panel.md
  - proposals/approved/bundle-chat-session-panel.md
  - proposals/bundle-enterprise-tier.md
deferred_reason: "Gate condition not met: proposals/bundle-enterprise-tier.md must be approved before this work begins. Deferred from chat-session-panel.md Tier 3 (steps 13–15)."
---

## Problem

Organizations running DocWright in an enterprise context often need to connect the
chat panel to multiple OpenCode endpoints — a local developer instance, a shared
team instance, and a production proxy — and switch between them at runtime. The
current implementation assumes a single, fixed `OPENCODE_URL` configured at deploy
time.

Additionally, when DocWright is served over HTTPS but the configured OpenCode
endpoint is plain HTTP (e.g. a local LLM running on localhost), browsers silently
block the mixed-content fetch with no user-visible error.

## Proposed Solution

### Named Connection System (Step 13)

Connection config stored in `localStorage` as `dw:opencode-connections: Connection[]`
where `Connection = { name, url, mode: 'direct'|'proxy', notes? }`.

Settings panel tab "Connections": add / edit / delete / set-active. Active connection
URL replaces `OPENCODE_URL` for all chat fetches at runtime. Sessions are
per-connection (sidebar filtered by active connection).

### Mixed Content Detection (Step 14)

On settings panel mount and on connection switch: check if page is `https:` and
selected URL is `http:` non-localhost. If so: show amber warning with
browser-specific guidance (Chrome/Edge: allowed via flag; Firefox: flag needed;
Safari: use proxy mode). Proxy mode routes OpenCode requests through
`/api/opencode-proxy` on the DocWright server.

### Tests (Step 15)

- Connection CRUD in localStorage (add/edit/delete/switch)
- `isUnsafeConnection(pageProtocol, connectionUrl)` unit test covering all
  4 browser × protocol combinations

## Gate Condition

This work must not begin until `proposals/bundle-enterprise-tier.md` is approved.
That proposal defines the broader enterprise tier scope; this feature is one
component of it.

## Out of Scope

- Server-side connection management (per-user connection configs in a database)
- OAuth/SSO integration with enterprise OpenCode deployments (separate proposal)
- Real-time sync of active connection across tabs

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-29 | Created as deferred from chat-session-panel.md Tier 3 (steps 13–15) | NetYeti |
