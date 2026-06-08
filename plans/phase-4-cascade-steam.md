---
title: Phase 4 — Cascade STEAM Reference Deployment
status: draft
author: NetYeti
created: 2026-06-03
tags:
  - phase-4
  - cascade-steam
  - deployment
  - forgejo
  - ai-stack
priority: medium
automated: off
assigned_to: NetYeti
depends_on:
  - phase-3-profile-acl-ai
_path: plans/phase-4-cascade-steam.md
proposal_source: phase-level — scope defined in PROJECT.md §14 Phase 4 & 5; no individual proposal
phase: 4
---
# Phase 4 — Cascade STEAM Reference Deployment

## Overview

Phase 4 is the reference implementation of DocWright in production at Cascade STEAM. The vault seed (in Drive) is activated, the Forgejo git server is provisioned, and the AI stack (growlf/ai-stack + growlf/meshy) is connected. This phase proves the full system end-to-end with a real organization.

This plan tracks all Phase 4 deliverables. Each deliverable will be broken out into its own plan when Phase 3 is complete and work begins.

## Deliverables

| # | Deliverable | Status | Notes |
| --- | --- | --- | --- |
| 1 | Vault seed finalized — vision.md and governance.md completed by leadership | ⏳ Planned | Blocked on leadership input; seed is in Drive folder |
| 2 | Forgejo server provisioned and configured | ⏳ Planned | Recommended self-hosted git server |
| 3 | Forgejo team structure mirrors Cascade STEAM org | ⏳ Planned | ACL source of truth |
| 4 | Branch protection rules configured in Forgejo | ⏳ Planned | Enforces lifecycle compliance |
| 5 | AI stack connected — growlf/ai-stack (i9 Ultra + Xe iGPU) | ⏳ Planned | Local inference via Meshy/Ollama |
| 6 | growlf/meshy inference proxy configured | ⏳ Planned | OpenAI-compatible endpoint for opencode |
| 7 | DocWright Web UI deployed and accessible to Cascade STEAM team | ⏳ Planned | SvelteKit server or static deployment behind Forgejo auth |
| 8 | VSCodium extension distributed to developer team members | ⏳ Planned | .vsix from CI; installed in Cascade STEAM dev environment |
| 9 | org-operations profile active with Cascade STEAM vault | ⏳ Planned | inbox→issue→proposal→plan→policy/decision/work |
| 10 | Onboarding documentation for Cascade STEAM contributors | ⏳ Planned | How to use DocWright, submit proposals, follow lifecycle |
| 11 | First live governance cycle — proposal through to decision | ⏳ Planned | Validates the full workflow end-to-end in production |

## Phase Context

See \[\[plans/phase-3-profile-acl-ai\]\] for Phase 3 deliverables. Phase 4 begins after Phase 3 is stable and the Cascade STEAM vault seed is approved by leadership.

The vault seed and AI stack context are in the Drive folder: https://drive.google.com/drive/folders/1XMK0Cxil65xzpXFWdMABp5i-5BHDgaZ-

## Document History

| Date | Change | Author |
| --- | --- | --- |
| 2026-06-03 | Created — roadmap placeholder, Phase 2 in progress | NetYeti |