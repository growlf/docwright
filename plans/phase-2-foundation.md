---
title: Phase 2 — Foundation (Web-First)
status: draft
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
depends_on:
  - phase-1-ui-polish
  - phase-1-critique-skill
  - phase-1-containerization
  - phase-1-plan-step-enforcement
scenario_synthesis: Web UI and dispatch module work; no VSCodium extension or IDE-specific steps
_path: plans/phase-2-foundation.md
---
# Phase 2 — Foundation (Web-First)

## Overview

Phase 1 delivered a complete, polished Web UI. Phase 2 builds the foundation that everything else depends on: the profile engine, dispatch module maturity, inbox capture, CI pipeline, and FOSS hygiene.

**VSCodium extension work has been extracted** to its own plan (\[\[plans/phase-vscodium-extension.md\]\]) to begin after the web tool reaches alpha and real users validate the core workflow. Building the extension before we know the workflow is stable is wasted effort.

This plan tracks all Phase 2 deliverables. Each will be broken out into its own sub-plan when work begins.

## Deliverables

| # | Deliverable | Status | Notes |
| --- | --- | --- | --- |
| 1 | Profile engine — loads profile.json, falls back to org-operations | ⏳ Planned | `src/dispatch/profile.ts` exists; needs loader, validation, schema |
| 2 | Dispatch module — verify zero VS Code API leakage in CI | ⏳ Planned | CI step that imports dispatch outside extension host confirms invariant |
| 3 | Inbox capture — minimal localhost web form | ⏳ Planned | Standalone HTML form, no framework required; inbox.ts adapter |
| 4 | `author-role:` in ALL profile templates | ⏳ Planned | Audit: verify every template in all four bundled profiles includes the field |
| 5 | GitHub Actions CI — lint + typecheck + unit tests | ⏳ Planned | `.github/workflows/ci.yml`; no .vsix step (that belongs in VSCodium plan) |
| 6 | FOSS hygiene files | ⏳ Planned | CHANGELOG.md, SECURITY.md, CONTRIBUTING.md, NOTICE.md, AGENTS.md, CODEOWNERS, .github/ templates, dependabot.yml |
| 7 | MCP server — TypeScript rewrite | ⏳ Planned | Replace `scripts/mcp-server.py` with `src/dispatch/mcp-server.ts`; eliminates Python dependency from container; aligns with dispatch module |
| 8 | MCP server tools — expand governance tool coverage | ⏳ Planned | Additional dispatch tools beyond Phase 1 skeleton |

## Phase Context

### Phase 0 (complete) ✅

Validated `opencode serve` HTTP API. Confirmed Web UI as primary surface.

### Phase 1 (complete) ✅

Complete polished Web UI: file tree, editor, properties, status, funnel view, AI chat panel, brand system, activity bar, phase gate, deployment docs.

### Phase 2 (this plan) — Web-First Foundation

Profile engine, dispatch CI, inbox, CI pipeline, FOSS hygiene, TypeScript MCP server. Containerization completed in Phase 1 — Phase 2 begins from a stable containerized base.

### VSCodium Extension (after alpha)

See \[\[plans/phase-vscodium-extension.md\]\]. Begins after the web tool has been validated by real users in alpha testing.

### Phase 3 (future) — Profile engine full, ACL, AI integration

Full profile engine with all bundled profiles, ACL enforcement via Forgejo, AI writes through ACL controller, wikilink graph, backlinks index.

### Phase 4 (future) — Cascade STEAM reference deployment

## Critical Review — Open Questions Before Starting

_Reviewed by /critique-plan adversarial agent. Resolve ⚠️/🚫 before starting._

### #1 — Profile engine ⚠️ warn

*   **Finding:** The loader already exists (`loadProfile`, `getActiveProfile`). Notes column says "needs loader, validation, schema" — this is wrong. Real gaps: (a) no schema validation lib installed (no AJV, no Zod); (b) `getActiveProfile` uses `__dirname` for path resolution which silently falls back to DEFAULT\_PROFILE outside the compiled dist tree — an existing bug; (c) plan never defines what the Web UI does differently when a non-default profile is active.
*   **Action:** Fix notes column. Decide whether schema validation is needed for static bundled profiles (probably not). File the `__dirname` bug. Define one concrete UI behavior that proves the engine does something.
*   **Resolution:**

### #2 — Dispatch CI 📝 note

