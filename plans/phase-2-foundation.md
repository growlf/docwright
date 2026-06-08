---
title: Phase 2 — Foundation (Web-First)
status: in-progress
author: NetYeti
created: 2026-06-03
phase: 2
gate_reviewer: NetYeti
gate_status: pending
tags:
  - phase-2
  - profile-engine
  - dispatch
  - ci
  - foss
priority: high
automated: off
assigned_to: NetYeti
proposal_source:
  - proposals/containerization.md
  - proposals/approved/research-stage-methodology.md
depends_on:
  - phase-1-ui-polish
  - phase-1-critique-skill
  - phase-1-containerization
  - phase-1-plan-step-enforcement
scenario_synthesis: Web UI and dispatch module work; no VSCodium extension or IDE-specific steps
tests_defined: false
total_steps: 0
completed_steps: 0
---

# Phase 2 — Foundation (Web-First)

## Overview

Phase 1 delivered a complete, polished Web UI. Phase 2 builds the foundation that everything else depends on: the profile engine, dispatch module maturity, inbox capture, CI pipeline, FOSS hygiene, and research methodology.

**VSCodium extension work has been extracted** to its own plan ([[plans/phase-vscodium-extension.md]]) to begin after the web tool reaches alpha and real users validate the core workflow.

This plan is the **parent/overview** for all Phase 2 deliverables. Each deliverable is or will be broken out into its own sub-plan when work begins. Sub-plan completions update this table manually until a formal parent-plan mechanism exists (see [[proposals/approved/sub-plan-parent-tracking.md]] when created).

## Deliverables

