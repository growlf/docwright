---
title: AI Governance Enforcement Architecture
status: active
author: NetYeti
created: 2026-06-04
tags:
  - governance
  - mcp
  - enforcement
  - reference
---

# AI Governance Enforcement Architecture

DocWright enforces lifecycle rules at the **AI workflow layer**, not in git
hooks. This document explains the architecture, the five enforcement surfaces,
and how they work together.

See also: [[policies/core/workflow-layer-governance.md]]

![AI governance enforcement layers](governance_enforcement_layers.svg)

---

## Why not git pre-commit?

Pre-commit hooks fire after the file is already written — the bad state exists
before the hook runs. They are also silently bypassable (`--no-verify`) and
only cover git commits, not Web UI writes, API calls, or direct file edits.

Git hooks belong to git. Lifecycle governance belongs to the AI workflow layer.

---

## The five enforcement layers

### Layer 1 — Behavioral contracts (AGENTS.md, CLAUDE.md, opencode-instructions.md)

The outermost layer. Every AI session loads these files at startup, giving the
agent its operating context: what it may and must not do, which tools to use,
what self-checks to run before attempting state changes.

**Key rule:** Before calling `update_plan_status(..., 'completed')`, the AI must
verify every Implementation Steps row shows ✅ Done. The contract tells it to
self-check; the inner layers enforce it mechanically.

### Layer 2 — MCP tools (`scripts/mcp-server.py`)

The primary enforcement layer for plan mutations. AI agents must use these tools
for all plan writes — direct file writes are blocked.

| Tool | What it does |
|------|-------------|
| `update_step(name, match, status)` | Update one step row; recounts totals automatically |
| `update_plan_status(name, status)` | Change status; blocks `completed` if steps pending |
| `append_history(name, change)` | Append a Document History row; auto-fills date and author |
| `set_plan_field(name, field, value)` | Set one frontmatter field; restricted fields blocked |
| `write_plan(name, content)` | Full structural rewrite (escape hatch; logs as rewrite) |
| `transition_to_completed(name)` | Archive plan: move to `plans/completed/`, generate doc |
| `transition_to_canceled(name, reason)` | Cancel plan with mandatory reason |
| `transition_to_approved(name)` | Move approved proposal, create plan |

Each tool validates, recounts `total_steps`/`completed_steps`, and logs to the
audit trail. The MCP server owns all plan state transitions — it cannot be
bypassed with `--no-verify`.

### Layer 3 — PreToolUse hook (`scripts/claude-lifecycle-hook.sh`)

Fires **before** any Claude Code Write or Edit tool executes. Intercepts:

- Any direct Write or Edit to `plans/*.md` → blocked; redirected to MCP tools
- Any write of `approved: true` to `proposals/approved/` without `HUMAN_APPROVED=1`
- Any edit that flips `approved: false → approved: true` without authorization

This is the last line of defense for AI tool use. An AI that ignores Layer 1
and tries to write a plan directly hits this layer before any file is touched.

### Layer 4 — Skills (plan-workflow skill — planned)

A skill that the AI loads when working on plans gives it vocabulary and a
step-by-step routine for correct completions: read steps, check for ⏳,
report blockers, use `update_step` to clear them, then call
`update_plan_status`. Behavioral shaping before action, not enforcement after.

*Status: planned for Phase 2.*

### Layer 5 — Plan schema (total_steps / completed_steps)

`status: completed` is structurally only valid when `completed_steps == total_steps`.
The MCP server maintains these counts automatically on every mutation. An AI
reading the frontmatter can self-validate without parsing the markdown body.

---

## What git pre-commit still does

The pre-commit hook (`scripts/pre-commit.sh`) retains git-appropriate checks:

- Commit message format (`feat|fix|docs|refactor|test|chore: description`)
- Required frontmatter fields per document type
- File placement invariants (e.g. `proposals/approved/` must have `approved: true`)
- No unresolved template variables (e.g. unfilled placeholder tokens)
- Self-approval detection for proposals

These are commit-time, file-agnostic concerns. Lifecycle governance is not.

---

## Audit trail

Every MCP tool call is logged to `docs/audit-log.md` with timestamp, event
type, and description. This provides a machine-readable history of all plan
state changes, independent of git history.

---

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-04 | Created — documents the enforcement architecture built in Phase 1 plan-step-enforcement | NetYeti |
