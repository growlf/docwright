---
title: "Plugin loader reads DOCWRIGHT_VAULT_ROOT only — plugins silently don't load in the container"
status: resolved
closed_by_pr: "#131"
author: NetYeti
author-role: contributor
created: 2026-07-05
category: bug
priority: medium
complexity: low
estimated_effort: S
tags:
  - plugins
  - docker
  - deployment
  - dogfooding
created_by: "NetYeti@cluster-llm"
assigned_to: ""
milestone: v0.6.0
---

> Found by dogfooding on 2026-07-05 standing up the cs-erp-images deployment (#3), whose
> vault ships a committed `plugins/erp-images`. The plugin did not appear until
> `DOCWRIGHT_VAULT_ROOT` was set by hand in a compose override.

## Problem

`src/webui/src/lib/server/plugins.ts` resolves the plugin scan directory from
`DOCWRIGHT_VAULT_ROOT` only:

```ts
function vaultRoot(): string {
  return process.env.DOCWRIGHT_VAULT_ROOT ?? process.cwd();
}
```

But the rest of the server (and the Docker image) uses **`DOCWRIGHT_ROOT`** as the vault
root — the `Dockerfile` sets `ENV DOCWRIGHT_ROOT=/vault` and the Web UI process does **not**
get `DOCWRIGHT_VAULT_ROOT`. So in the container the loader falls back to `process.cwd()`
(`/app/src/webui`) and scans `/app/src/webui/plugins` — never `/vault/plugins`. Plugins
committed in the vault silently fail to load, with no error.

## Fix

Fall back to the canonical `DOCWRIGHT_ROOT` before `cwd`:

```ts
return process.env.DOCWRIGHT_VAULT_ROOT ?? process.env.DOCWRIGHT_ROOT ?? process.cwd();
```

**Fix applied in this PR.** (The `DOCWRIGHT_VAULT_ROOT` *setter* in
`api/opencode-config/+server.ts` is unaffected.)

## Acceptance

- A release container started with only `DOCWRIGHT_ROOT=/vault` discovers and serves
  plugins from `/vault/plugins` (verify `/api/plugins`) — no compose override needed.

## Resolution (2026-07-04)

Fixed by PR #131 (commit d135be8) — `vaultRoot()` falls back `DOCWRIGHT_VAULT_ROOT ?? DOCWRIGHT_ROOT ?? cwd`.
