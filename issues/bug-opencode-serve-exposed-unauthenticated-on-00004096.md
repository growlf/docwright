---
title: opencode serve exposed unauthenticated on 0.0.0.0:4096 — agent server with shell access reachable from LAN
status: new
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
---

# opencode serve exposed unauthenticated on 0.0.0.0:4096 — agent server with shell access reachable from LAN

## Description

**Finding (2026-07-08, live-AI-visibility research session):** `opencode serve` runs on cluster-llm as `opencode serve --hostname 0.0.0.0 --port 4096` with no authentication. This is an agent server with bash + file-edit permission (`.opencode/config.json`: `"bash": "allow", "edit": "allow"`) reachable by any host on the LAN and — via the localhost-attack class (CORS gaps, DNS rebinding, 0.0.0.0-day) — potentially by JavaScript on malicious web pages visited from machines that can route to it. Its web app is also served at the root, listing all sessions to anyone who can reach the port.

**Industry confirmation:** OpenHands agent-server docs state the identical warning: "Do not expose an unauthenticated Agent Server on a public network. It can execute commands and read or write files."

**Native mitigations available (verified in opencode docs):**
- `OPENCODE_SERVER_PASSWORD` (+ optional `OPENCODE_SERVER_USERNAME`) enables HTTP basic auth
- `--cors` flag restricts browser origins
- Bind a specific interface instead of 0.0.0.0 where topology allows (note: DocWright containers reach the server over the docker bridge, so pure 127.0.0.1 binding breaks them — password auth is the primary fix)

**Sequencing constraint:** DocWright's `opencodeComplete()` (src/webui/src/lib/server/opencode-complete.ts) and any other `OPENCODE_URL` consumers must send the Authorization header BEFORE the password is enabled, or all AI features (review, improve, chat, executor, plan-generator) break. Fix = (1) add basic-auth support to the webui OpenCode client + env var for the credential, (2) set OPENCODE_SERVER_PASSWORD on the host service, (3) restrict --cors, (4) document in docs/deployment.md + docker docs.

Related upcoming work: the live-AI-visibility architecture proposal routes all browser traffic through DocWright's authenticated backend relay, which makes never-expose-4096 a permanent invariant.

## System Info

cluster-llm host; opencode v1.17.x at /home/gemini/.opencode/bin/opencode; DocWright dogfood container reaches it via OPENCODE_URL
