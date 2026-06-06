# DocWright — Docker Deployment Guide

## Quick start (standalone, local vault)

```bash
# 1. Clone DocWright
git clone https://github.com/your-org/docwright
cd docwright

# 2. Set your git identity
export GIT_USER_NAME="Your Name"
export GIT_USER_EMAIL="you@example.com"

# 3. Point to your vault (a git repo of markdown files)
export VAULT_PATH=/path/to/your/vault

# 4. Start
docker compose up

# Open http://localhost:5173
```

The vault directory is mounted read-write into the container. DocWright reads and
writes markdown files there. Git operations (commit, push) use the identity you set
above.

---

## Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `GIT_USER_NAME` | Yes | `DocWright User` | Name for git commits made via the Web UI |
| `GIT_USER_EMAIL` | Yes | `docwright@localhost` | Email for git commits made via the Web UI |
| `GIT_TOKEN` | No | — | GitHub/Forgejo personal access token for HTTPS push |
| `VAULT_PATH` | No | `./example-vault` | Host path to mount as the vault (standalone scenario) |
| `PORT` | No | `5173` | Port the Web UI listens on |
| `MCP_PORT` | No | `3002` | Port the MCP SSE server listens on (internal) |
| `DOCWRIGHT_ROOT` | No | `/vault` | Container path to the vault root (change only if you remap the volume) |
| `DOCWRIGHT_CACHE_DIR` | No | `/tmp` | Directory for the status cache file |

---

## Git credentials

### Option A — Personal access token (HTTPS)

Set `GIT_TOKEN` and the entrypoint writes it to `.git-credentials` scoped to
github.com. Works for GitHub, Forgejo, Gitea, and GitLab HTTPS remotes.

```bash
export GIT_TOKEN=ghp_your_token_here
docker compose up
```

### Option B — SSH key (recommended for production)

Mount your SSH key into the container:

```yaml
services:
  docwright:
    volumes:
      - /path/to/vault:/vault
      - ~/.ssh/id_ed25519:/root/.ssh/id_ed25519:ro
      - ~/.ssh/known_hosts:/root/.ssh/known_hosts:ro
```

SSH keys are never read by the entrypoint — they're picked up by git natively.

---

## Deployment scenarios

### Scenario 1 — Standalone (local developer)

The default `docker-compose.yml` configuration. Mount a local vault directory and
access the UI on `localhost:5173`. Suitable for a single developer running
DocWright on their workstation.

```yaml
# docker-compose.yml (active by default — no changes needed)
services:
  docwright:
    build: .
    volumes:
      - ${VAULT_PATH:-./example-vault}:/vault
    ports:
      - "5173:5173"
    environment:
      GIT_USER_NAME:  ${GIT_USER_NAME}
      GIT_USER_EMAIL: ${GIT_USER_EMAIL}
```

### Scenario 2 — Team server (Caddy reverse proxy)

Caddy handles TLS termination. DocWright is not exposed directly. Create a
`Caddyfile` next to `docker-compose.yml`:

```
your.domain.example.com {
    reverse_proxy docwright:5173
}
```

Then uncomment Scenario 2 in `docker-compose.yml` (and comment out Scenario 1).

### Scenario 3 — Enterprise (OpenCode sidecar)

For deployments that co-locate an OpenCode serve instance alongside DocWright —
useful for air-gapped environments where the AI backend is on the same host.

Uncomment Scenario 3 in `docker-compose.yml`. Replace the `ghcr.io/sst/opencode`
image reference with the actual published image once available, or build from
source.

---

## Known limitations (Phase 1)

- **Dev mode server**: the container runs `vite dev`, not a production build.
  This is intentional for Phase 1 — the priority is environment reproducibility,
  not performance. Production mode (adapter-node build) will be addressed in
  Phase 2.

- **No authentication**: the Web UI has no login gate. For team/enterprise
  deployments, Caddy or your load balancer should handle access control.

- **opencode.json is excluded from the image**: it contains host-local paths.
  If you need OpenCode integration, configure it via environment variables or
  mount a vault-specific `opencode.json` at runtime.

- **MCP SSE port (3002) is not exposed by default**: it is internal to the
  container. Only expose it if external tooling needs to connect to the MCP
  server directly.

---

## Building the image manually

```bash
docker build -t docwright:local .
docker run -it \
  -e GIT_USER_NAME="Your Name" \
  -e GIT_USER_EMAIL="you@example.com" \
  -v /path/to/vault:/vault \
  -p 5173:5173 \
  docwright:local
```
