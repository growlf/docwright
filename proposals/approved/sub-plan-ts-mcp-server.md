---
title: "Sub-Plan: TypeScript MCP Server Migration"
author: NetYeti
created: 2026-06-09
tags:
  - phase-3
  - mcp-server
  - typescript
  - vault-portability
approved: true
created_by: NetYeti@phoenix
assigned_to: NetYeti
priority: high
complexity: high
parent_plan: plans/phase-vault-portability-pilot.md
parent_deliverable: 1
_path: proposals/sub-plan-ts-mcp-server.md
consumed_by: plans/completed/sub-plan-ts-mcp-server.md
---
## Problem

The Python MCP server (`scripts/mcp-server.py`) is the single point of lifecycle enforcement, but it lives outside the web UI's TypeScript ecosystem. This creates three concrete problems:

1. **Two-language maintenance burden** — The Python server duplicates TypeScript logic for lifecycle validation, frontmatter parsing, and plan mutation. Every frontmatter schema change must be applied in both languages. Two dependency trees (pip + npm) drift independently and must be kept in sync.

2. **Deployment overhead** — Requiring a Python runtime in the Docker image adds ~150 MB, increases the security surface (additional packages, CVEs), and complicates CI (Python toolchain alongside Node.js toolchain).

3. **Vault-portability blocker** — The Python server's file I/O assumes a single DocWright repo checkout. The `--mode vault` pattern is the right architectural direction but cannot be implemented cleanly without a rewrite that discovers vault roots and resolves paths from config at startup.

## Proposed Solution

Rewrite `scripts/mcp-server.py` in TypeScript. Introduce a `--mode` flag:

- `--mode vault` (default): serves the vault's lifecycle data via `DOCWRIGHT_VAULT_ROOT`
- `--mode upstream`: targets DocWright's own repo for the contribution pipeline

Key design decisions:

- **Zero hard-coded paths** — Every path and endpoint is driven by environment variables (`DOCWRIGHT_VAULT_ROOT`, `DOCWRIGHT_MCP_PORT`, `DOCWRIGHT_PROFILE`, `DOCWRIGHT_LOG_LEVEL`). No magic strings.
- **Parity test suite** — Every existing MCP tool works identically in both modes. Tests run against mock repos in both `--mode vault` and `--mode upstream` configurations.
- **File structure** — `src/mcp/server.ts` (entrypoint), `src/mcp/tools/*.ts` (one file per tool), `src/mcp/validation/` (frontmatter rules, lifecycle rules), `src/mcp/config.ts` (env var resolution with sensible defaults).
- **API parity** — Same tool names, same argument schemas, same return types as the Python server. CLI tools, VS Code extension, and CI hooks see zero difference.
- **Migration path** — Ship the TypeScript server alongside the Python server initially. Switch the Docker entrypoint default to the TS server after soak. Remove the Python server and Python runtime from the Dockerfile after the soak period ends with no regressions.
- **Process management** — Use `supervisord` for container deployments (unchanged); direct `node` for dev workflows and single-container vault deployments.

## Out of Scope

- Changes to MCP tool names, argument schemas, or return types (API parity is required — consumers must not change)
- Refactoring of MCP consumers (CLI, VS Code extension, CI hooks)
- Automatic mode detection or multi-mode orchestration
- Profile-specific MCP variants or changes to the profile system
- Performance optimization beyond what the TypeScript rewrite naturally yields

## Parent Reference

This is sub-plan **#1** of Phase 3 — Vault Portability, Real-World Pilot & Upstream Contribution Pipeline (`plans/phase-vault-portability-pilot.md`, Step 1). It is the foundational dependency for all subsequent Phase 3 sub-plans.

## Dependencies

- **Prerequisite:** Phase 2 gate review complete
- **Blocking:** All other Phase 3 sub-plans (they depend on the TS MCP server)

## Future

After migration, the Python server can be retired. The TypeScript server becomes the single MCP implementation for all modes and profiles.

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-09 | AI-improved via Improve | NetYeti |
