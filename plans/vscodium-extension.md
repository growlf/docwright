---
title: VSCodium Extension
status: draft
author: NetYeti
created: 2026-06-04
phase: post-alpha
gate_reviewer: NetYeti
gate_status: pending
tags:
  - vscodium
  - extension
  - ide
priority: medium
mode: mentor
assigned_to: NetYeti
depends_on:
  - phase-2-foundation
scenario_synthesis: VSCodium extension development; requires Node.js + VS Code API; no web UI or shell deployment steps in this plan
_path: plans/vscodium-extension.md
proposal_source: phase-level — scope defined in PROJECT.md §14 Phase 5; no individual proposal
github_epic: null
milestone: future
---
# VSCodium Extension

## Overview

The VSCodium extension brings DocWright governance into the IDE. It is deliberately deferred until the web tool has been validated in alpha testing with real users — building an IDE extension before the core workflow is stable is premature investment.

**Gate condition to begin this plan:** the Web UI has at least one non-developer organization using it, workflow issues have been discovered and resolved, and the BDFL has confirmed the document model is stable.

The extension re-uses the dispatch module (zero VS Code API deps in `src/dispatch/`) which will be mature by the time this plan starts.

## Deliverables

| # | Deliverable | Status | Notes |
| --- | --- | --- | --- |
| 1 | Extension activates lazily (< 500ms) | ⏳ Planned | Skeleton in `src/extension/extension.ts`; lazy activation on `.md` file open |
| 2 | Profile engine wired into extension | ⏳ Planned | Extension reads active profile from vault `opencode.json`; falls back to org-operations |
| 3 | `opencode serve` child process management + crash recovery | ⏳ Planned | Extension manages OpenCode lifecycle; restart with backoff; status bar indicator |
| 4 | New Document scaffolding — extension command | ⏳ Planned | Command palette: "DocWright: New Document"; uses dispatch templates; auto-stages in git |
| 5 | Inbox capture — VSCodium command | ⏳ Planned | Quick-capture to `inbox/` from command palette; minimal input |
| 6 | GitHub Actions CI — .vsix package step | ⏳ Planned | Add to existing CI workflow: compile extension + package .vsix artifact |
| 7 | Extension distribution to Cascade STEAM dev team | ⏳ Planned | Install .vsix in team dev environment; document setup |

## Architectural invariant (never break)

**`src/dispatch/` must have zero VS Code API dependencies.** The dispatch module runs outside the extension host and is tested independently. Every extension command delegates logic to dispatch — the extension is only a thin VS Code adapter layer.

CI enforces this via `npm run test:dispatch` run outside the extension host.

## Why deferred

*   Building an IDE extension before the workflow is proven wastes effort on the wrong surface
*   The web tool covers all contributors; the extension serves developers only
*   Extension maintenance cost is high; it should target a stable interface
*   The dispatch module (the real value) is shared between surfaces; it gets built in Phase 2 regardless

## Document History

| Date | Change | Author |
| --- | --- | --- |
| 2026-06-04 | Created — extracted from Phase 2 plan; deferred to post-alpha | NetYeti |