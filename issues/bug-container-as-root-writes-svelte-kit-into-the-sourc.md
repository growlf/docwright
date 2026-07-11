---
title: Container-as-root writes .svelte-kit into the source-mounted checkout, blocking host-user vite build (EACCES)
status: resolved
created: 2026-07-10
author: NetYeti
author-role: user
category: bug
priority: low
complexity: medium
estimated_effort: S
demand_count: 1
reported_dates: [2026-07-10]
channel: dev
github_issue: https://github.com/growlf/docwright/issues/288
resolved_by: plans/image-based-deployment-any-directory.md
tags:
  - reported-bug
---

> **Resolved 2026-07-11** by the image-based deployment model (plan
> image-based-deployment-any-directory, step 1.0/1.3). Root cause: the container
> ran the Vite **dev server** over a bind-mounted source tree, writing
> root-owned `.svelte-kit` into the host checkout. Fixed by switching the web UI
> to a production `@sveltejs/adapter-node` build baked into the image (`node build`),
> so deployed instances mount **only** the vault — no source tree to write into.
> **Verified:** `docker diff` shows zero writes under `/app/src` on the dogfood box,
> all three dev-cloud instances, and a fresh scaffolded instance. Dev mode
> (`docker-compose.yml`) still source-mounts by deliberate opt-in for HMR.

# Container-as-root writes .svelte-kit into the source-mounted checkout, blocking host-user vite build (EACCES)

## Description

OBSERVED 2026-07-10 (live-ai session). The dogfood container (docwright-docwright-1) runs as root (default user) and bind-mounts the project source. When it runs `svelte-kit sync` / vite, it writes generated files into `src/webui/.svelte-kit/types/...` as ROOT. After that, the host user (gemini) running `npm run build` in the main checkout fails:

  Error: EACCES: permission denied, open '.../src/webui/.svelte-kit/types/src/routes/api/ai/bus-status/$types.d.ts'
    at update_types (@sveltejs/kit/.../write_types)

Confirmed: `.svelte-kit/types/src/routes/api/ai/{bus-status,flags,presence,stream}` are owned by root:root (created by the container), while the parent `.svelte-kit` is gemini:gemini. `docker inspect -f '{{.Config.User}}'` on the container is empty (root).

IMPACT: low/dev-friction only. The container itself builds/serves fine (it created the types), and CI / any fresh checkout builds fine (no pre-existing root-owned .svelte-kit). But a developer on the host cannot run `npm run build` (or anything that triggers svelte-kit sync) in the source-mounted checkout without sudo/chown, and it's confusing (looks like a code failure). Recurs whenever the container regenerates types for new routes.

FIX DIRECTIONS (pick one):
- Run the container as the host UID/GID (docker-compose `user: \"${UID}:${GID}\"` or an entrypoint that drops privileges) so generated files are host-owned.
- Exclude `.svelte-kit` (and node_modules) from the bind mount via an anonymous/named volume so the container's generated artifacts don't land in the host tree.
- Or point SvelteKit's `outDir`/types output outside the mounted path.

WORKAROUND: `sudo chown -R gemini:gemini src/webui/.svelte-kit` before a host build (transient — recurs on next container sync).

Related: docker-compose source mount for dogfood dev (commit ef422a5 era).

## System Info

cluster-llm; docwright-docwright-1 container (root); source bind-mounted; src/webui .svelte-kit types root-owned; observed during live-ai 3.6 build in the main checkout
