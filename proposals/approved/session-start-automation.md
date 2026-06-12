---
title: Session Start Automation — Identity Resolution, Context Gathering, and Status Report
author: NetYeti
created: 2026-06-09
tags:
  - workflow
  - automation
  - lifecycle
  - mcp
  - tooling-gap
approved: true
created_by: NetYeti@phoenix
assigned_to: NetYeti
_path: proposals/session-start-automation.md
consumed_by: plans/session-start-automation.md
---

## Problem

Every session start requires the agent to manually run the same ritual:
1. Identity resolution protocol (read `.env`, run `hostname`, traceroute)
2. Scan `plans/` for active work
3. Read `SESSION-LOG.md` for last session context
4. Check `proposals/` for pending items

This is rote work that should be automated. The pattern mirrors session-shutdown-automation, which already proves the concept works — but session startup has no equivalent.

## Proposed Solution

Build two complementary components:

### 1. MCP Tool: `session_context`

Add a new tool to the `dw-mcp` TypeScript server that returns a structured JSON payload:

```jsonc
{
  "identity": {
    "human": { "name": "NetYeti", "email": "..." },
    "machine": "phoenix",
    "network": "107.191.239.0/24"
  },
  "active_plans": [
    { "file": "bundle-ai-capabilities.md", "title": "...", "status": "in-progress", "steps_done": 6, "steps_total": 12 }
  ],
  "pending_proposals": 42,
  "last_session": "2026-06-08 — AI model picker, v0.2.4 tagged",
  "git_status": "3 modified, 1 staged"
}
```

The tool should:
- Parse `.env` and fall back to `git config`
- Run `hostname` for machine identity
- Traceroute 8.8.8.8 for network fingerprint
- Scan `plans/*.md` frontmatter for `status: in-progress`
- Read the last entry from `SESSION-LOG.md`
- Run `git status --porcelain`

### 2. Skill: `docwright-session-start`

A skill at `.opencode/skills/docwright-session-start/SKILL.md` that:
- Trigger words: `what's next`, `session start`, `resume`, `continue`, `status`
- Calls the MCP tool `session_context`
- Formats the output into a clear session-start summary
- Sets up the todo list from active plan state

The skill's instructions should be concise — the heavy lifting is in the MCP tool.

## Alternatives Considered

- **AGENTS.md instructions only**: Would work but no structured data — the agent would still need to parse markdown files. MCP tool gives clean JSON.
- **Standalone MCP tool only**: Works but requires the user or agent to remember to call it. The skill auto-triggers on session start keywords.
- **Bash script**: Fragile, no structured output, bypasses MCP validation.

## Future

- Add `session_context` to the `endsession` skill flow so the shutdown note includes the startup context for comparison.
- Consider auto-injecting session context into every agent's system prompt via `opencode.json` hooks.


*(AI improvement Message failed: 500 — showing original body)*

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-10 | AI-improved via Improve | NetYeti |
