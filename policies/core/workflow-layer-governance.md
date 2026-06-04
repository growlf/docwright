---
title: "Workflow Layer Governance — AI Enforcement Belongs at the Point of Action"
status: active
author: NetYeti
created: 2026-06-04
tags:
  - core
  - governance
  - mcp
  - enforcement
  - ai
gate_reviewer: NetYeti
gate_status: approved
gate_date: 2026-06-04
---

# Workflow Layer Governance

## Policy

Governance rules that apply to AI agents must be enforced at the **AI workflow
layer** — MCP tools, PreToolUse hooks, behavioral contracts (AGENTS.md), and UI
constraints — not at the git layer.

Git is a versioning system. Its hooks (`pre-commit`, `pre-push`) are the right
place to enforce commit hygiene: message format, file placement, no unresolved
template variables. They are the **wrong** place for lifecycle governance because:

1. **Too late** — a pre-commit hook fires after the file is already written to
   disk. The bad state exists; the hook can only reject the commit, not prevent
   the mutation.
2. **Wrong surface** — pre-commit only governs commits. A file edited via the
   Web UI `/api/write`, a direct file-manager edit, or an API call never hits
   the hook.
3. **Adversarial** — `--no-verify` bypasses all hooks silently. Governance that
   can be disabled with a flag is governance in name only.
4. **Wrong audience** — pre-commit speaks to git. Lifecycle governance speaks to
   AI agents. These are different audiences with different contracts.

## The four enforcement surfaces

| Surface | Mechanism | Covers |
|---------|-----------|--------|
| **Behavioral contract** | AGENTS.md, CLAUDE.md, profile `opencode-instructions.md` | AI reads intent and constraints at session start; shapes all subsequent behavior |
| **PreToolUse hook** | `scripts/claude-lifecycle-hook.sh` — fires before Write/Edit executes | Intercepts AI tool calls before files are touched; blocks invalid mutations at the source |
| **MCP tools** | `scripts/mcp-server.py` — owned state machine | Validates, recounts, and logs on every plan mutation; the only path for AI-initiated plan writes |
| **UI constraint** | PropertiesPane, API endpoint validation | Blocks humans from creating invalid state via the Web UI |

These layers reinforce each other. The behavioral contract shapes intent. The
hook and MCP tools enforce it mechanically. The UI closes the human path.
Defense in depth without any single point of failure.

## How plan writes work under this policy

**AI must never write directly to plan files.** All plan mutations route through
MCP tools:

| Operation | Tool |
|-----------|------|
| Mark a step done or pending | `update_step(name, match, status)` |
| Change plan status | `update_plan_status(name, status)` — validates pending steps on completion |
| Add a history entry | `append_history(name, change)` — auto-fills date and author |
| Set a frontmatter field | `set_plan_field(name, field, value)` — restricted fields blocked |
| Structural rewrite | `write_plan(name, content)` — validates same lifecycle rules as `update_plan_status`; not a bypass |
| Archive a completed plan | `transition_to_completed(name)` — moves file, generates doc |

The PreToolUse hook blocks any direct Write or Edit to `plans/*.md` with a clear
redirect message. The MCP tools are the only governed path.

This design prevents **content drift**: when an AI edits a large file in full,
every untouched paragraph passes through the model and can be subtly paraphrased.
Targeted tools mutate only the specific string they're responsible for — everything
else on disk is guaranteed unchanged.

## What stays in git pre-commit

Pre-commit retains the checks it is genuinely suited for:

- Commit message format (`<type>: <description>`)
- Required frontmatter fields (title, author, created, etc.)
- File placement invariants (`proposals/approved/` must have `approved: true`)
- No unresolved template variables

These are git-native concerns: they apply per-commit, are file-agnostic, and
don't require understanding document state.

## This policy applies outward

DocWright is adopted by organizations to govern their own work. Every profile's
`opencode-instructions.md` must transmit this principle: governance rules belong
in the tool layer, not in "please remember to..." comments. When an org deploys
DocWright with its own MCP instance, custom profiles, and AI sessions, the same
architecture applies — their AI agents are governed by their MCP server and their
PreToolUse hooks, not by hoping the AI reads a policy document carefully.

The enforcement architecture is part of what DocWright ships to its adopters.

## Relationship to other core policies

- [[code-over-memory.md]] — establishes that code enforces; this policy specifies
  WHERE in the stack the code lives for AI-facing governance.
- [[ai-governance-boundaries.md]] — defines what AI may never do; this policy
  defines the mechanism by which those boundaries are maintained.

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-04 | Created — distilled from Phase 1 plan-step-enforcement redesign; governs DocWright's own AI workflow and the architecture it ships to adopters | NetYeti |
