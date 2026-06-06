# Rule: Governance Writes Must Use MCP Tools

Direct file writes to governance directories are forbidden. All governance
mutations must go through DocWright MCP tools.

## Blocked paths (never write directly)

| Path pattern | Use instead |
|-------------|-------------|
| `plans/*.md` | `write_plan`, `update_step`, `set_plan_field`, `update_plan_status` |
| `plans/completed/*.md` | `transition_to_completed` |
| `policies/**/*.md` | Human-only — propose a policy change, do not write directly |
| `docs/SOPs/*.md` | Human-only — propose via a plan step |
| `AGENTS.md` | Human-only — governed document |
| `CLAUDE.md` | Human-only or `sync-claude-skills` script only |

## Why

The MCP tools apply lifecycle validation, field checks, completion-gate enforcement,
and audit logging. Direct writes bypass all of this silently. A commit that looks
correct may violate lifecycle invariants that only the MCP layer can catch.

This is enforced mechanically in Claude Code via the PreToolUse hook. In OpenCode,
it is a behavioral rule: follow it as if it were enforced by a hook.

**If you are tempted to write directly to any of these paths, stop.**
Use the appropriate MCP tool. If no MCP tool covers the case, surface it as a
proposal rather than bypassing governance.

## Phase 2

Mechanical enforcement via `opencode.json` preToolUse hook will be added in
Phase 2 when the OpenCode hooks API stabilises. Until then, this rule is the
enforcement contract for OpenCode sessions.
