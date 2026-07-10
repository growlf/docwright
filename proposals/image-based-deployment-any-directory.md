---
title: "Image-based deployment — DocWright runs on any directory with a mounted vault + env, no source checkout"
author: NetYeti
created: 2026-07-10
tags:
  - deployment
  - docker
  - infrastructure
  - config
  - security
approved: false
created_by: "NetYeti@cluster-llm"
assigned_to: ""
related_to:
  - issues/bug-container-as-root-writes-svelte-kit-into-the-sourc.md
milestone: backlog
---

## Problem

A "deployment" today is **a full git checkout of DocWright's source that is rebuilt
in place** (`build: .`). That single decision is the root of a class of failures:

- **App code lives in a mutable working tree that drifts.** The tree accumulates
  hand-applied hotfixes (e.g. an `auth/constants.ts` edit), root-owned `.svelte-kit`
  artifacts the container writes back into the source
  (see [[issues/bug-container-as-root-writes-svelte-kit-into-the-sourc]], GH #288),
  and local `docker-compose.yml` edits. Any drift makes `git checkout <tag>` refuse.
- **Per-instance config leaked into tracked source.** The base `docker-compose.yml`
  *enumerated* env vars, so customizing an instance (adding `AUTH_MODE` / `LOCAL_AUTH_*`)
  meant editing a tracked file — which then wedged the next checkout.
- **The update mechanism was a git-checkout poll (hourly cron).** Because every
  checkout hit a dirty tree, all three dev-cloud instances (csdocs, erp-images, msp)
  silently failed to advance and sat **two releases behind** (stuck on v0.4.9 while
  main shipped v0.4.11). The "flaky cron" was in fact a *deterministic* failure caused
  by the checkout-in-place model, not by the trigger.

Observed 2026-07-10 during the v0.4.11 release. The cron has since been removed and the
three instances were manually pinned to the published v0.4.11 image as a stopgap; this
proposal makes that the permanent, general model.

**The design rule this violates:** the image *is* DocWright. A deployment should be
**one mounted vault folder + environment** — nothing DocWright-owned should live in
that folder, and no instance should ever edit DocWright's files. It must run on **any**
directory with zero customization to tracked code.

## Proposed Solution

Adopt the immutable-image / 12-factor separation — code in the image, config in the
environment, data in the mount:

| Concern | Belongs in |
|---|---|
| **Code** (build output, deps, defaults) | the versioned image `ghcr.io/growlf/docwright:<tag>` (pin by digest) |
| **Config** (auth mode, credentials, git identity, port, base URL, allowed hosts) | environment — an untracked `.env` / `--env-file`, read via `process.env` |
| **Data** (the vault) | the single bind mount → `/vault` |

Concrete deliverables (to be decomposed in a plan):

1. **Ship a production compose** that references the **published image** (no `build:`)
   and is driven entirely by `env_file:` — so adding a knob never touches a tracked
   file. Keep the existing `build: .` compose as the clearly-labelled **dev-only**
   variant (the dogfood box legitimately source-mounts for live development).
2. **Every per-instance knob is an env var with an image-baked default**, so an
   instance with a minimal `.env` still boots. Document the full env contract.
3. **The only mount is the vault → `/vault`.** Nothing DocWright writes lands outside
   `/vault` or an explicit named volume; runtime cache/index/ai-sessions get a
   deliberate home. This eliminates GH #288 (no source tree to write `.svelte-kit`
   into).
4. **Updates become `docker compose pull && up -d`** (or pin-by-digest) — no git on the
   deploy host. This is the prerequisite that makes an event-driven redeploy trigger
   correct.
5. **Redeploy trigger:** recommend **Watchtower** (watches the registry, recreates on a
   new image — outbound-only, no inbound endpoint). A CI-driven push webhook is possible
   but adds an inbound attack surface on a homelab host; deferred unless instant
   redeploy is required.
6. **Scaffold it into `docwright init`/adopt** so a deploy directory (`.env` + generic
   compose) can be generated for **any** vault path, no clone or build.
7. **Retire** the git-checkout dev-cloud instances and `auto-release-update.sh`.

## Security Implications

- **Outbound-only updates.** Registry pull keeps the deploy hosts from exposing any
  inbound endpoint. Watchtower over a webhook preserves this.
- **Secrets stay out of code.** All credentials live in untracked `.env` / mounted keys
  (as the per-repo SSH deploy keys already do), never in tracked files or the image.
- **Supply-chain integrity.** Pin production by image **digest**, not a floating tag, so
  a deploy is reproducible and tamper-evident.
- **Smaller blast radius.** No writable source tree on production hosts; the container
  gets only the vault it manages.

## Verification

- A fresh, empty directory + a `.env` + a vault mount boots a working instance with
  **zero edits to any tracked file** (`docker compose up -d` → `/api/health` 200).
- `docker compose pull && up -d` moves an instance to a new release with no git ops.
- All three dev-cloud instances run the **published** image (already demonstrated
  2026-07-10: csdocs/erp-images/msp recreated on `ghcr.io/growlf/docwright:v0.4.11`,
  all healthy).
- GH #288 no longer reproduces (no source mount on a production instance).

## Alternatives Considered

- **Keep build-from-source + a hardened cron** (dirty-safe `git reset --hard <tag>`).
  Rejected as the durable answer: it keeps a mutable source tree on production hosts
  (the actual root cause) and preserves the hotfix-on-tracked-files habit. Acceptable
  only as the short-term stopgap, which the manual v0.4.11 pin already superseded.
- **True push webhook (GH Actions → boxes).** Gives instant redeploy but requires an
  inbound endpoint + secrets on homelab hosts — a new attack surface. Watchtower gets
  ~near-instant, outbound-only, so the webhook is not worth its cost here.

## Future

- Multi-arch images; digest pinning surfaced in the UI/status page.
- A first-class `docwright deploy` scaffold command wrapping the generic compose + env
  contract.
- Optional signed images (cosign) for stronger supply-chain guarantees.
