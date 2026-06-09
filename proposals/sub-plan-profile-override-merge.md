---
title: "Sub-Plan: Profile Override Merge"
author: NetYeti
created: 2026-06-09
tags:
  - phase-3
  - profile
  - merge
  - engine
approved: false
created_by: "NetYeti@phoenix"
assigned_to: ""
priority: medium
complexity: low
parent_plan: phase-vault-portability-pilot.md
parent_deliverable: "4"
---

## Problem

DocWright ships bundled profiles (e.g., `org-operations`), but vaults need to customize them — add required fields, extend schemas, override templates. Currently there's no merge mechanism; a vault either uses the bundled profile verbatim or forks it entirely.

## Proposed Solution

Implement a profile override merge engine in the dispatch module. The engine reads a vault-root `profile.json` (if present) and merges it onto the bundled profile using these rules:

- **Scalar fields:** vault value replaces bundled value
- **Objects:** deep-merge (vault keys supplement bundled keys)
- **Arrays:** `+array` prefix → append to bundled array; unprefixed → replace entirely

**Test:** MSP vault adds one custom required frontmatter field without losing any bundled defaults. All three merge modes have unit test coverage.

## Parent Reference

This is sub-plan **#4** of Phase 3 — Vault Portability, Real-World Pilot & Upstream Contribution Pipeline (`plans/phase-vault-portability-pilot.md`, Step 7). It enables vaults to extend DocWright's governance model without forking.

## Dependencies

- **No hard prerequisite** — can be developed in parallel with sub-plans #1–#3 and #5–#6
- **Required by:** MSP Pilot (sub-plan #7) needs custom fields for service-catalog policies

## Future

The merge engine could support `+field` for adding new schema properties, and a `--diff` mode to show what a vault overrides vs the bundled default.
