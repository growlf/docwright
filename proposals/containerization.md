---
title: "Containerization — Docker Deployment for All Three Scenarios"
author: NetYeti
created: 2026-06-03
updated: 2026-06-04
tags:
  - infrastructure
  - deployment
  - docker
  - phase-1
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

**DocWright container** — the SvelteKit web server + all API routes + MCP server:
- Node.js runtime (pinned version)
- Built SvelteKit app
- **MCP server** (`scripts/mcp-server.py`) — Python and `mcp` package installed
  directly into the container's system Python via `pip install --no-cache-dir mcp`.
  No venv inside the container — the container IS the isolation layer, making
  a venv redundant and a source of the exact path confusion it is meant to prevent.
- `DOCWRIGHT_ROOT` points to the vault volume mount

**Phase 2 TypeScript MCP migration:** Phase 2 rewrites the MCP server from
Python to TypeScript (`src/dispatch/mcp-server.ts`). Once complete, Python is
removed from the container entirely — the image becomes pure Node.js, smaller
and simpler. The Dockerfile detects `dist/mcp-server.js` and prefers it; Python
is the fallback until then.

**Vault** — mounted as a volume, never baked into the image:
- The vault is the user's data; the container is the runtime
- `docker run -v /path/to/my-vault:/vault docwright`

**OpenCode** — NOT containerized in the DocWright image:
- Each user runs OpenCode locally on their own machine (Team Server scenario)
- OR: an optional `opencode` sidecar container for server-side AI (Enterprise)
- See `docs/deployment.md` for the AI architecture per scenario

### What the container needs to include

**Critical dependency: `git`** — the DocWright server calls `git` directly via
`spawnSync` for all git operations: commit, stage, push, tag, status, undo.
Without git in the image, the entire git panel fails silently.

**Git identity** — commits require `user.name` and `user.email`. These must be
configurable via environment variables (`GIT_AUTHOR_NAME`, `GIT_AUTHOR_EMAIL`).

**Git credentials for push** — pushing to Forgejo requires authentication.
Options (user chooses one):
- Mount SSH key: `-v ~/.ssh/id_rsa:/root/.ssh/id_rsa:ro`
- Pass token via env: `GIT_TOKEN=xxx` (container writes `.netrc`)
- For standalone local git: no credentials needed

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
# git — server calls it directly for all git operations (commit, stage, push, etc.)
# python3 + mcp — MCP server; no venv needed in a container
RUN apk add --no-cache git python3 py3-pip \
    && pip install --no-cache-dir mcp \
    && git config --global --add safe.directory /vault
WORKDIR /app
COPY --from=builder /app/build ./build
COPY --from=builder /app/node_modules ./node_modules
COPY scripts/ ./scripts/
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh
ENV DOCWRIGHT_ROOT=/vault
ENV NODE_ENV=production
EXPOSE 5173
VOLUME /vault
HEALTHCHECK --interval=30s CMD wget -qO- http://localhost:5173/api/status || exit 1
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "build/index.js"]
```

**`docker-entrypoint.sh`** — sets git identity from environment before starting:
```bash
#!/bin/sh
# Configure git identity if provided via environment
if [ -n "$GIT_AUTHOR_NAME" ]; then
  git config --global user.name "$GIT_AUTHOR_NAME"
fi
if [ -n "$GIT_AUTHOR_EMAIL" ]; then
  git config --global user.email "$GIT_AUTHOR_EMAIL"
fi
# Write .netrc for HTTPS git auth if token provided
if [ -n "$GIT_TOKEN" ] && [ -n "$GIT_HOST" ]; then
  echo "machine $GIT_HOST login git password $GIT_TOKEN" > /root/.netrc
  chmod 600 /root/.netrc
fi
exec "$@"
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

### What remains outside the container

| Component | Why outside | How to connect |
|-----------|-------------|----------------|
| **The vault** (git repo) | User's data — never baked into image | `-v /path/to/vault:/vault` volume mount |
| **OpenCode** | Each user runs their own (team server model); or optional sidecar | `OPENCODE_URL` env var |
| **Forgejo** (git server) | Separate service | `GIT_HOST` + `GIT_TOKEN` or SSH key mount |
| **Reverse proxy** (HTTPS) | TLS termination is infrastructure's job | Caddy/nginx in docker-compose |
| **Git credentials** | Vault-specific auth | SSH key volume or `GIT_TOKEN` env var |
| **DNS/hostname** | Infrastructure concern | Reverse proxy config |

For **standalone local use**, none of these are needed — git is local, no push credentials required, HTTP is fine.

For **team server**, only the reverse proxy and git credentials need configuration.

### Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DOCWRIGHT_ROOT` | `/vault` | Absolute path to vault directory inside container |
| `ORIGIN` | `http://localhost:5173` | Public URL — required for CSRF protection in production |
| `OPENCODE_URL` | `http://127.0.0.1:4096` | Where to find OpenCode (override for sidecar) |
| `OPENCODE_SERVER_PASSWORD` | *(none)* | Optional OpenCode auth token |
| `PORT` | `5173` | Internal server port |
| `GIT_AUTHOR_NAME` | *(none)* | Git commit identity — name |
| `GIT_AUTHOR_EMAIL` | *(none)* | Git commit identity — email |
| `GIT_HOST` | *(none)* | Forgejo hostname for HTTPS auth (e.g. `git.cascade.steam`) |
| `GIT_TOKEN` | *(none)* | Forgejo personal access token for HTTPS push |

### Eliminates existing fragility

| Current problem | Container fix |
|----------------|---------------|
| MCP server hangs because `.venv/bin/python3` ≠ system `python3` | Container has one Python; `mcp` installed directly via pip — no venv, no ambiguity |
| `mcp` package not installed in the right Python | Installed into container's system Python at build time; always present |
| `git` not on PATH — git panel silently broken | `git` installed in image via `apk add git`; always available to server |
| Git identity not set — commits fail | `GIT_AUTHOR_NAME` + `GIT_AUTHOR_EMAIL` env vars; entrypoint configures git |
| `DOCWRIGHT_ROOT` not set | Set by the container entrypoint |
| Node version mismatch between dev and production | Pinned in Dockerfile `FROM node:22-alpine` |
| Phase 2 TypeScript MCP replaces Python | Container detects `dist/mcp-server.js` and uses it; Python layer dropped |

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
