---
title: "Phase 0 Spike: OpenCode Embed Verification"
author: NetYeti
created: "2026-06-02"
tags: [phase-0, spike, decision, opencode, architecture]
approved: false
created_by: "NetYeti@phoenix"
assigned_to: [NetYeti]
---

# Phase 0 Spike: OpenCode Embed Verification

## Summary

The Phase 0 spike validated `opencode serve` as the AI backend for docwright.
The spike confirms the SDK path is fully viable and the SPA embed path is
simpler than originally designed.

## Findings

### 1. `opencode serve` is stable and documented

- Version 1.15.13, CLI documented with `--help`
- Serves a full SPA (1.6MB JS + 320KB CSS) at `http://127.0.0.1:PORT`
- REST API at `/api/session`, `/api/session/{id}/message`, etc.
- Fully functional via curl and the JS SDK

### 2. JS SDK covers all required endpoints

Package `@opencode-ai/sdk@1.15.13` provides:

| Feature | Status |
|---------|--------|
| Server spawn (`createOpencode`) | ✅ Tested — spawns on free port, returns URL |
| Session CRUD (create, get, list) | ✅ Tested — returns full session objects |
| Message send (`session.prompt`) | ✅ Tested — HTTP 200, parts returned |
| SSE event stream (`event.subscribe`) | ✅ Available — real-time events |
| Server management | ✅ `server.close()`, process cleanup |

### 3. SPA embed (simplified architecture)

**Key discovery:** `opencode serve` serves its own SPA. The original PROPOSAL.md §7
architecture described an in-process HTTP server that would serve SPA static files
and proxy `/api/*` to the child process. This is **no longer needed**.

**Simplified architecture:**

```
VSCodium WebView ──► http://127.0.0.1:PORT (opencode serve child process)
```

No in-process HTTP server, no static file serving, no API proxy.

A minimal extension at `spike/opencode-embed/minimal-extension/` demonstrates this
approach. The remaining unknown is whether VSCodium's WebView Content-Security-Policy
allows loading the SPA from `http://127.0.0.1:*` — this must be validated in Phase 1.

### 4. SDK-only fallback is fully proven

The SDK test (`spike/opencode-embed/test-sdk.mjs`) demonstrates:
- Server spawn and lifecycle
- Session creation with title
- Message sending with text parts
- Response parsing

If the CSP blocks SPA embedding, the SDK-only path is ready for Phase 1 with no
additional spike required.

## Decision

**GO** with direct-URL SPA embed.

- The in-process HTTP proxy from PROPOSAL.md §7 is eliminated
- Phase 1 starts with WebView CSP validation as the first task
- If CSP blocks embedding, immediately fall back to SDK-only custom chat UI
- Update PROPOSAL.md to reflect the simplified architecture

## Next Steps

1. Update PROPOSAL.md §7 architecture to remove in-process HTTP server
2. Phase 1: Validate WebView CSP in VSCodium
3. If CSP passes: build OpenCode Server Manager using `@opencode-ai/sdk`
4. If CSP fails: build SDK-only chat UI using the SDK client

## Files

| File | Purpose |
|------|---------|
| `spike/opencode-embed/test-sdk.mjs` | SDK-only path test (executable) |
| `spike/opencode-embed/embed-test.html` | Plain HTML iframe test |
| `spike/opencode-embed/minimal-extension/` | VSCodium extension with WebView embed |
| `spike/opencode-embed/README.md` | Spike plan |
