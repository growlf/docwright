---
title: Sub-Plan: docwright init Scaffold
status: draft
author: NetYeti
created: 2026-07-10
tags:
  - phase-3
  - scaffold
  - init
  - vault-creation
proposal_source: proposals/approved/sub-plan-docwright-init-scaffold.md
priority: high
automated: guided
assigned_to: NetYeti
tests_defined: false
tests_human_reviewed: false
_path: plans/sub-plan-docwright-init-scaffold.md
---

# Sub-Plan: docwright init Scaffold

## Overview

Delivers the approved proposal [[proposals/approved/sub-plan-docwright-init-scaffold.md]] — see it for the full *what & why*.
Held at `status: draft`; fill in the implementation steps below before moving to `in-progress`.



## Implementation Steps

Let me check existing plans to match the exact format conventions.

## Testing Plan

### Step Verification

- [ ] `npm run init --dest /tmp/test-vault --profile default` exits 0 and creates the expected directory tree: `.docwright/`, `plans/`, `proposals/`, `docs/`, `issues/`, `inventory/`, `templates/`, plus all scaffolded config files (`config.json`, `.env`, `.mcp.json`, `.claude/settings.json`)
- [ ] The scaffolded `.env` contains no plaintext secrets — only placeholder tokens (e.g. `OPCODE_USER_NAME=changeme`) — and the file is listed in `.gitignore`
- [ ] The pre-commit hook installed by `init` is executable and rejects a commit that introduces a plaintext credential (verified via `git -C /tmp/test-vault commit` with a test secret)
- [ ] A `profile.json` stub exists at `.docwright/profiles/default/profile.json` and contains the required `states`, `documentTypes`, and `features` fields with non-empty defaults
- [ ] Running `npm run init` a second time into the same `--dest` is idempotent: exit 0, no files overwritten, existing config untouched
- [ ] The end-to-end lifecycle test (`test:init-e2e`) passes: init → create proposal → approve proposal → create plan → execute all steps → complete plan → verify plan lands in `plans/completed/` — with zero manual file edits and zero MCP validation errors

### Integration & Regression

- [ ] `npm test` passes on the full test suite (all pre-existing tests remain green)
- [ ] `npm run typecheck` passes with no new errors
- [ ] Existing `npm run init`-unrelated flows (manual vault setup, `npm run session:end`, `npm run plan-health`) produce identical output before and after the change
- [ ] The `init` command's profile stub generation produces valid JSON matching `src/profiles/*/schema.json` validation (validated via a schema-check assertion in the test)
- [ ] Pre-commit hook installation via `init` produces the same hook binary as `bash scripts/install-hooks.sh` (byte-identical or symlink-equivalent)

### Gate Criteria

- [ ] All Step Verification checkboxes above are checked
- [ ] `npm test` and `npm run typecheck` pass on the final commit
- [ ] The `test:init-e2e` test covers the full proposal→plan→completed lifecycle and is included in `npm test`
- [ ] Manual smoke test: a fresh `npm run init --dest` on a clean machine (no pre-existing vault) produces a working vault with no manual intervention
- [ ] Documentation updated: `README.md` or `GETTING-STARTED.md` lists `npm run init` as the first step for new deployments

## Rollback Procedures

Let me check the current codebase state to write accurate rollback procedures.

## Risk Assessment

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `--dest` points at non-empty directory, overwriting existing files silently | Medium | High | Refuse to scaffold into non-empty dirs unless `--force` is passed; log and exit with clear message |
| Profile stub is incomplete or missing required frontmatter fields, causing downstream schema validation failures | Medium | Medium | Profile stubs are generated from canonical templates in `src/profiles/`; CI test verifies generated `profile.json` passes `schema.json` validation |
| Pre-commit hook install fails on systems without Node/npm on PATH, leaving vault half-initialized | Medium | Low | Detect missing Node, print install instructions, and roll back partial scaffold before exiting |
| `.env.example` secrets (e.g. `OPCODE_USER_NAME`) left as placeholder values in generated vault, exposing defaults to users who forget to fill them in | High | Medium | Post-scaffold prompt (interactive or `--non-interactive` skips with warning banner); `init` refuses to mark vault complete until `.env` differs from `.env.example` |
| E2E test passes in CI but real end-user `npm run init` fails on Windows path handling or permission errors | Low | High | Add a Windows-labeled CI job and a `--dry-run` mode that validates the scaffold plan without writing files; ship `--dry-run` first to catch path issues early |
| Scope creep: init command grows hooks for CI/CD, Docker, or provisioning that should be separate proposals | Medium | Medium | Strict scope gate in the plan: init handles directory structure, config files, hooks, and profile stubs only; anything else requires its own proposal |

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-07-10 | Created from approved proposal | NetYeti |
