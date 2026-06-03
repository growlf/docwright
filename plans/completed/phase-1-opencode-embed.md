---
title: Phase 1 — OpenCode AI integration (Web UI first; extension deferred)
status: completed
completed_date: 2026-06-03
author: NetYeti
created: 2026-06-03
tags:
  - phase-1
  - opencode
  - web-ui
  - ai-integration
proposal_source: proposals/approved/phase-0-spike-decision.md
priority: high
automated: guided
assigned_to: NetYeti
scenario_synthesis: AI integration stubbed with keyword similarity for prototyping; no shell or deploy steps
---

## Overview

The Phase 0 spike confirmed **GO** with direct-URL iframe embed of the OpenCode
SPA. Architecture decision stands.

**Priority update (2026-06-03):** The Web UI (SvelteKit) is the primary surface
for the team right now — people need the browser tool more than the IDE plugin.
The VSCodium extension is deprioritized to Phase 2. This plan is reframed around
what OpenCode integration means for the Web UI today.

## Current Web UI AI integration state

The Web UI already has prototype-level AI hooks using keyword similarity stubs:

| Feature | Status | Location |
|---------|--------|----------|
| Overlap / duplicate detection | ✅ Stub (Jaccard) | `/api/overlap` |
| Related proposals collation panel | ✅ Stub (Jaccard) | `CollationPanel.svelte` |
| MCP server (lifecycle gate) | ✅ Real | `scripts/mcp-server.py` |

These stubs define the engine API surface. When the real OpenCode backend is
wired, the response shape stays identical and the UI changes nothing.

## What "Phase 1 OpenCode integration" means for the Web UI

### 1. AI stub → real LLM (Phase 2 gate)

Replace Jaccard similarity in `/api/overlap` with an actual LLM semantic
similarity call via the OpenCode SDK. The endpoint contract is already defined —
this is a server-side swap, no UI changes required.

**Blocked on:** dispatch module (Phase 2). Do not build yet.

### 2. AI-assisted proposal fill-in button (when AI backend is ready)

The `misc.md` collation test case documents this: a button that prompts the AI
to auto-fill and review the current proposal. Wire to OpenCode SDK once dispatch
module exists.

**Blocked on:** Phase 2. Do not build yet.

### 3. VSCodium extension — ServerManager + iframe embed (DEFERRED)

The original Phase 1 tasks below are technically correct and the spike confirmed
feasibility. They are parked until the team needs the IDE surface.

#### Deferred tasks (Phase 2 / IDE track)

- [ ] `src/opencode/ServerManager.ts` — spawn `opencode serve` on free port via
      `createOpencode()`, manage lifecycle (start, health check, stop/cleanup)
- [ ] Wire ServerManager into `src/extension/extension.ts`
- [ ] WebView panel with iframe embedding the OpenCode SPA
- [ ] CSP: allow `http://127.0.0.1:*` frame-src
- [ ] Verify iframe interactive (chat works in WebView)
- [ ] Handle VSCodium keyboard shortcut interception quirk
- [ ] Document known limitations

## Current focus

With the Web UI prototype proving the governance layer, Phase 2 planning should
start. The priority order for what comes next:

1. **Dispatch module** — the engine that all AI features plug into
2. **Real overlap detection** — swap Jaccard stub with LLM in `/api/overlap`
3. **Collation panel** — swap stub with real AI-ranked related proposals
4. **VSCodium extension** — when the team needs the IDE surface

## Dependencies

- Spike: confirmed (Phase 0 done ✅)
- Web UI prototype: substantially complete ✅
- Dispatch module: not yet built (Phase 2)
