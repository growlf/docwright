---
title: Phase 5 — Cascade STEAM Production Infrastructure
status: draft
author: NetYeti
created: 2026-06-03
tags:
  - phase-5
  - cascade-steam
  - forgejo
  - ai-stack
  - infrastructure
priority: medium
mode: mentor
assigned_to: NetYeti
depends_on:
  - phase-4-profile-acl-ai
_path: plans/phase-5-cascade-steam.md
proposal_source: phase-level — scope defined in PROJECT.md §14 Phase 5; no individual proposal
phase: 5
total_steps: 0
completed_steps: 0
github_epic: null
---

# Phase 5 — Cascade STEAM Production Infrastructure

## Overview

Phase 5 takes the Cascade STEAM vault (provisioned in Phase 3 Step 9 as an early-access
local vault) and moves it onto full production infrastructure: Forgejo as the git server,
Forgejo ACL enforcement, the AI stack, and Web UI deployment to the full team.

**What this phase is NOT:** Phase 5 does not prove that DocWright works with an external
vault — Phase 3 proved that with the MSP pilot and the Cascade STEAM early-access vault.
Phase 5 is purely about production infrastructure for one specific organization.

**Depends on:** Phase 4 (Forgejo ACL enforcement must exist before Forgejo teams are
the ACL source of truth). Phase 3 (vault seed and `docwright init` work complete).

## Deliverables

| # | Deliverable | Status | Notes |
| --- | --- | --- | --- |
| 1 | Vault seed finalized — vision.md and governance.md completed by leadership | ⏳ Planned | Blocked on leadership input; seed content is in Drive folder; early-access vault from Phase 3 gives leadership a working environment to iterate in |
| 2 | Forgejo server provisioned and configured | ⏳ Planned | Self-hosted git server; replaces local git repo from Phase 3 early-access vault |
| 3 | Forgejo team structure mirrors Cascade STEAM org | ⏳ Planned | ACL source of truth; depends on Phase 4 ACL controller |
| 4 | Branch protection rules configured in Forgejo | ⏳ Planned | Enforces lifecycle compliance at the git layer |
| 5 | AI stack connected — growlf/ai-stack (i9 Ultra + Xe iGPU) | ⏳ Planned | Local inference via Meshy/Ollama; replaces any remote inference used in Phase 3 |
| 6 | growlf/meshy inference proxy configured | ⏳ Planned | OpenAI-compatible endpoint for OpenCode |
| 7 | Web UI deployed and accessible to full Cascade STEAM team | ⏳ Planned | SvelteKit server behind Forgejo auth; includes CS-specific onboarding guide (thin layer on top of Phase 3 architecture doc) |
| 8 | VSCodium extension distributed to developer team members | ⏳ Planned | .vsix from CI; depends on VSCodium extension work (phase-vscodium-extension plan) |

## Phase Context

See [[plans/phase-3-vault-portability-pilot]] — Phase 3 provisions the Cascade STEAM
early-access vault (Step 9) and proves DocWright works with external vaults generally.
Phase 5 converts that early-access vault into a production deployment.

See [[plans/phase-4-profile-acl-ai]] — Phase 4 delivers the Forgejo ACL integration
that makes Deliverables 3 and 4 here possible.

The vault seed content is in the Drive folder:
https://drive.google.com/drive/folders/1XMK0Cxil65xzpXFWdMABp5i-5BHDgaZ-

## Document History

| Date | Change | Author |
| --- | --- | --- |
| 2026-06-08 | Reframed as production infrastructure only — "proof of concept" work moved to Phase 3 Step 9. Removed D9 (org-operations profile active — covered by Phase 3), D10 (onboarding docs — covered by Phase 3 arch doc), D11 (first governance cycle — covered by Phase 3 MSP pilot). Renamed to "Production Infrastructure". | NetYeti |
| 2026-06-08 | Renumbered Phase 4 → Phase 5; depends_on updated to phase-4-profile-acl-ai | NetYeti |
| 2026-06-03 | Created — roadmap placeholder | NetYeti |
