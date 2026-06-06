---
title: Phase 1 — Containerization
status: in-progress
author: NetYeti
created: 2026-06-04
phase: 1
gate_reviewer: NetYeti
gate_status: pending
proposal_source:
  - proposals/containerization.md
priority: medium
automated: off
assigned_to: NetYeti
depends_on:
  - phase-1-ui-polish
  - phase-1-critique-skill
scenario_synthesis: Docker build and deployment config; no UI changes; no shell execution beyond docker build/run testing
tags:
  - phase-1
  - infrastructure
  - docker
tests_defined: true
total_steps: 7
completed_steps: 7
---

## Overview

The MCP server bug (Python venv vs system Python path mismatch) proved that
environment fragility is a real stability problem, not a future concern.
Containerization is promoted to Phase 1 to ensure the web tool ships in a
reproducible, stable environment before Phase 2 begins.

This plan delivers a complete Docker packaging covering all three deployment
scenarios (standalone, team server, enterprise). See [[proposals/containerization.md]]
for the full specification.

## Implementation Steps

| # | Deliverable | Details | Status |
|---|-------------|---------|--------|
| 1 | `Dockerfile` — single-stage, bookworm-slim | node:22-bookworm-slim (NOT alpine — musl incompatible); git, python3, mcp; runs vite dev for Phase 1 | ✅ |
| 2 | `docker-entrypoint.sh` | Sets git user.name/email from env; GIT_TOKEN → .git-credentials; starts MCP SSE in background; starts vite dev | ✅ |
| 3 | `docker-compose.yml` — three scenario examples | Standalone, team server (+ Caddy), enterprise (+ OpenCode sidecar) | ✅ |
| 4 | `.dockerignore` | Excludes vault data, node_modules, .venv, opencode.json, VERSION, secrets | ✅ |
| 5 | `docs/docker.md` — deployment guide | One-command quickstart; all three scenarios; env vars reference; git credentials setup | ✅ |
| 6 | GitHub Actions CI — image build + health check | Build on every PR; push to ghcr.io on tagged releases; Node version bumped to 22 | ✅ |
| 7 | Test: standalone scenario works | `docker compose up` → `/api/health` returns `{"ok":true}`; git panel works; MCP SSE on :3002 | ✅ Done |

## Tests

| Test | Command | Expected | Status |
|------|---------|----------|--------|
| Image builds successfully | `docker build -t docwright:test .` | Exit 0, no errors | ⏳ |
| Health endpoint responds | `curl http://localhost:5173/api/health` | `{"ok":true}` | ⏳ |
| MCP SSE reachable | `curl http://localhost:3002/sse` | SSE stream opens | ⏳ |
| Git commits work via UI | Create file, commit via Web UI | Commit appears in `git log` | ⏳ |
| Vault files visible in UI | Mount example-vault, open UI | File tree shows vault contents | ⏳ |

## Blocker resolutions

### 🚫 Alpine incompatible → RESOLVED
`node:22-bookworm-slim` used instead. pydantic-core (Rust) and cryptography (C)
require glibc — musl (Alpine) fails. bookworm-slim is confirmed compatible.

### 🚫 `opencode.json` host-local paths → RESOLVED
`opencode.json` added to `.dockerignore`. Also added `VERSION` (regenerated from
git tags at build time). Note in `docs/docker.md`: opencode.json is a workstation
artifact and must never be baked into a distributed image.

### 🚫 MCP transport undefined → RESOLVED
`mcp-server.py` already has `--serve` flag for SSE transport (port 3002, configurable
via `MCP_PORT`). Container uses SSE mode — health-verifiable via HTTP and usable by
external tooling. Entrypoint starts MCP with `--serve` in background.

### ⚠️ `.netrc` in table description → RESOLVED
Entrypoint uses `.git-credentials` (git credential store), not `.netrc`. SSH key mount
documented as the recommended production approach in `docs/docker.md`.

### ⚠️ CI Node version mismatch → RESOLVED
`ci.yml` updated: `node-version: '20'` → `'22'`.

### ⚠️ `/tmp` cache hardcoded → RESOLVED
`CACHE_FILE` now reads `DOCWRIGHT_CACHE_DIR` env var (default `/tmp`). One-line
change in `mcp-server.py`.

### 📝 `depends_on` missing `phase-1-critique-skill` → RESOLVED
Added to frontmatter `depends_on`. Both `phase-1-critique-skill` and
`phase-1-ui-polish` are completed.

### 📝 No `/health` endpoint → RESOLVED
`GET /api/health` added at `src/webui/src/routes/api/health/+server.ts`.
Returns `{"ok":true}`. Used in `HEALTHCHECK` directive in Dockerfile.

## Rationale for Phase 1 promotion

The environment fragility that containers solve is not theoretical:

- The Python MCP server hung all AI responses because of a venv/system-Python
  path mismatch — silent, confusing, hard to diagnose
- New contributors face multi-step setup with multiple silent failure modes
- The web tool cannot be meaningfully alpha-tested if setup varies by machine

Shipping Phase 2 work into a non-containerized environment means discovering
environment bugs during Phase 2 feature work. Containerization first.

## Phase Gate

This plan gates the same Phase 1 sign-off as `phase-1-ui-polish`. Both must be
complete before Phase 2 begins.

**Gate reviewer:** NetYeti  
**Gate status:** `pending` — all deliverables complete; awaiting Deliverable 7 live test + sign-off

## Out of Scope

Kubernetes/Helm — see [[proposals/kubernetes-deployment.md]]. Docker compose is
sufficient for all Phase 1 and Phase 2 needs.

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-04 | Created — promoted from Phase 2; stability warrants Phase 1 | NetYeti |
| 2026-06-06 | All deliverables implemented (1-6); all blocker resolutions documented; D7 live test pending | NetYeti |
| 2026-06-06 | All 7 deliverables complete — D7 verified: health ✓, git panel ✓, file tree ✓, MCP SSE ✓. Added safe.directory fix for mounted vault. | NetYeti |
