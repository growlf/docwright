---
title: "Sub-Plan: Vault Migration System"
author: NetYeti
created: 2026-06-09
tags:
  - phase-3
  - migration
  - schema
  - versioning
approved: false
created_by: "NetYeti@phoenix"
assigned_to: ""
priority: medium
complexity: medium
parent_plan: phase-vault-portability-pilot.md
parent_deliverable: "5"
---

## Problem

As DocWright evolves, vault configuration schemas will change. Without a migration system, updating a vault means manual edits, breakage, or re-initializing from scratch. There is no versioned upgrade path.

## Proposed Solution

Define a `MIGRATION.md` format and a `vault:migrate` script:

1. **`MIGRATION.md` schema** — Per-version `## BREAKING` sections listing migration commands:
   ```markdown
   ## v0.3.0 → v0.4.0 (BREAKING)
   - Field `foo` renamed to `bar` in `.docwright/config.json`
   - Run: `npm run vault:migrate -- --field-rename foo:bar`
   ```

2. **`npm run vault:migrate -- --vault /path --from X --to Y`** — Reads `MIGRATION.md`, applies steps in the version range, updates `.docwright/config.json`, never touches vault content (proposals, plans, docs).

3. **First entry** — Write the initial `MIGRATION.md` entry documenting the Phase 3 vault-portable schema changes.

**Acceptance:** A no-op migration (same version) produces zero changes. A breaking migration (field rename) updates config without touching vault content.

## Parent Reference

This is sub-plan **#5** of Phase 3 — Vault Portability, Real-World Pilot & Upstream Contribution Pipeline (`plans/phase-vault-portability-pilot.md`, Step 6). It provides the safety net for vault schema evolution.

## Dependencies

- **Recommended:** Vault Portability Foundation (sub-plan #2) — path resolution ensures `--vault` arg works consistently
- **Can run in parallel** with sub-plans #3, #4, #6

## Future

Automated migration on `docwright init --upgrade`. A `MIGRATION.md` linter that catches missing entries before release.
