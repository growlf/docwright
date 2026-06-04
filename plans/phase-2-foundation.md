---
title: Phase 2 — Foundation (Web-First)
status: approved
author: NetYeti
created: 2026-06-03
phase: 2
gate_reviewer: NetYeti
gate_status: pending
tags:
  - phase-2
  - profile-engine
  - dispatch
  - ci
  - foss
priority: high
automated: off
assigned_to: NetYeti
depends_on:
  - phase-1-ui-polish
  - phase-1-containerization
scenario_synthesis: "Web UI and dispatch module work; no VSCodium extension or IDE-specific steps"
---

# Phase 2 — Foundation (Web-First)

## Overview

Phase 1 delivered a complete, polished Web UI. Phase 2 builds the foundation
that everything else depends on: the profile engine, dispatch module maturity,
inbox capture, CI pipeline, and FOSS hygiene.

**VSCodium extension work has been extracted** to its own plan
([[plans/phase-vscodium-extension.md]]) to begin after the web tool reaches
alpha and real users validate the core workflow. Building the extension before
we know the workflow is stable is wasted effort.

This plan tracks all Phase 2 deliverables. Each will be broken out into its
own sub-plan when work begins.

## Deliverables

| # | Deliverable | Status | Notes |
|---|-------------|--------|-------|
| 1 | Profile engine — loads profile.json, falls back to org-operations | ⏳ Planned | `src/dispatch/profile.ts` exists; needs loader, validation, schema |
| 2 | Dispatch module — verify zero VS Code API leakage in CI | ⏳ Planned | CI step that imports dispatch outside extension host confirms invariant |
| 3 | Inbox capture — minimal localhost web form | ⏳ Planned | Standalone HTML form, no framework required; inbox.ts adapter |
| 4 | `author-role:` in ALL profile templates | ⏳ Planned | Audit: verify every template in all four bundled profiles includes the field |
| 5 | GitHub Actions CI — lint + typecheck + unit tests | ⏳ Planned | `.github/workflows/ci.yml`; no .vsix step (that belongs in VSCodium plan) |
| 6 | FOSS hygiene files | ⏳ Planned | CHANGELOG.md, SECURITY.md, CONTRIBUTING.md, NOTICE.md, AGENTS.md, CODEOWNERS, .github/ templates, dependabot.yml |
| 7 | MCP server — TypeScript rewrite | ⏳ Planned | Replace `scripts/mcp-server.py` with `src/dispatch/mcp-server.ts`; eliminates Python dependency from container; aligns with dispatch module |

## Phase Context

### Phase 0 (complete) ✅
Validated `opencode serve` HTTP API. Confirmed Web UI as primary surface.

### Phase 1 (complete) ✅
Complete polished Web UI: file tree, editor, properties, status, funnel view,
AI chat panel, brand system, activity bar, phase gate, deployment docs.

### Phase 2 (this plan) — Web-First Foundation
Profile engine, dispatch CI, inbox, CI pipeline, FOSS hygiene, TypeScript MCP
server. Containerization completed in Phase 1 — Phase 2 begins from a stable
containerized base.

### VSCodium Extension (after alpha)
See [[plans/phase-vscodium-extension.md]]. Begins after the web tool has been
validated by real users in alpha testing.

### Phase 3 (future) — Profile engine full, ACL, AI integration
Full profile engine with all bundled profiles, ACL enforcement via Forgejo,
AI writes through ACL controller, wikilink graph, backlinks index.

### Phase 4 (future) — Cascade STEAM reference deployment

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-03 | Created — Phase 1 complete, Phase 2 begins | NetYeti |
| 2026-06-04 | VSCodium items extracted to phase-vscodium-extension plan; containerization and TypeScript MCP server added | NetYeti |
