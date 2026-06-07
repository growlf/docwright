---
title: "Cross-Tool Compatibility: OpenCode and Claude Code Skills, Agents, and Governance Parity"
author: NetYeti
created: 2026-06-06
tags:
  - architecture
  - opencode
  - claude-code
  - skills
  - agents
  - governance
  - compatibility
complexity: high
estimated_effort: L
approved: false
created_by: NetYeti@phoenix
assigned_to: ""
_path: proposals/cross-tool-ai-compatibility-opencode-claude-code.md
consumed_by: plans/completed/cross-tool-ai-compatibility-opencode-claude-code.md
---

## Problem

DocWright is operated by two AI toolchains simultaneously: **OpenCode** (primary AI
backend, session-based) and **Claude Code** (governance/development tool). Both are
first-class participants in vault operations. Today they diverge on almost every
surface-level integration point, creating real operational failures:

**Skills are not portable.** DocWright skills live in `.opencode/skills/*/SKILL.md`
and are only natively invokable from OpenCode. When Claude Code attempts to invoke
a skill by name (`Skill("docwright-raw-proposal")`), it fails — the skill registry is
invisible to it. Claude Code can only follow skill instructions by reading the SKILL.md
manually, which requires human direction every time.

**Context injection is duplicated and diverges.** Claude Code reads `CLAUDE.md`.
OpenCode reads `opencode.json` orchestrator instructions and `opencode-instructions.md`
in profile directories. Both contain governance rules — but they're maintained
independently. When a governance rule changes, both files must be updated manually or
they drift. The skills table in `CLAUDE.md` is a manually maintained pointer into the
`.opencode/skills/` directory; it gets stale.

**Agent role enforcement is tool-specific.** The `DOCWRIGHT_AGENT_ROLE` env-var hook
(Phase 2) is designed around OpenCode's session model. It has no defined behavior for
Claude Code's execution model, where there is no long-running session and
"orchestrator vs. code agent" is a context-injected concept, not a process-level one.
The governance boundary must hold regardless of which tool is active.

**Hook enforcement surface differs.** The pre-commit hook (`scripts/claude-lifecycle-hook.sh`)
runs on git commits from any tool. But the PreToolUse hook that blocks direct writes to
`plans/*.md` is Claude Code-specific (`.claude/hooks/`). OpenCode has no equivalent
write-block — it relies on the MCP mutation tools by convention, not enforcement.

The result: governance rules that should be universal are silently unenforceable in half
the toolchain. Skills that should be usable from any AI surface require manual
re-discovery every session. A developer using Claude Code and a contributor using
OpenCode operate under different (and diverging) constraints.

## Proposed Solution

### 1. Canonical skill format shared between both tools

Define a single **DocWright Skill Specification** (`docs/specs/skill-format.md`) that
both tools can consume:

- Skills continue to live in `.opencode/skills/*/SKILL.md` (OpenCode-native location)
- SKILL.md frontmatter adds a `claude_code_name:` field — the exact string Claude Code
  would use to invoke it if/when Claude Code supports custom skill directories
- A generator script (`scripts/sync-claude-skills.ts`) reads all SKILL.md files and
  auto-regenerates the skills table in `CLAUDE.md` — single source of truth, no manual
  drift
- The CLAUDE.md skills table gains a `SKILL.md path` column so Claude Code can read
  the full instructions directly when the Skill tool cannot auto-invoke

This is a pragmatic bridge: Claude Code reads the table, follows the SKILL.md path,
and executes the skill manually. When either tool adds native cross-tool skill
discovery, the spec is already in place to support it.

### 2. Unified agent role contract

Define a `docs/specs/agent-roles.md` contract that both tools implement:

- **Role names**: `orchestrator`, `code`, `reviewer` — identical in both tools
- **Role injection**: OpenCode sets `DOCWRIGHT_AGENT_ROLE` env var; Claude Code receives
  role via `CLAUDE.md` system prompt context — not an env var, because Claude Code has
  no long-running process
- **Role enforcement**: the pre-commit hook checks both `$DOCWRIGHT_AGENT_ROLE`
  (OpenCode) AND `$CLAUDE_AGENT_ROLE` (Claude Code), with identical rules applied
- **Role boundary rules** are defined once in `agent-roles.md` and referenced from
  both `CLAUDE.md` and `opencode.json` — no duplication, no drift

### 3. Context sync: single-source governance rules

A `scripts/sync-ai-context.ts` script that:
- Reads canonical governance rules from `policies/core/`
- Regenerates the governance sections of `CLAUDE.md` and `opencode.json` instructions
  that must stay in sync
- Runs in CI as a lint check — fails if either file is out of sync with policies
- Tool-specific sections (CLAUDE.md keyboard shortcuts, OpenCode session management)
  are left untouched

### 4. Write-block parity: OpenCode PreToolUse equivalent

The Claude Code PreToolUse hook blocks direct writes to `plans/`, `policies/`, etc.
OpenCode currently relies on behavioral convention only. Add an OpenCode hook
(`opencode.json` `hooks.preToolUse`) that replicates the same block:
- Direct writes to `plans/*.md`, `policies/*.md`, `AGENTS.md` → blocked, error returned
- Message mirrors the Claude Code hook: "Governance writes must go through MCP mutation
  tools (write_plan, update_step, set_plan_field…)"

This closes the enforcement gap: both tools block direct governance writes mechanically,
not just by convention.

### 5. Compatibility test suite

A new test file (`test/compat/cross-tool.test.ts`) that verifies:
- Every skill in `.opencode/skills/` has a corresponding entry in the CLAUDE.md table
- Every SKILL.md has valid frontmatter (name, description, triggers)
- The CLAUDE.md skills table is not stale (matches `.opencode/skills/` directory)
- The agent role contract doc exists and defines all required roles
- Pre-commit hook reads both `DOCWRIGHT_AGENT_ROLE` and `CLAUDE_AGENT_ROLE`

This runs in CI alongside the existing dispatch and hooks tests.

## Relationship to Existing Work

| Proposal / Plan | Relationship |
|-----------------|-------------|
| [[proposals/split-agent-governance.md]] | Phase 2 deliverable `DOCWRIGHT_AGENT_ROLE` hook must extend to Claude Code context; agent-roles.md is the shared contract |
| [[plans/phase-2-foundation.md]] | Context sync tooling and parity enforcement belong in Phase 2 foundation |
| [[proposals/need-a-way-to-quickly-discern-raw-proposals.md]] | Skills used by both tools — raw-proposal detection must be invokable from either surface |
| [[policies/core/code-over-memory.md]] | Skill table drift is a memory problem; automation (sync script + CI check) is the fix |

## Out of Scope

| Idea | Why deferred |
|------|-------------|
| Unified session model across tools | OpenCode and Claude Code have fundamentally different session architectures |
| Upstream contributions to Claude Code / OpenCode skill spec | Design for it, don't block on it |
| Auto-invocation of OpenCode skills natively from Claude Code | Requires upstream support; bridge approach is pragmatic Phase 1 |
| Skill versioning and compatibility matrix | Phase 3+ when skill count warrants it |
| Cross-tool telemetry / session correlation | No telemetry, ever |
