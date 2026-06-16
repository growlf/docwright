---
title: "Script + Skill: docwright-adopt — Initialize DocWright on Existing Vaults"
author: NetYeti
created: 2026-06-16
tags:
  - tooling
  - init
  - adoption
  - skill
  - existing-vault
complexity: medium
estimated_effort: M
approved: false
created_by: "NetYeti@phoenix"
assigned_to: ""
related_to:
  - proposals/approved/sub-plan-docwright-init-scaffold.md
  - plans/phase-vault-portability-pilot.md
---

## Problem

`docwright init` refuses to run on non-empty directories. This is correct behaviour for new vault creation, but it completely blocks the most common real-world scenario: adopting an existing project directory, git repo, or Obsidian vault into DocWright governance.

The first unplanned real-world pilot (DAFO Infrastructure Vault, 2026-06-16) required a 15+ step manual process to accomplish what `docwright init` does automatically for empty directories. That manual process revealed several undocumented sharp edges:

1. Pre-commit hook requires `js-yaml` resolvable from vault's `node_modules` — no existing vault has this; requires a `node_modules` symlink to `$DOCWRIGHT_PATH/node_modules`
2. Existing markdown files may have incompatible frontmatter (`status: pending`, missing `title`, missing `created_by`) that cause hook failures on first commit
3. Non-proposal markdown in `proposals/` (cover letters, SOW docs) must carry full proposal frontmatter or the hook rejects them
4. Sensitive content in existing repos needs a careful gitignore before the first `git add` — there is no guidance for this
5. `.docwright/.gitignore` silently prevents `config.json` from staging — confusing for first-time adopters who expect all DocWright config to be committed
6. **DocWright skills are not available in adopted vaults.** The `.claude/skills/` and `.opencode/skills/` directories live inside `$DOCWRIGHT_PATH`, not in the vault. An adopted vault has no `.claude/settings.json` at all, so DocWright's hooks don't run and no skills (including `/endsession`) are discoverable by Claude Code. The user had to manually redirect Claude to use the DAFO vault for `/endsession` because the skill was invisible from that working directory.
7. **`/endsession` does not exist as a Claude Code skill at all.** It is defined only under `.opencode/skills/endsession/` (for OpenCode/BigPickle). There is no `.claude/skills/endsession.md` in DocWright, so it cannot be invoked via Claude Code from _any_ repo — not just adopted vaults.

Without tooling, every new external vault adoption is a re-engineering exercise. The user mentioned wanting to repeat this process across many client repos immediately.

## Pre-condition Bug to Fix First

`init.ts` writes `.mcp.json` with literal `${DOCWRIGHT_PATH}` and `${DOCWRIGHT_VAULT_ROOT}` strings (lines 100–113). MCP clients do not shell-expand env vars in JSON config files — these values are never substituted at runtime. This is a pre-existing bug that `adopt-vault.ts` would inherit. Fix this in `init.ts` before implementing `adopt-vault.ts`. (Bugs-before-features policy: [[policies/core/bugs-before-features.md]].)

## Three Modes of Engagement

Adoption is not a single operation. There are three meaningfully different levels of commitment, and the tooling must support all three rather than forcing every user straight to full adoption:

| Mode | Files written to vault | git workflow changed | Use case |
|------|----------------------|---------------------|---------- |
| **Open** | None (or a gitignored session marker) | No | Browse, evaluate, one-session read — low commitment |
| **Lightweight Adopt** | `.env`, `.mcp.json`, `.claude/settings.json` only | No | MCP tools + Claude Code hooks work; no hook on git commit |
| **Full Adopt** | Full DocWright structure + pre-commit hook | Yes | Permanent: governance lifecycle, frontmatter enforcement, versioned upgrades |

Each mode is idempotent and re-runnable. Open can be escalated to Lightweight, Lightweight to Full, at any time.

## Proposed Solution

### 0. `npm run open` — Transient "Open with DocWright" (Mode 1)

The most common first contact with an existing repo. The Web UI and MCP server already accept `DOCWRIGHT_VAULT_ROOT` as an env var — "Open" is just a thin wrapper that sets it and starts the servers without writing anything to the target directory.

Add to `package.json`:
```json
"open": "tsx scripts/open-vault.ts"
```

`scripts/open-vault.ts`:
- Accepts `--vault /path/to/repo`
- Validates the path exists and is a directory
- Sets `DOCWRIGHT_VAULT_ROOT` and starts `npm run dev` (or `npm run start` in production)
- Writes nothing to the target directory
- Optionally writes a `.dw-session.json` marker to the vault root (gitignored) recording which DocWright install opened it and when — useful for debugging multi-install conflicts

This is the entry point for every new client repo. No commitment, full UI. Can be escalated to Lightweight or Full Adopt at any time.

### 1. `scripts/adopt-vault.ts` — Idempotent adoption script (Modes 2 and 3)

Accepts the same flags as `init.ts` (`--dest`, `--profile`, `--name`, `--docwright-path`) plus:
- `--mode lightweight|full` (default: `full`)
- `--upgrade` — re-runs adoption against an already-adopted vault, updating stale DocWright-managed files

