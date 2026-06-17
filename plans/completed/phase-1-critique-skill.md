---
title: Phase 1 — Plan Critique Skill
status: completed
completed_date: 2026-06-04
author: NetYeti
created: 2026-06-04
phase: 1
gate_reviewer: NetYeti
gate_status: waived
gate_note: "Waived retroactively — completed before strict gate enforcement; NetYeti authorized 2026-06-07"
proposal_source:
  - proposals/skill-plan-critique.md
priority: critical
mode: mentor
assigned_to: NetYeti
scenario_synthesis: Node.js script + Claude Code skill file; no deployment or infrastructure steps
tags:
  - phase-1
  - governance
  - skills
  - ai
_path: plans/phase-1-critique-skill.md
---

# Phase 1 — Plan Critique Skill

## Overview

**This plan must complete before all other Phase 1 plans begin execution.**

The critique skill is the meta-tool that validates all other plans. It should
exist before containerization, before step enforcement, before Phase 2 — so
that every plan we execute has already been stress-tested.

Building the tool that audits plans AFTER plans are already in flight is
backwards. This is the highest-priority Phase 1 item.

See [[proposals/skill-plan-critique.md]] for the full specification.

## Deliverables

| # | Deliverable | Details | Status |
|---|-------------|---------|--------|
| 1 | `scripts/critique-plan.js` | Reads plan + referenced proposals + downstream plans + core policies; outputs structured context block with critic questions embedded. Pure context-gathering — no AI reasoning. | ✅ Done |
| 2 | `.claude/skills/critique-plan.md` | Claude Code wrapper: runs script, passes output to Agent, presents findings for human review, commits on approval with HUMAN_APPROVED=1 | ✅ Done |
| 3 | OpenCode usage documented | Instructions in `docs/skills.md` for piping script output to any AI session (OpenCode, BigPickle, any model) | ✅ Done |
| 4 | Run on all existing Phase 1 plans | Execute `/critique-plan` on phase-1-containerization, phase-1-plan-step-enforcement; update Critical Review sections with any new findings | ✅ Done |
| 5 | Run on Phase 2 plan | Execute on phase-2-foundation; update Critical Review section | ✅ Done |

## Why first

Without this tool:
- Plans get executed without adversarial review
- Gaps and failure modes are discovered during implementation (expensive)
- The review depends on someone remembering to do it (discipline-based)

With this tool:
- Any plan can be critiqued by any AI before a single line of code is written
- Claude and BigPickle can both review the same plan from different angles
- The Critical Review section becomes mandatory infrastructure, not optional

## Phase Gate

**Gate reviewer:** NetYeti
**Gate status:** `pending`

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-04 | Created — promoted to Phase 1, highest priority | NetYeti |
