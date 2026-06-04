---
title: Phase 2 — Foundation (Web-First)
status: approved
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
  - proposals/skill-plan-critique.md
depends_on:
  - phase-1-ui-polish
  - phase-1-containerization
  - phase-1-plan-step-enforcement
scenario_synthesis: "Web UI and dispatch module work; no VSCodium extension or IDE-specific steps"
---

# Phase 2 — Foundation (Web-First)

## Overview

Phase 1 delivered a complete, polished Web UI. Phase 2 builds the foundation
that everything else depends on: the profile engine, dispatch module maturity,
inbox capture, CI pipeline, and FOSS hygiene.

**VSCodium extension work has been extracted** to its own plan
([[plans/phase-vscodium-extension.md]]) to begin after the web tool reaches
alpha and real users validate the core workflow. Building the extension before
we know the workflow is stable is wasted effort.

This plan tracks all Phase 2 deliverables. Each will be broken out into its
own sub-plan when work begins.

## Deliverables

| # | Deliverable | Status | Notes |
|---|-------------|--------|-------|
| 1 | Profile engine — loads profile.json, falls back to org-operations | ⏳ Planned | `src/dispatch/profile.ts` exists; needs loader, validation, schema |
| 2 | Dispatch module — verify zero VS Code API leakage in CI | ⏳ Planned | CI step that imports dispatch outside extension host confirms invariant |
| 3 | Inbox capture — minimal localhost web form | ⏳ Planned | Standalone HTML form, no framework required; inbox.ts adapter |
| 4 | `author-role:` in ALL profile templates | ⏳ Planned | Audit: verify every template in all four bundled profiles includes the field |
| 5 | GitHub Actions CI — lint + typecheck + unit tests | ⏳ Planned | `.github/workflows/ci.yml`; no .vsix step (that belongs in VSCodium plan) |
| 6 | FOSS hygiene files | ⏳ Planned | CHANGELOG.md, SECURITY.md, CONTRIBUTING.md, NOTICE.md, AGENTS.md, CODEOWNERS, .github/ templates, dependabot.yml |
| 7 | MCP server — TypeScript rewrite | ⏳ Planned | Replace `scripts/mcp-server.py` with `src/dispatch/mcp-server.ts`; eliminates Python dependency from container; aligns with dispatch module |
| 8 | `/critique-plan` skill — `scripts/critique-plan.js` | ⏳ Planned | Tool-agnostic context gatherer; works with Claude, OpenCode, and any AI. See [[proposals/skill-plan-critique.md]] |

## Phase Context

### Phase 0 (complete) ✅
Validated `opencode serve` HTTP API. Confirmed Web UI as primary surface.

### Phase 1 (complete) ✅
Complete polished Web UI: file tree, editor, properties, status, funnel view,
AI chat panel, brand system, activity bar, phase gate, deployment docs.

### Phase 2 (this plan) — Web-First Foundation
Profile engine, dispatch CI, inbox, CI pipeline, FOSS hygiene, TypeScript MCP
server. Containerization completed in Phase 1 — Phase 2 begins from a stable
containerized base.

### VSCodium Extension (after alpha)
See [[plans/phase-vscodium-extension.md]]. Begins after the web tool has been
validated by real users in alpha testing.

### Phase 3 (future) — Profile engine full, ACL, AI integration
Full profile engine with all bundled profiles, ACL enforcement via Forgejo,
AI writes through ACL controller, wikilink graph, backlinks index.

### Phase 4 (future) — Cascade STEAM reference deployment

## Critical Review — Open Questions Before Starting

*These issues were identified in adversarial review. Each must be resolved or
explicitly accepted before the relevant deliverable begins.*

### #1 — Profile engine
- **What is "validation"?** `src/dispatch/profile.ts` already has a `ProfileConfig`
  interface. The plan says "validation, schema" but doesn't define what that means.
  JSON Schema via AJV? Runtime type-checking? Or just the existing TS interface?
  Profiles are bundled and static — schema validation may be unnecessary. Decide
  before building.
- **Missing:** What does the Web UI do with the active profile? How does it know
  which profile is loaded? This affects the UI layer, not just dispatch.

### #2 — Dispatch CI
- **Does `npm run test:dispatch` exist?** The hook in CLAUDE.md references it but
  it may not be wired into `package.json`. Verify before claiming this is a CI step.

### #3 — Inbox capture ⚠️ Possibly wrong scope
- **Use case undefined.** Who submits to this form? Why can't they `git push` a
  file to `inbox/` themselves? If the answer is "no git access," that's an ACL
  problem — Phase 3, not Phase 2.
- **Where does captured data go?** What format? How does the Web UI present it?
  If `inbox.ts` doesn't exist, this deliverable is larger than one line suggests.
- **Recommendation:** Either specify the use case fully, or defer to Phase 3 where
  ACL and team membership are in place.

### #4 — `author-role:` audit ⚠️ Templates don't exist
- Only `org-operations` has any content. `doc-lifecycle`, `infra-topology`, and
  `knowledge-base` are stubs (profile.json only, no templates).
- **This deliverable is mislabeled.** It should be:
  - (a) Audit `org-operations` templates for `author-role:` field *(easy)*
  - (b) Create templates for the other three profiles *(Phase 3 scope)*
  Change the deliverable to match reality, or move (b) explicitly to Phase 3.

### #5 — CI
- **Does `npm run test:dispatch` work today?** Must be verified before being in CI.
- **What triggers the workflow?** Push to main? PRs? Tags? Not specified.

### #6 — FOSS hygiene ⚠️ Mostly already done
- CONTRIBUTING.md, NOTICE.md, SECURITY.md, CHANGELOG.md all exist.
- What's actually missing: AGENTS.md, CODEOWNERS, dependabot.yml, PR template.
- **This is maintenance, not a Phase 2 deliverable.** Consider demoting to a
  checklist item rather than a numbered deliverable. Update the plan to reflect
  what is already done vs what is actually pending.

### #7 — TypeScript MCP server ⚠️ Severely underestimated
- The Python server is ~600 lines. Porting to TypeScript with parity is a
  2-3 day task, not a one-liner.
- **Break into sub-deliverables:**
  - 7a: Port read-only tools
  - 7b: Port state transition tools
  - 7c: Verify tool parity with Python version
  - 7d: Remove Python from Dockerfile
- **Parity matters:** If any state transition is missed, Phase 3 ACL breaks.

### Cross-cutting
- **No testing plan.** No deliverable says "how do we know this works?" Add
  acceptance criteria to each deliverable before starting it.
- **Test-last is risk.** Currently tests are the last deliverable everywhere.
  Reverse this: define acceptance criteria first, build to pass them.
- **Phase 2 must not start until all Phase 1 gates pass.** The `depends_on`
  field enforces this structurally but must also be enforced by the phase gate
  mechanism.

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-03 | Created — Phase 1 complete, Phase 2 begins | NetYeti |
| 2026-06-04 | VSCodium items extracted to phase-vscodium-extension plan; containerization and TypeScript MCP server added | NetYeti |