| # | Deliverable | Sub-plan | Status | Notes |
| --- | --- | --- | --- | --- |
| 1 | Profile engine — loads profile.json, falls back to org-operations | *(inline)* | ⏳ Planned | Loader exists; Phase 2 work: schema validation, UI behaviour on profile switch |
| 2 | Dispatch module — verify zero VS Code API leakage in CI | *(Phase 1 carry-over)* | ✅ Done | 137 dispatch tests run outside extension host in CI; invariant confirmed |
| 3 | Inbox capture — minimal localhost web form | *(deferred)* | 🔜 Deferred to Phase 3 | Submitter persona and data format undefined; ACL dependency confirmed |
| 4 | `author-role:` in ALL profile templates | [[plans/research-stage-methodology.md]] | ✅ Done | All 4 bundled profiles — requiredFrontmatter + templates/research.md |
| 5 | GitHub Actions CI — lint + typecheck + unit tests | *(Phase 1 carry-over)* | ✅ Done | ci.yml, Node 22, v0.x.x tag-only trigger, 203 tests across 5 suites |
| 6 | FOSS hygiene files | *(inline)* | ⚠️ Partial | CHANGELOG, SECURITY, CONTRIBUTING, NOTICE, AGENTS, .github/ — done. Missing: CODEOWNERS, dependabot.yml |
| 7 | MCP server — TypeScript rewrite | *(planned sub-plan)* | ⏳ Planned | Replace mcp-server.py; sub-deliverables defined in critique #7 below |
| 8 | MCP server tools — expand governance tool coverage | *(merged into #7)* | ⏳ Planned | Merged into Deliverable 7 sub-deliverables |
| 9 | Research Stage MVP | [[plans/research-stage-methodology.md]] | ✅ Done | 8-step plan complete; 203 tests passing; `research/` live in Web UI |

## Phase Context

### Phase 0 (complete) ✅

Validated `opencode serve` HTTP API. Confirmed Web UI as primary surface.

### Phase 1 (complete) ✅

Complete polished Web UI: file tree, editor, properties, status, funnel view, AI chat panel, brand system, activity bar, phase gate, deployment docs.

### Phase 2 (this plan) — Web-First Foundation

Profile engine, dispatch CI, FOSS hygiene, TypeScript MCP server, Research Stage. Containerization completed in Phase 1 — Phase 2 begins from a stable containerized base. Inbox capture deferred to Phase 3.

### VSCodium Extension (after alpha)

See [[plans/phase-vscodium-extension.md]]. Begins after the web tool has been validated by real users in alpha testing.

### Phase 3 (future) — Profile engine full, ACL, Research AI tooling

Full profile engine with all bundled profiles, ACL enforcement via Forgejo, AI writes through ACL controller, wikilink graph, backlinks index. AI-assisted research sessions and research-to-proposal generation.

## Critical Review — Findings and Resolutions

*Reviewed by /critique-plan adversarial agent. ⚠️/🚫 resolved below.*

### #1 — Profile engine ⚠️ warn

- **Finding:** The loader already exists (`loadProfile`, `getActiveProfile`). Real gaps: (a) no schema validation lib; (b) `getActiveProfile` uses `__dirname` for path resolution outside dist tree; (c) no concrete UI behaviour defined when non-default profile is active.
- **Resolution:** Schema validation for static bundled profiles deemed unnecessary — profiles are committed code, not user-uploaded. `__dirname` bug filed as known issue. UI behaviour defined: profile `features` flags (`wikilinks`, `graph`, `llmWiki`) drive sidebar and panel visibility. Remaining work captured in Deliverable 1 above.

### #2 — Dispatch CI 📝 note

- **Finding:** `npm run test:dispatch` was already wired. This deliverable was effectively done.
- **Resolution:** ✅ Confirmed done. 137 dispatch tests + 203 total tests run in CI. Marked complete in deliverables table.

### #3 — Inbox capture 🚫 block

- **Finding:** `src/dispatch/inbox.ts` does not exist. Use case undefined. Depends on Phase 3 ACL.
- **Resolution:** ✅ Deferred to Phase 3. Deliverable 3 marked deferred. Will be re-scoped when submitter persona is defined and ACL is available.

### #4 — `author-role:` audit 🚫 block

- **Finding:** No `author-role:` field existed in any template. Template canonical location was ambiguous.
- **Resolution:** ✅ Resolved via [[plans/research-stage-methodology.md]]. Canonical location established as `src/profiles/*/templates/`. All 4 bundled profiles now have `author-role: contributor` in `requiredFrontmatter` and in `templates/research.md`. Vault-level `/templates/` also has `author-role` in all 5 templates.

### #5 — CI ⚠️ warn

- **Finding:** CI used Node 20; container targets Node 22. Version mismatch gap.
- **Resolution:** ✅ Resolved. CI now runs Node 22. Workflow trigger documented (v0.x.x tags + workflow_dispatch only, per `policies/core/versioning.md`). CI watch automation added (PostToolUse hook + SSE endpoint).

### #6 — FOSS hygiene ⚠️ warn

- **Finding:** CONTRIBUTING, NOTICE, SECURITY, CHANGELOG, AGENTS all exist. Only CODEOWNERS and dependabot.yml missing.
- **Resolution:** ⚠️ Partially resolved. CODEOWNERS and dependabot.yml still outstanding — tracked in Deliverable 6. All other files confirmed present.

### #7 — TypeScript MCP server 🚫 block

- **Finding:** 600-line Python port. Needs sub-deliverables: 7a read-only tools, 7b state transitions, 7c parity verification, 7d remove Python from Dockerfile.
- **Resolution:** Acknowledged. Sub-deliverables captured. Will be scoped in the TypeScript MCP sub-plan when started. Python server remains operational in the interim.

### #8 — MCP governance tools 🚫 block

- **Finding:** "Additional dispatch tools" is a placeholder with no acceptance criteria.
- **Resolution:** Merged into Deliverable 7 as sub-deliverable 7e: list and expose specific governance tools (linter, gate evaluator) once TypeScript server exists.

### Cross-cutting — Template location ambiguity ⚠️ warn

- **Finding:** Templates existed in three locations; canonical location undefined.
- **Resolution:** ✅ Resolved. Canonical location: `src/profiles/*/templates/`. Established and enforced during Research Stage plan. `/templates/` in vault root serves as human-readable reference; `.docworkbench/` is legacy and scheduled for removal in Phase 3 cleanup.

### Cross-cutting — Phase 1 gate must complete 🚫 block

- **Finding:** Phase 2 started before all Phase 1 dependencies were complete.
- **Resolution:** ✅ Resolved. All four Phase 1 dependency plans are now in `plans/completed/`. Phase 1 gate cleared.

## Phase Gate

- [x] All Phase 1 plans completed and gated
- [x] Research Stage MVP delivered (Deliverable 9)
- [x] CI pipeline running with full test suite (Deliverable 5)
- [x] `author-role:` in all bundled profile templates (Deliverable 4)
- [ ] Profile engine runtime (Deliverable 1) — in progress
- [ ] TypeScript MCP server (Deliverable 7) — planned
- [ ] CODEOWNERS + dependabot.yml (Deliverable 6 remainder)
- [ ] Phase 2 gate review by NetYeti

## Document History

| Date | Change | Author |
| --- | --- | --- |
| 2026-06-03 | Created — Phase 1 complete, Phase 2 begins | NetYeti |
| 2026-06-04 | VSCodium items extracted to phase-vscodium-extension plan; containerization and TypeScript MCP server added | NetYeti |
| 2026-06-07 | Deliverables updated to reflect actual state; Research Stage added as Deliverable 9; Critical Review resolutions filled; Phase Gate added; sub-plan column added | NetYeti |
