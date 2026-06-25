---
title: "Sub-Plan: Contribution Pipeline & Friction Log"
author: NetYeti
created: 2026-06-09
tags:
  - phase-3
  - contribution
  - upstream
  - friction-log
  - consent
approved: true
created_by: NetYeti@phoenix
assigned_to: NetYeti
priority: medium
complexity: medium
parent_plan: plans/phase-3-vault-foundation.md
parent_deliverable: 6
_path: proposals/sub-plan-contribution-pipeline.md
consumed_by: plans/contribution-pipeline.md
---

## Problem

When using DocWright to manage external projects, users encounter friction and missing features. There is no structured pipeline to feed these experiences back into DocWright's own development. Bugs get forgotten, feature requests stay verbal, and upstream contributions require manual GitHub navigation.

## Proposed Solution

Deliver two related MCP tools that form an upstream contribution pipeline:

1. **`contribute_upstream(title, description, category, docwright_version)`** — Available in upstream mode only. Gated by `DOCWRIGHT_CONTRIB_APPROVED=1` env var (human-set, AI cannot forge). Validates sanitization schema, creates GitHub issue via `DOCWRIGHT_GITHUB_TOKEN` or generates a pre-filled URL fallback. Logs to `.docwright/contributions.log`.

2. **`log_friction(description, category)`** — Available in vault mode. Creates structured entries in `docs/friction-log.md`. Categories: `bug`, `feature-request`, `ux-friction`, `docs-gap`, `missing-abstraction`. Periodic review process: friction entries → (with consent) → `contribute_upstream` → GitHub issues.

3. **Supporting tools:** `list_docwright_issues`, `create_docwright_proposal` (in upstream mode).

## Parent Reference

This is sub-plan **#6** of Phase 3 — Vault Portability, Real-World Pilot & Upstream Contribution Pipeline (`plans/phase-3-vault-foundation.md`, Steps 2 + 10). It closes the feedback loop between vault users and DocWright development.

## Dependencies

- **Prerequisite:** TypeScript MCP Server (sub-plan #1) — the upstream mode enables contribution from any vault
- **Can run in parallel** with sub-plans #2–#5

## Future

A review dashboard that surfaces pending friction entries for triage. Automated consent workflow via proposal creation instead of direct GitHub issues.


*(AI improvement Message failed: 500 — showing original body)*

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-14 | AI-improved via Improve | NetYeti |
