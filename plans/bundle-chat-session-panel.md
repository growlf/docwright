---
title: Chat & Session Panel Phase 2 — Session Management, @-Mention, Model Picker, History, Diff Review, and Terminal
status: approved
author: NetYeti
created: 2026-06-08
tags:
  - ui
  - chat
  - sessions
  - opencode
  - ai
  - phase-3
proposal_source: proposals/approved/bundle-chat-session-panel.md
priority: medium
automated: guided
assigned_to: NetYeti
tests_defined: false
phase: 3
depends_on:
  - proposals/approved/web-ui-ai-chat-panel.md
total_steps: 16
completed_steps: 0
scenario_synthesis: SvelteKit UI components + OpenCode API integration; no shell execution or infrastructure steps
---

# Chat & Session Panel Phase 2 — Session Management, @-Mention, Model Picker, History, Diff Review, and Terminal

## Overview

Phase 3 successor to the MVP AI chat panel. Delivers seven previously-deferred
proposals as a single coordinated bundle, grouped into four delivery tiers by
dependency. Tier 1 ships first; Tiers 2–4 follow as their upstream dependencies
mature.

See [[proposals/approved/bundle-chat-session-panel.md]] for the full rationale
and feature specifications.

## Delivery Tiers

| Tier | Features | Gate |
|------|----------|------|
| 1 | Session sidebar, @-mention, model picker, vault-scoped history | Base chat panel stable in daily use |
| 2 | Diff/review panel for AI sessions | Dispatch module lifecycle awareness |
| 3 | Dual-mode enterprise (multi-endpoint) | [[proposals/bundle-enterprise-tier.md]] |
| 4 | Terminal/PTY panel | Demand confirmed from developer users |

## Implementation Steps

### Tier 1 — Base Session Management

| Step | Action | Details | Status |
|------|--------|---------|--------|
| 1 | Session management sidebar | Collapsible sidebar inside `ChatPanel.svelte`: session list grouped by today / yesterday / older. Each row: title, timestamp, token count. | ⏳ Pending |
| 2 | Session CRUD actions | Fork (`POST /session/:id/fork`), summarize (`POST /session/:id/summarize`), share (`POST /session/:id/share`), delete with confirmation. Abort button cancels in-flight stream. | ⏳ Pending |
| 3 | Token + cost tracking | Parse `usage` fields from OpenCode event stream; accumulate per-session. Show in session row and chat header. | ⏳ Pending |
| 4 | @-mention context injection | `@` in chat input opens autocomplete from vault file tree. Selected doc appends path + frontmatter summary to prompt context. Mentions render as removable chips. | ⏳ Pending |
| 5 | Model / provider picker | Dropdown in chat header; populated from `GET /v2/provider` + `GET /v2/model`. Selecting updates active session model via OpenCode API. Per-vault default in `opencode.json`. | ⏳ Pending |
| 6 | Vault-scoped session history | Sessions tagged with vault path on creation (name: `[vault-name] doc-title YYYY-MM-DD`). Session list filters to current vault by default; toggle to show all. | ⏳ Pending |
| 7 | Tests — Tier 1 | Unit: @-mention parsing, session grouping logic, model picker population. Integration: session create/fork/delete flows against mock OpenCode. | ⏳ Pending |

### Tier 2 — Diff / Review Panel

| Step | Action | Details | Status |
|------|--------|---------|--------|
| 8 | Session diff view | `GET /session/:id/diff` → side-by-side diff panel or modal. Requires dispatch module lifecycle awareness to annotate changes with governance context. | ⏳ Pending |
| 9 | Governance annotation | Each changed file annotated: which frontmatter fields changed, any lifecycle transitions triggered, any gate rules fired. | ⏳ Pending |
| 10 | Selective staging | Accept all / reject all / per-file staging before commit. Human-in-the-loop checkpoint for AI-driven edits in guided mode. | ⏳ Pending |
| 11 | Tests — Tier 2 | Governance annotation accuracy; selective staging commit path. | ⏳ Pending |

### Tier 3 — Enterprise Dual Mode

| Step | Action | Details | Status |
|------|--------|---------|--------|
| 12 | Named connection system | Multiple configured OpenCode endpoints stored in `localStorage`. Display name, URL (direct or `proxy`), optional notes. Switching changes active base URL; sessions are per-connection. | ⏳ Pending |
| 13 | Mixed content detection | Detect HTTP-localhost connections from HTTPS deployments. Warn in panel settings with browser-specific guidance. | ⏳ Pending |
| 14 | Tests — Tier 3 | Connection switching, mixed content detection logic. | ⏳ Pending |

### Tier 4 — Terminal Panel

| Step | Action | Details | Status |
|------|--------|---------|--------|
| 15 | Demand validation | Gather signal from developer users before building. Gate: explicit demand confirmed; ship only if justified. | ⏳ Pending |
| 16 | PTY panel (if demanded) | Collapsible terminal using `xterm.js` (MIT). PTY scoped to vault directory via OpenCode WebSocket. | ⏳ Pending |

## Testing Plan

- All Tier 1 units runnable outside browser (pure logic: @-mention parsing, grouping, filtering)
- Integration tests against OpenCode mock server for session lifecycle operations
- Manual golden path: create session → mention document → switch model → fork → summarize → delete
- Tier 2 gated on dispatch module tests passing before merge

## Rollback Procedures

Each tier is an isolated feature flag or component addition to `ChatPanel.svelte`.
Rollback = revert the relevant component change; no data migration needed.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| OpenCode API shape changes between Phase 2 and Phase 3 | Medium | High | Pin to tested API version; adapter layer in `dispatch/opencode.ts` |
| @-mention autocomplete performance on large vaults | Low | Medium | Debounce + limit to first 50 matches; file tree already cached |
| Diff panel governance annotation complexity | High | Medium | Gate Tier 2 strictly on dispatch maturity; ship Tier 1 independently |
| Terminal security surface | Medium | High | Ship Tier 4 only with explicit demand; document the risk in the phase gate |
| Mixed content errors on HTTPS deployments | Medium | Medium | Detect and warn proactively; proxy mode as fallback |

## Out of Scope

| Idea | Why deferred |
|------|-------------|
| Real-time collaborative chat (shared sessions) | Phase 4+ multi-user concern |
| Chat-to-proposal pipeline | Requires careful AI governance boundary design; separate proposal |
| Voice input | Accessibility concern; post-launch |

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-08 | Created from approved proposal | NetYeti |
| 2026-06-08 | Filled in from proposal spec — 4 tiers, 16 steps | NetYeti |
