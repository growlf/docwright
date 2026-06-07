---
title: Isolate DocWright MCP Instances Per Project
author: NetYeti
created: 2026-06-02
tags:
  - security
  - mcp
  - infrastructure
  - governance
approved: true
priority: high
created_by: NetYeti@phoenix
assigned_to: "NetYeti"
consumed_by: plans/completed/isolate-docwright-mcp-instances.md
---

## Problem

The `dw-mcp` MCP server is configured globally in `~/.config/opencode/opencode.json` and points to `http://127.0.0.1:3001/sse` — the bms-ai-cluster DocWright instance. This means:

1. **Every opencode session in every repo** loads bms-ai-cluster's lifecycle data (proposals, plans for BMS/Cascade/YetiCraft infra)
2. Agents working in the DocWright repo itself see the wrong set of plans — as demonstrated this session
3. An agent in an unrelated repo could accidentally read, act on, or modify plans from the wrong instance
4. **Worst case:** destructive actions (archiving, canceling, modifying plans) could be applied to the wrong instance's data, losing valuable work

This is a cross-instance contamination vector with real consequences for data integrity and security.

## Proposed Solution

Scope MCP connections to the project level. Multiple options, recommend starting with:

**Option A (Recommended) — Project-level MCP config**
- Move the `dw-mcp` definition from `~/.config/opencode/opencode.json` into each project's `opencode.jsonc` where it belongs
- Each project runs its own DocWright MCP server (or none if not needed)
- The global config has no MCP servers by default — they're opt-in per project

**Option B — Environment variable switching**
- The MCP server reads `DOCWRIGHT_PROJECT` env var to determine which lifecycle to serve
- `opencode.jsonc` sets `DOCWRIGHT_PROJECT` per project
- Single MCP server, scoped by project

**Option C — MCP path parameter**
- Add a `project` parameter to the MCP SSE endpoint
- Each project's config specifies its own project name
- Server responds with only that project's data

## Recommended Path

Start with **Option A** — move `dw-mcp` to project configs. It's the simplest, most secure approach with the least surface area. Each project explicitly opts into DocWright lifecycle management.

## Future

Once Option A is done, audit the bms-ai-cluster repo to ensure its `opencode.jsonc` properly configures its own MCP server. Add a section to AGENTS.md or a new SOP documenting how to configure DocWright MCP for a new project.
