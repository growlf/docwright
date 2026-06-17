---
title: "Sub-Plan: Vault Migration System"
status: approved
author: NetYeti
created: 2026-06-11
tags:
  - phase-3
  - migration
  - schema
  - versioning
proposal_source: proposals/approved/sub-plan-vault-migration-system.md
priority: medium
complexity: medium
mode: guided
scenario_synthesis: Vault migration system; npm scripts, MIGRATION.md parsing, config.json versioning; no VS Code or IDE-specific steps
assigned_to: NetYeti
parent_plan: phase-vault-portability-pilot.md
parent_deliverable: 5
tests_defined: true
phase: 3
_path: plans/sub-plan-vault-migration-system.md
total_steps: 3
completed_steps: 3
---

# Sub-Plan: Vault Migration System

## Overview

_Plan generated from approved proposal: Sub-Plan: Vault Migration System_

### Problem

As DocWright evolves, vault configuration schemas will change. Without a migration system, updating a vault means manual edits, breakage, or re-initializing from scratch. There is no versioned upgrade path.

### Parent Reference

This is sub-plan **#5** of Phase 3 — Vault Portability, Real-World Pilot & Upstream Contribution Pipeline (`plans/phase-vault-portability-pilot.md`, Step 6). It provides the safety net for vault schema evolution.

### Dependencies

- **Recommended:** Vault Portability Foundation (sub-plan #2) — path resolution ensures `--vault` arg works consistently
- **Can run in parallel** with sub-plans #3, #4, #6

### Future

Automated migration on `docwright init --upgrade`. A `MIGRATION.md` linter that catches missing entries before release.


*(AI fill-in unavailable — OpenCode not configured)*


## Implementation Steps

| 1 | **`MIGRATION.md` schema** — Per-version `## BREAKING` sections listing migration commands: | | ✅ Done |
| 2 | **`npm run vault:migrate -- --vault /path --from X --to Y`** — Reads `MIGRATION.md`, applies steps in the version range, updates `.docwright/config.json`, never touches vault content (proposals, plans, docs). | | ✅ Done |
| 3 | **First entry** — Write the initial `MIGRATION.md` entry documenting the Phase 3 vault-portable schema changes. | | ✅ Done |

## Testing Plan

- [ ] Step 2: `npm run vault:migrate -- --vault /path --from X --to Y` — Reads `MIGRATION.md`, applies steps in the version range, updates `.docwright/config.json`, never touches vault content (proposals, plans, docs).
- [ ] Step 3: First entry — Write the initial `MIGRATION.md` entry documenting the Phase 3 vault-portable schema changes.
_Testing plan TBD_

## Rollback Procedures

_Rollback procedures TBD_

## Risk Assessment

_Risk assessment TBD_

## Document History

| Date | Change | Author |
| --- | --- | --- |
| 2026-06-11 | Created from approved proposal | NetYeti |
| 2026-06-14 | Steps 1-3 completed: MIGRATION.md format defined, vault:migrate script built and tested, first v1 entry written for Phase 3 vault-portable schema. init.ts updated to generate .docwright/config.json. | NetYeti |
