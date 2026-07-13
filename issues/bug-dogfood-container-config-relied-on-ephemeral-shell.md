---
title: Dogfood container config relied on ephemeral shell env — recreate silently reverted vault mount and port (data "disappeared")
status: proposal-linked
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
github_issue: 360
---

# Dogfood container config relied on ephemeral shell env — recreate silently reverted vault mount and port (data "disappeared")

> **Proposal-linked 2026-07-11** (backlog cleanup) → captured by `proposals/three-docwright-instance-deployment.md`. Not lost; will be delivered as part of that proposal/plan.


## Description

**Incident 2026-07-09 (twice, same root cause):** the dogfood container was originally created with `PORT=5174` and `VAULT_PATH=/home/gemini/Projects/DocWright` supplied as shell environment variables that were never persisted. Any later `docker compose up -d` (this time: adding OPENCODE_SERVER_PASSWORD for live-ai step 1.2) re-evaluated `${PORT:-5173}` and `${VAULT_PATH:-./example-vault}` from defaults:

1. Published port reverted 5174→5173 → the reverse proxy target (docwright-dev.bms.local) broke.
2. `/vault` silently mounted `example-vault` → the UI showed a near-empty vault ("all plans and proposals gone") and auth/logout misbehaved (user store lives under the vault).

Both fixed durably by persisting `PORT` and `VAULT_PATH` in the repo-root `.env` with warning comments.

**Why it matters beyond dogfood:** any deployment following docs that exports compose parameters ad hoc will "lose" its vault on the next recreate — terrifying-looking, though no data is touched.

**Fix directions:** (a) docs/docker.md quick-start should write VAULT_PATH/PORT into `.env`, not `export` them; (b) consider failing loudly instead of defaulting: entrypoint sanity check — if `/vault` looks like the bundled example-vault while `.docwright/` state or a project registry expects otherwise, print a prominent warning in logs and the status page; (c) status page could show the resolved vault path (it may already — verify) so a wrong mount is visible at a glance.

## System Info

docker compose v5.1.2, cluster-llm; docwright-docwright-1; compose defaults ${VAULT_PATH:-./example-vault}, ${PORT:-5173}
