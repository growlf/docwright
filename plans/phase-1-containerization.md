---
title: Phase 1 — Containerization
status: approved
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
_path: plans/phase-1-containerization.md
---
# Phase 1 — Containerization

## Overview

The MCP server bug (Python venv vs system Python path mismatch) proved that environment fragility is a real stability problem, not a future concern. Containerization is promoted to Phase 1 to ensure the web tool ships in a reproducible, stable environment before Phase 2 begins.

This plan delivers a complete Docker packaging covering all three deployment scenarios (standalone, team server, enterprise). See \[\[proposals/containerization.md\]\] for the full specification.

## Deliverables

#

Deliverable

Details

Status

1

`Dockerfile` — multi-stage build

node:22-alpine; includes git, python3, mcp; entrypoint.sh for git identity

⏳ Pending

2

`docker-entrypoint.sh`

Sets git user.name/email from env; writes .netrc for GIT\_TOKEN auth

⏳ Pending

3

`docker-compose.yml` — three scenario examples

Standalone, team server (+ Caddy), enterprise (+ OpenCode sidecar)

⏳ Pending

4

`.dockerignore`

Exclude vault data, node\_modules, .venv, secrets from image

⏳ Pending

5

`docs/docker.md` — deployment guide

One-command quickstart; all three scenarios; environment variables reference; git credentials setup

⏳ Pending

6

GitHub Actions CI — image build + health check

Build image on every PR; push to ghcr.io on tagged releases

⏳ Pending

7

Test: standalone scenario works

`docker compose up` → vault accessible, git panel works, MCP registers

⏳ Pending

## Rationale for Phase 1 promotion

The environment fragility that containers solve is not theoretical:

*   The Python MCP server hung all AI responses because of a venv/system-Python path mismatch — silent, confusing, hard to diagnose
*   New contributors face multi-step setup with multiple silent failure modes
*   The web tool cannot be meaningfully alpha-tested if setup varies by machine

Shipping Phase 2 work into a non-containerized environment means discovering environment bugs during Phase 2 feature work. Containerization first.

## Phase Gate

This plan gates the same Phase 1 sign-off as `phase-1-ui-polish`. Both must be complete before Phase 2 begins.

**Gate reviewer:** NetYeti **Gate status:** `pending`

## Out of Scope

Kubernetes/Helm — see \[\[proposals/kubernetes-deployment.md\]\]. Docker compose is sufficient for all Phase 1 and Phase 2 needs.

## Critical Review — Open Questions Before Starting

*Reviewed by /critique-plan adversarial agent. Resolve ⚠️/🚫 before starting.*

### Dockerfile — Alpine Linux is confirmed incompatible 🚫 block
- **Finding:** `mcp` → `pydantic` → `pydantic-core` (Rust extension) and `mcp` → `pyjwt` → `cryptography` → `cffi` (C extension). Alpine's musl libc is ABI-incompatible. `pip install mcp` on alpine will fail or require full Rust+gcc toolchain. This is confirmed — not a risk to assess.
- **Action:** Switch to `node:22-bookworm-slim`. Decision must be documented in writing before Dockerfile work begins.
- **Resolution:**

### `.dockerignore` — `opencode.json` encodes host-local paths 🚫 block
- **Finding:** `opencode.json` has `DOCWRIGHT_ROOT` hardcoded to `/home/netyeti/Projects/DocWright` and `.venv` paths. If baked into the image it silently breaks MCP for every other user. It is NOT in `.gitignore`. `VERSION` is also new and needs handling.
- **Action:** Add `opencode.json` and `VERSION` to `.dockerignore`. Consider adding `opencode.json` to `.gitignore`. Add a note to `docs/docker.md`: opencode.json is a workstation artifact, never include in a distributed image.
- **Resolution:**

### Deliverable 7 — MCP transport must be decided first 🚫 block
- **Finding:** `mcp.run()` uses stdio by default — no HTTP endpoint to curl. "MCP registers" is unverifiable without choosing a transport. If SSE mode: need HTTP endpoint. If stdio mode: "registers" means "exits 0 with --test flag." Fixture vault also still unaddressed.
- **Action:** Choose transport, document it, write the verification command before marking Deliverable 7 in-progress.
- **Resolution:**

### Deliverable 2 — `.netrc` still in table description ⚠️ warn
- **Finding:** The table says "writes .netrc for GIT_TOKEN auth" even though the plan's own review flags .netrc as deprecated. An implementer reading only the table will build the wrong thing.
- **Action:** Update Deliverable 2 description: "mounts SSH key; .netrc is fallback-only and documented as such."
- **Resolution:**

### GitHub Actions CI — Node version mismatch ⚠️ warn
- **Finding:** `ci.yml` uses `node-version: '20'`. Dockerfile will use Node 22. Version differences won't be caught.
- **Action:** Update CI to Node 22 when this plan is implemented.
- **Resolution:**

### `mcp-server.py` — `/tmp` cache hardcoded ⚠️ warn
- **Finding:** `CACHE_FILE = Path("/tmp/docwright-status-cache.txt")` breaks in non-root or multi-instance containers.
- **Action:** Parameterise via `DOCWRIGHT_CACHE_DIR` env var (default `/tmp`). One-line change.
- **Resolution:**

### `depends_on` missing `phase-1-critique-skill` 📝 note
- **Finding:** Containerization should not ship before the critique skill can review the Dockerfile and compose files.
- **Action:** Add `phase-1-critique-skill` to `depends_on:` frontmatter.
- **Resolution:**

### No `/health` endpoint 📝 note
- **Finding:** `GET /api/status` reads the vault on every call — too heavy for HEALTHCHECK.
- **Action:** Add lightweight `GET /api/health` returning `{ok:true}` and use that in HEALTHCHECK.
- **Resolution:**

## Document History

Date

Change

Author

2026-06-04

Created — promoted from Phase 2; stability warrants Phase 1

NetYeti