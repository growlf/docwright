---
title: Isolate DocWright MCP Instances Per Project
status: completed
completed_date: 2026-06-02
author: NetYeti
created: 2026-06-02
tags:
  - security
  - mcp
  - infrastructure
  - governance
proposal_source: proposals/approved/isolate-docwright-mcp-instances.md
priority: high
mode: autonomous
assigned_to: NetYeti
---

## Tasks

1. **Remove `dw-mcp` from global config** — delete `"dw-mcp"` block from `~/.config/opencode/opencode.json`
2. ~~Add `dw-mcp` to this project~~ — reverted: this project doesn't run an MCP server
3. **Verify bms-ai-cluster** — confirmed: has its own `dw-mcp` config in its `opencode.jsonc`
4. **Document policy** — added MCP Instance Isolation section to AGENTS.md

## Progress

- [x] Mark proposal approved and moved to proposals/approved/
- [x] Create plan
- [x] Remove dw-mcp from global config
- [x] Reverted: this project doesn't need its own MCP config
- [x] Verify bms-ai-cluster has its own config
- [x] Document the policy in AGENTS.md
- [x] Complete plan, generate docs
