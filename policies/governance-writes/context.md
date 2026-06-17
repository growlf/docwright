# governance-writes

## Rule

All mutations to governance directories must go through DocWright MCP tools. Never write directly to these paths:

| Path | Use instead |
|------|-------------|
| `plans/*.md` | `write_plan`, `update_step`, `set_plan_field`, `update_plan_status` |
| `plans/completed/*.md` | `transition_to_completed` |
| `policies/**/*.md` | Human-only — propose a policy change |
| `docs/SOPs/*.md` | Human-only — propose via a plan step |
| `AGENTS.md`, `CLAUDE.md` | Human-only or `sync-claude-skills` script only |

MCP tools apply lifecycle validation, field checks, gate enforcement, and audit logging. Direct writes bypass all of this silently.

## Rationale

A direct write to `plans/my-plan.md` that looks correct may violate lifecycle invariants — missing `completed_date`, pending steps, invalid gate status — that only the MCP layer can catch. The governance model is: the MCP server is the only path to governance mutations for AI agents.

## Examples

Correct:
```
update_step("my-plan", "Step 3: Build thing", "done")
```

Incorrect (triggers this rule):
```
// Writing directly to plans/my-plan.md via Edit tool
```

## Scope

Applies in all plan, proposal, doc, and session contexts. This is a behavioral rule enforced by the PreToolUse hook in Claude Code (`.claude/settings.json`). In OpenCode sessions, follow this rule as if mechanically enforced.
