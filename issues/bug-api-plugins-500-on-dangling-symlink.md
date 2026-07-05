---
title: "/api/plugins 500s on a dangling plugin symlink; repo committed a dev-home symlink"
status: open
author: NetYeti
author-role: contributor
created: 2026-07-05
category: bug
priority: medium
complexity: low
estimated_effort: S
tags:
  - plugins
  - api
  - reproducibility
  - dogfooding
milestone: v0.5.0
created_by: "NetYeti@cluster-llm"
assigned_to: ""
---

> Found by dogfooding on 2026-07-05 — a headless-browser render of the dev-cloud instances
> showed `docwright-dev` logging a background `500 GET /api/plugins` (page still rendered).

## Problem

Two coupled defects:

1. **Non-reproducible committed symlink.** The repo committed `plugins/erp-images` as a
   **symlink into a developer's home** (`/home/netyeti/Projects/cs-erp-images/...`). It
   dangles in every other clone. (The `erp-images` plugin properly lives in the
   `cs-erp-images` *vault*, not the DocWright source tree — see
   [[proposals/three-docwright-instance-deployment]], which flagged this exact issue.)

2. **`scanPlugins()` throws on a dangling symlink.** `src/webui/src/lib/server/plugins.ts`
   ran `fs.statSync(entryPath).isDirectory()` **before** its try/catch. `statSync` follows
   symlinks, so a dangling symlink throws `ENOENT`, which propagates out of `scanPlugins()`
   and 500s the whole `/api/plugins` endpoint (the route has no catch). One bad plugin dir
   should never take down plugin discovery.

## Fix (this PR)

- Remove the committed `plugins/erp-images` symlink; add `/plugins/` to `.gitignore` so dev
  plugin dirs/symlinks are never committed into the source tree again.
- Wrap each entry in `scanPlugins()` in try/catch so an unreadable/dangling entry is skipped
  with a warning instead of throwing.

## Acceptance

- `/api/plugins` returns 200 (empty list) when the vault's `plugins/` contains a dangling
  symlink, logging a skip warning for that entry.
