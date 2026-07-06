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
| `write_plan(name, content)` | Full structural rewrite — validates same lifecycle rules as `update_plan_status`; blocks `status: completed` with pending steps and `gate_status: approved/waived` |
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

**Scope:** Claude Code's Write and Edit tools only. The hook is blind to writes
that come through any other path: a Bash tool call that runs a Python script,
an OpenCode tool on a different surface, or any direct file I/O that doesn't
go through Claude Code's tool layer. It is surface-specific belt-and-suspenders
for the Claude Code surface — not a universal write gate.

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

## Failure modes

### MCP server unavailable

When `mcp-server.py` is not running, all MCP tool calls (`update_step`,
`update_plan_status`, `append_history`, etc.) fail with a connection error.

**Expected AI behavior: halt and report. Do not fall back to direct writes.**

The correct response is:
1. Surface the error clearly — "MCP server is unavailable"
2. Tell the contributor what they need to do: `python3 scripts/mcp-server.py`
   (or restart via however it is configured in the session)
3. Do nothing further until the server is back

**Why not fall back to direct writes:** the PreToolUse hook blocks direct
writes to `plans/*.md` regardless of whether the MCP server is running. A
fallback write attempt will be blocked and produce a confusing redirect
message. More importantly, a direct write bypasses all validation — pending
steps go unchecked, step counts go unstale, the audit log gets no entry.
The governance architecture is intentionally **fail-closed**: no mutation is
better than an unvalidated mutation.

This is not a bug — it is the expected behavior. The MCP server is a required
runtime dependency for plan mutations, not an optional enhancement.

### PreToolUse hook not installed

If `scripts/claude-lifecycle-hook.sh` is not registered in `.claude/settings.json`,
direct writes to `plans/*.md` succeed silently. The MCP tools still validate
when called, but the surface-specific intercept is absent.

**Detection:** `cat .claude/settings.json` — verify `claude-lifecycle-hook.sh`
appears in the `hooks.PreToolUse` array.

**Impact:** reduced to behavioral contract + MCP validation only; no automatic
block on direct writes from the Claude Code surface.

---

## What git pre-commit still does

The active hook is `.githooks/pre-commit` (`git config core.hooksPath = .githooks`),
which since #144 is a thin exec-shim: the canonical source is `scripts/pre-commit.sh`
(same for `commit-msg` → `scripts/commit-msg.sh`; vault installs get real copies of
both via `install-hooks.sh`). It runs two categories of checks:

**Lifecycle governance (via `lifecycle-gate.js`):**
- Pending step validation — `node scripts/lifecycle-gate.js --check-files` on every
  staged plan file; blocks commits where a plan has `status: completed` with ⏳ rows,
  or where a ✅-headed task section still has ⏳ step rows

**Git-native integrity:**
- Commit message format (`feat|fix|docs|refactor|test|chore: description`)
- Required frontmatter fields per document type
- File placement invariants (e.g. `proposals/approved/` must have `approved: true`)
- No unresolved template variables
- Self-approval detection for proposals

The pending-step check is the final backstop: MCP tools and the PreToolUse hook
prevent bad state from reaching disk; git catches anything that slips through.
`--no-verify` bypasses all of this — but that's a deliberate human choice, not
something an AI agent can do undetected.

---

## Audit trail

MCP tool calls and git hook validation events are logged to
`.docwright/audit.jsonl` (append-only NDJSON, not tracked in git). Both
`mcp-server.py` and `lifecycle-gate.js` append to the same file.

Query the live log:
- MCP tool: `audit_log()` — returns last 50 entries as a table
- CLI: `node scripts/lifecycle-gate.js --audit`

`docs/audit-log.md` is a historical archive of pre-migration entries only.

---

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-04 | Created — documents the enforcement architecture built in Phase 1 plan-step-enforcement | NetYeti |
