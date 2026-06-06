---
title: "Phase 0 Spike: OpenCode Embed Verification"
author: NetYeti
created: 2026-06-02
tags:
  - phase-0
  - spike
  - decision
  - opencode
  - architecture
approved: true
created_by: NetYeti@phoenix
assigned_to:
  - NetYeti
---

# Phase 0 Spike: OpenCode Embed Verification

## Summary

The Phase 0 spike validated `opencode serve` as the AI backend for docwright.
All three criteria are met and the iframe embedding approach is confirmed working.

## Findings

### 1. `opencode serve` is stable and documented

- Version 1.15.13, full CLI documented via `--help`
- Serves a complete SPA (1.6MB JS + 320KB CSS) at `http://127.0.0.1:PORT`
- REST API at `/api/session`, `/api/session/{id}/message`, etc.
- Full lifecycle: start, serve, stop — all tested

### 2. JS SDK covers all required endpoints

Package `@opencode-ai/sdk@1.15.13` tested and confirmed:

| Feature | Status |
|---------|--------|
| Server spawn (`createOpencode`) | ✅ Spawns on free port, returns URL |
| Session CRUD (create, get, list) | ✅ Full session objects returned |
| Message send (`session.prompt`) | ✅ HTTP 200, parts returned |
| SSE event stream (`event.subscribe`) | ✅ Available for real-time events |
| Server lifecycle | ✅ `server.close()`, process cleanup |

### 3. SPA embed — three approaches tested

| # | Approach | Result |
|---|----------|--------|
| 1 | iframe to `http://127.0.0.1:PORT` | **✅ WORKS** — full SPA renders, interactive, chat works |
| 2 | Fetch+inject with `<base>` tag | ❌ Fails — `<base>` conflicts with SPA module loading |
| 3 | SDK-only custom chat WebView | ❌ Fails — VS Code blocks `connect-src` from WebView JS |

**Winner:** Approach 1 — direct iframe embed. No in-process HTTP proxy needed.

Known quirk: VSCodium intercepts certain keyboard shortcuts (e.g., `Ctrl+End`)
before they reach the iframe. Expected behaviour — does not affect
functionality.

### 4. Simplified architecture

`opencode serve` serves its own SPA. The architecture from PROJECT.md §7
(which included an in-process HTTP server to serve SPA files and proxy API
calls) is **eliminated**:

```
VSCodium WebView ──► http://127.0.0.1:PORT (opencode serve child process)
```

The WebView CSP permits loading `http://127.0.0.1:*` via iframe — the SPA's
own CSP and VS Code's CSP both allow this path. Verified in live VSCodium test.

## Decision

**GO** with direct-URL iframe SPA embed.

- The in-process HTTP proxy (§7) is removed from the architecture
- Phase 1 can proceed with `src/opencode/ServerManager.ts` as the first module
- No CSP workaround or fallback needed — iframe approach is confirmed
- The `@opencode-ai/sdk` `createOpencode()` function handles server spawn + client creation

## Next Steps

1. Build `src/opencode/ServerManager.ts` — spawns opencode serve, manages lifecycle
2. Integrate into `src/extension/extension.ts` — wire up to WebView panel
3. Begin Phase 1 deliverables per PROJECT.md §14
