---
complexity: low
title: "Profile-Aware Project Templates for vault init"
author: NetYeti
created: 2026-06-03
tags:
  - profile-engine
  - templates
  - init
  - improvements
approved: false
priority: medium
deferred: true
deferred_reason: "Depends on full profile engine (Phase 3). Revisit after profile loading and validation are stable."
created_by: "NetYeti@phoenix"
assigned_to: NetYeti
related_to:
  - proposals/approved/project-registry.md
  - plans/phase-3-profile-acl-ai.md
milestone: backlog
---

## Problem

The `init project` / vault initialisation flow creates a generic vault
structure regardless of which profile the vault will use. An `infra-topology`
vault gets the same scaffold as an `org-operations` vault — wrong directory
structure, wrong example documents, wrong frontmatter schema hints.

## Proposed Solution

Make vault initialisation profile-aware. When a new vault is created:

1. The user selects (or accepts the default of) a bundled profile
2. The init process reads `src/profiles/[name]/templates/` for that profile
3. The vault is scaffolded with the correct directory structure, example
   documents, and frontmatter defaults for the chosen profile
4. The `profile.json` is written to the vault root, pointing at the selected
   profile

Each bundled profile ships with an `init/` directory containing:
- `vault-structure.json` — directory tree to create
- `example-documents/` — starter documents appropriate to the profile
- `README.md` — orientation for new contributors to that vault type

Custom profiles (third-party or org-specific) can provide the same `init/`
directory and plug into the same flow.

## Deferred Because

Requires the full profile engine (loading, validation, template resolution)
to be stable before init can be profile-driven.
See [[plans/phase-3-profile-acl-ai.md]].

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-03 | Created — deferred from project-registry proposal | NetYeti |
