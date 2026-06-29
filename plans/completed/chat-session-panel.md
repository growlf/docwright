---
title: Chat & Session Panel Phase 2 — Session Management, @-Mention, Model Picker, History, Diff Review, and Terminal
status: completed
completed_date: 2026-06-29
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
tests_defined: true
tests_human_reviewed: true
phase: 5
depends_on:
  - proposals/approved/web-ui-ai-chat-panel.md
scenario_synthesis: SvelteKit UI components + OpenCode API integration; no shell execution or infrastructure steps
total_steps: 17
completed_steps: 17
github_epic:
automated: full
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

| Step | Action | Details | Status | Issue | Branch |
|------|--------|---------|--------| --- | --- |
| 1 | `dispatch/opencode.ts` adapter | Thin adapter wrapping all OpenCode HTTP calls: `createSession`, `sendMessage`, `forkSession`, `summarizeSession`, `shareSession`, `deleteSession`, `listProviders`, `listModels`. Absorbs API-shape changes in one place. All existing `ChatPanel.svelte` fetches migrate to use this module. | ✅ Done | — | — |
| 2 | Session list sidebar | New `SessionSidebar.svelte` component, collapsible, inside `ChatPanel.svelte`. Fetches `GET /session` on mount; groups rows by today / yesterday / older (compare `session.time` to `Date.now()`). Each row: title (truncated), relative timestamp, token count badge. Active session highlighted. | ✅ Done | — | — |
| 3 | Session CRUD actions | Per-row actions via a `⋯` menu: Fork, Summarize, Share, Delete. In-flight stream abort button in chat header. | ✅ Done | — | — |
| 4 | Token + cost tracking | Parse `usage` object from OpenCode SSE event stream. Accumulate per-session. Display in session row (compact) and chat header (full with tooltip). | ✅ Done | — | — |
| 5 | @-mention context injection | Trigger on `@` in chat input. Autocomplete from file tree store. 120ms debounce, cap 50 results. Removable chips. Context injected on send. | ✅ Done | — | — |
| 6 | Model / provider picker | Dropdown in chat header. Lists providers and models from OpenCode API. PATCH session on change. | ✅ Done | — | — |
| 7 | Vault-scoped session history | Session titles auto-prefixed with vault name. Sidebar filtered to vault by default. Toggle persisted to localStorage. | ✅ Done | — | — |
| 8 | Tests — Tier 1 | chat-utils.ts pure functions (flattenTree, relativeTime, dayGroup, detectMention, filterMention, accumulateUsage, truncate). 36 tests passing. | ✅ Done | — | — |

### Tier 2 — Diff / Review Panel (gate: dispatch lifecycle awareness)

| Step | Action | Details | Status | Issue | Branch |
|------|--------|---------|--------| --- | --- |
| 9 | Session diff fetch | `GET /session/:id/diff` → raw unified diff. New `SessionDiffPanel.svelte` with CSS-grid side-by-side view, unified fallback, binary handling. "Review changes" button in session sidebar. | ✅ Done | — | — |
| 10 | Governance annotation | `diffAnnotate(before, after)` in `dispatch/linter.ts`. `POST /api/diff-annotate` endpoint. Governance badge row per file in diff panel (status transition, approval, gate, AI stamp). | ✅ Done | — | — |
| 11 | Selective staging + commit | Per-file Accept/Reject checkboxes. Staging footer with commit message input and "Commit N" button. `POST /api/git/restore` (new) and updated `POST /api/git/stage` (selective). | ✅ Done | — | — |
| 12 | Tests — Tier 2 | 9 `diffAnnotate()` unit tests. 7 selective staging integration tests (real temp git repo). Path injection security fix. 288 dispatch + 68 webui tests passing. | ✅ Done | — | — |

### Tier 3 — Enterprise Dual Mode (gate: bundle-enterprise-tier approved)

| Step | Action | Details | Status | Issue | Branch |
|------|--------|---------|--------| --- | --- |
| 13 | Named connection system | Deferred — see [[proposals/deferred-chat-enterprise-dual-mode.md]] | ✅ Done | — | — |
| 14 | Mixed content detection | Deferred — see [[proposals/deferred-chat-enterprise-dual-mode.md]] | ✅ Done | — | — |
| 15 | Tests — Tier 3 | Deferred — see [[proposals/deferred-chat-enterprise-dual-mode.md]] | ✅ Done | — | — |

### Tier 4 — Terminal Panel (gate: demand confirmed)

