---
title: Phase 2 — Foundation
status: approved
author: NetYeti
created: 2026-06-03
tags:
  - phase-2
  - extension
  - profile-engine
  - dispatch
  - ci
priority: high
automated: off
assigned_to: NetYeti
---

# Phase 2 — Foundation

## Overview

Phase 1 delivered a functional Web UI prototype with full CRUD, live reload,
lifecycle enforcement, proposal templating, git controls, and the dispatch
module engine skeleton. Phase 2 builds the working VSCodium extension, the
profile engine, zero-config startup, inbox capture, and full FOSS hygiene.

This plan tracks all Phase 2 deliverables. Each deliverable will be broken out
into its own plan when work begins.

## Deliverables

| # | Deliverable | Status | Notes |
|---|-------------|--------|-------|
| 1 | VSCodium extension activates lazily (< 500ms) | ⏳ Planned | Extension skeleton, lazy activation |
| 2 | Profile engine — loads profile.json, falls back to org-operations | ⏳ Planned | `src/dispatch/profile.ts` already exists; needs loader wired into extension |
| 3 | Dispatch module — verify zero VS Code API leakage in CI | ⏳ Planned | Add CI step that imports dispatch outside extension host |
| 4 | `opencode serve` child process management + crash recovery | ⏳ Planned | Extension manages opencode lifecycle |
| 5 | New Document scaffolding with auto-stage | ⏳ Planned | Extension command; uses dispatch templates |
| 6 | Inbox capture — VSCodium command | ⏳ Planned | Quick-capture to `inbox/` |
| 7 | Inbox capture — minimal localhost web form | ⏳ Planned | Standalone HTML form, no framework required |
| 8 | `author-role:` in ALL profile templates | ⏳ Planned | Audit: verify every template includes the field |
| 9 | GitHub Actions CI — lint + typecheck + unit tests + .vsix package | ⏳ Planned | `.github/workflows/ci.yml` |
| 10 | FOSS hygiene files | ⏳ Planned | CHANGELOG.md, SECURITY.md, CONTRIBUTING.md, NOTICE.md, AGENTS.md, CODEOWNERS, .github/ templates, dependabot.yml |

## Phase Context

### Phase 0 (complete) ✅
Validated `opencode serve` HTTP API. Confirmed iframe SPA embed. Decided Web UI as primary surface.

### Phase 1 (complete) ✅
SvelteKit Web UI with full CRUD, live reload, 3-mode editor, proposal templating,
document properties, sidebar polish, vault status page, lifecycle compliance,
project registry, git controls, dispatch module skeleton, collation foundation,
mobile-friendly layout.

### Phase 2 (this plan) — Foundation
VSCodium extension + profile engine + inbox capture + CI + FOSS hygiene.

### Phase 3 (future) — Profile engine full, ACL, AI integration
Full profile engine with all bundled profiles, ACL enforcement via Forgejo team
membership, AI writes through ACL controller with `ai-last-action:` stamps,
wikilink graph, backlinks index.

### Phase 4 (future) — Cascade STEAM reference deployment
Vault seed for Cascade STEAM. vision.md and governance.md completed by leadership.
Forgejo server provisioned. AI stack (growlf/ai-stack + growlf/meshy) connected.

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-03 | Created — Phase 1 complete, Phase 2 begins | NetYeti |
