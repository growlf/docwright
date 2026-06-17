---
title: "Plan: docwright-adopt — Initialize DocWright on Existing Vaults"
status: in-progress
author: NetYeti
author-role: contributor
created: 2026-06-17
created_by: NetYeti@phoenix
tags: [planning, tooling, adoption, vault-portability]
proposal_source: proposals/approved/docwright-adopt-existing-vault
priority: high
phase: 3
parent_plan: phase-vault-portability-pilot.md
automated: full
waiting_reason: ""
assigned_to: ["NetYeti"]
related_to:
  - plans/phase-vault-portability-pilot.md
depends_on: []
blocks: []
reviewed_by: ""
reviewed_date: ""
canceled_date: ""
cancellation_reason: ""
template_version: 1.0
tests_defined: true
tests_human_reviewed: false
gate_reviewer: ""
gate_status: ""
gate_date: ""
gate_note: ""
gate_reviews: []
gate_quorum: 1
scenario_synthesis: >
_path: plans/plan-script-skill-docwright-adopt-initialize-docwright-on-existing-vaults.md
---
# Plan: docwright-adopt — Initialize DocWright on Existing Vaults

## Overview

Implements the three-mode vault adoption tooling described in \[\[proposals/approved/docwright-adopt-existing-vault\]\]. Extends Phase 3's vault portability foundation (deliverables 1–5 complete) with the tools needed to onboard any existing repo, Obsidian vault, or project directory into DocWright governance — without destructive side effects.

Key deliverables:

*   `scripts/open-vault.ts` + `npm run open` — zero-commitment browse mode
*   `scripts/adopt-vault.ts` + `npm run adopt` — idempotent adopt + upgrade
*   Three-surface AI skills bridge (Claude Code, OpenCode, Gemini CLI)
*   js-yaml baked-path fix in `install-hooks.sh`
*   `.claude/skills/endsession.md` added to DocWright itself
*   `docwright-session-start` adoption health check
*   `docs/vault-portability.md` architecture doc
*   Validation against DAFO (both paths) and Cascade STEAM

## Implementation Steps

