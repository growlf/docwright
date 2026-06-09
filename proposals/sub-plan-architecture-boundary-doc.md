---
title: "Sub-Plan: Architecture Boundary Document"
author: NetYeti
created: 2026-06-09
tags:
  - phase-3
  - documentation
  - architecture
  - vault-portability
approved: false
created_by: "NetYeti@phoenix"
assigned_to: ""
priority: low
complexity: low
parent_plan: phase-vault-portability-pilot.md
parent_deliverable: "9"
---

## Problem

The vault portability architecture spans multiple components (MCP server modes, path resolution, init scaffold, migration system, profile merge). There is no single document that explains what the tool provides, what the vault provides, and how they interface. New vault deployments and future Phase 5 developers lack a canonical reference.

## Proposed Solution

Write `docs/vault-portability.md` in the DocWright repo covering:

- **What the tool provides:** MCP server modes, lifecycle enforcement, linting, profile engine
- **What the vault provides:** content (proposals, plans, docs), config overrides, friction log
- **The interface:** env var contract (`DOCWRIGHT_PATH`, `DOCWRIGHT_VAULT_ROOT`, etc.), `.docwright/config.json` schema, `.mcp.json` template, hook install contract, `MIGRATION.md` format
- **Deployment guide:** steps to create a new vault, wire MCP, install hooks, run migration

This becomes the canonical reference for all new vault deployments, including Phase 5's Cascade STEAM production setup.

## Parent Reference

This is sub-plan **#9** of Phase 3 — Vault Portability, Real-World Pilot & Upstream Contribution Pipeline (`plans/phase-vault-portability-pilot.md`, Step 11). It captures all architecture decisions made during Phase 3.

## Dependencies

- **Prerequisite:** All other Phase 3 sub-plans must be complete or near-complete — the document must reflect the shipped architecture, not the planned one
- **Written last** in the execution order

## Future

This document evolves as new modes, profiles, and migration scenarios are added. It becomes the first thing a new DocWright adopter reads.
