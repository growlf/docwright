---
title: "BMS dev-cloud — DocWright deployment runbook"
status: active
author: NetYeti
created: 2026-07-05
tags:
  - deployment
  - operations
  - bms
  - runbook
---

# BMS dev-cloud — DocWright deployment runbook

**Operational** runbook for the four DocWright instances on the BMS dev-cloud. The
*design/rationale* lives in [[proposals/three-docwright-instance-deployment]]; this doc is
how to reproduce, operate, and update them. Host: `10.10.0.201` (BMS env), Linux user `gemini`.

## Instances

| # | Name | URL (no port) | Port | Mode | Vault → remote |
|---|------|---------------|------|------|----------------|
| 1 | dogfood-dev | `docwright-dev.bms.local` | 5173 | **systemd** `docwright-dev.service` (`npm run dev`), `dogfood` branch, **serves itself** | `~/Projects/DocWright-development` → `growlf/docwright` |
| 2 | csdocs | `csdocs.bms.local` | 5274 | release container (v0.4.8) | `~/Projects/csdocs` → `CascadeSTEAM/csdocs` |
| 3 | erp-images | `erp-images.bms.local` | 5275 | release container + `erp-images` plugin | `~/Projects/cs-erp-images` → `CascadeSTEAM/cs-erp-images` |
| 4 | msp-pilot | `msp.bms.local` | 5276 | release container (v0.4.8) | `~/Projects/msp-pilot-vault` (clone of `growlf/bms-ai-cluster`) |

## Host layout

```
~/Projects/
  DocWright-development/          # #1 code+vault (dogfood branch), run via npm run dev
  csdocs/  cs-erp-images/  msp-pilot-vault/   # vaults for #2/#3/#4 (bind-mounted at /vault)
  docwright-deploy/
    csdocs/      code checkout @ release tag + .env + docker-compose.override.yml   # #2
    erp-images/  "                                                                  # #3
    msp/         "                                                                  # #4
    _secrets/<name>/id_ed25519   # per-repo deploy key (root:600), mounted into the container
```

Each container deployment = a **disposable DocWright code checkout** pinned to a release tag
(`build: .`) with the **vault bind-mounted from a separate content-repo clone**. Compose
project names: `docwright-csdocs`, `docwright-erp-images`, `docwright-msp`.

### Per-instance config (`.env` + `docker-compose.override.yml`)

`.env` (consumed by the repo's `docker-compose.yml`): `VAULT_PATH`, `PORT`, `GIT_USER_NAME`,
`GIT_USER_EMAIL` (a transparently-labeled static service identity, e.g. `DocWright csdocs`),
`DOCWRIGHT_ALLOWED_HOSTS=<hostname>,localhost`. `GIT_TOKEN` left empty (SSH deploy key is used).

`docker-compose.override.yml` adds: `DOCWRIGHT_ALLOWED_HOSTS` env, the deploy-key volume
(`_secrets/<name>/id_ed25519:/root/.ssh/id_ed25519:ro`), and `GIT_SSH_COMMAND` pointing git at
that key. (Instance 3 no longer needs `DOCWRIGHT_VAULT_ROOT` — the v0.4.8 plugin-loader fix
falls back to `DOCWRIGHT_ROOT`.)

## Reverse proxy + DNS

- **Canonical NPMPlus runs on the Docker Swarm** — nodes `10.10.0.64/.65/.66/.68`, ingress
  `swarm.bellinghammakerspace.org`, published on `:80/:443/:81` via the routing mesh. (The old
  standalone `10.10.0.11` LXC was empty/flaky and is **decommissioned** — see `BMS-0092`.)
- **DNS**: `*.bms.local` → **CNAME `swarm.bellinghammakerspace.org`** (Technitium `10.10.0.4`).
- **Proxy hosts**: `<name>.bms.local` → `http://10.10.0.201:<port>`, **websockets on** (Vite HMR
  + SSE `/api/watch`), created via the NPM admin API on any swarm node (`:81`).
- All of the above is managed by the idempotent playbook
  `bms-ai-cluster:ansible/playbooks/configure-docwright-dev-cloud.yml` (creds from VaultWarden;
  tracked under `BMS-0091`). Add a new instance by appending to its `instances:` list and re-running.

## Git-push auth (deploy keys)

Per-repo ed25519 **write** deploy keys, one per content repo, `root:600` on the host under
`docwright-deploy/_secrets/<name>/`, mounted read-only into each container and used via
`GIT_SSH_COMMAND`. Backed up in **VaultWarden → Cascade STEAM org → `DocWright` collection**
(items `DocWright deploy key: <repo>`). Container image includes `openssh-client` as of v0.4.8.
(#1 pushes with the host user's own key.)

## Process management & auto-update

- **#1 (dogfood-dev)** runs under **systemd** — unit `docwright-dev.service` (in
  `/etc/systemd/system/`, tracked at `deploy/bms-dev-cloud/docwright-dev.service`). `enabled`
  (survives reboot), `Restart=on-failure`. Manage with
  `sudo systemctl {status,restart,stop,start} docwright-dev`. Its **code** is updated by the manual
  leap-frog (`dogfood` ← `main`); after pulling, `sudo systemctl restart docwright-dev` (Vite HMR
  also picks up source changes live between restarts).
- **#2/#3/#4** **auto-update hourly** — `deploy/bms-dev-cloud/auto-release-update.sh` (deployed at
  `~/Projects/docwright-deploy/auto-release-update.sh`) runs on cron (`0 * * * *`): fetches the newest
  `v*` release tag and, for any instance not on it, checks it out + rebuilds/recreates the container.
  Logs to `~/Projects/docwright-deploy/auto-release.log`. `restart: unless-stopped` covers crash/reboot.

## Common operations

```bash
# Rebuild / restart a container instance (#2/#3/#4)
cd ~/Projects/docwright-deploy/<name>
docker compose -p docwright-<name> up -d --build

# Update a release-pinned instance to a new tag
cd ~/Projects/docwright-deploy/<name>
git fetch origin --tags && git checkout vX.Y.Z
docker compose -p docwright-<name> up -d --build

# #1 dogfood-dev — leap-frog from main, then restart the systemd-managed dev server
cd ~/Projects/DocWright && git checkout dogfood && git merge origin/main   # (conforming commit msg)
cd ~/Projects/DocWright-development && git pull --ff-only origin dogfood
npm ci && (cd src/webui && npm ci) && npm run compile:mcp                  # if package.json changed
sudo systemctl restart docwright-dev

# Re-run the proxy/DNS playbook (creds via env from VaultWarden)
cd ~/Projects/bms-ai-cluster
DNS_ADMIN_PASSWORD=… NPM_SECRET=… ~/.local/bin/ansible-playbook ansible/playbooks/configure-docwright-dev-cloud.yml
```

Health: `http://<name>.bms.local/api/health` → `{"ok":true}`. Direct-IP fallback (bypasses
DNS+proxy): `http://10.10.0.201:<port>/`.

## Known deferred work

Tracked in the proposal's *Deferred proposals* section: per-user OAuth attribution (replaces the
interim static service identities), instance-3 tool-vs-customer-data commit guardrail +
customer-data backup store, and multi-instance deploy tooling — the hourly auto-release cron +
systemd unit are now in place; the remaining optimization is to **pull the GHCR release image**
instead of building locally and collapse the three near-identical checkouts.