*   **Finding:** `npm run test:dispatch` IS wired in root `package.json`. CI workflow already calls it. 34 tests pass. This deliverable is effectively already done.
*   **Action:** Mark complete or note as already delivered in Phase 1.
*   **Resolution:**

### #3 — Inbox capture 🚫 block

*   **Finding:** `src/dispatch/inbox.ts` does not exist. Use case still undefined. "No git access" = ACL problem = Phase 3, not Phase 2. "Power user shortcut" = nice-to-have, not foundation. Neither is specified.
*   **Action:** Do not start this until: (1) submitter persona defined, (2) data format specified, (3) confirmed it doesn't depend on Phase 3 ACL. Move to Phase 3 or extract to its own sub-plan.
*   **Resolution:**

### #4 — `author-role:` audit 🚫 block

*   **Finding:** No `author-role:` field exists in ANY template anywhere — not in `/templates/`, not in `.docworkbench/`. The plan says "org-operations has templates" but `src/profiles/org-operations/` has no `templates/` dir. Templates live in `/templates/` (3 files) and `.docworkbench/*/templates/` (5 files). The audit target doesn't match reality.
*   **Action:** Rewrite deliverable: (a) add `author-role:` to all `/templates/*.md` (3 files), (b) add to all `.docworkbench/*/templates/*.md` (5 files), (c) decide which template location is canonical per CLAUDE.md spec (`src/profiles/*/templates/`).
*   **Resolution:**

### #5 — CI ⚠️ warn

*   **Finding:** CI exists and mostly works. One gap: CI uses Node 20, container targets Node 22. Behavioral differences between versions won't be caught.
*   **Action:** Bump CI to Node 22. Document what events trigger the workflow.
*   **Resolution:**

### #6 — FOSS hygiene ⚠️ warn

*   **Finding:** CONTRIBUTING.md ✅, NOTICE.md ✅, SECURITY.md ✅, CHANGELOG.md ✅, AGENTS.md ✅ — all exist. Actually missing: CODEOWNERS and dependabot.yml only.
*   **Action:** Update deliverable to list only the two missing files. Consider demoting to a checklist item rather than a numbered deliverable.
*   **Resolution:**

### #7 — TypeScript MCP server 🚫 block

*   **Finding:** 600-line Python port with one line of description. Covers 11 async tool handlers, status cache, file operations, collation logic, dry-run state machine, 3 state transition workflows, audit log writer, self-test suite. ~3 dev days minimum.
*   **Action:** Expand to sub-deliverables: 7a read-only tools, 7b state transitions, 7c parity verification vs Python, 7d remove Python from Dockerfile. Do not switch `opencode.json` until 7c passes. Add explicit acceptance criterion: smoke test against Python output and diff.
*   **Resolution:**

### #8 — MCP governance tools 🚫 block

*   **Finding:** "Additional dispatch tools beyond Phase 1 skeleton" is a placeholder, not a deliverable. No skeleton exists in TypeScript. No tools listed. No acceptance criteria. Cannot be estimated or reviewed.
*   **Action:** Either list specific tools with names and behaviors (e.g., "expose `linter.ts` as MCP lint tool"), or merge into Deliverable 7 as 7e and eliminate as separate item.
*   **Resolution:**

### Cross-cutting — Template location ambiguity ⚠️ warn

*   **Finding:** Templates exist in three locations: `/templates/`, `/.docworkbench/*/templates/`, and planned-but-nonexistent `src/profiles/*/templates/`. CLAUDE.md says canonical location is `src/profiles/`. This inconsistency will confuse every template-touching deliverable.
*   **Action:** Decide canonical location before ANY template work. If `.docworkbench/` is legacy, schedule removal.
*   **Resolution:**

### Cross-cutting — Phase 1 gate must actually complete 🚫 block

*   **Finding:** Plan is `status: approved` but four Phase 1 dependencies are not complete. Phase 2 work that overlaps with incomplete Phase 1 scope will rework.
*   **Action:** No Phase 2 deliverable starts until all four Phase 1 plans pass gate review.
*   **Resolution:**

## Document History

| Date | Change | Author |
| --- | --- | --- |
| 2026-06-03 | Created — Phase 1 complete, Phase 2 begins | NetYeti |
| 2026-06-04 | VSCodium items extracted to phase-vscodium-extension plan; containerization and TypeScript MCP server added | NetYeti |