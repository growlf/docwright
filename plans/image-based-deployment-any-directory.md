---
title: Image-Based Deployment — Run on Any Directory (Vault Mount + Env, No Source Checkout)
status: draft
author: NetYeti
created: 2026-07-10
tags:
  - deployment
  - docker
  - infrastructure
  - config
  - security
proposal_source: proposals/image-based-deployment-any-directory.md
priority: high
complexity: medium
automated: guided
assigned_to: ""
tests_defined: false
tests_human_reviewed: false
scenario_synthesis: "Happy path: an operator creates an empty directory, drops a .env + points VAULT_PATH at a vault, runs `docker compose up -d` against the shipped production compose, and gets a healthy instance on the published image with ZERO edits to any tracked file. Update path: `docker compose pull && up -d` (or Watchtower auto-recreate) moves it to a new release with no git ops. Failure paths: empty .env still boots (image-baked defaults); a foreign/absent vault path fails fast with a clear error; pull of an unavailable tag leaves the running container intact. Root-cause elimination: no source tree is mounted on a production instance, so GH #288 (root-owned .svelte-kit written into the source mount) cannot reproduce. The dogfood dev box keeps its source-mount build compose untouched throughout."
total_steps: 0
completed_steps: 0
---

# Image-Based Deployment — Run on Any Directory (Vault Mount + Env, No Source Checkout)

## Overview

Replace the "deployment = a git checkout rebuilt in place (`build: .`)" model with an
immutable-image deployment: production instances run the **published**
`ghcr.io/growlf/docwright` image, take **all** per-instance config from the
environment (`.env` / `env_file`), and mount exactly **one** thing — the vault at
`/vault`. Updates become `docker compose pull && up -d` (or a Watchtower auto-recreate).
Full rationale, security implications, and alternatives:
[[proposals/image-based-deployment-any-directory]].

