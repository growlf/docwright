---
title: "Containerization — Docker Deployment for All Three Scenarios"
author: NetYeti
created: 2026-06-03
updated: 2026-06-04
tags:
  - infrastructure
  - deployment
  - docker
  - phase-2
category:
  - infrastructure
complexity: medium
estimated_effort: M
approved: false
created_by: NetYeti@phoenix
assigned_to: NetYeti
related_to:
  - docs/deployment.md
  - plans/phase-2-foundation.md
---

## Problem

DocWright currently requires a specific environment to run correctly:
- Node.js + correct npm version
- Python with a virtual environment (`.venv/`) for the MCP server
- The `mcp` package installed in that venv
- `DOCWRIGHT_ROOT` environment variable set correctly
- `opencode` binary on PATH

This creates real problems already encountered in development:
- The MCP server hung all AI responses because `.venv/bin/python3` was used
  in the venv but the config assumed system `python3`
- New contributors face a multi-step setup with silent failure modes
- Team server deployments require manual environment management
- Running multiple vault instances on one server is awkward and error-prone

Additionally, DocWright's most valuable use case is being hosted for a team
or organisation — not just run locally. Containerization makes that deployment
one command.

## Proposed Solution

A complete Docker packaging of DocWright that works for all three deployment
scenarios documented in `docs/deployment.md`.

### What gets containerized

**DocWright container** — the SvelteKit web server + all API routes:
- Node.js runtime (pinned version)
- Built SvelteKit app
- Python + venv + `mcp` package (for the MCP server)
- `DOCWRIGHT_ROOT` points to the vault volume mount
- Eliminates the venv/system-Python ambiguity permanently

**Vault** — mounted as a volume, never baked into the image:
- The vault is the user's data; the container is the runtime
- `docker run -v /path/to/my-vault:/vault docwright`

**OpenCode** — NOT containerized in the DocWright image:
- Each user runs OpenCode locally on their own machine (Team Server scenario)
- OR: an optional `opencode` sidecar container for server-side AI (Enterprise)
- See `docs/deployment.md` for the AI architecture per scenario

### Image design

```dockerfile
# Multi-stage build
FROM node:22-alpine AS builder
WORKDIR /app
COPY src/webui/package*.json ./
RUN npm ci
COPY src/webui/ .
RUN npm run build

FROM node:22-alpine AS runtime
# Add Python for MCP server
RUN apk add --no-cache python3 py3-pip
WORKDIR /app
COPY --from=builder /app/build ./build
COPY --from=builder /app/node_modules ./node_modules
COPY scripts/ ./scripts/
# Install Python MCP deps into a clean venv
RUN python3 -m venv .venv && .venv/bin/pip install mcp
ENV DOCWRIGHT_ROOT=/vault
ENV NODE_ENV=production
EXPOSE 5173
VOLUME /vault
HEALTHCHECK --interval=30s CMD wget -qO- http://localhost:5173/api/status || exit 1
CMD ["node", "build/index.js"]
```

### docker-compose.yml — three scenarios

**Standalone (local developer):**
```yaml
services:
  docwright:
    image: ghcr.io/growlf/docwright:latest
    volumes:
      - ./my-vault:/vault
    ports:
      - "5173:5173"
    environment:
      - DOCWRIGHT_ROOT=/vault
```

**Team Server (shared, HTTPS via reverse proxy):**
```yaml
services:
  docwright:
    image: ghcr.io/growlf/docwright:latest
    volumes:
      - /data/org-vault:/vault
    expose:
      - "5173"
    environment:
      - DOCWRIGHT_ROOT=/vault
      - ORIGIN=https://docwright.yourorg.com
  caddy:
    image: caddy:alpine
    ports: ["80:80", "443:443"]
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
```

**Enterprise (with server-side OpenCode sidecar):**
```yaml
services:
  docwright:
    image: ghcr.io/growlf/docwright:latest
    volumes:
      - /data/vault:/vault
    environment:
      - DOCWRIGHT_ROOT=/vault
      - OPENCODE_URL=http://opencode:4096
  opencode:
    image: ghcr.io/sst/opencode:latest
    environment:
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
    command: ["serve", "--host", "0.0.0.0", "--port", "4096"]
```

### Multiple vault instances

Each vault instance is a separate container with its own volume mount.
A reverse proxy routes by hostname or path prefix:

```
docwright-policies.cascade.steam   → container 1 (policies vault)
docwright-product.cascade.steam    → container 2 (product vault)
docwright-marketing.cascade.steam  → container 3 (marketing vault)
```

Each container is fully independent — separate git histories, separate
opencode sessions, separate user permissions via Forgejo team membership.

### CI/CD — image publication

On every tagged release, GitHub Actions:
1. Builds the multi-stage Docker image
2. Runs health check validation
3. Pushes to `ghcr.io/growlf/docwright:{tag}` and `:latest`

### Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DOCWRIGHT_ROOT` | `/vault` | Absolute path to vault directory |
| `ORIGIN` | `http://localhost:5173` | Public URL (required for CSRF/cookie security in production) |
| `OPENCODE_URL` | `http://127.0.0.1:4096` | Where to find OpenCode (overridden for sidecar pattern) |
| `OPENCODE_SERVER_PASSWORD` | *(none)* | Optional OpenCode auth token |
| `PORT` | `5173` | Internal server port |

### Eliminates existing fragility

| Current problem | Container fix |
|----------------|---------------|
| `.venv` vs system Python confusion | One pinned Python inside the image |
| `mcp` package not installed | Baked into image at build time |
| `opencode` not on PATH | Optional sidecar, not assumed |
| `DOCWRIGHT_ROOT` not set | Set by the container entrypoint |
| Node version mismatch | Pinned in Dockerfile FROM |

## Scope

- Dockerfile (multi-stage, Alpine-based)
- docker-compose.yml with three scenario examples
- `.dockerignore`
- `docs/docker.md` — deployment guide
- GitHub Actions CI step for image build + push
- Update `docs/deployment.md` with container instructions

## Out of Scope

| Idea | Why deferred | Deferred proposal |
|------|-------------|-------------------|
| Kubernetes / Helm charts | Overkill for Phase 2; add when enterprise customers need it | [[proposals/kubernetes-deployment.md]] |
| Container registry beyond ghcr.io | Not needed for Phase 2 | Post-launch |
| Hot-reload in development container | Dev workflow is fine without it | Post-launch |
| Secrets management (Vault, AWS Secrets) | Enterprise Phase 4+ concern | Post-launch |

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-03 | Created (skeleton) | NetYeti |
| 2026-06-04 | Fully specified: three scenarios, Dockerfile design, env vars, CI/CD, eliminates known fragility issues | NetYeti |
