---
title: Phase 2 — Foundation (Web-First)
status: completed
completed_date: 2026-06-08
author: NetYeti
created: 2026-06-03
phase: 2
gate_reviewer: NetYeti
gate_status: approved
tags:
  - phase-2
  - profile-engine
  - dispatch
  - ci
  - foss
priority: high
mode: autonomous
assigned_to: NetYeti
tests_defined: true
proposal_source:
  - proposals/approved/containerization.md
  - proposals/approved/research-stage-methodology.md
depends_on:
  - phase-1-ui-polish
  - phase-1-critique-skill
  - phase-1-containerization
  - phase-1-plan-step-enforcement
scenario_synthesis: Web UI and dispatch module work; no VSCodium extension or IDE-specific steps
total_steps: 0
completed_steps: 0
_path: plans/completed/phase-2-foundation.md
---
# Phase 2 — Foundation (Web-First)

## Overview

Phase 1 delivered a complete, polished Web UI. Phase 2 built the foundation: profile engine, dispatch module CI, FOSS hygiene, TypeScript MCP server (→ Phase 3), and research methodology.

**VSCodium extension:** deliberately deferred. See \[\[plans/vscodium-extension.md\]\].

## Deliverables

| # | Deliverable | Sub-plan | Status | Notes |
| --- | --- | --- | --- | --- |
| 1 | Profile engine — loads profile.json, falls back to org-operations | _(inline)_ | 🔜 Deferred to Phase 4 | Loader exists; full runtime deferred — Phase 4 has full profile engine scope |
| 2 | Dispatch module — verify zero VS Code API leakage in CI | _(Phase 1 carry-over)_ | ✅ Done | 137 dispatch tests run outside extension host in CI; invariant confirmed |
| 3 | Inbox capture — minimal localhost web form | _(deferred)_ | 🔜 Deferred to Phase 4 | Submitter persona and data format undefined; ACL dependency confirmed |
| 4 | `author-role:` in ALL profile templates | \[\[plans/completed/research-stage-methodology.md\]\] | ✅ Done | All 4 bundled profiles — requiredFrontmatter + templates/research.md |
| 5 | GitHub Actions CI — lint + typecheck + unit tests | _(Phase 1 carry-over)_ | ✅ Done | ci.yml, Node 22, v0.x.x tag-only trigger; 203+ tests across 5 suites |
| 6 | FOSS hygiene files | _(inline)_ | ✅ Done | CHANGELOG, SECURITY, CONTRIBUTING, NOTICE, AGENTS, .github/, CODEOWNERS, dependabot.yml |
| 7 | MCP server — TypeScript rewrite | _(→ Phase 3)_ | 🔜 Moved to Phase 3 | Moved to Phase 3 as first deliverable with vault portability as design constraint |
| 8 | MCP server tools — expand governance tool coverage | _(merged into #7)_ | 🔜 Moved to Phase 3 | Merged into Phase 3 Deliverable 1 |
| 9 | Research Stage MVP | \[\[plans/completed/research-stage-methodology.md\]\] | ✅ Done | 8-step plan complete; 203 tests passing; `research/` live in Web UI |
| 10 | Plan execution mode research | \[\[plans/completed/research-plan-execution-modes.md\]\] | ✅ Done | mode: mentor/guided/autonomous recommendation; enforcement contract; implementation proposal |
| 11 | Fix stale approved proposals | \[\[plans/completed/plan-mcp-tool-or-npm-script-fix-stale-approved-proposals-not-in-proposals-approved.md\]\] | ✅ Done | scripts/fix-stale-approvals.ts; npm lifecycle:fix-approvals; pre-commit hook |
| 12 | Assign plans to phases | \[\[plans/completed/assign-plans-to-phases.md\]\] | ✅ Done | PropertiesPane dropdown, auto-assign on creation, linter, status page grouping |

## Testing Plan

| # | Criterion | Verified |
| --- | --- | --- |
| T1 | All dispatch tests pass outside extension host (`npm run test:dispatch`) | ✅ |
| T2 | CI pipeline runs on v0.x.x tags with full test suite | ✅ |
| T3 | All FOSS hygiene files present in repo root | ✅ |
| T4 | Research stage deliverables (5 research docs, implementation proposal) reviewed against criteria | ✅ |
| T5 | fix-stale-approvals: 5 unit tests passing, live vault clean | ✅ |
| T6 | assign-plans-to-phases: phase dropdown, auto-assign, linter warn, status grouping all working | ✅ |

## Phase Gate

*   Phase 1 gate fully cleared
*   Dispatch CI: zero VS Code API leakage confirmed (Deliverable 2)
*   FOSS hygiene complete — all files present (Deliverable 6)
*   Research Stage MVP delivered (Deliverable 9)
*   Plan execution mode research complete, proposal submitted (Deliverable 10)
*   Fix stale approvals: script + hook + tests (Deliverable 11)
*   Assign plans to phases: end-to-end working (Deliverable 12)
*   Deliverable 1 (profile engine runtime) → deferred to Phase 4 (documented)
*   Deliverable 7/8 (TypeScript MCP) → moved to Phase 3 as first deliverable (documented)
*   Deliverable 3 (inbox capture) → deferred to Phase 4 (documented)
*   `tests_defined: true`
*   Phase 2 gate review by NetYeti

## Document History

| Date | Change | Author |
| --- | --- | --- |
| 2026-06-08 | CODEOWNERS + dependabot.yml created — FOSS hygiene complete (Deliverable 6) | NetYeti |
| 2026-06-08 | Deliverables updated to reflect actual state; Research Stage added as Deliverable 9 | NetYeti |
| 2026-06-04 | VSCodium items extracted to phase-vscodium-extension plan | NetYeti |
| 2026-06-03 | Created — Phase 1 complete, Phase 2 begins | NetYeti |
| 2026-06-08 | Phase 2 close: Deliverables 10–12 added (completed); 1/3 deferred to Phase 4; 7/8 moved to Phase 3; Phase Gate filled; ready for gate review | NetYeti |

* * *

⚠ **Governance:** mutate this plan via MCP only — update\_step · update\_plan\_status · append\_history · set\_plan\_field · write\_plan. Direct writes to `plans/*.md` are blocked by the PreToolUse hook.