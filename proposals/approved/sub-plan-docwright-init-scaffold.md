---
title: "Sub-Plan: docwright init Scaffold"
author: NetYeti
created: 2026-06-09
tags:
  - phase-3
  - scaffold
  - init
  - vault-creation
approved: true
created_by: "NetYeti@phoenix"
assigned_to: NetYeti
priority: high
complexity: medium
parent_plan: plans/phase-3-vault-foundation.md
parent_deliverable: "3"
milestone: v0.6.0
_path: proposals/approved/sub-plan-docwright-init-scaffold
consumed_by: plans/sub-plan-docwright-init-scaffold.md
---

## Problem

Creating a new DocWright vault is currently a manual process: copy files, edit paths, install hooks, write config. There is no single command that produces a working vault from scratch. This blocks both the MSP pilot and Cascade STEAM early-access.

## Proposed Solution

Implement `npm run init -- --dest /path/to/new-vault --profile org-operations` that creates:

- Full vault directory structure (`.docwright/`, `proposals/`, `plans/`, `docs/`, etc.)
- `.docwright/config.json` — vault identity and version
- `.env` — with `DOCWRIGHT_PATH` set to the vault root
- `.mcp.json` — wiring `dw-vault` and `dw-upstream` via the template from sub-plan #2
- `.claude/settings.json` — hook commands using `$DOCWRIGHT_PATH`
- Pre-commit hook (installed via `npm run hook:install`)
- `profile.json` stub — based on the `--profile` argument
- `docs/friction-log.md` — empty friction log

**Acceptance:** End-to-end test: init → open in web UI → create proposal → approve → create plan → complete → archive. Zero manual file edits.

## Parent Reference

This is sub-plan **#3** of Phase 3 — Vault Portability, Real-World Pilot & Upstream Contribution Pipeline (`plans/phase-3-vault-foundation.md`, Step 5). It is the primary user-facing output of the vault portability work.

## Dependencies

- **Prerequisite:** Vault Portability Foundation (sub-plan #2) — provides the path resolution and `.mcp.json` template
- **Blocking:** MSP Pilot (sub-plan #7), Cascade STEAM (sub-plan #8)

## Future

`docwright init` becomes the entry point for all new vault deployments. Future profiles are added as `--profile` options. An `--upgrade` flag could migrate existing vaults to newer DocWright versions.