This eliminates the failure class observed 2026-07-10 (drifting source trees wedging
`git checkout <tag>`; three dev-cloud instances stuck two releases behind under a
silently-failing hourly cron) and removes [[issues/bug-container-as-root-writes-svelte-kit-into-the-sourc]] (GH #288) at the root.

```
Any directory:   .env  +  VAULT_PATH -> vault/           (nothing DocWright-owned here)
      │  docker compose up -d   (generic prod compose, identical for every instance)
      ▼
ghcr.io/growlf/docwright:<tag/digest>   ── mounts only ──▶  /vault
      ▲  update = docker compose pull + up -d  (Watchtower can trigger this, outbound-only)
```

## Constraints & Invariants (read before executing ANY step)

1. **The dogfood dev box (`docwright-docwright-1`) is NOT in scope for the image
   model.** It legitimately source-mounts (`build: .` + `.:/app`) for live
   development. Keep its compose working; only *label* it clearly as dev-only.
2. **No secrets in tracked files or in the image.** All credentials stay in an
   untracked `.env` / mounted keys (as the per-repo SSH deploy keys already do).
   Never write a real token/password into the repo or a committed compose.
3. **Nothing DocWright-owned may live in the mount.** The only bind mount is the
   vault → `/vault`. The container must not depend on writing into `/app` at runtime.
4. **Pin production by digest, not a floating tag,** wherever a concrete release is
   deployed (reproducible + tamper-evident). `:latest` is allowed only for the
   Watchtower auto-update channel, documented as such.
5. **Updates are outbound-only.** Prefer Watchtower (polls the registry) over an
   inbound webhook; do NOT open an inbound endpoint on a deploy host in this plan.
6. **Plan mutations via MCP tools only** (`update_step` / `append_history` /
   `update_plan_status`). Direct writes to `plans/*.md` are blocked. Keep history
   text free of `|` pipe characters (avoids the known table-corruption bug, GH #272).
7. **Git flow (branch-only until completion):** all repo changes land on
   `feat/image-based-deployment` (branched off `origin/main`). Work in this worktree.
   Ops steps in Phase 4 act on the `docwright-deploy` checkouts + docker on
   `cluster-llm` and are NOT repo commits — record their evidence in the step history.
   On completion: one `feat/image-based-deployment → main` PR with at least a
   patch-level version bump. Typed commit prefixes (`feat|fix|docs|chore|refactor`).
8. **The three dev-cloud instances (csdocs :5274, erp-images :5275, msp :5276) are
   currently on a throwaway image pin** (`docker-compose.pin-v0.4.11.yml`, applied
   2026-07-10). They must stay healthy throughout; Phase 4 replaces the throwaway pin
   with the supported production compose, then removes the pin files.
9. **Verify every image-runnable claim by RUNNING the image**, not by reading the
   Dockerfile: `docker run`/`compose up` + `curl /api/health` → 200.

## Steps

| # | Action | Details | Status |
| --- | --- | --- | --- |
| 1.1 | Enumerate the env config contract | Grep the app + entrypoint for every consumed env var: `grep -rnoE "process\\.env\\.[A-Z_]+" src/ scripts/ \| sort -u` and read the container entrypoint (`docwright-entrypoint`). Produce a canonical list (name, purpose, default, secret?). Deliverable: a table in `docs/deployment.md` under a new "Environment contract" heading. No code change yet. Verify: the list includes at minimum GIT_USER_NAME, GIT_USER_EMAIL, GIT_TOKEN, AUTH_MODE, LOCAL_AUTH_USER/PASSWORD/EMAIL/DISPLAY_NAME, SESSION_TTL_SECONDS, PORT, VAULT_PATH, DOCWRIGHT_ALLOWED_HOSTS, plus any others grep finds. | ⏳ Pending |
| 1.2 | Bake sane defaults so an empty .env boots | For each non-secret knob from 1.1, ensure a working default exists in the entrypoint/app (secrets default to empty/disabled, never a real value). Verify by RUNNING the published image with NO env file, only a throwaway vault: `docker run --rm -p 5999:5173 -v $(mktemp -d):/vault ghcr.io/growlf/docwright:<current-tag>` then `curl -s -o /dev/null -w '%{http_code}' localhost:5999/api/health` → 200. Record the output in the step history. | ⏳ Pending |
| 1.3 | Confirm zero DocWright-owned writes outside /vault | Identify every runtime write path (index.json cache, DOCWRIGHT_CACHE_DIR, ai-sessions, `.svelte-kit`). Ensure `.svelte-kit`/build output is baked into the image at build time (never written at runtime) and any runtime cache resolves under `/vault` or an explicit named volume — NOT under `/app`. Verify: run the image (no source mount), exercise one AI action, then `docker diff <container>` shows no new/changed files under `/app/src`. This is the fix for [[issues/bug-container-as-root-writes-svelte-kit-into-the-sourc]] (GH #288). | ⏳ Pending |
| 2.1 | Ship a production compose (image-based) | Add `docker-compose.prod.yml` (or `deploy/docker-compose.yml`): `image: ghcr.io/growlf/docwright:${DOCWRIGHT_IMAGE:-latest}` (support a digest via the same var), `env_file: .env`, exactly one bind mount `${VAULT_PATH:?set VAULT_PATH}:/vault`, `ports: ${PORT:-5173}:5173`, `restart: unless-stopped`. NO `build:`. Do NOT enumerate individual env vars (env_file carries them). Verify: `docker compose -f docker-compose.prod.yml config` resolves; `up -d` against a temp .env + vault → `/api/health` 200. | ⏳ Pending |
| 2.2 | Label the existing compose dev-only | Add a header comment to the current `docker-compose.yml` (Scenario 1) marking `build: .` + source mount as DEV-ONLY (dogfood), and cross-reference the prod compose from 2.1. No behavior change to the dev box. Verify: dogfood container still builds + serves (`curl localhost:5174/api/health` → 200 after a `docker compose up -d --build` on the dogfood dir). | ⏳ Pending |
| 2.3 | Add opt-in Watchtower update channel | Add a documented, opt-in Watchtower service (compose fragment `deploy/watchtower.yml` + docs): registry-poll only, label-scoped (`com.centurylinklabs.watchtower.enable=true`) to DocWright containers, `--cleanup`, outbound-only, no inbound port. Document the CI-push-webhook alternative and why it is deferred (inbound attack surface). No secrets committed. Verify: `docker compose -f deploy/watchtower.yml config` resolves; docs explain enable/disable. | ⏳ Pending |
| 3.1 | Scaffold a deploy directory generator | Extend `docwright init`/adopt (or add `scripts/scaffold-deploy.ts`) to generate a deploy dir for ANY vault path: writes the prod compose (2.1) + a `.env` from `.env.example` with VAULT_PATH filled in, and prints next steps. Must not require editing any tracked repo file. Verify: run the scaffold into a fresh `mktemp -d`, then `docker compose up -d` there → `/api/health` 200, and `git -C <repo> status` shows no tracked-file changes from the deploy. | ⏳ Pending |
| 3.2 | Update .env.example + deployment docs | Regenerate `.env.example` from the 1.1 contract (every knob, safe defaults, secrets blank with comments). Rewrite `docs/deployment.md` + `docs/docker.md` for the image-based flow (create dir → .env → compose up; update via pull; optional Watchtower). Remove/retire guidance that implies deploying via a source checkout. Verify: docs contain no `git clone`/`build: .` step in the production path; `.env.example` lints. | ⏳ Pending |
| 4.1 | Cut over csdocs to the prod compose | On cluster-llm, in `docwright-deploy/csdocs`: replace the throwaway `docker-compose.pin-v0.4.11.yml` with the supported prod compose (2.1) + Watchtower label, keeping the existing `.env`, vault mount, and SSH deploy-key mount. `docker compose -p docwright-csdocs -f <prod compose> up -d`. Verify: `docwright-csdocs-docwright-1` healthy on `ghcr.io/growlf/docwright:<pinned digest>`, `curl localhost:5274/api/health` → 200. Record evidence in history. | ⏳ Pending |
| 4.2 | Cut over erp-images + msp | Repeat 4.1 for `docwright-deploy/erp-images` (:5275) and `msp` (:5276), preserving each instance's `.env` + SSH key + allowed-hosts. Verify both healthy on the published image via the prod compose (`/api/health` → 200 on 5275 and 5276). | ⏳ Pending |
| 4.3 | Enable Watchtower + retire the checkout deploy | Bring up the opt-in Watchtower (2.3) on cluster-llm scoped to the three instances. Then retire the legacy path: remove the throwaway `docker-compose.pin-*.yml` files and archive/remove the git-checkout trees + `docwright-deploy/auto-release-update.sh` (the hourly cron was already removed 2026-07-10). Verify: pushing a subsequent release tag results in Watchtower pulling + recreating the three instances automatically (or, if testing without a real bump, `docker compose pull` shows the mechanism); confirm no `auto-release-update.sh` remains referenced by cron (`crontab -l`). | ⏳ Pending |
| 5.1 | End-to-end acceptance from a clean directory | From a brand-new empty directory (not a repo checkout), scaffold (3.1) + `docker compose up -d` → healthy instance, ZERO tracked-file edits. Bump the image var to a newer digest + `docker compose pull && up -d` → instance updates with no git ops. Confirm GH #288 does not reproduce (no `.svelte-kit` written into any source tree). Close #288 with a note. Verify: paste all curl/health outputs into the step history. | ⏳ Pending |
| 5.2 | Version bump + completion PR | Bump VERSION + package.json (≥ patch). Open one `feat/image-based-deployment → main` PR summarizing the new deployment model, the env contract, the Watchtower channel, and the #288 fix. Propose the commit command for the human to attest (do NOT self-attest HUMAN_APPROVED). Verify: CI green on the PR (Lint/Typecheck/Test, Docker build + health, Branch policy). | ⏳ Pending |

## Document History

| Date | Change | By |
| --- | --- | --- |
| 2026-07-10 | Drafted from proposal image-based-deployment-any-directory; status draft, awaiting human review/approval. | NetYeti |
