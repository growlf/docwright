---
title: "Chat & Session Panel Phase 2 — Session Management, @-Mention, Model Picker, History, Diff Review, and Terminal"
author: NetYeti
created: 2026-06-06
tags:
  - ui
  - chat
  - sessions
  - opencode
  - ai
  - phase-3
complexity: high
estimated_effort: XL
approved: false
created_by: NetYeti@phoenix
assigned_to: ""
absorbs:
  - proposals/web-ui-session-management.md
  - proposals/chat-at-mention-context.md
  - proposals/chat-dual-mode-enterprise.md
  - proposals/chat-model-picker.md
  - proposals/chat-vault-session-history.md
  - proposals/web-ui-diff-review-panel.md
  - proposals/web-ui-terminal-panel.md
depends_on:
  - proposals/approved/web-ui-ai-chat-panel.md
---

## Problem

The MVP AI chat panel (Phase 2) covers the core loop: create session, send
prompt, stream response. Seven deferred proposals represent the next layer of
the chat experience. All seven depend on the base panel being stable and proven
in daily use. Tracking them individually creates noise — they share a dependency
and a delivery moment.

## Proposed Solution

Deliver as a single Phase 3 Chat & Session Panel plan. Items are grouped by
delivery tier.

### Tier 1 — Base session management (ship first in Phase 3)

**Full session management UI**

Extends the chat panel with a session management sidebar:
- Session list grouped by today / yesterday / older (matching OpenCode conventions)
- Fork session — create a branch point to explore an alternative approach
- Session summary — trigger `POST /session/:id/summarize` to compact long sessions
- Share session — `POST /session/:id/share` generates a shareable link
- Abort — cancel a running prompt mid-stream
- Delete session with confirmation
- Token usage and cost tracking per session (from the OpenCode event stream)

**@-mention to inject document context**

`@document-name` mention syntax in the chat input:
- Typing `@` opens autocomplete populated from the vault file tree
- Selected document appends its path and frontmatter summary to the prompt context
- Autocomplete filters by title and path
- Selected mentions appear as removable chips in the input area
- Reuses file tree data already loaded by the sidebar (no new data source)

**Model / provider picker**

A model picker dropdown in the chat panel header:
- Populated from `GET /v2/provider` and `GET /v2/model`
- Selecting a model updates the active session's model preference via OpenCode API
- Per-vault default model settable in `opencode.json`

**Vault-scoped session history**

Sessions created by DocWright are tagged with the vault path (in session metadata
or title prefix). The chat panel session list:
- Filters to show only sessions tagged to the current vault by default
- Toggle to show all sessions
- Session naming convention: `[vault-name] document-title YYYY-MM-DD` auto-set
  on session creation

### Tier 2 — Depends on dispatch module maturity (Phase 3 mid/late)

**Diff / review panel for AI sessions**

When the AI modifies vault documents during a session, surfaces changes for
human review before committing:
- `GET /session/:id/diff` (OpenCode API) returns the diff for a session
- DocWright renders this as a side-by-side diff view in a panel or modal
- Changes annotated with governance context: which frontmatter fields changed,
  whether any lifecycle transitions occurred, whether any gate rules were triggered
- Accept all / reject all / selective staging before committing
- This is the "human in the loop" checkpoint for AI-driven edits in guided mode
- Depends on: dispatch module lifecycle awareness to annotate changes with
  governance context (without it, this is just a git diff — already in the git panel)

### Tier 3 — Depends on enterprise server AI (Phase 3 late / enterprise only)

**Dual mode for enterprise (personal + server AI)**

A named connection system with multiple configured OpenCode endpoints:
```
[ My OpenCode ▾ ]
  ✓ My OpenCode     (direct, localhost:4096)
    Server AI        (proxy, /api/opencode)
    Team Claude      (direct, claude.internal:4096)
```
Each connection: display name, URL (direct) or `proxy`, optional notes.
Stored in `localStorage`. Switching connections changes the active base URL.
Sessions are per-connection.

Mixed content note: for HTTPS deployments connecting to HTTP localhost:
- Chrome/Edge 94+: allowed (localhost is "potentially trustworthy")
- Firefox: allowed with `network.websocket.allowInsecureFromHTTPS`
- Safari: recommend proxy mode or localhost HTTPS cert
Panel settings should detect and warn about potential mixed content issues.

Depends on: [[proposals/bundle-enterprise-tier.md]] server-side AI.

### Tier 4 — Post-launch, evaluate demand

**Terminal / PTY panel**

A collapsible terminal panel powered by the OpenCode PTY WebSocket endpoint,
using `xterm.js` (MIT — same library as VS Code). PTY scoped to the vault
directory.

Note: a terminal panel is a significant security surface in a governance app
used by non-developer contributors. The AI chat panel (via OpenCode + MCP)
covers the automation use case without exposing a raw shell. Ship only if
demand from developer users is clear; keep deprioritized until then.

## Relationship to Existing Work

| Proposal / Plan | Relationship |
|-----------------|-------------|
| [[proposals/approved/web-ui-ai-chat-panel.md]] | This bundle is the Phase 3 successor to the MVP panel |
| [[proposals/approved/project-registry.md]] | Vault-scoped session history uses vault paths from the project registry |
| [[proposals/bundle-enterprise-tier.md]] | Dual-mode enterprise chat depends on server-side AI |
| [[plans/phase-3-profile-acl-ai.md]] | Diff review panel requires dispatch lifecycle awareness |

## Out of Scope

| Idea | Why deferred |
|------|-------------|
| Real-time collaborative chat (shared sessions) | Phase 4+ multi-user concern |
| Chat-to-proposal pipeline (auto-create proposals from chat) | Separate proposal; requires careful AI governance boundary design |
| Voice input | Accessibility concern but not core; post-launch |

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-06 | Created — consolidated from 7 individual deferred proposals | NetYeti |