| Step | Action | Details | Status |
| --- | --- | --- | --- |
| 1 | Fix js-yaml path in `install-hooks.sh` | Replace `cp "$SOURCE_HOOK" "$HOOK_TARGET"` with a `sed` substitution that rewrites `require('js-yaml')` → `require('$DOCWRIGHT_PATH/node_modules/js-yaml')` in the generated hook. Both quote styles. Verify smoke test still passes. Pre-condition for all hook-install calls downstream. | ✅ Done |
| 2 | Add `.claude/skills/endsession.md` to DocWright | Create the Claude Code skill file mirroring `.opencode/skills/endsession/SKILL.md`. Must cover: identity resolution, session data collection, phase close-out check, session note creation, SESSION-LOG.md update, git status report. Run `npm run sync:skills` after. Pre-condition for the skills bridge. | ✅ Done |
| 3 | Add manifest + stamp to `init.ts` | `init.ts` must write `.docwright/manifest.json` (file → SHA-256 map of all files it creates) and stamp `adopt_version` + `adopt_date` + `adopt_mode: "init"` in `.docwright/config.json`. Ensures `adopt --upgrade` works on vaults created by `init`. | ✅ Done |
| 4 | `scripts/open-vault.ts` + `npm run open` | New script. Accepts `--vault <path>`. Validates env vars (fail-hard: `DOCWRIGHT_PATH` must be set). Sets `DOCWRIGHT_ROOT=<path>` and `DOCWRIGHT_VAULT_ROOT=<path>`, then starts the Web UI server. Writes nothing to the target directory. Optionally writes `.dw-session.json` marker (gitignored). Add `"open": "tsx scripts/open-vault.ts"` to `package.json`. | ✅ Done |
| 5 | `scripts/adopt-vault.ts` — core + lightweight mode | New script. Accepts `--dest`, `--profile`, `--name`, `--docwright-path`, `--mode lightweight|full` (default: full), `--upgrade`. Fail-hard on missing `DOCWRIGHT_PATH`. Lightweight mode writes: `.env`, `.envrc` (one line: `dotenv`), `.mcp.json`, `.gemini/settings.json`, `.claude/settings.json`, `.docwright/config.json` (with `adopt_version` read from `$DOCWRIGHT_PATH/package.json`), `.docwright/manifest.json`. Outputs `direnv allow` reminder after writing `.envrc`. Add `"adopt": "tsx scripts/adopt-vault.ts"` to `package.json`. | ✅ Done |
| 6 | `adopt-vault.ts` — full mode additions | Full mode adds on top of lightweight: create missing dirs (`proposals/`, `plans/`, `docs/`, `.docwright/`); run profile-aware frontmatter audit (resolve profile from `profile.json` first, scope to profile's document-type roots, present findings for human approval, never auto-write); `.gitignore` append with duplicate detection (present additions for human review before writing); install pre-commit hook via `npm run hook:install -- --vault <dest>`. | ✅ Done |
| 7 | `adopt-vault.ts` — three-surface skills bridge | Full mode copies skill files from DocWright into the vault for all three AI surfaces. **Claude Code:** copy `$DOCWRIGHT_PATH/.claude/skills/*.md` → `vault/.claude/skills/`. Copy `$DOCWRIGHT_PATH/.claude/settings.json` (with `DOCWRIGHT_PATH` resolved) → `vault/.claude/settings.json`. **OpenCode:** copy `$DOCWRIGHT_PATH/.opencode/skills/*/` directories → `vault/.opencode/skills/`. **Gemini CLI:** generate `GEMINI.md` from profile's `gemini-instructions.md` template (append if file exists); write `.gemini/settings.json` with MCP config. Record all copied files in `.docwright/manifest.json` with source SHA-256. Add `.claude/skills/`, `.opencode/skills/`, `.gemini/agents/` to `.gitignore` (appended). | ✅ Done |
| 8 | `adopt-vault.ts` — `--upgrade` path | When `.docwright/manifest.json` exists: (a) for each manifest entry, compare on-disk SHA-256 to stored hash — match = user-unmodified = overwrite silently **then update manifest entry**; differ = user-modified = skip with warning; (b) for files in current DW templates absent from manifest where `distributable: true` = add silently; (c) manifest entries absent from current templates = warn, do not delete; (d) update `adopt_version` + `adopt_date` in config on success. | ✅ Done |
| 9 | `.claude/skills/docwright-adopt-vault.md` | Claude Code skill wrapping the full interactive workflow. Detects mode from context (Open/Lightweight/Full). Auto-routes to `--upgrade` when `.docwright/config.json` already exists with `adopt_version`. Covers: mode selection, script invocation, frontmatter audit review, `.gitignore` review, `direnv allow` prompt, pre-commit validation, optional `gh repo create`, staging guidance. | ✅ Done |
| 10 | Session-start adoption health check | Update `docwright-session-start` skill (`.opencode/skills/docwright-session-start/SKILL.md`) to read `.docwright/config.json`, compare `adopt_version` to `$DOCWRIGHT_PATH/package.json` version. Emit non-blocking advisory if they differ. Skip silently if `.docwright/config.json` absent (e.g., DocWright repo itself). Also added to `.claude/skills/status.md`. | ✅ Done |
| 11 | `docs/vault-portability.md` | Architecture boundary doc covering: the three modes and when to use each; manifest-based upgrade contract including new-file propagation; js-yaml baked-path approach and recovery when DocWright moves (re-run `hook:install` or `adopt --upgrade`); moving a vault to a new machine (update `.env`, `direnv allow`, `adopt --upgrade`); CI usage (set `DOCWRIGHT_ROOT` + `DOCWRIGHT_VAULT_ROOT` as CI env vars; no direnv or hook install needed); the `DOCWRIGHT_ROOT` vs `DOCWRIGHT_VAULT_ROOT` distinction. | ✅ Done |
| 12 | Validation — DAFO fresh adoption | On a branch or copy of the DAFO Infrastructure Vault: wipe DocWright infrastructure files (`.env`, `.envrc`, `.mcp.json`, `.claude/`, `.opencode/`, `.gemini/`, `.docwright/`). Run `npm run adopt -- --dest <dafo-path> --mode full`. Must complete without manual steps. Pre-commit validation must pass without manually fixing frontmatter the script's audit didn't surface. | ✅ Done |
| 13 | Validation — DAFO upgrade | Run `npm run adopt -- --dest <dafo-path> --upgrade` on the result of step 12. Verify: unmodified managed files updated silently, no spurious overwrites of user content, new-version files propagated, config stamp updated. | ✅ Done |
| 14 | Validation — Cascade STEAM | Run `npm run adopt -- --dest <cascade-steam-path> --mode full` against the Cascade STEAM vault (structurally different repo). Any friction discovered is filed as a bug before this plan closes. | ✅ Done |

## Testing Plan

### Step Verification

- [x] Step 1: `npm run hook:install` on test vault — hook resolves `js-yaml` via baked absolute path; self-install integrity check passes
- [x] Step 2: `.claude/skills/endsession.md` created; `/endsession` invocable from Claude Code
- [x] Step 3: `npm run init` produces `.docwright/manifest.json` with all created files + `adopt_version` stamp
- [x] Step 4: `npm run open -- --vault <path>` starts Web UI pointing at target; writes nothing to target
- [x] Step 5: `npm run adopt -- --mode lightweight` creates exactly the lightweight file set; manifest correct
- [x] Step 6: Full mode creates dir structure, appends .gitignore (no duplicates), installs hook
- [x] Step 7a: All `.opencode/skills/` SKILL.md files tagged with `distributable:` — 7 true, 5 false
- [x] Step 7: Full adoption bridges 4 Claude Code skills + 7 distributable OpenCode skills to vault
- [x] Step 8: `--upgrade` refreshes 10 files silently (0 user-modified prompts on fresh vault)
- [x] Step 9: `.claude/skills/docwright-adopt-vault.md` created; covers all three modes
- [x] Step 10: Health check added to `docwright-session-start` (OpenCode) and `status.md` (Claude Code)
- [x] Step 11: `docs/vault-portability.md` written covering all specified topics
- [x] Step 12: DAFO Infrastructure Vault — full adoption clean, no manual steps
- [x] Step 13: DAFO upgrade — 10 files refreshed, 0 user-modified prompts
- [x] Step 14: bms-ai-cluster (Cascade STEAM surrogate) — adopted cleanly (Ansible infra repo, no package.json, 4 Claude skills + 7 OpenCode skills bridged, hook + smoke test passed)

### Integration & Regression

- [ ] `npm test` passes without modification after all steps
- [ ] `npm run typecheck` compiles cleanly
- [x] `npm run hook:install` self-install still works — VAULT_TARGET guard verified, integrity check passes
- [x] `npm run init` on new empty vault still works after Step 3 changes
- [x] Existing adopted vaults continue to work — DAFO adoption successful

### Gate Criteria

- [x] `tests_defined: true` in frontmatter
- [x] Steps 12, 13, 14 complete — DAFO (fresh + upgrade) + bms-ai-cluster all passed
- [x] No friction from validation milestones requiring bug filing
- [ ] Human reviewer has verified step outcomes above
- [x] `docs/vault-portability.md` exists and covers all specified topics

## Rollback Procedures

| Scenario | Rollback |
| --- | --- |
| `install-hooks.sh` sed change breaks self-install | Revert the sed line; DocWright's self-install uses a different code path (no `VAULT_TARGET`) — can add a guard to skip substitution for self-installs |
| `adopt-vault.ts` writes bad config to a vault | Delete the files it wrote (listed in `.docwright/manifest.json`); re-run `adopt --mode lightweight` once fixed |
| `init.ts` manifest change breaks existing tests | The manifest is additive — existing `init.ts` tests check for files created, not for absence of manifest; add manifest assertion to tests rather than rolling back |
| `.claude/skills/endsession.md` causes skill conflicts | Remove the file; update `sync:skills` — skills are opt-in, removal has no side effects |

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| `sed` substitution in install-hooks.sh corrupts hook for self-install (DocWright repo) | Low | High | Gate on `[ -n "$VAULT_TARGET" ]` before applying substitution; self-installs skip it |
| `adopt-vault.ts` appending to `.gitignore` duplicates existing entries | Medium | Low | Check each entry with `grep -qF` before appending |
| Frontmatter audit false positives on non-governed markdown | Medium | Low | Scope audit to profile's document-type roots only; skip files with no frontmatter |
| `--upgrade` hash mismatch on files the user intentionally modified | Expected | Low | By design — user is prompted; skip option always available |
| Gemini CLI `.gemini/` local directory structure changes between CLI versions | Low | Medium | Pin Gemini CLI version in docs; `--upgrade` re-generates from template |
| DAFO vault has content the audit flags as invalid (blocking fresh adoption) | High | Medium | Expected — audit is interactive, human approves each finding before any write |

## Document History

| Date | Change | Author |
| --- | --- | --- |
| 2026-06-17 | Created from bare template — filled by Claude Code based on proposal and session decisions | NetYeti |
| 2026-06-17 | Steps 1–14 + 7a implemented. All validation milestones passed: DAFO fresh adoption, DAFO upgrade (10 files / 0 false prompts), bms-ai-cluster full adoption. Plan ready for human gate review. | NetYeti |