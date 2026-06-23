---
title: Chat & Session Panel Phase 2 — Session Management, @-Mention, Model Picker, History, Diff Review, and Terminal
status: in-progress
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
mode: guided
assigned_to: NetYeti
tests_defined: false
phase: 5
depends_on:
  - proposals/approved/web-ui-ai-chat-panel.md
scenario_synthesis: SvelteKit UI components + OpenCode API integration; no shell execution or infrastructure steps
total_steps: 17
completed_steps: 8
_path: plans/bundle-chat-session-panel.md
---

# Chat & Session Panel Phase 2 — Session Management, @-Mention, Model Picker, History, Diff Review, and Terminal

## Overview

Phase 3 successor to the MVP AI chat panel. Delivers seven previously-deferred
proposals as a single coordinated bundle, grouped into four delivery tiers by
dependency. Tier 1 ships first and self-contains; Tiers 2–4 each carry an explicit
upstream gate that must clear before work begins.

See [[proposals/approved/bundle-chat-session-panel.md]] for full feature
specifications and the rationale for bundling.

## Delivery Tiers

| Tier | Features | Gate |
|------|----------|------|
| 1 | OpenCode adapter, session sidebar, @-mention, model picker, vault-scoped history | Base `ChatPanel.svelte` stable in daily use |
| 2 | Diff/review panel for AI sessions | `src/dispatch/` lifecycle awareness (Phase 3 mid) |
| 3 | Dual-mode enterprise (multi-endpoint) | [[proposals/bundle-enterprise-tier.md]] approved |
| 4 | Terminal/PTY panel | Explicit demand confirmed from developer users |

## Implementation Steps

### Tier 1 — Base Session Management

| Step | Action | Details | Status |
|------|--------|---------|--------|
| 1 | `dispatch/opencode.ts` adapter | Thin adapter wrapping all OpenCode HTTP calls: `createSession`, `sendMessage`, `forkSession`, `summarizeSession`, `shareSession`, `deleteSession`, `listProviders`, `listModels`. Absorbs API-shape changes in one place. All existing `ChatPanel.svelte` fetches migrate to use this module. | ✅ Done |
| 2 | Session list sidebar | New `SessionSidebar.svelte` component, collapsible, inside `ChatPanel.svelte`. Fetches `GET /session` on mount; groups rows by today / yesterday / older (compare `session.time` to `Date.now()`). Each row: title (truncated), relative timestamp, token count badge. Active session highlighted. | ✅ Done |
| 3 | Session CRUD actions | Per-row actions via a `⋯` menu: Fork → `POST /session/:id/fork`, Summarize → `POST /session/:id/summarize` (compacts context), Share → `POST /session/:id/share` (returns URL, copies to clipboard), Delete → confirm dialog then `DELETE /session/:id`. In-flight stream abort button in chat header: calls `AbortController` on the fetch, sends `POST /session/:id/abort` if available. | ✅ Done |
| 4 | Token + cost tracking | Parse `usage` object from OpenCode SSE event stream (`event: message` → `data.usage.inputTokens`, `outputTokens`, `cost`). Accumulate per-session in a `Map<sessionId, Usage>` store. Display in session row (compact: `4.2k`) and chat header (full: `↑ 1.2k ↓ 3.0k  $0.02`). | ✅ Done |
| 5 | @-mention context injection | Trigger: `@` typed in chat input. Autocomplete dropdown populated from the file tree store (already loaded — no new fetch). Filter by title + path as user types; cap at 50 results; debounce 120ms. Selecting a file: (a) appends a chip to the input area showing the doc title, (b) adds `\n\n[Context: path]\n<frontmatter summary>` to the prompt on send. Chips are individually removable. State: `let mentions = $state<string[]>([])`. | ✅ Done |
| 6 | Model / provider picker | Dropdown in chat panel header. On panel mount: `GET /v2/provider` → list providers, `GET /v2/model` → list models per provider. Active session's current model shown as selected. On change: `PATCH /session/:id` with `{ modelId }` or re-create session with new model (whichever the OpenCode API supports). Default model readable/writable in `opencode.json` under `chat.defaultModel`. | ✅ Done |
| 7 | Vault-scoped session history | Session created by DocWright: title auto-set to `[vault-name] <doc-title or "New Chat"> YYYY-MM-DD` via a `POST /session` body field or immediate rename. Session list: filter to current vault by matching title prefix `[vault-name]` by default. Toggle "Show all sessions" stores preference in `localStorage`. | ✅ Done |
| 8 | Tests — Tier 1 | `test/dispatch/opencode.test.ts`: adapter unit tests (mock fetch, verify correct URL shapes + payloads). `test/webui/chat-session.test.ts`: @-mention parsing (trigger, filter, chip add/remove), session grouping (today/yesterday/older buckets), token accumulation arithmetic. Integration: create → fork → delete flow against `opencode.mock.ts`. | ✅ Done |

