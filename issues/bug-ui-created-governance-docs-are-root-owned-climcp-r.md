---
title: UI-created governance docs are root-owned — CLI/MCP (running as gemini) can't edit them (EACCES)
status: new
created: 2026-07-13
author: NetYeti
author-role: user
category: bug
priority: high
complexity: medium
estimated_effort: S
demand_count: 1
reported_dates: [2026-07-13]
channel: dev
tags:
  - reported-bug
github_issue: 383
---

# UI-created governance docs are root-owned — CLI/MCP (running as gemini) can't edit them (EACCES)

## Description

OBSERVED 2026-07-13 while consolidating the GH-pivot plan. The Web UI runs in a container as root and writes governance docs into the host-mounted vault (e.g. the approve flow created plans/plan-pivot-...-cyclic-reference.md owned root:root, mode 644). The MCP server + CLI run as the host user (gemini), so any subsequent MCP mutation (write_plan/update_step) fails with EACCES: permission denied. Required a manual `sudo chown gemini:gemini <file>` to proceed. IMPACT: any doc created/edited via the Web UI cannot then be maintained by the AI/CLI without a manual chown — the two surfaces can't co-edit the same governance files. This is a concrete instance of the self-hosting coupling and a general multi-surface write-integrity bug. FIX DIRECTIONS: run the container as the host uid/gid (docker user: ${UID}:${GID} or PUID/PGID), or have the app write with a shared group + group-writable umask (0002) so gemini + container-user share write access; verify a UI-created plan is immediately editable by the MCP server with no chown. RELATED: the image-based deployment root-owned .svelte-kit issue (#288 class).

## System Info

None provided
