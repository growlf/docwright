---
title: "Plan: docwright-adopt — Initialize DocWright on Existing Vaults"
status: draft
author: "NetYeti"
author-role: contributor
created: "2026-06-17"
created_by: "NetYeti@phoenix"
tags: [planning, tooling, adoption, vault-portability]
proposal_source: "proposals/approved/docwright-adopt-existing-vault"
priority: high
phase: 3
parent_plan: phase-vault-portability-pilot.md
automated: guided
waiting_reason:
assigned_to: ["NetYeti"]
related_to:
  - plans/phase-vault-portability-pilot.md
depends_on: []
blocks: []
reviewed_by:
reviewed_date:
canceled_date:
cancellation_reason:
template_version: "1.0"
tests_defined: true
tests_human_reviewed: false
gate_reviewer:
gate_status:
gate_date:
gate_note:
gate_reviews: []
gate_quorum: 1
scenario_synthesis: >
  New scripts, npm entries, and skill files — no VS Code API, no database.
  All file writes go to the vault root or DocWright's own .claude/skills/.
  adopt-vault.ts is a CLI script invoked from DocWright, never from inside the vault.
---

# Plan: docwright-adopt — Initialize DocWright on Existing Vaults

## Overview

Implements the three-mode vault adoption tooling described in
[[proposals/approved/docwright-adopt-existing-vault]]. Extends Phase 3's
vault portability foundation (deliverables 1–5 complete) with the tools
needed to onboard any existing repo, Obsidian vault, or project directory
into DocWright governance — without destructive side effects.

Key deliverables:
- `scripts/open-vault.ts` + `npm run open` — zero-commitment browse mode
- `scripts/adopt-vault.ts` + `npm run adopt` — idempotent adopt + upgrade
- Three-surface AI skills bridge (Claude Code, OpenCode, Gemini CLI)
- js-yaml baked-path fix in `install-hooks.sh`
- `.claude/skills/endsession.md` added to DocWright itself
- `docwright-session-start` adoption health check
- `docs/vault-portability.md` architecture doc
- Validation against DAFO (both paths) and Cascade STEAM

## Implementation Steps