### Tier 2 — Diff / Review Panel (gate: dispatch lifecycle awareness)

| Step | Action | Details | Status |
|------|--------|---------|--------|
| 9 | Session diff fetch | `GET /session/:id/diff` → raw unified diff string. New `SessionDiffPanel.svelte` renders a split view using a CSS-grid diff layout (no library needed for Markdown files; fallback to unified view for binary). Accessible from a "Review changes" button in the session sidebar row. | ⏳ Pending |
| 10 | Governance annotation | For each changed file in the diff, call `dispatch/linter.ts` to identify: (a) frontmatter fields that changed, (b) lifecycle transitions triggered (`status` before → after), (c) gate rules that fired. Annotate each diff hunk with a governance badge. Requires `dispatch/linter.ts` to expose a `diffAnnotate(before, after)` function. | ⏳ Pending |
| 11 | Selective staging + commit | File-level checkboxes: Accept / Reject each changed file. "Commit accepted" button: stages accepted files via `POST /api/git/stage` and commits via `POST /api/git/commit`. Rejected files are restored from `HEAD`. This is the human-in-the-loop gate for AI-driven edits in guided mode. | ⏳ Pending |
| 12 | Tests — Tier 2 | `diffAnnotate()` unit test: given before/after YAML, returns correct field-change list and transition events. Selective staging integration: mock git API, verify only accepted files staged. | ⏳ Pending |

### Tier 3 — Enterprise Dual Mode (gate: bundle-enterprise-tier approved)

| Step | Action | Details | Status |
|------|--------|---------|--------|
| 13 | Named connection system | Connection config stored in `localStorage` as `dw:opencode-connections: Connection[]` where `Connection = { name, url, mode: 'direct'|'proxy', notes? }`. Settings panel tab "Connections": add / edit / delete / set-active. Active connection URL replaces `OPENCODE_URL` for all chat fetches at runtime. Sessions are per-connection (sidebar filtered by active connection). | ⏳ Pending |
| 14 | Mixed content detection | On settings panel mount and on connection switch: check if page is `https:` and selected URL is `http:` non-localhost. If so: show amber warning with browser-specific guidance (Chrome/Edge: allowed; Firefox: flag needed; Safari: use proxy mode). Proxy mode routes OpenCode requests through `/api/opencode-proxy` on the DocWright server. | ⏳ Pending |
| 15 | Tests — Tier 3 | Connection CRUD in localStorage (add/edit/delete/switch). Mixed content detection logic: `isUnsafeConnection(pageProtocol, connectionUrl)` unit test covering all 4 browser × protocol combinations. | ⏳ Pending |

### Tier 4 — Terminal Panel (gate: demand confirmed)

| Step | Action | Details | Status |
|------|--------|---------|--------|
| 16 | Demand validation | Survey developer users: is the AI chat panel (via OpenCode + MCP) sufficient for their automation needs, or is raw shell access required? Gate: at least 3 distinct developer users explicitly request a terminal panel. Document findings in `docs/terminal-demand.md`. | ⏳ Pending |
| 17 | PTY panel (if gate clears) | Collapsible panel below chat using `xterm.js` (MIT, same as VS Code). WebSocket connection to OpenCode PTY endpoint scoped to vault directory. Security note: expose only if DocWright is deployed in a developer-only context — document this constraint clearly in the settings UI. | ⏳ Pending |

## Testing Plan

**Unit (no browser, no OpenCode):**
- `dispatch/opencode.ts`: all adapter functions with mocked fetch — verify URL shape, method, and payload for each call
- @-mention: trigger detection, debounce, vault filter, chip state mutations
- Session grouping: today / yesterday / older bucket assignment given mocked timestamps
- Token accumulation: running totals update correctly across multiple SSE events
- Mixed content: `isUnsafeConnection()` covers all protocol/URL combinations

**Integration (mock OpenCode server):**
- `opencode.mock.ts`: lightweight Express mock serving the subset of endpoints used
- Full flow: create session → send message → fork → summarize → delete
- Vault-scoped filter: sessions with and without vault prefix correctly partitioned

