---
title: Project registry for multi-vault project tracking
status: approved
author: NetYeti
created: 2026-06-02
tags:
  - core
  - workflow
  - registry
  - multi-repo
proposal_source: proposals/approved/project-registry.md
priority: highest
automated: guided
assigned_to: NetYeti
---

## Overview

Gitignored project registry at `.docwright/registry.json` so DocWright can
discover and resume work across external vaults without committing references
to them.

## Tasks

### 1. `.docwright/` directory scaffold
- Create `.docwright/` at repo root
- Add `.gitignore` with `*` (everything gitignored)
- Add `registry.example.json` (tracked) as a template

### 2. Dispatch registry module
- `src/dispatch/registry.ts` with `loadRegistry`, `listProjects`, `updateLastSession`
- Types: `Registry`, `ProjectEntry`

### 3. Web UI project switcher
- Read registry in layout, show project list in sidebar
- Each entry shows name, profile, link to last session note
- Click navigates to project path (for now, just display)

### 4. Session workflow integration
- Auto-update `last_session` in registry on session resume
- CLI/command to switch vault context