**Idempotency contract:**

On first adoption, the script stamps two things in `.docwright/config.json`:
```json
{
  "schema_version": "1",
  "adopt_version": "0.2.3",
  "adopt_date": "2026-06-16",
  "adopt_mode": "full"
}
```

It also writes `.docwright/manifest.json` — a record of every file created by DocWright adoption, keyed by relative path, value is the SHA-256 of the file content at time of writing:
```json
{
  ".env": "a3f9...",
  ".mcp.json": "b12c...",
  ".claude/settings.json": "d45e...",
  "hooks/pre-commit": "f67a..."
}
```

On `--upgrade`:
1. Read `.docwright/manifest.json`
2. For each managed file: hash the current on-disk content
3. If hash matches manifest → file is unmodified → overwrite silently with the current DocWright version's template
4. If hash differs → file was user-modified → show a diff and prompt: skip / overwrite / merge
5. For files in the manifest that no longer exist in DocWright's templates → warn, do not delete
6. Update `adopt_version` and `adopt_date` in `config.json` on success

This delegates schema migrations to `vault-migrate.ts` (which already handles `schema_version` bumps) and limits `adopt-vault.ts` to DocWright-managed infrastructure files.

**Mode: `lightweight`**

Writes only:
- `.env` (identity + paths)
- `.mcp.json` (MCP server config — with actual resolved paths, not literal `${...}` strings)
- `.claude/settings.json` (hooks wiring)
- `.docwright/config.json` (stamp)
- `.docwright/manifest.json` (for future upgrades)

Does not: create directory structure, install pre-commit hook, run frontmatter audit.

**Mode: `full`** (superset of lightweight, adds):
- Does **not** refuse non-empty directories
- Creates missing DocWright directories (`proposals/`, `plans/`, `docs/`, `.docwright/`)
- Profile-aware frontmatter audit (see §3)
- Protective `.gitignore` generation (interactive)
- `js-yaml` dependency installation (see §6)
- Pre-commit hook installation via `npm run hook:install -- --vault <path>`

### 2. `npm run adopt` entry point

Add to `package.json`:
```json
"adopt": "tsx scripts/adopt-vault.ts"
```

Usage:
```sh
npm run adopt -- --dest /path/to/existing-vault --profile org-operations --mode full
npm run adopt -- --dest /path/to/vault --upgrade   # idempotent re-run / version update
```

### 3. Profile-aware frontmatter audit

The audit must resolve the vault's active profile **before** scanning. `profile.json` at vault root specifies the profile; valid `status` values come from that profile's `profile.json` manifest. Without this, the audit produces false positives (flagging valid status values from a different profile) or false negatives (accepting invalid ones).

Audit scope: all markdown files under directories declared in the profile as document-type roots (e.g., `proposals/`, `plans/`). Not blindly `**/*.md` — that would catch README files and other non-governed docs.

Findings are presented to the human for approval before any file is written. Never auto-normalise frontmatter.

### 4. Claude Code skills bridge — copy + hash, not symlink

`adopt-vault.ts` creates a `.claude/skills/` directory in the vault containing **copies** (not symlinks) of every skill file from `$DOCWRIGHT_PATH/.claude/skills/`. Each copied file is recorded in `.docwright/manifest.json` with its source hash.

Why copies, not symlinks:
- Symlinks break when DocWright moves, when the vault is opened on another machine, or in CI environments where the install path differs
- Copies are portable — the vault works standalone
- Upgrade (`--upgrade`) replaces stale copies using the same manifest-diff algorithm

Add `.claude/skills/` to the vault's `.gitignore`. The skills are DocWright infrastructure, not vault content.

**`.claude/settings.json`** is also generated (not symlinked) from `$DOCWRIGHT_PATH/.claude/settings.json` with `DOCWRIGHT_PATH` resolved to the actual installation path. Recorded in manifest for upgrade tracking.

Example structure after full adoption:
```
vault/
  .claude/
    settings.json       ← generated, recorded in manifest
    skills/
      endsession.md     ← copy of $DOCWRIGHT_PATH/.claude/skills/endsession.md
      critique-plan.md
      status.md
  .docwright/
    config.json         ← schema_version + adopt_version + adopt_date
    manifest.json       ← file → source-hash map (DocWright-managed files only)
```

### 5. Add `.claude/skills/endsession.md` to DocWright itself

This is a DocWright-side gap independent of vault adoption. `/endsession` currently only exists as an OpenCode skill (`.opencode/skills/endsession/SKILL.md`). It has no Claude Code equivalent, so it is unreachable from Claude Code in _any_ repo — including DocWright itself.

Create `.claude/skills/endsession.md` that mirrors the OpenCode skill's steps, adapted for Claude Code's skill invocation pattern. This is a prerequisite for the vault skill bridge to be complete — the skill must exist in DocWright before it can be distributed to adopted vaults.

### 6. `js-yaml` hook dependency — proper fix, symlink as interim

