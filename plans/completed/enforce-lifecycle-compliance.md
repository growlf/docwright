---
title: Enforce Lifecycle Compliance at the Tool Layer
status: completed
completed_date: 2026-06-02
author: NetYeti
created: 2026-06-02
tags:
  - governance
  - security
  - lifecycle
  - enforcement
proposal_source: proposals/approved/enforce-lifecycle-compliance.md
priority: high
mode: guided
assigned_to: NetYeti
consumed_by: plans/ai-task-category-taxonomy.md
---

## Summary

Build mechanical enforcement for the lifecycle governance across three layers:
MCP server gatekeeping, agent permission tightening, and pre-commit validation.

## Tasks

### Layer 1 — MCP server as gatekeeper
- [ ] `get_status()` warns when no approved plan is active for the session
- [ ] `run_dry_run()` must be called before any lifecycle state change
- [ ] Server logs all lifecycle transitions for audit

### Layer 2 — Agent permission tightening
- [ ] `design` mode: remove blanket `edit: allow` on lifecycle files
- [ ] Add explicit permission rule: lifecycle mutations require bash-gated approval
- [ ] Mode descriptions forbid crossing lifecycle gates

### Layer 3 — Pre-commit lifecycle validation
- [ ] Extend `scripts/pre-commit.sh` to check changed lifecycle files
- [ ] Reject commits that mutate lifecycle files without a valid plan context
- [ ] Add validation SOP to docs/SOPs/

## Progress

- [x] Proposal written and approved
- [x] Moved to proposals/approved/
- [x] Plan created
- [ ] Layer 1 implemented
- [ ] Layer 2 implemented
- [ ] Layer 3 implemented
- [ ] Plan completed, docs generated
