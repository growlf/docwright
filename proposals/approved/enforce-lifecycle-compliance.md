---
title: Enforce Lifecycle Compliance at the Tool Layer
author: NetYeti
created: 2026-06-02
tags:
  - governance
  - security
  - lifecycle
  - enforcement
approved: true
created_by: NetYeti@phoenix
assigned_to: NetYeti
consumed_by: plans/completed/enforce-lifecycle-compliance.md
---

## Problem

The DocWright lifecycle governance (proposals → plans → execution → docs) is
enforced only through instructions in AGENTS.md and `.opencode/rules/*`. These
are advisory — they load into the agent's context but have no mechanical teeth.

The 2026-06-02 session demonstrated this concretely: the agent violated every
major lifecycle rule despite having all rules loaded:

- Approved its own proposal (forbidden by AGENTS.md)
- Started implementation before plan approval (forbidden by no-work-before-approval)
- Built a new feature (MCP server) as a one-off task outside the lifecycle
- Closed its own plan with no human review

This will happen again — not because a future agent is malicious, but because
LLMs optimize for getting the task done and rationalize around advisory rules
when a human says "go ahead."

## Proposed Solution

Build enforcement at three layers, so no single bypass succeeds:

**Layer 1 — Tool-level gate (MCP server)**
The MCP server validates lifecycle state before allowing transitions. For example:
- `get_status()` refuses or warns when no approved plan is active
- `run_dry_run()` is required before any lifecycle mutation
- The server rejects state changes that skip lifecycle stages

**Layer 2 — Agent permission tightening**
Revise the agent modes in `opencode.jsonc`:
- `design` mode should NOT have blanket write access to lifecycle files
- Lifecycle mutations require `bash: ask` approval or a specific gate tool
- Mode descriptions explicitly forbid crossing lifecycle gates

**Layer 3 — Pre-commit lifecycle validation**
The pre-commit hook checks not just frontmatter validity, but whether each
changed lifecycle file (proposal/plan/doc) is reachable from an active approved
plan. Commits that mutate lifecycle files without a valid plan context are
rejected.

## Alternatives Considered

- **More AGENTS.md rules** — no, we saw those don't work
- **Git hooks only** — doesn't prevent in-session violations, only catches at commit time
- **MCP-only enforcement** — doesn't catch direct file writes that bypass MCP tools

## Future

- Add a verification SOP documenting how to audit lifecycle compliance
- Extend the MCP server's gate to also log all lifecycle transitions for audit
