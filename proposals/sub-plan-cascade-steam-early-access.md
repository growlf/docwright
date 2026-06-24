---
title: "Sub-Plan: Cascade STEAM Early-Access Vault"
author: NetYeti
created: 2026-06-09
tags:
  - phase-3
  - cascade-steam
  - early-access
  - vault-seed
approved: false
created_by: "NetYeti@phoenix"
assigned_to: ""
priority: high
complexity: medium
parent_plan: plans/phase-vault-portability-pilot.md
parent_deliverable: "8"
---

## Problem

Cascade STEAM leadership needs hands-on access to DocWright governance before Phase 5's full production infrastructure (Forgejo, AI stack) is deployed. Without an early vault, Phase 5 would need to both build infrastructure AND validate the governance model simultaneously — increasing risk and delaying leadership feedback.

## Proposed Solution

Using `docwright init` (sub-plan #3) and the Phase 3 vault-portable architecture, provision a Cascade STEAM vault on a local git repository:

- **No Forgejo, no AI stack yet** — just the vault structure, `org-operations` profile, and stub policies seeded from the Drive vault content
- **Leadership can:** open the Web UI, read vault seed content, submit their first proposal
- **Validates:** the vault seed content is usable before Phase 5 production infra begins

**Acceptance bar:** Leadership can open the Web UI, navigate the vault seed, and successfully submit a proposal. No manual file editing required.

## Parent Reference

This is sub-plan **#8** of Phase 3 — Vault Portability, Real-World Pilot & Upstream Contribution Pipeline (`plans/phase-vault-portability-pilot.md`, Step 9). It de-risks Phase 5 by proving the governance content works before the production infrastructure build.

## Dependencies

- **Prerequisite:** Vault Portability Foundation (sub-plan #2), `docwright init` (sub-plan #3)
- **Independent of:** MSP Pilot (sub-plan #7) — can run in parallel

## Future

Once Phase 5 deploys Forgejo and the AI stack, this vault is migrated to the production server. The early-access proposals become the first items in Cascade STEAM's formal governance cycle.
