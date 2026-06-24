---
title: "Lifecycle Gates Phase 2 — AI Assistance, Quorum, Scheduled Triggers, Retroactive Audit, and Governance Log"
status: draft
author: "NetYeti"
created: "2026-06-08"
created_by: "NetYeti@phoenix"
tags: [governance, gates, audit, ai, lifecycle]
proposal_source: "proposals/approved/bundle-lifecycle-gates-phase-2"
priority: high
mode: guided
assigned_to: netyeti
related_to:
  - plans/completed/lifecycle-gates-extension-bundle.md
  - plans/phase-4-profile-acl-ai.md
depends_on:
  - plans/completed/lifecycle-gates-extension-bundle.md
  - plans/phase-4-profile-acl-ai.md
blocks: []
tests_defined: true
total_steps: 5
completed_steps: 0
phase: 4
github_epic: null
---

# Lifecycle Gates Phase 2 — AI Assistance, Quorum, Scheduled Triggers, Retroactive Audit, and Governance Log

## Overview

Five deferred gate proposals consolidated: AI-assisted preparation (surveys scope, drafts readiness summary for reviewers), multi-reviewer quorum (per-reviewer state tracking, quorum requirement in profile.json), time-based and scheduled triggers (cadence-based gate firing with overdue detection), retroactive audit (vault scan for transitions that bypassed gates, with --fix option), and governance audit log (append-only JSONL log of every lifecycle transition, committed to git).

## Implementation Steps

| Step | Action | Details | Status | Issue | Branch |
|------|--------|---------|--------| --- | --- |
| 1 | AI-assisted gate preparation | Before presenting a gate to a reviewer, AI reads all documents in scope, checks for incomplete items, flags inconsistencies, drafts readiness summary. Summary stored in gate_note. Profile's opencode-instructions.md defines AI checks per gate type. | ⏳ Pending | — | — |
| 2 | Multi-reviewer quorum | Extend gate definitions in profile.json with quorum field. Frontmatter gains gate_reviews array (per-reviewer state). Gate stays pending until quorum reached. Status page shows per-reviewer state. | ⏳ Pending | — | — |
| 3 | Time-based and scheduled triggers | Add schedule trigger type to gate definitions with cadence field. Document frontmatter gains review_cadence override. Overdue gates surface on status page. | ⏳ Pending | — | — |
| 4 | Retroactive audit of past transitions | Vault scan tool (MCP + CLI) finding gated transitions without recorded gate_status. With --fix: stamps with waived + audit note. MCP tool: docwright_gate_audit. Status page Audit tab. | ⏳ Pending | — | — |
| 5 | Governance audit log | Append-only structured JSONL log of every lifecycle transition (status changes, gate approvals, AI write actions, deferrals). Logged via pre-commit hook or dispatch promote(). MCP query tool, Web UI Audit tab, CLI interface. Committed to git. | ⏳ Pending | — | — |

## Parallelism Map

Steps that share no overlapping files can be worked simultaneously on separate `feat/` branches.
Fill in Depends On and Parallel With based on reviewing the step details above.

| Step | Depends On | Parallel With | Notes |
| --- | --- | --- | --- |
| 1 | — | — | |
| 2 | — | — | |
| 3 | — | — | |
| 4 | — | — | |
| 5 | — | — | |

## Testing Plan

- [ ] Step 1: AI-assisted gate preparation
- [ ] Step 2: Multi-reviewer quorum
- [ ] Step 3: Time-based and scheduled triggers
- [ ] Step 4: Retroactive audit of past transitions
- [ ] Step 5: Governance audit log
1. Gate fires with AI summary present — verify reviewer sees AI output
2. Quorum: single reviewer approves — gate stays pending until quorum met
3. Quorum: all reviewers approve — gate transitions
4. Scheduled gate: document past cadence — shows as overdue on status page
5. Retroactive audit: scan detects pre-gate transitions correctly
6. Audit log: every status transition produces a JSONL entry
7. Audit log: entries survive git commit and clone

## Rollback Procedures

- AI gate prep: remove AI review step from gate flow
- Quorum: revert to single-reviewer gate definition
- Scheduled triggers: remove schedule trigger type from gate definitions
- Retroactive audit: the --fix flag stamps are reversible by editing frontmatter
- Audit log: entries are append-only; no rollback needed. If format changes, migrate the JSONL file.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| AI-assisted prep produces inaccurate summaries | Medium | Medium | AI prepares, human decides always; reviewer can override/dismiss AI summary |
| Quorum causes gate deadlock if reviewer is unavailable | Medium | High | Gates support waiver option to bypass stalled quorum; profile.json can set quorum=1 |
| Audit log file grows large over time | Low | Low | JSONL is line-oriented and compressible; implement log rotation for large vaults |
| Retroactive audit floods with false positives | Medium | Low | Audit findings are advisory — --fix is explicit opt-in; false positives are searchable and can be ignored |

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-08 | Plan filled in from proposal — AI prep, quorum, scheduled triggers, retroactive audit, audit log — 5 steps with testing and risk | NetYeti |
