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
priority: high
automated: off
assigned_to: NetYeti
depends_on:
  - phase-1-ui-polish
scenario_synthesis: "Docker build and deployment config; no UI changes; no shell execution beyond docker build/run testing"
tags:
  - phase-1
  - infrastructure
  - docker
---

# Phase 1 — Containerization

## Overview

The MCP server bug (Python venv vs system Python path mismatch) proved that
environment fragility is a real stability problem, not a future concern.
Containerization is promoted to Phase 1 to ensure the web tool ships in a
reproducible, stable environment before Phase 2 begins.

This plan delivers a complete Docker packaging covering all three deployment
scenarios (standalone, team server, enterprise). See
[[proposals/containerization.md]] for the full specification.

## Deliverables

| # | Deliverable | Details | Status |
|---|-------------|---------|--------|
| 1 | `Dockerfile` — multi-stage build | node:22-alpine; includes git, python3, mcp; entrypoint.sh for git identity | ⏳ Pending |
| 2 | `docker-entrypoint.sh` | Sets git user.name/email from env; writes .netrc for GIT_TOKEN auth | ⏳ Pending |
| 3 | `docker-compose.yml` — three scenario examples | Standalone, team server (+ Caddy), enterprise (+ OpenCode sidecar) | ⏳ Pending |
| 4 | `.dockerignore` | Exclude vault data, node_modules, .venv, secrets from image | ⏳ Pending |
| 5 | `docs/docker.md` — deployment guide | One-command quickstart; all three scenarios; environment variables reference; git credentials setup | ⏳ Pending |
| 6 | GitHub Actions CI — image build + health check | Build image on every PR; push to ghcr.io on tagged releases | ⏳ Pending |
| 7 | Test: standalone scenario works | `docker compose up` → vault accessible, git panel works, MCP registers | ⏳ Pending |

## Rationale for Phase 1 promotion

The environment fragility that containers solve is not theoretical:
- The Python MCP server hung all AI responses because of a venv/system-Python
  path mismatch — silent, confusing, hard to diagnose
- New contributors face multi-step setup with multiple silent failure modes
- The web tool cannot be meaningfully alpha-tested if setup varies by machine

Shipping Phase 2 work into a non-containerized environment means discovering
environment bugs during Phase 2 feature work. Containerization first.

## Phase Gate

This plan gates the same Phase 1 sign-off as `phase-1-ui-polish`. Both must
be complete before Phase 2 begins.

**Gate reviewer:** NetYeti
**Gate status:** `pending`

## Out of Scope

Kubernetes/Helm — see [[proposals/kubernetes-deployment.md]]. Docker compose
is sufficient for all Phase 1 and Phase 2 needs.

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-04 | Created — promoted from Phase 2; stability warrants Phase 1 | NetYeti |