The `node_modules` symlink from the original proposal is a workable interim, but the correct fix is to make `js-yaml` available without coupling the vault to DocWright's entire dependency tree. Options in preference order:

1. **Proper fix (Phase 3):** Rewrite the pre-commit hook to use a bundled single-file version of `js-yaml` (via `esbuild --bundle`). The hook becomes self-contained, no `node_modules` dependency at all.
2. **Interim fix (now):** Create the symlink `$VAULT_ROOT/node_modules → $DOCWRIGHT_PATH/node_modules` as the script currently proposes, but document the security implication explicitly: the vault hook can resolve any package from DocWright's full dependency tree. Add `node_modules` to the vault's `.gitignore`.

Security note: the symlink exposes the vault hook to DocWright's transitive deps. If DocWright has a compromised package in `node_modules`, the hook in every adopted vault is reachable. This is acceptable for a controlled local install but unacceptable for a packaged/distributed version of DocWright. Track as a known limitation until the bundled hook lands.

### 7. Session-start adoption health check

The `docwright-session-start` skill must read `.docwright/config.json` and compare `adopt_version` against the current DocWright installation version (from DocWright's `package.json`). If they differ, emit a non-blocking advisory at session start:

```
ℹ  This vault was adopted with DocWright 0.2.1. Current installation is 0.2.3.
   Run `npm run adopt -- --dest . --upgrade` to update hooks and skills.
```

This is the automatic "check for updates" described in the requirements. It requires no network access — the comparison is local filesystem only.

### 8. `.claude/skills/docwright-adopt-vault.md` — Claude Code skill

A skill that wraps the full workflow for interactive use:

**Detection:** User says "adopt this vault", "set up DocWright on this repo", "open this folder with DocWright", or points at an existing directory.

**Process:**
1. Determine mode: does the user want Open, Lightweight, or Full? Default to Open for first contact.
2. For Open: run `npm run open -- --vault <path>` from `$DOCWRIGHT_PATH`, confirm servers start
3. For Lightweight/Full: run `npm run adopt -- --dest <path> --mode <mode>` from `$DOCWRIGHT_PATH`
4. Present frontmatter audit findings (Full mode only) for human approval before writing
5. Present proposed `.gitignore` additions for human review before writing
6. Confirm pre-commit validation passes (Full mode only) before proceeding
7. Offer to create a GitHub/Forgejo repo via `gh repo create`
8. Guide the user through staging only DocWright-managed files for the initial commit

For re-adoption / upgrade runs: detect existing `adopt_version` in `.docwright/config.json` and route to `--upgrade` automatically.

### 9. Document the full adoption model in `docs/vault-portability.md`

Covers:
- The three modes and when to use each
- The manifest-based upgrade contract
- The `js-yaml` symlink security note and the bundled-hook roadmap
- How to move a vault to a new machine (update `DOCWRIGHT_PATH` in `.env`, re-run `--upgrade`)
- How to open a vault in CI (use Open mode / set `DOCWRIGHT_VAULT_ROOT` env var, no hook install)

## Out of Scope

| Idea | Why deferred |
|------|-------------|
| Auto-migrate all frontmatter without interactive review | Frontmatter changes are governance mutations — human must approve per DocWright's core principle |
| VS Code / IDE extension wizard for adoption | Deferred to Phase 4 (VSCodium extension) |
| Detecting and handling non-Obsidian vault types (plain markdown, Logseq, etc.) | Phase 3 scope is Obsidian + generic markdown; specialised adapters are follow-on work |
| `--dry-run` flag showing what would change without writing | Useful but not blocking; add in iteration |
| Bundled self-contained hook (esbuild) | Proper fix for js-yaml dep; tracked as Phase 3 follow-on |

## Validation Milestones

This proposal is not complete until:

1. **DAFO Infrastructure Vault** — re-adopted using `adopt-vault.ts --mode full` without manual steps (regression test against the original pilot)
2. **Cascade STEAM vault** — adopted using the same script on a second real repo without manual intervention; any new friction is filed as bugs before the plan closes

Both adoptions must pass the pre-commit validation gate without manual frontmatter fixes not performed by the script's guided audit.

## Real-World Validation

This proposal was derived directly from the DAFO Infrastructure Vault adoption session (2026-06-16). The complete manual process that `adopt-vault.ts` would automate is documented in `plans/phase-vault-portability-pilot.md` under "Real-World Pilot: DAFO Infrastructure Vault."

## Related

- [[plans/phase-vault-portability-pilot.md]] — Phase 3 plan; DAFO pilot findings documented there
- [[proposals/approved/sub-plan-docwright-init-scaffold.md]] — the `init.ts` script this extends
- [[proposals/sub-plan-cascade-steam-early-access.md]] — next planned vault adoption; required validation milestone
- [[scripts/vault-migrate.ts]] — existing schema migration script; `adopt --upgrade` delegates schema bumps to this
- [[policies/core/bugs-before-features.md]] — `.mcp.json` env-var bug must be fixed before adopt-vault.ts ships