**Manual golden path:**
1. Open chat panel → session sidebar shows existing sessions grouped by date
2. Type `@` → autocomplete opens → select a doc → chip appears → send → doc context in prompt
3. Switch model from picker → new model reflected in session
4. Fork session → new session appears in sidebar → independent conversation
5. Delete session → confirmed → removed from list

**Tier 2 gate:** All dispatch unit tests pass and `diffAnnotate()` is implemented before Tier 2 steps begin.

## Rollback Procedures

Each tier ships as isolated component additions to `ChatPanel.svelte`. The
`dispatch/opencode.ts` adapter (step 1) is additive — existing fetch calls can
be reverted independently. No data migration required at any tier. Tier 3
connection config is `localStorage`-only; clearing `dw:opencode-connections` fully
resets to single-endpoint mode.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| OpenCode API shape changes between Phase 2 and Phase 3 | Medium | High | All calls go through `dispatch/opencode.ts` adapter; update one file |
| @-mention autocomplete laggy on large vaults | Low | Medium | Debounce 120ms + cap 50 results; file tree already in memory |
| `GET /session/:id/diff` not available in OpenCode v1.x | Medium | High | Gate Tier 2 behind feature-detection check; fall back to git diff panel |
| Governance annotation complexity delays Tier 2 | High | Medium | Ship Tier 1 independently; treat Tier 2 as a separate sub-plan if needed |
| Terminal security surface in non-developer deployments | Medium | High | Demand gate; deploy-time flag to disable; prominent warning in UI |
| Mixed content blocks localhost OpenCode on HTTPS deployments | Medium | Medium | Detect proactively; proxy mode as documented fallback |
| `localStorage` connection config conflicts with multi-tab sessions | Low | Low | Last-write-wins; connections are user preference, not operational state |

## Out of Scope

| Idea | Why deferred |
|------|-------------|
| Real-time collaborative chat (shared sessions) | Phase 4+ multi-user concern |
| Chat-to-proposal pipeline (auto-create proposals from chat) | Requires AI governance boundary design; separate proposal |
| Voice input | Accessibility post-launch |
| Per-step mode switching mid-session | Overly complex; plan-level mode is sufficient |

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-08 | Created from approved proposal | NetYeti |
| 2026-06-08 | Filled in from proposal spec — 4 tiers, 16 steps | NetYeti |
| 2026-06-08 | Improved — adapter step added, technical detail expanded, 17 steps | NetYeti |
| 2026-06-22 | Step 1 complete: dispatch/opencode.ts adapter — typed functions for createSession, sendMessage, forkSession, summariseSession, shareSession, deleteSession, listProviders, listModels, checkHealth, listSessions, getSessionMessages, abortSession. Response-shape normalisation, directory query param, 244 tests passing, typecheck clean. | NetYeti |
| 2026-06-22 | Step 2 complete: SessionSidebar.svelte — collapsible session list grouped by today/yesterday/older, relative timestamps, token count badges, active session highlight, integrated into ChatPanel.svelte replacing flat select dropdown. | NetYeti |
| 2026-06-22 | Step 3 complete: Per-row ⋮ menu with Fork (POST /session/:id/fork), Summarise (POST /session/:id/summarise), Share (POST /session/:id/share → clipboard), Delete (confirm dialog → DELETE /session/:id). Abort button in chat header during in-flight messages. Action feedback messages with fade-out. | NetYeti |
| 2026-06-22 | Step 4 complete: Per-session usage tracking (inputTokens, outputTokens, cost) captured from SSE events and POST responses. Usage Map accumulates per sessionId. Compact token badge in sidebar rows (e.g. 4.2k). Full display in chat header (e.g. ↑ 1.2k ↓ 3.0k $0.02) with tooltip for raw values. | NetYeti |
| 2026-06-22 | Step 5 complete: @-mention context injection — autocomplete dropdown on @ trigger, file tree flattening (GET /api/list), 120ms debounce, up to 50 filtered results, frontmatter caching, removable chips, context injected on send. | NetYeti |
| 2026-06-22 | Step 6 complete: Model / provider picker — dropdown in chat header listing providers grouped by models from GET /api/provider + GET /api/model. PATCH session on change; fallback to new session with modelID/providerID. | NetYeti |
| 2026-06-22 | Step 7 complete: Vault-scoped session history — session titles auto-prefixed with [vault-name], session list filtered to vault by default, toggle button (showAll) persisted to localStorage. | NetYeti |
| 2026-06-22 | Step 8 complete: Tests — Tier 1 — extracted chat-utils.ts with pure functions (flattenTree, relativeTime, dayGroup, detectMention, filterMention, accumulateUsage, truncate). 36 tests passing. npm run test:webui added. | NetYeti |
