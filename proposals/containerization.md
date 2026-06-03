---
title: Containerization
author: NetYeti
created: 2026-06-03
tags: []
category: []
complexity: ""
estimated_effort: ""
depends_on: []
approved: false
created_by: NetYeti@phoenix
assigned_to: ""
_path: proposals/containerization.md
---
## Problem

We will want to be able to easily deploy this tool to servers - current layout makes this more challenging than if it was containerized.  Also, if it were in containers, we could also support (more easily) multiple instances on a single server host for multiple standalone projects for the same organization.  Example, one instance for company policies, another for a specific product, and still another for the marketing group intentions, etc. Another example is for an author who is working on multiple unrelated books, each would have it's own instance.

## Proposed Solution

1. **Dockerfile** at repo root — multi-stage build: `npm ci && npm run build`
   produces a production image serving the SvelteKit web UI and API on a single port.
2. **docker-compose.yml** — defines the web service plus optional `opencode serve`
   sidecar for AI chat support. Vault directory mounted as a volume.
3. **Multiple instances** — each vault gets its own container. Environment variables
   (`VAULT_PATH`, `OPENCODE_URL`, `SESSION_SECRET`) configure per-instance identity.
   A reverse proxy (Caddy / nginx) routes by hostname or path prefix.
4. **Health checks** — Docker HEALTHCHECK against the status page endpoint.
5. **Image registry** — published to ghcr.io on tagged releases via CI.

This keeps the existing build system intact and adds containerization as a
deployment option, not a rewrite.