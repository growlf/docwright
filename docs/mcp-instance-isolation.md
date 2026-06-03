---
title: MCP Instance Isolation
status: completed
completed_date: 2026-06-02
author: NetYeti
created: 2026-06-02
tags:
  - security
  - mcp
  - infrastructure
  - governance
---

## Summary

DocWright MCP servers expose a specific project's lifecycle data as tools
(`get_status`, `get_plan`, `get_facts`, etc.). To prevent cross-instance
contamination, each project must own its own MCP config.

## Policy

1. **MCP config lives in the project** — define `"dw-mcp"` in the project's
   `opencode.jsonc`, never in `~/.config/opencode/opencode.json`.
2. **Each project has its own server** — the MCP URL/path must serve that
   project's data only.
3. **No MCP = no `"mcp"` block** — if a project doesn't run a DocWright MCP
   server, omit the `"mcp"` block entirely. No orphaned references.
4. **Each project's server serves only its own data** — the `scripts/mcp-server.py`
   reads from its repo's `proposals/`, `plans/`, and `docs/` directories only.

## Rationale

A global MCP config in `~/.config/opencode/opencode.json` causes every repo
on the machine to load the same lifecycle data. This leads to:

- Agents acting on wrong plans (as seen in the 2026-06-02 session)
- Accidental data corruption or cancellation of plans from the wrong instance
- Confused session context across projects

## Verification

To check that MCP is correctly scoped per project:

```bash
# Global config should have NO 'mcp' block
grep -A5 '"mcp"' ~/.config/opencode/opencode.json || echo "✅ No global MCP config"

# Project config should have MCP only if it runs a server
grep -A5 '"mcp"' opencode.jsonc
```

## History

- **2026-06-02** — Discovered bug: `dw-mcp` in global config caused
  cross-instance data leak between bms-ai-cluster and DocWright repos.
  Removed from global config, added AGENTS.md policy section, created
  project-level `scripts/mcp-server.py` for this repo.