| Step | Action | Details | Status |
|------|--------|---------|--------|
| 1 | Fix js-yaml path in `install-hooks.sh` | Replace `cp "$SOURCE_HOOK" "$HOOK_TARGET"` with a conditional: if `[ -n "$VAULT_TARGET" ]` → apply `sed` substitution rewriting `require('js-yaml')` and `require("js-yaml")` → `require('$DOCWRIGHT_PATH/node_modules/js-yaml')`; else → plain `cp`. **The guard is mandatory** — without it the sed runs on self-install, bakes a machine-specific path into DocWright's own `.githooks/pre-commit`, and causes the integrity diff check (lines 142-148) to fail for every developer. Verify both paths: smoke test on vault install (no `node_modules`), integrity check on self-install. | ⏳ Pending |
| 2 | Add `.claude/skills/endsession.md` to DocWright | Create the Claude Code skill file mirroring `.opencode/skills/endsession/SKILL.md`. Must cover: identity resolution, session data collection, phase close-out check, session note creation, SESSION-LOG.md update, git status report. Run `npm run sync:skills` after. Pre-condition for the skills bridge. | ⏳ Pending |
| 3 | Add manifest + stamp to `init.ts` | `init.ts` must write `.docwright/manifest.json` (file → SHA-256 map of all files it creates) and stamp `adopt_version` + `adopt_date` + `adopt_mode: "init"` in `.docwright/config.json`. Ensures `adopt --upgrade` works on vaults created by `init`. | ⏳ Pending |
| 4 | `scripts/open-vault.ts` + `npm run open` | New script. Accepts `--vault <path>`. Validates env vars (fail-hard: `DOCWRIGHT_PATH` must be set). Sets `DOCWRIGHT_ROOT=<path>` and `DOCWRIGHT_VAULT_ROOT=<path>`, then starts the Web UI server. Writes nothing to the target directory. Optionally writes `.dw-session.json` marker (gitignored). Add `"open": "tsx scripts/open-vault.ts"` to `package.json`. | ⏳ Pending |
| 5 | `scripts/adopt-vault.ts` — core + lightweight mode | New script. Accepts `--dest`, `--profile`, `--name`, `--docwright-path`, `--mode lightweight\|full` (default: full), `--upgrade`. Fail-hard on missing `DOCWRIGHT_PATH`. Lightweight mode writes: `.env`, `.envrc` (one line: `dotenv`), `.mcp.json`, `.gemini/settings.json`, `.claude/settings.json`, `.docwright/config.json` (with `adopt_version` read from `$DOCWRIGHT_PATH/package.json`), `.docwright/manifest.json`. Outputs `direnv allow` reminder after writing `.envrc`. Add `"adopt": "tsx scripts/adopt-vault.ts"` to `package.json`. | ⏳ Pending |
| 6 | `adopt-vault.ts` — full mode additions | Full mode adds on top of lightweight: create missing dirs (`proposals/`, `plans/`, `docs/`, `.docwright/`); run profile-aware frontmatter audit (resolve profile from `profile.json` first, scope to profile's document-type roots, present findings for human approval, never auto-write); `.gitignore` append with duplicate detection (present additions for human review before writing); install pre-commit hook via `npm run hook:install -- --vault <dest>`. | ⏳ Pending |
| 7 | `adopt-vault.ts` — three-surface skills bridge | Full mode copies skill files from DocWright into the vault for all three AI surfaces. **Claude Code:** copy `$DOCWRIGHT_PATH/.claude/skills/*.md` → `vault/.claude/skills/`. `.claude/settings.json` is generated once in Step 5 (lightweight); Step 7 does NOT re-copy DocWright's own `.claude/settings.json` over it — they are different documents for different contexts. **OpenCode:** copy only skill directories where `SKILL.md` frontmatter has `distributable: true` from `$DOCWRIGHT_PATH/.opencode/skills/*/` → `vault/.opencode/skills/`. Internal-only skills (`docwright-project`, `docwright-infra`, `docwright-backup`, etc.) are excluded. **Gemini CLI:** generate `GEMINI.md` from profile's `gemini-instructions.md` template (append if file exists); write `.gemini/settings.json` with MCP config. Record all copied files in `.docwright/manifest.json` with source SHA-256. Append `.claude/skills/`, `.opencode/skills/`, `.gemini/agents/`, **and `.gemini/settings.json`** to `.gitignore` — `.gemini/settings.json` contains a machine-local absolute path and must never be committed. | ⏳ Pending |
| 8 | `adopt-vault.ts` — `--upgrade` path | When `.docwright/manifest.json` exists: (a) for each manifest entry, compare on-disk SHA-256 to stored hash — match = user-unmodified = overwrite silently **then update the manifest entry to the new file's hash**; differ = user-modified = show diff + prompt skip/overwrite/merge — if overwritten, **update the manifest entry to the new hash**; (b) for files in current DW templates absent from manifest, and only where `distributable: true` = new in this version = add silently + record in manifest; (c) for manifest entries absent from current templates = warn, do not delete; (d) call `vault-migrate.ts` via `npx tsx $DOCWRIGHT_PATH/scripts/vault-migrate.ts --vault <dest>` if `schema_version` is behind — run from DocWright's directory, not the vault's; (e) update `adopt_version` + `adopt_date` in config on success. **Manifest entries must be updated in steps (a) and (b) — failure to do so causes every subsequent --upgrade to misidentify overwritten files as user-modified.** | ⏳ Pending |
| 9 | `.claude/skills/docwright-adopt-vault.md` | Claude Code skill wrapping the full interactive workflow. Detects mode from context (Open/Lightweight/Full). Auto-routes to `--upgrade` when `.docwright/config.json` already exists with `adopt_version`. Covers: mode selection, script invocation, frontmatter audit review, `.gitignore` review, `direnv allow` prompt, pre-commit validation, optional `gh repo create`, staging guidance. | ⏳ Pending |
| 10 | Session-start adoption health check | Update `docwright-session-start` skill (`.opencode/skills/docwright-session-start/SKILL.md`) to read `.docwright/config.json`, compare `adopt_version` to `$DOCWRIGHT_PATH/package.json` version. Emit non-blocking advisory if they differ. Skip silently if `.docwright/config.json` absent (e.g., DocWright repo itself). | ⏳ Pending |
| 11 | `docs/vault-portability.md` | Architecture boundary doc covering: the three modes and when to use each; manifest-based upgrade contract including new-file propagation; js-yaml baked-path approach and recovery when DocWright moves (re-run `hook:install` or `adopt --upgrade`); moving a vault to a new machine (update `.env`, `direnv allow`, `adopt --upgrade`); CI usage (set `DOCWRIGHT_ROOT` + `DOCWRIGHT_VAULT_ROOT` as CI env vars; no direnv or hook install needed); the `DOCWRIGHT_ROOT` vs `DOCWRIGHT_VAULT_ROOT` distinction. | ⏳ Pending |
| 12 | Validation — DAFO fresh adoption | On a branch or copy of the DAFO Infrastructure Vault: wipe DocWright infrastructure files (`.env`, `.envrc`, `.mcp.json`, `.claude/`, `.opencode/`, `.gemini/`, `.docwright/`). Run `npm run adopt -- --dest <dafo-path> --mode full`. Must complete without manual steps. Pre-commit validation must pass without manually fixing frontmatter the script's audit didn't surface. | ⏳ Pending |
| 13 | Validation — DAFO upgrade | Run `npm run adopt -- --dest <dafo-path> --upgrade` on the result of step 12. Verify: unmodified managed files updated silently, no spurious overwrites of user content, new-version files propagated, config stamp updated. | ⏳ Pending |
| 14 | Validation — Cascade STEAM | Run `npm run adopt -- --dest <cascade-steam-path> --mode full` against the Cascade STEAM vault (structurally different repo). Any friction discovered is filed as a bug before this plan closes. | ⏳ Pending |

## Testing Plan

### Step Verification

- [ ] Step 1: `npm run hook:install` on a test vault with no `node_modules` — hook resolves `js-yaml` correctly via baked absolute path
- [ ] Step 1: Smoke test in `install-hooks.sh` passes after sed substitution
- [ ] Step 2: `/endsession` is invocable from Claude Code in DocWright repo — no "skill not found" error
- [ ] Step 3: `npm run init` on a new empty dir produces `.docwright/manifest.json` with all created files listed
- [ ] Step 4: `npm run open -- --vault /tmp/test-repo` starts the Web UI pointing at the test repo; `/api/list` returns files from the test repo, not from DocWright
- [ ] Step 5: `npm run adopt -- --dest /tmp/test-vault --mode lightweight` creates exactly the files listed in the lightweight spec and no others
- [ ] Step 5: `.envrc` contains `dotenv`; `.docwright/manifest.json` records all written files with correct hashes
- [ ] Step 6: `npm run adopt -- --dest /tmp/test-vault --mode full` on a repo with existing markdown — frontmatter audit runs, findings presented, nothing written without confirmation
- [ ] Step 6: `.gitignore` additions are appended (existing entries preserved), no duplicates
- [ ] Step 7: After full adoption, `claude code` in the vault directory can invoke `/endsession` and `/status`
- [ ] Step 7: `GEMINI.md` and `.gemini/settings.json` present and correctly reference `DOCWRIGHT_PATH`
- [ ] Step 8: Re-running `adopt --upgrade` after modifying a managed file prompts for resolution; unmodified files update silently
- [ ] Step 8: Simulated new-version file (add a file to DW templates, run `--upgrade`) — new file appears in vault and manifest
- [ ] Steps 12–14: All three validation milestones pass as specified in the proposal

### Integration & Regression

- [ ] `npm test` passes without modification after all steps
- [ ] `npm run typecheck` compiles cleanly
- [ ] `npm run hook:install` (self-install on DocWright repo) still works correctly after step 1 changes — DocWright's own hook must not get the baked path substitution (only vault installs should)
- [ ] `npm run init` on a new empty vault still works correctly after step 3 changes
- [ ] Existing adopted vaults (manually configured) continue to work — no regressions from install-hooks.sh change

### Gate Criteria

- [ ] `tests_defined: true` in frontmatter
- [ ] Steps 12, 13, 14 complete — both DAFO paths and Cascade STEAM validated
- [ ] Any friction from validation milestones filed as bugs and resolved or explicitly deferred
- [ ] Human reviewer has verified step outcomes above
- [ ] `docs/vault-portability.md` exists and covers all specified topics

## Rollback Procedures

| Scenario | Rollback |
|----------|---------|
| `install-hooks.sh` sed change breaks self-install | The `[ -n "$VAULT_TARGET" ]` guard is mandatory in the spec; if missing, add it. Self-install path falls through to plain `cp` — no baked path. |
| `adopt-vault.ts` writes bad config to a vault | Delete the files it wrote (listed in `.docwright/manifest.json`); re-run `adopt --mode lightweight` once fixed |
| `init.ts` manifest change breaks existing tests | The manifest is additive — existing `init.ts` tests check for files created, not for absence of manifest; add manifest assertion to tests rather than rolling back |
| `.claude/skills/endsession.md` causes skill conflicts | Remove the file; update `sync:skills` — skills are opt-in, removal has no side effects |

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `sed` substitution in install-hooks.sh corrupts hook for self-install (DocWright repo) | Low | High | Gate on `[ -n "$VAULT_TARGET" ]` before applying substitution; self-installs skip it |
| `adopt-vault.ts` appending to `.gitignore` duplicates existing entries | Medium | Low | Check each entry with `grep -qF` before appending |
| Frontmatter audit false positives on non-governed markdown | Medium | Low | Scope audit to profile's document-type roots only; skip files with no frontmatter |
| `--upgrade` hash mismatch on files the user intentionally modified | Expected | Low | By design — user is prompted; skip option always available |
| Gemini CLI `.gemini/` local directory structure changes between CLI versions | Low | Medium | Pin Gemini CLI version in docs; `--upgrade` re-generates from template |
| DAFO vault has content the audit flags as invalid (blocking fresh adoption) | High | Medium | Expected — audit is interactive, human approves each finding before any write |

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-17 | Created from bare template — filled by Claude Code based on proposal and session decisions | NetYeti |
