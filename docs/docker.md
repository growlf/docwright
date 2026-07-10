# DocWright — Docker Deployment Guide

DocWright ships as a container image. A deployment is **one mounted vault + an
environment file** — nothing DocWright-owned lives in the deploy directory (the
app is the image). Two compose files:

- **`docker-compose.prod.yml`** — production. Runs the published image, config
  from `app.env`, one vault mount. Update with `docker compose pull`.
- **`docker-compose.yml`** — development. Builds locally, bind-mounts the source,
  runs the Vite dev server (HMR). For working *on* DocWright.

## Quick start (production)

Scaffold a deploy directory for any vault (nothing is written into the DocWright
checkout):

```bash
npm run deploy:scaffold -- --dir /srv/docwright --vault /srv/my-vault --port 5173
cd /srv/docwright
# edit app.env — at minimum set ORIGIN (once you enable auth) and, for AI, OPENCODE_URL
docker compose -f docker-compose.prod.yml up -d
# open http://localhost:5173
```

Or by hand: create a directory with a `.env` (below), copy `app.env.example` to
`app.env`, and run the same `up -d`.

**Update** to a newer release:

```bash
docker compose -f docker-compose.prod.yml pull && \
docker compose -f docker-compose.prod.yml up -d
```

---

## Configuration — two files

**`.env`** (compose interpolation — the deploy dir only):

| Variable | Default | Description |
|---|---|---|
| `DOCWRIGHT_IMAGE` | `ghcr.io/growlf/docwright:latest` | Image ref. **Pin by digest in production** (`…@sha256:…`) |
| `VAULT_PATH` | — (required) | Host path to the vault, mounted at `/vault` |
| `PORT` | `5173` | Host port to publish (container always listens on 5173) |

**`app.env`** (container runtime config — loaded verbatim, so a bcrypt `$`
survives). Everything has a safe default; an absent/empty `app.env` boots an open
`AUTH_MODE=none` instance. See **`app.env.example`** for the full contract:

| Variable | Notes |
|---|---|
| `AUTH_MODE` | `none` (default) \| `local` \| `forgejo` |
| `LOCAL_AUTH_USER` / `LOCAL_AUTH_PASSWORD` / … | For `local`; `LOCAL_AUTH_PASSWORD` is a **bcrypt hash** |
| `ORIGIN` | **Required once auth is on** — the URL users hit (login is a form POST; the server rejects it without a matching origin). Do NOT set to an empty string. |
| `PROTOCOL_HEADER` / `HOST_HEADER` | Alternative to `ORIGIN` behind a reverse proxy: `x-forwarded-proto` / `x-forwarded-host` |
| `GIT_USER_NAME` / `GIT_USER_EMAIL` / `GIT_TOKEN` | Git identity + HTTPS push token |
| `OPENCODE_URL` / `OPENCODE_SERVER_PASSWORD` | AI backend (never browser-exposed). Never run the agent server unauthenticated |

---

## Git credentials

**Option A — token (HTTPS):** set `GIT_TOKEN` in `app.env`; the entrypoint writes
it to `.git-credentials` scoped to github.com.

**Option B — SSH key (recommended):** mount the key and point git at it. Add a
`docker-compose.override.yml` next to the prod compose:

```yaml
services:
  docwright:
    volumes:
      - /path/to/id_ed25519:/root/.ssh/id_ed25519:ro
    environment:
      GIT_SSH_COMMAND: "ssh -i /root/.ssh/id_ed25519 -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new"
```

---

## Reverse proxy (TLS / domain)

Put Caddy/nginx in front and terminate TLS there. So login (a form POST) works,
either set `ORIGIN` to the public URL, or have the proxy send `x-forwarded-proto`
and `x-forwarded-host` and set `PROTOCOL_HEADER`/`HOST_HEADER` in `app.env`.

```
docs.example.org {
    reverse_proxy localhost:5173
}
```

---

## Auto-update (optional)

`deploy/watchtower.yml` runs Watchtower to auto-recreate DocWright containers when
a newer image is published — **outbound-only** (it polls the registry; no inbound
endpoint). It is label-scoped and only touches containers that opted in (the prod
compose sets the label). Enable: `docker compose -f deploy/watchtower.yml up -d`.
For reproducible deploys, pin `DOCWRIGHT_IMAGE` to a digest instead and update
deliberately with `pull`.

---

## Development (working on DocWright)

`docker-compose.yml` builds the image, bind-mounts the source, and runs the Vite
dev server (`DOCWRIGHT_DEV_SERVER=1`) for live reload:

```bash
export VAULT_PATH=/path/to/vault PORT=5174
docker compose up --build      # dev; edits reload without a rebuild
```

Auth in dev is read by Vite from `src/webui/.env` (production reads `app.env`).

---

## Building the image locally

```bash
docker build -t docwright:local .
# then set DOCWRIGHT_IMAGE=docwright:local in the deploy dir's .env
```

The build runs the SvelteKit production build (`@sveltejs/adapter-node`) and bakes
it into the image; the container runs `node build`. Nothing is written into the
source tree at runtime.

---

## Notes

- **MCP SSE port (3002)** is internal by default; expose it only if external
  tooling needs the MCP server directly.
- **opencode.json** is excluded from the image (host-local paths). Configure
  OpenCode via `OPENCODE_URL` or mount a vault-specific config at runtime.
