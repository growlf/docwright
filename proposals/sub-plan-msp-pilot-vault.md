---
title: "Sub-Plan: MSP Pilot Vault"
author: NetYeti
created: 2026-06-09
tags:
  - phase-3
  - pilot
  - msp
  - real-world
approved: false
created_by: "NetYeti@phoenix"
assigned_to: ""
priority: high
complexity: high
parent_plan: plans/phase-vault-portability-pilot.md
parent_deliverable: "7"
---

## Problem

DocWright's governance model has only been tested on its own development. Before we can recommend it for external projects, we need a real-world pilot with an actual organization — a non-profit managed services provider (MSP) — running through a complete governance cycle.

## Proposed Solution

Create a git repository for the MSP partner and run `docwright init` to scaffold their vault. Then:

1. **Write policies** — service-catalog, change-management, incident-response, security-baseline, onboarding
2. **Complete a full lifecycle cycle** — proposal → approve → plan → execute → complete → archive — entirely through DocWright's web UI
3. **Record friction log entries** throughout using `log_friction` from sub-plan #6
4. **Acceptance bar:** Full lifecycle works with zero manual file edits. All operations go through the web UI and MCP tools.

The pilot vault exercises:
- Vault portability (sub-plan #2) — runs outside DocWright's own repo
- `docwright init` (sub-plan #3) — scaffolded, not copied
- Profile override (sub-plan #4) — custom fields for MSP policies
- Contribution pipeline (sub-plan #6) — friction entries fed upstream

## Parent Reference

This is sub-plan **#7** of Phase 3 — Vault Portability, Real-World Pilot & Upstream Contribution Pipeline (`plans/phase-vault-portability-pilot.md`, Step 8). It is the primary validation gate for the entire vault portability architecture.

## Dependencies

- **Prerequisite:** TypeScript MCP Server (sub-plan #1), Vault Portability Foundation (sub-plan #2), `docwright init` (sub-plan #3)
- **Recommended:** Profile Override Merge (sub-plan #4), Contribution Pipeline (sub-plan #6)

## Future

The MSP vault becomes a reference deployment for new DocWright adopters. Lessons learned feed into documentation and the `org-operations` profile.
