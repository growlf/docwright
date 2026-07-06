---
title: "Deferred: Chat Panel Terminal/PTY (xterm.js + WebSocket)"
author: NetYeti
author-role: contributor
created: 2026-06-29
tags:
  - ui
  - chat
  - terminal
  - developer-tools
  - phase-future
complexity: high
estimated_effort: L
approved: false
created_by: "NetYeti@phoenix"
assigned_to: ""
related_to:
  - plans/chat-session-panel.md
  - proposals/approved/bundle-chat-session-panel.md
deferred_reason: "Gate condition not met: at least 3 distinct developer users must explicitly request a terminal panel before implementation begins. Deferred from chat-session-panel.md Tier 4 (steps 16–17)."
milestone: backlog
---

## Problem

Developer users working with DocWright may need raw shell access alongside the AI
chat panel — for running scripts, inspecting file system state, or executing git
commands — without leaving the web UI. The current chat panel delegates all
execution to OpenCode's AI session, which may be insufficient for users who need
direct terminal interaction.

## Proposed Solution

### Demand Validation (Step 16)

Survey developer users: is the AI chat panel (via OpenCode + MCP) sufficient for
their automation needs, or is raw shell access required? Gate clears when at least
3 distinct developer users explicitly request a terminal panel. Findings documented
in `docs/terminal-demand.md`.

### PTY Panel Implementation (Step 17, if gate clears)

Collapsible panel below chat using `xterm.js` (MIT, same license as VS Code).
WebSocket connection to OpenCode PTY endpoint, scoped to the vault directory.

**Security requirements (must be satisfied before shipping):**
- Only exposed when DocWright is deployed in a developer-only context
- Deploy-time flag to disable the terminal entirely (default: off)
- Prominent warning in the settings UI when enabled
- No access to paths outside the vault root

## Gate Condition

Implementation must not begin until at least 3 distinct developer users have
explicitly (in writing) requested a terminal panel. Document the requests in
`docs/terminal-demand.md` with user identifier, date, and verbatim request.

If the gate never clears, this proposal should be withdrawn with a written
rationale: OpenCode's AI-mediated execution via MCP is sufficient for the
developer use cases we actually see.

## Security Note

A web-accessible PTY is a significant security surface. This feature is appropriate
only for self-hosted, developer-only DocWright deployments. It must never be enabled
in a shared or public-facing deployment. The deploy-time flag and UI warning are
non-negotiable prerequisites.

## Out of Scope

- Collaborative terminal sessions (multi-user PTY)
- Terminal history persistence across sessions
- Custom shell configuration per user

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-29 | Created as deferred from chat-session-panel.md Tier 4 (steps 16–17) | NetYeti |
