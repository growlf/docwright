---
title: CI gap: webui production build (vite build) never exercised — unresolved imports reach main undetected
status: resolved
resolved_by: #307
created: 2026-07-09
author: NetYeti
author-role: user
category: bug
priority: high
complexity: medium
estimated_effort: S
demand_count: 1
reported_dates: [2026-07-09]
channel: dev
tags:
  - reported-bug
github_issue: 358
---

# CI gap: webui production build (vite build) never exercised — unresolved imports reach main undetected

> **Resolved 2026-07-11** (backlog cleanup). The Dockerfile now runs the adapter-node production build (npm run build) baked into the image (#307); CI's 'Docker build + health check' job exercises the webui production build on every PR.


## Description

**Observed 2026-07-09:** PR #268 merged to main with two wrong import depths in webui route files (`api/opencode/[...path]/+server.ts`, `api/opencode-model/+server.ts`). `vite build` fails with UNRESOLVED_IMPORT — but every green gate missed it:

- CI "Lint, Typecheck & Test": root eslint + `tsc --noEmit` (root tsconfig does not cover webui routes) + mocha suites (only load the import graphs of the test files themselves).
- CI "Docker build + health check": container runs `vite dev`, which compiles routes lazily on first request; the health check never requests those routes.
- Local dev: same lazy-compilation masking.

Hotfixed in PR #269 (main) and commit 8035488 (dogfood merge).

**Fix direction:** add `npm run build --prefix src/webui` (or `vite build`) as a CI step in the Lint/Typecheck/Test job — it is the only check that resolves the full webui module graph. Aligns with the Phase-1 known limitation note in docs/docker.md (dev-mode container) which quietly extends to CI coverage.

## System Info

GitHub Actions ci.yml; webui SvelteKit + vite; observed via PR #268 → #269
