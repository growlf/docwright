# DocWright Agent Role Contract

Defines the roles AI agents play in vault operations and how they are
enforced across both OpenCode and Claude Code.

## Roles

| Role | Name | Responsibilities |
|------|------|-----------------|
| Orchestrator | `orchestrator` | Reads vault state, makes governance decisions, calls MCP tools, writes proposals and plans via MCP, delegates code tasks to the code agent |
| Code Agent | `code` | Writes and edits source files only (`src/`, `test/`, `scripts/`, config files). Cannot write to governance directories. |
| Reviewer | `reviewer` | Read-only. Critiques proposals and plans, writes critique output only. |

## Governance boundaries

The code agent **cannot** write to:
- `plans/` (use MCP `write_plan`, `update_step`, `set_plan_field`)
- `policies/`
- `docs/SOPs/`
- `AGENTS.md`, `CLAUDE.md`
- `proposals/` approved subdirectory

The orchestrator **should not** write source code directly when a code agent
is available. Separation is behavioral in Phase 1, enforced by
`DOCWRIGHT_AGENT_ROLE` hook in Phase 2.

## Role injection by tool

### OpenCode

Set the `DOCWRIGHT_AGENT_ROLE` environment variable before spawning the agent:

```bash
DOCWRIGHT_AGENT_ROLE=orchestrator opencode ...
DOCWRIGHT_AGENT_ROLE=code opencode ...
```

The pre-commit hook reads `$DOCWRIGHT_AGENT_ROLE` and enforces boundaries.

### Claude Code

Role is injected via `CLAUDE.md` system prompt context. The active role
is declared in the `## Current Agent Role` section of `CLAUDE.md` (or
passed explicitly in the session prompt). Claude Code also exposes
`$CLAUDE_AGENT_ROLE` as an environment variable when set in `.claude/settings.json`.

The pre-commit hook reads both `$DOCWRIGHT_AGENT_ROLE` and `$CLAUDE_AGENT_ROLE`
(whichever is set) and applies identical boundary enforcement.

## Enforcement layers

| Phase | Enforcement |
|-------|------------|
| Phase 1 (now) | Behavioral — orchestrator follows boundaries by convention; PreToolUse hook in Claude Code blocks writes to governance dirs |
| Phase 2 | Mechanical — `DOCWRIGHT_AGENT_ROLE` hook enforced in both tools; code agent context template injected automatically |

## Fail behavior

If an agent attempts a blocked write, the hook returns:

```
[docwright] Role '<role>' cannot write to '<path>'.
Governance writes must go through MCP mutation tools:
  write_plan, update_step, set_plan_field, append_history
```

The commit is aborted. No silent failures.

## Default role

If neither `DOCWRIGHT_AGENT_ROLE` nor `CLAUDE_AGENT_ROLE` is set, the agent
defaults to `orchestrator`. This preserves existing behavior for sessions
that predate role enforcement.
