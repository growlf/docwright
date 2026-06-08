---
title: "Research: Plan Execution Mode — Naming, Enforcement, and Default"
status: in-progress
author: NetYeti
created: 2026-06-08
tags:
  - research
  - governance
  - ai
  - workflow
  - plan-modes
proposal_source: proposals/approved/research-plan-execution-modes.md
priority: high
automated: guided
assigned_to: NetYeti
tests_defined: false
phase: 2
scenario_synthesis: Research process — surveys, naming analysis, UI mocks, enforcement contract; no infrastructure steps
total_steps: 5
completed_steps: 2
_path: plans/research-plan-execution-modes.md
---

# Research: Plan Execution Mode — Naming, Enforcement, and Default

## Overview

The `automated` field (values: `off | guided | full`) describes how much the AI
does vs. the human. The current naming is misleading: `off` sounds like a disabled
state rather than an intentional human-led mode, and the field has almost no
enforcement — mode is purely advisory, not a runtime constraint.

This research phase answers five questions, then produces a single implementation
proposal for approval. See [[proposals/approved/research-plan-execution-modes.md]]
for the full problem statement and research questions.

## Research Questions

1. What should the field and values be called? (rename `automated` → `mode`? `off` → `mentor`?)
2. How do we make mentor mode the intentional default, not a fallback?
3. Should the `## Mode` section in plan bodies be dynamic, removed, or kept as-is?
4. Which Web UI and MCP behaviors should branch on mode?
5. Is mode a self-instruction to the AI or a system-enforced constraint?

## Implementation Steps

| Step | Action | Details | Status |
|------|--------|---------|--------|
| 1 | Survey comparable tools | GitHub Copilot Workspace, OpenCode, Linear Asks, Cursor — how do they model "how much does the AI do"? Comparison table: mode models, defaults, enforcement patterns. | ✅ Done |
| 2 | Draft naming options | 2–3 candidate name sets for field + values. Evaluate against: clarity, default-readiness, avoidance of false implications. Deliverable: naming recommendation with rationale. (Parallel with step 1.) | ✅ Done |
| 3 | Sketch Web UI mocks per mode | For each mode: which buttons appear, what is locked/greyed, what `## Mode` section shows (if kept), how human perceives mode at a glance. Include mid-mode indicators. | ⏳ Pending |
| 4 | Define enforcement contract | Exactly which behaviors branch on mode: MCP tool behavior, Web UI button visibility, AI instruction preamble injection, linter validation. Single source of truth for Web UI and AI tools. | ⏳ Pending |
| 5 | Synthesize implementation proposal | Naming recommendation + UI mocks + enforcement contract → single proposal. Include migration path for existing plans (backward-compatible reading, deprecation warning for old values). | ⏳ Pending |

## Testing Plan

Research deliverables are reviewed documents, not code. Each step's output is reviewed
against the research questions before proceeding to the next step. The final proposal
(step 5) must answer all 5 research questions before it is submitted for approval.

## Out of Scope

| Idea | Why deferred |
|------|-------------|
| Full autonomous AI execution (no human in loop) | Requires significant infrastructure; AI governance boundary must hold |
| Per-step mode (some steps mentor, some autonomous) | Too granular; plan-level mode is sufficient for Phase 3 |
| Cross-vault mode sync | Enterprise concern |
| Real-time mode indicator in activity feed | Depends on enforcement contract; defer until designed |
| Enforcing mode in Claude Code | Claude Code is not a DocWright surface; DocWright controls only Web UI and MCP tools |

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Rename breaks existing plans that use old values | Medium | Medium | Backward-compatible field reading + deprecation lint warning |
| Enforcement design is too restrictive (blocks valid workflows) | Medium | High | User-test each mode's button set before committing to the contract |
| Research scope creep into cross-tool enforcement | Low | Medium | Scope explicitly excludes Claude Code; document the boundary |

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-08 | Created from approved proposal | NetYeti |
| 2026-06-08 | Filled from proposal spec — 5-step research path, quoted title to fix YAML parse | NetYeti |
| 2026-06-08 | Completed steps 1 & 2 (parallel): tool survey + naming recommendation. Deliverables: research/plan-execution-mode-tool-survey.md, research/plan-execution-mode-naming.md. Recommendation: mode: mentor | guided | autonomous | NetYeti |