| Step | Action | Details | Status | Issue | Branch |
|------|--------|---------|--------| --- | --- |
| 16 | Demand validation | Deferred — see [[proposals/deferred-chat-terminal-pty-panel.md]] | ✅ Done | — | — |
| 17 | PTY panel (if gate clears) | Deferred — see [[proposals/deferred-chat-terminal-pty-panel.md]] | ✅ Done | — | — |

## Testing Plan

**Unit (no browser, no OpenCode):**
- `dispatch/opencode.ts`: all adapter functions with mocked fetch — verify URL shape, method, and payload for each call
- @-mention: trigger detection, debounce, vault filter, chip state mutations
- Session grouping: today / yesterday / older bucket assignment given mocked timestamps
- Token accumulation: running totals update correctly across multiple SSE events
- `diffAnnotate()`: status transitions, gate flags, field changes, non-governance fields ignored

**Integration (real git repo):**
- Selective staging: stage specific files, restore rejected, path traversal guards
- Full flow: create session → send message → fork → summarize → delete (against mock OpenCode)

**Manual golden path:**
1. Open chat panel → session sidebar shows existing sessions grouped by date
2. Type `@` → autocomplete opens → select a doc → chip appears → send → doc context in prompt
3. Switch model from picker → new model reflected in session
4. Fork session → new session appears in sidebar → independent conversation
5. Delete session → confirmed → removed from list
6. Review changes → governance badges on frontmatter-changing files → accept/reject → commit

## Rollback Procedures

Each tier shipped as isolated component additions to `ChatPanel.svelte`. The
`dispatch/opencode.ts` adapter is additive. No data migration at any tier. Tier 3
connection config is `localStorage`-only.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| OpenCode API shape changes | Medium | High | All calls through `dispatch/opencode.ts` adapter |
| @-mention autocomplete laggy on large vaults | Low | Medium | Debounce 120ms + cap 50 results |
| `GET /session/:id/diff` not available in OpenCode v1.x | Medium | High | Feature-detection check; fall back to git diff panel |
| Terminal security surface in non-developer deployments | Medium | High | Demand gate; deploy-time flag; prominent warning |

## Out of Scope

| Idea | Why deferred |
|------|-------------|
| Enterprise dual-mode connections | Gate: bundle-enterprise-tier approved — [[proposals/deferred-chat-enterprise-dual-mode.md]] |
| Terminal/PTY panel | Gate: 3 developer users request it — [[proposals/deferred-chat-terminal-pty-panel.md]] |
| Real-time collaborative chat (shared sessions) | Phase 4+ multi-user concern |
| Chat-to-proposal pipeline | Requires AI governance boundary design; separate proposal |
| Voice input | Accessibility post-launch |

## Phase Gate

- [x] All 17 implementation steps resolved (12 delivered, 5 formally deferred with captured proposals)
- [x] Tiers 1 and 2 fully implemented and merged to main (v0.4.6)
- [x] Test coverage defined and human-reviewed: 288 dispatch + 68 webui tests passing
- [x] Deferred ideas captured before closing: [[proposals/deferred-chat-enterprise-dual-mode.md]], [[proposals/deferred-chat-terminal-pty-panel.md]]
- [x] Rollback procedures documented
- [x] Risk assessment completed

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-08 | Created from approved proposal | NetYeti |
| 2026-06-08 | Filled in from proposal spec — 4 tiers, 16 steps | NetYeti |
| 2026-06-08 | Improved — adapter step added, technical detail expanded, 17 steps | NetYeti |
| 2026-06-22 | Steps 1–8 complete: Tier 1 fully delivered | NetYeti |
| 2026-06-29 | Step 9 complete: Session diff fetch — SessionDiffPanel.svelte with side-by-side/unified diff view | NetYeti |
| 2026-06-29 | Step 10 complete: Governance annotation — diffAnnotate(), /api/diff-annotate, badge row in diff panel | NetYeti |
| 2026-06-29 | Step 11 complete: Selective staging + commit — Accept/Reject checkboxes, staging footer, /api/git/restore | NetYeti |
| 2026-06-29 | Step 12 complete: Tests — Tier 2 — 9 diffAnnotate() unit tests, 7 staging integration tests, path injection fix | NetYeti |
| 2026-06-29 | Tiers 3 and 4 (steps 13–17) closed as deferred. Tier 3 → proposals/deferred-chat-enterprise-dual-mode.md. Tier 4 → proposals/deferred-chat-terminal-pty-panel.md. Plan complete on Tiers 1 and 2. | NetYeti |
