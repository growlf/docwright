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
---

## Summary

Phase 1 validated the OpenCode embed approach and built prototype-level AI
hooks in the Web UI. The VSCodium extension track is deferred to Phase 2.

## What was built / decided

- **Spike confirmed**: GO with direct-URL iframe SPA embed (`opencode serve`)
  — three embedding approaches tested, Approach 1 (iframe) won
- **Web UI AI stubs**: Jaccard keyword similarity engine at `/api/overlap`,
  CollationPanel, Find Related button — all with the exact API surface the
  real LLM engine will replace in Phase 2
- **VSCodium extension**: Deferred — ServerManager.ts, WebView panel, CSP
  config, keyboard quirk handling all moved to Phase 2

## Source proposal

- `proposals/approved/phase-0-spike-decision.md`
