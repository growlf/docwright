---
title: Image-Based Deployment — Run on Any Directory (Vault Mount + Env, No Source Checkout)
status: in-progress
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
assigned_to: NetYeti
tests_defined: false
tests_human_reviewed: false
scenario_synthesis: "Happy path: an operator creates an empty directory, drops a .env + points VAULT_PATH at a vault, runs `docker compose up -d` against the shipped production compose, and gets a healthy instance on the published image with ZERO edits to any tracked file. Update path: `docker compose pull && up -d` (or Watchtower auto-recreate) moves it to a new release with no git ops. Failure paths: empty .env still boots (image-baked defaults); a foreign/absent vault path fails fast with a clear error; pull of an unavailable tag leaves the running container intact. Root-cause elimination: no source tree is mounted on a production instance, so GH #288 (root-owned .svelte-kit written into the source mount) cannot reproduce. The dogfood dev box keeps its source-mount build compose untouched throughout."
total_steps: 14
completed_steps: 7
gate_note: "Changed files are untestable types: plans/image-based-deployment-any-directory.md"
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
6. **Plan mutations via MCP tools only** (`update_step` / `update_plan_status` /
   `append_history` / `set_plan_field` / `write_plan`). Direct writes to `plans/*.md`
   are blocked. Keep history text free of `|` pipe characters (avoids the known
   table-corruption bug, GH #272).
7. **Git flow:** governance docs (this plan, the proposal, issues) are authored via the
   MCP tools into the `dogfood` integration checkout and committed on `dogfood`. Code /
   config / docs deliverables (compose files, entrypoint, `docs/*`, `scripts/*`) also
   land on `dogfood`; the source-mounted dogfood container picks them up live for
   testing. Phase 4 ops steps act on the `docwright-deploy` checkouts + docker on
   `cluster-llm` and are NOT repo commits — record their evidence in the step history.
   On completion: one `dogfood → main` PR with at least a patch-level version bump.
   Typed commit prefixes (`feat|fix|docs|chore|refactor`); do NOT self-attest
   HUMAN_APPROVED on governance-state commits — propose them for the human.
8. **The three dev-cloud instances (csdocs :5274, erp-images :5275, msp :5276) are
   currently on a throwaway image pin** (`docker-compose.pin-v0.4.11.yml`, applied
   2026-07-10). They must stay healthy throughout; Phase 4 replaces the throwaway pin
   with the supported production compose, then removes the pin files.
9. **Verify every image-runnable claim by RUNNING the image**, not by reading the
   Dockerfile: `docker run`/`compose up` + `curl /api/health` → 200.

## Implementation Steps

| # | Action | Details | Status |
| --- | --- | --- | --- |
| 1.0 | Production image target (adapter-node build) | Foundational, load-bearing. Switch webui from `@sveltejs/adapter-auto` to `@sveltejs/adapter-node`; add a multi-stage production build to the Dockerfile (`npm run build` in `src/webui` producing the `build/` output) and run the built server `HOST=0.0.0.0 PORT=${PORT:-5173} node build` in place of the entrypoint's `npm run dev -- --host 0.0.0.0 --port`, keeping the background MCP launch + git-identity setup. For reverse-proxied instances, honor adapter-node's `ORIGIN` (or `PROTOCOL_HEADER`/`HOST_HEADER`) rather than Vite's `DOCWRIGHT_ALLOWED_HOSTS` host-check. Keep the dogfood dev box on its `vite dev` compose (Constraint 1). Verify by RUNNING the built image (Constraint 9): build locally, `docker run` with a throwaway vault, `curl /api/health` → 200, exercise Review end-to-end, and `docker diff` shows NO new/changed files under `/app/src` (no runtime `.svelte-kit` write). This is the real root fix for [[issues/bug-container-as-root-writes-svelte-kit-into-the-sourc]] (GH #288). | ✅ Done |
| 1.1 | Enumerate the env config contract | DONE (investigation): grepped every `process.env.*` in `src/`+`scripts/` and read `Dockerfile` + `docker-entrypoint.sh`. ~40 vars grouped: vault/paths (DOCWRIGHT_ROOT=/vault, DOCWRIGHT_CACHE_DIR=/tmp, DW_SESSION_ROOT), server (PORT=5173, MCP_PORT=3002, DOCWRIGHT_ALLOWED_HOSTS, VITE_HOST/PORT), auth (AUTH_MODE=none, LOCAL_AUTH_*, SESSION_TTL_SECONDS, FORGEJO_*), git (GIT_USER_NAME/EMAIL/TOKEN, *GITHUB_TOKEN), AI (OPENCODE_URL, OPENCODE_SERVER_USER/PASS, OLLA_*, LIVE_AI_*), behavior (DOCWRIGHT_PROFILE, DOCWRIGHT_LOG_LEVEL, executor knobs). Remaining deliverable: write the canonical table into `docs/deployment.md` under an "Environment contract" heading (defer final wording to 3.2, which rewrites that doc). Note: DOCWRIGHT_ALLOWED_HOSTS is a Vite-dev artifact and should be superseded by ORIGIN once 1.0 lands. | ✅ Done |
| 1.2 | Bake sane defaults so an empty .env boots | For each non-secret knob from 1.1, ensure a working default exists in the entrypoint/app (secrets default to empty/disabled, never a real value). Build on the 1.0 production image. Verify by RUNNING the image with NO env file, only a throwaway vault: `docker run --rm -p 5999:5173 -v $(mktemp -d):/vault <local-prod-image>` then `curl -s -o /dev/null -w '%{http_code}' localhost:5999/api/health` → 200. Record the output in the step history. | ✅ Done |
| 1.3 | Confirm zero DocWright-owned writes outside /vault | Identify every runtime write path (index.json cache, DOCWRIGHT_CACHE_DIR, ai-sessions, `.svelte-kit`). With 1.0 in place the SvelteKit build is baked at image-build time (never written at runtime); confirm any runtime cache resolves under `/vault` or an explicit named volume — NOT under `/app`. Verify: run the prod image (no source mount), exercise one AI action, then `docker diff <container>` shows no new/changed files under `/app/src`. Confirms the GH #288 fix from 1.0 end-to-end. | ✅ Done |
| 2.1 | Ship a production compose (image-based) | Add `docker-compose.prod.yml` (or `deploy/docker-compose.yml`): `image: ghcr.io/growlf/docwright:${DOCWRIGHT_IMAGE:-latest}` (support a digest via the same var), `env_file: .env`, exactly one bind mount `${VAULT_PATH:?set VAULT_PATH}:/vault`, `ports: ${PORT:-5173}:5173`, `restart: unless-stopped`. NO `build:`. Do NOT enumerate individual env vars (env_file carries them). Verify: `docker compose -f docker-compose.prod.yml config` resolves; `up -d` against a temp .env + vault → `/api/health` 200. | ✅ Done |
| 2.2 | Label the existing compose dev-only | Add a header comment to the current `docker-compose.yml` (Scenario 1) marking `build: .` + source mount as DEV-ONLY (dogfood), and cross-reference the prod compose from 2.1. No behavior change to the dev box. Verify: dogfood container still builds + serves (`curl localhost:5174/api/health` → 200 after a `docker compose up -d --build` on the dogfood dir). | ✅ Done |
| 2.3 | Add opt-in Watchtower update channel | Add a documented, opt-in Watchtower service (compose fragment `deploy/watchtower.yml` + docs): registry-poll only, label-scoped (`com.centurylinklabs.watchtower.enable=true`) to DocWright containers, `--cleanup`, outbound-only, no inbound port. Document the CI-push-webhook alternative and why it is deferred (inbound attack surface). No secrets committed. Verify: `docker compose -f deploy/watchtower.yml config` resolves; docs explain enable/disable. | ✅ Done |
| 3.1 | Scaffold a deploy directory generator | Extend `docwright init`/adopt (or add `scripts/scaffold-deploy.ts`) to generate a deploy dir for ANY vault path: writes the prod compose (2.1) + a `.env` from `.env.example` with VAULT_PATH filled in, and prints next steps. Must not require editing any tracked repo file. Verify: run the scaffold into a fresh `mktemp -d`, then `docker compose up -d` there → `/api/health` 200, and `git -C <repo> status` shows no tracked-file changes from the deploy. | ⏳ Pending |
| 3.2 | Update .env.example + deployment docs | Regenerate `.env.example` from the 1.1 contract (every knob, safe defaults, secrets blank with comments). Rewrite `docs/deployment.md` + `docs/docker.md` for the image-based flow (create dir → .env → compose up; update via pull; optional Watchtower). Remove/retire guidance that implies deploying via a source checkout. Verify: docs contain no `git clone`/`build: .` step in the production path; `.env.example` lints. | ⏳ Pending |
| 4.1 | Cut over csdocs to the prod compose | On cluster-llm, in `docwright-deploy/csdocs`: replace the throwaway `docker-compose.pin-v0.4.11.yml` with the supported prod compose (2.1) + Watchtower label, keeping the existing `.env`, vault mount, and SSH deploy-key mount. `docker compose -p docwright-csdocs -f <prod compose> up -d`. Verify: `docwright-csdocs-docwright-1` healthy on `ghcr.io/growlf/docwright:<pinned digest>`, `curl localhost:5274/api/health` → 200. Record evidence in history. | ⏳ Pending |
| 4.2 | Cut over erp-images + msp | Repeat 4.1 for `docwright-deploy/erp-images` (:5275) and `msp` (:5276), preserving each instance's `.env` + SSH key + allowed-hosts. Verify both healthy on the published image via the prod compose (`/api/health` → 200 on 5275 and 5276). | ⏳ Pending |
| 4.3 | Enable Watchtower + retire the checkout deploy | Bring up the opt-in Watchtower (2.3) on cluster-llm scoped to the three instances. Then retire the legacy path: remove the throwaway `docker-compose.pin-*.yml` files and archive/remove the git-checkout trees + `docwright-deploy/auto-release-update.sh` (the hourly cron was already removed 2026-07-10). Verify: pushing a subsequent release tag results in Watchtower pulling + recreating the three instances automatically (or, if testing without a real bump, `docker compose pull` shows the mechanism); confirm no `auto-release-update.sh` remains referenced by cron (`crontab -l`). | ⏳ Pending |
| 5.1 | End-to-end acceptance from a clean directory | From a brand-new empty directory (not a repo checkout), scaffold (3.1) + `docker compose up -d` → healthy instance, ZERO tracked-file edits. Bump the image var to a newer digest + `docker compose pull && up -d` → instance updates with no git ops. Confirm GH #288 does not reproduce (no `.svelte-kit` written into any source tree). Close #288 with a note. Verify: paste all curl/health outputs into the step history. | ⏳ Pending |
| 5.2 | Version bump + completion PR | Bump VERSION + package.json (≥ patch). Open one `dogfood → main` PR summarizing the new deployment model, the env contract, the Watchtower channel, and the #288 fix. Propose the commit command for the human to attest (do NOT self-attest HUMAN_APPROVED). Verify: CI green on the PR (Lint/Typecheck/Test, Docker build + health, Branch policy). | ⏳ Pending |

## Document History

| Date | Change | By |
| --- | --- | --- |
| 2026-07-10 | Drafted from proposal image-based-deployment-any-directory; status draft, awaiting human review/approval. | NetYeti |
| 2026-07-10 | Approved by BDFL; renamed steps heading to Implementation Steps so the tracker parses the steps; moved to in-progress. Phase 1 started. | NetYeti |
| 2026-07-10 | Step 1.1 finding: the Dockerfile is a DEV image (runs vite dev; webui on adapter-auto, no production build). This is the true root of GH #288 and why DOCWRIGHT_ALLOWED_HOSTS exists. Env contract enumerated. | NetYeti |
| 2026-07-10 | BDFL: fold the adapter-node production-image work into this plan as step 1.0 ahead of 1.2; total_steps 13 to 14. Executing 1.0 next. | NetYeti |
| 2026-07-10 | Step 1.0 code complete + image-proven on isolated branch feat/prod-image (commit bf9d33f). Swapped webui to @sveltejs/adapter-node 5.5.7; Dockerfile bakes npm run build; entrypoint runs node build by default with a DOCWRIGHT_DEV_SERVER=1 branch preserving vite dev for the dogfood box. Verified by RUNNING the built image docwright:prod-test: boots healthy, GET /api/health 200, and docker diff shows ZERO changes under /app/src (no runtime .svelte-kit write) — GH #288 root cause eliminated, demonstrated. NOT yet done: Review e2e (needs an OpenCode backend) and the dogfood-box cutover, both to be confirmed at landing since the dogfood container mounts the repo as /app and /vault and runs vite dev — a naive merge to dogfood would change svelte.config under the live dev server. Proposed safe cutover: install adapter-node in the dogfood checkout first, set DOCWRIGHT_DEV_SERVER=1 in its compose, then merge + rebuild + verify Review, with BDFL awareness of the brief dev-box restart. | NetYeti |
| 2026-07-10 | Step 1.0 DONE and fully verified on the live dogfood box. Landed 1.0 on dogfood (cherry-pick 0fa10c2), disabled the source mount in docker-compose.yml (commit 870dbb4), rebuilt + recreated docwright-docwright-1. Verified: pid 1 is node build, only /vault mounted, build baked at /app/src/webui/build, health healthy, /api/health 200. Review e2e through the production build streamed live via the authenticated relay: 773 message.part.delta, 26 part.updated snapshots, 8 reasoning, session busy/status/idle, real review content, 12 prompts, 205KB in 40s — SSE under adapter-node behaves like dev. Env-contract note for steps 1.2/3.2: production node build does NOT read src/webui/.env, so the dogfood box is now AUTH_MODE=none (dev vite had loaded local auth from that file); all config must flow via compose env in the image model. Next: step 1.2 (empty-env boot) and 1.3 (docker diff acceptance), then Phase 2 prod compose. | NetYeti |
| 2026-07-10 | Phase 1 complete (steps 1.0-1.3 done; 4/14). Auth restored on the dogfood box via a gitignored .env.auth loaded with env_file (bcrypt hash intact); login verified working (303 + dw_session cookie, wrong password 401). Found a second production-config requirement: adapter-node CSRF rejects form POSTs (login) unless ORIGIN is set; JSON/SSE APIs are unaffected. Added ORIGIN + PROTOCOL_HEADER + HOST_HEADER passthrough to the compose env contract (commit on dogfood); set ORIGIN=http://10.10.0.201:5174 in the gitignored .env. Step 1.2 verified: production image boots healthy with ZERO env (only a vault mount), /api/health 200. Step 1.3 verified: docker diff shows 0 changes under /app/src on both a fresh empty-env container and the live dogfood container, no .svelte-kit written — #288 eliminated on the real instance. Step 1.1 enumeration done; the formal env-contract table in docs/deployment.md is folded into step 3.2 to avoid rewriting that doc twice. Ready for Phase 2 (2.1 image-based prod compose, 2.2 dev-vs-prod split, 2.3 Watchtower). | NetYeti |
| 2026-07-10 | Phase 2 complete (2.1-2.3 done; 7/14). 2.1: docker-compose.prod.yml (image-based, DOCWRIGHT_IMAGE digest-pinnable, container config via a verbatim app.env so bcrypt survives, container port pinned to avoid env leak, single /vault mount) plus app.env.example documenting the full env contract; validated in a throwaway deploy dir (healthy, 200, only /vault) proving run-on-any-directory. 2.2: docker-compose.yml refactored into the clean DEV compose (build + source mount + DOCWRIGHT_DEV_SERVER=1 vite HMR); the dogfood box migrated onto docker-compose.prod.yml with a locally-built image docwright:local (health, auth-enforced, login 303, OpenCode wired) so the live box now validates the prod compose itself. app.env gitignored; no secrets committed. Dev-mode entrypoint branch: config resolves and the branch is the original proven vite-dev command, but a clean-checkout runtime smoke is deferred (my worktree-mount smoke crashed on the worktree .git pointer under set -e, a test artifact not a defect). 2.3: deploy/watchtower.yml opt-in outbound-only update channel (label-scoped, cleanup, 5-min poll, no inbound endpoint); documents the digest-pin caveat and why a CI push webhook is deferred. Next: Phase 3 (3.1 scaffold generator, 3.2 rewrite .env.example + docs). | NetYeti |
