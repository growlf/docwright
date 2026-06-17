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
created_by: NetYeti@phoenix
assigned_to: ""
related_to:
  - proposals/approved/sub-plan-docwright-init-scaffold.md
  - plans/phase-vault-portability-pilot.md
_path: proposals/docwright-adopt-existing-vault.md
---
## Problem

`docwright init` refuses to run on non-empty directories. This is correct behaviour for new vault creation, but it completely blocks the most common real-world scenario: adopting an existing project directory, git repo, or Obsidian vault into DocWright governance.

The first unplanned real-world pilot (DAFO Infrastructure Vault, 2026-06-16) required a 15+ step manual process to accomplish what `docwright init` does automatically for empty directories. That manual process revealed several undocumented sharp edges:

1.  Pre-commit hook requires `js-yaml` resolvable from vault's `node_modules` — no existing vault has this, and adding a symlink or installing into an existing `node_modules` is unsafe (see §6)
2.  Existing markdown files may have incompatible frontmatter (`status: pending`, missing `title`, missing `created_by`) that cause hook failures on first commit
3.  Non-proposal markdown in `proposals/` (cover letters, SOW docs) must carry full proposal frontmatter or the hook rejects them
4.  Sensitive content in existing repos needs a careful gitignore before the first `git add` — there is no guidance for this
5.  `.docwright/.gitignore` silently prevents `config.json` from staging — confusing for first-time adopters who expect all DocWright config to be committed
6.  **DocWright skills are not available in adopted vaults.** The `.claude/skills/`, `.opencode/skills/`, and any Gemini-equivalent directories live inside `$DOCWRIGHT_PATH`, not in the vault. An adopted vault has no `.claude/settings.json` at all, so DocWright's hooks don't run and no skills (including `/endsession`) are discoverable by Claude Code. The user had to manually redirect Claude to use the DAFO vault for `/endsession` because the skill was invisible from that working directory.
7.  **`/endsession` does not exist as a Claude Code skill at all.** It is defined only under `.opencode/skills/endsession/` (for OpenCode/BigPickle). There is no `.claude/skills/endsession.md` in DocWright, so it cannot be invoked via Claude Code from _any_ repo — not just adopted vaults.

Without tooling, every new external vault adoption is a re-engineering exercise. The user mentioned wanting to repeat this process across many client repos immediately.

## Environment Variable Contract

All DocWright scripts require `DOCWRIGHT_PATH` and `DOCWRIGHT_VAULT_ROOT` to be set in the environment. The canonical mechanism is `direnv` — which is already installed (v2.37.1) and hooked into the user's shell (`eval "$(direnv hook zsh)"` in `.zshrc`).

The `.mcp.json` files deliberately use `${DOCWRIGHT_PATH}` and `${DOCWRIGHT_VAULT_ROOT}` syntax. This is correct — `direnv` loads the vault's `.env` into the process environment before Claude Code launches, so these vars expand correctly at runtime.

**Required setup (one-time per vault):** `direnv allow` in the vault root after adoption. Every script validates that required env vars are present and halts with a clear diagnostic if they are absent:

```
✗ DOCWRIGHT_PATH is not set. Run `direnv allow` in the vault root,
  or export DOCWRIGHT_PATH=/path/to/docwright before running this script.
```

Scripts never proceed silently with unresolved env vars. This is the fail-hard invariant.

## Three Modes of Engagement

Adoption is not a single operation. There are three meaningfully different levels of commitment, and the tooling must support all three:

| Mode | Files written to vault | git workflow changed | Use case |
| --- | --- | --- | --- |
| **Open** | None (or a gitignored session marker) | No | Browse, evaluate, one-session read — zero commitment |
| **Lightweight Adopt** | `.env`, `.envrc`, `.mcp.json`, `.gemini/settings.json`, AI config files | No | MCP tools + all AI hooks work; no git commit enforcement |
| **Full Adopt** | Everything above + DocWright directory structure + pre-commit hook | Yes | Permanent: governance lifecycle, frontmatter enforcement, versioned upgrades |

Each mode is idempotent and re-runnable. Open escalates to Lightweight by running `adopt --mode lightweight`. Lightweight escalates to Full by running `adopt --mode full`. The `--upgrade` flag re-runs the current mode against an already-adopted vault.

## Proposed Solution

### 0\. `npm run open` — Transient "Open with DocWright" (Mode 1)

The most common first contact with an existing repo. The Web UI server already reads `process.env.DOCWRIGHT_ROOT` in every API route — "Open" is a thin wrapper that sets it and starts the servers without writing anything to the target directory.

Add to `package.json`:

```json
"open": "tsx scripts/open-vault.ts"
```

`scripts/open-vault.ts`:

*   Accepts `--vault /path/to/repo`
*   Validates env vars are present (fail-hard)
*   Validates the path exists and is a directory
*   Sets `DOCWRIGHT_ROOT=<path>` and starts `npm run dev` (or `npm run start` in production)
*   Writes nothing to the target directory
*   Optionally writes a `.dw-session.json` marker (gitignored) recording which DocWright install opened it and when — useful for diagnosing multi-install conflicts

Note: the Web UI uses `DOCWRIGHT_ROOT` (not `DOCWRIGHT_VAULT_ROOT`) as the env var for all file API routes. These are two distinct vars — `DOCWRIGHT_ROOT` drives the Web UI, `DOCWRIGHT_VAULT_ROOT` drives the MCP server. Both are set in the vault's `.env`.

This is the entry point for every new client repo. No commitment, full UI. Can be escalated to Lightweight or Full at any time.

### 1\. `scripts/adopt-vault.ts` — Idempotent adoption script (Modes 2 and 3)

Accepts the same flags as `init.ts` (`--dest`, `--profile`, `--name`, `--docwright-path`) plus:

*   `--mode lightweight|full` (default: `full`)
*   `--upgrade` — re-runs adoption against an already-adopted vault, updating stale DocWright-managed files

**Env var validation (fail-hard):** The script checks that `DOCWRIGHT_PATH` is set and points to a valid DocWright installation before doing anything else. If not set, halt with the standard diagnostic.

**Idempotency contract:**

On first adoption, the script stamps `.docwright/config.json`:

```json
{
  "schema_version": "1",
  "adopt_version": "0.2.3",
  "adopt_date": "2026-06-16",
  "adopt_mode": "full"
}
```

`adopt_version` is read from `$DOCWRIGHT_PATH/package.json` at runtime.

It also writes `.docwright/manifest.json` — a record of every file written by DocWright adoption, keyed by relative vault path, value is SHA-256 of content at time of writing:

```json
{
  ".env": "a3f9...",
  ".envrc": "b00c...",
  ".mcp.json": "b12c...",
  ".gemini/settings.json": "c23d...",
  ".claude/settings.json": "d45e...",
  ".claude/skills/endsession.md": "e56f...",
  ".opencode/skills/endsession/SKILL.md": "f67a...",
  "hooks/pre-commit": "g78b..."
}
```

On `--upgrade`:

1.  Read `.docwright/manifest.json`
2.  For each file in the manifest: hash the current on-disk content
3.  If hash matches manifest → user has not modified it → overwrite silently with the current DocWright version's template
4.  If hash differs → user-modified → show a diff and prompt: skip / overwrite / merge
5.  For files in the manifest that no longer exist in DocWright's templates → warn, do not delete
6.  **For files in the current DocWright templates NOT present in the manifest → add them as new managed files.** This is the new-version propagation step: when DocWright 0.3.0 adds a new skill or config file, `--upgrade` delivers it to all existing adopted vaults.
7.  Update `adopt_version`, `adopt_date`, and `adopt_mode` in `config.json` on success

Schema version migrations are delegated to `vault-migrate.ts` — `adopt --upgrade` calls it when `schema_version` in the vault is behind the current DocWright version.

**Mode: `lightweight`**

Writes only:

*   `.env` (identity + paths)
*   `.envrc` (one line: `dotenv`) — enables direnv auto-loading
*   `.mcp.json` (MCP server config with `${VAR}` syntax — correct when direnv is active)
*   `.gemini/settings.json` (Gemini CLI MCP config)
*   `.claude/settings.json` (Claude Code hooks wiring)
*   `.opencode/` config if applicable
*   `.docwright/config.json` (stamp)
*   `.docwright/manifest.json` (for future upgrades)

Does not: create directory structure, install pre-commit hook, run frontmatter audit.

**Mode: `full`** (superset of lightweight, adds):

*   Creates missing DocWright directories (`proposals/`, `plans/`, `docs/`, `.docwright/`)
*   Profile-aware frontmatter audit (see §3) — runs after `profile.json` is written
*   Protective `.gitignore` additions (interactive, appended to existing `.gitignore`, not overwritten)
*   Pre-commit hook installation via `npm run hook:install -- --vault <path>` (see §6)
*   All three AI surface skill bridges (see §4)

### 2\. `npm run adopt` entry point

Add to `package.json`:

```json
"adopt": "tsx scripts/adopt-vault.ts"
```

Usage:

```sh
npm run adopt -- --dest /path/to/existing-vault --profile org-operations --mode full
npm run adopt -- --dest /path/to/vault --upgrade   # idempotent re-run / version update
```

### 3\. Profile-aware frontmatter audit

The audit runs after `profile.json` is written (Full mode writes it as part of directory structure creation). It resolves the vault's active profile from `profile.json` before scanning — valid `status` values come from that profile's `profile.json` states manifest. Without this, the audit would produce false positives or false negatives against a different profile's vocabulary.

Audit scope: only markdown files under directories declared in the active profile as document-type roots (e.g., `proposals/`, `plans/`). Not `**/*.md` — that would catch README files and other non-governed docs.

If `profile.json` cannot be resolved or the profile has no document-type roots defined, the audit emits a warning and skips rather than failing.

Findings are presented to the human for approval before any file is written. Never auto-normalise frontmatter.

### 4\. Three-surface AI skills bridge — copy + hash

`adopt-vault.ts` bridges DocWright's AI skill files into the vault for all three supported AI surfaces: Claude Code, OpenCode/BigPickle, and Gemini CLI. Each copied file is recorded in `.docwright/manifest.json` with its source hash so `--upgrade` can detect and replace stale copies.

**Why copies, not symlinks:** Symlinks break when DocWright moves, when the vault is opened on another machine, or in CI. Copies are portable — the vault works standalone on any machine. `--upgrade` handles refresh.

**Claude Code bridge:**

Copies every file from `$DOCWRIGHT_PATH/.claude/skills/` into vault `.claude/skills/`. Generates `.claude/settings.json` from DocWright's template.

**OpenCode/BigPickle bridge:**

Copies every skill directory from `$DOCWRIGHT_PATH/.opencode/skills/` into vault `.opencode/skills/`. Includes full subdirectory contents (`SKILL.md` + any supporting files).

**Gemini CLI bridge:**

The Gemini CLI reads:

*   `GEMINI.md` at vault root — project-level context (equivalent to `CLAUDE.md`)
*   `.gemini/settings.json` — project-level settings including MCP server config
*   `.gemini/agents/` — project-level agent/skill definitions (equivalent to `.claude/skills/`)

`adopt-vault.ts` writes:

*   `GEMINI.md` generated from `$DOCWRIGHT_PATH/src/profiles/<profile>/gemini-instructions.md` template. If `GEMINI.md` already exists in the vault, append DocWright's context block rather than overwriting.
*   `.gemini/settings.json` with MCP server config pointing at `$DOCWRIGHT_PATH/dist/mcp/server.js`.
*   `.gemini/agents/` populated from `$DOCWRIGHT_PATH/.gemini/agents/` once DocWright has Gemini-format skill files (follow-on work; see Out of Scope).

Add `.claude/skills/`, `.opencode/skills/`, and `.gemini/agents/` to the vault's `.gitignore` additions (appended, not overwritten — see §1 on `.gitignore` handling).

Example structure after full adoption:

```
vault/
  GEMINI.md              ← generated/appended, recorded in manifest
  .claude/
    settings.json        ← generated, recorded in manifest
    skills/
      endsession.md      ← copy of $DOCWRIGHT_PATH/.claude/skills/endsession.md
      critique-plan.md
      status.md
  .opencode/
    skills/
      endsession/        ← copy of $DOCWRIGHT_PATH/.opencode/skills/endsession/
        SKILL.md
      docwright-git/
        SKILL.md
      ...
  .gemini/
    settings.json        ← generated, recorded in manifest
    agents/              ← populated once DW has Gemini skill files
  .docwright/
    config.json          ← schema_version + adopt_version + adopt_date + adopt_mode
    manifest.json        ← file → source-hash map (all DocWright-managed files)
```

### 5\. Add `.claude/skills/endsession.md` to DocWright itself

This is a DocWright-side gap independent of vault adoption. `/endsession` currently exists only as an OpenCode skill (`.opencode/skills/endsession/SKILL.md`). It has no Claude Code equivalent, so it is unreachable from Claude Code in _any_ repo — including DocWright itself.

Create `.claude/skills/endsession.md` adapted for Claude Code's skill invocation pattern. This is a prerequisite for the vault skill bridge to be complete — the skill must exist in DocWright before it can be distributed to adopted vaults.

### 6\. `js-yaml` hook dependency — bake path at install time

The pre-commit hook calls `js-yaml` via inline `node -e` one-liners (lines 83 and 202–210 of `pre-commit.sh`). Node resolves `require('js-yaml')` from `process.cwd()` — the vault root. No existing vault has `js-yaml` in its `node_modules`.

**The fix is in `install-hooks.sh`, not in `adopt-vault.ts`.**

The hook installer already knows `DOCWRIGHT_PATH` and already generates a customized copy of `pre-commit.sh` into the vault's `.git/hooks/`. Change the copy step to substitute the require path at install time:

```bash
# Replace the copy line in install-hooks.sh:
sed "s|require('js-yaml')|require('$DOCWRIGHT_PATH/node_modules/js-yaml')|g; \
     s|require(\"js-yaml\")|require('$DOCWRIGHT_PATH/node_modules/js-yaml')|g" \
  "$SOURCE_HOOK" > "$HOOK_TARGET"
chmod +x "$HOOK_TARGET"
```

The installed hook in the vault gets an absolute require path baked in. No `node_modules` in the vault needed. No symlink. Works regardless of whether the vault is a Node project. Breaks only if DocWright moves — but re-running `hook:install` (or `adopt --upgrade`) recovers it.

**Do not modify the vault's existing `node_modules`.** Running `npm install` in a foreign vault risks modifying lockfiles, getting wiped by `npm ci`, and creating invisible side effects for the vault owner.

This fix must land in `install-hooks.sh` before `adopt-vault.ts` ships (bugs-before-features: \[\[policies/core/bugs-before-features.md\]\]).

### 7\. `.gitignore` handling — append, never overwrite

Existing repos almost certainly have a `.gitignore`. `adopt-vault.ts` appends a clearly-marked DocWright block to the existing file rather than creating or overwriting it. If no `.gitignore` exists, create one.

```
# DocWright — managed entries (added by adopt-vault.ts)
.env
.dw-session.json
node_modules
.claude/skills/
.opencode/skills/
.gemini/agents/
```

The script checks for each entry before appending to avoid duplicates. It presents the proposed additions for human review before writing (same interactive pattern as frontmatter audit).

### 8\. `init.ts` also needs manifest + stamp

`init.ts` (used for new empty vaults) must also write `.docwright/manifest.json` and stamp `adopt_version` in `config.json`. Without this, new vaults created with `init.ts` have no manifest baseline and cannot use `adopt --upgrade`. The manifest for a fresh `init.ts` vault records all files it writes, same as `adopt-vault.ts`.

This change lands in `init.ts` alongside or before `adopt-vault.ts`.

### 9\. `.envrc` — direnv auto-loading

`adopt-vault.ts` writes a one-line `.envrc` at the vault root:

```
dotenv
```

This is the same pattern already in use at `~/Projects/bms-ai-cluster/.envrc`. When the user enters the vault directory, `direnv` loads `.env` into the shell environment, making `DOCWRIGHT_PATH` and `DOCWRIGHT_VAULT_ROOT` available to all tools — Claude Code, Gemini CLI, the Web UI server, and `npm run` scripts.

`adopt-vault.ts` outputs a reminder after writing `.envrc`:

```
  ✓ .envrc (direnv auto-load)
  → Run `direnv allow` in the vault root to activate.
```

`.envrc` is recorded in the manifest and is a managed file (upgrading DocWright does not change it, but it's tracked for completeness).

### 10\. Session-start adoption health check

The `docwright-session-start` skill reads `.docwright/config.json` and compares `adopt_version` against the current DocWright installation version (from `$DOCWRIGHT_PATH/package.json`). If they differ and `.docwright/config.json` exists, emit a non-blocking advisory at session start:

```
ℹ  This vault was adopted with DocWright 0.2.1. Current installation is 0.2.3.
   Run `npm run adopt -- --dest . --upgrade` to update hooks and skills.
```

If `.docwright/config.json` does not exist (vault is DocWright itself, or was never adopted), the check is silently skipped.

### 11\. `.claude/skills/docwright-adopt-vault.md` — Claude Code skill

**Detection:** User says "adopt this vault", "set up DocWright on this repo", "open this folder with DocWright", or points at an existing directory.

**Process:**

1.  Determine mode: Open, Lightweight, or Full? Default to Open for first contact. Detect `adopt_version` in `.docwright/config.json` — if present, route to `--upgrade` automatically.
2.  For Open: run `npm run open -- --vault <path>`, confirm servers start
3.  For Lightweight/Full: run `npm run adopt -- --dest <path> --mode <mode>`
4.  Present frontmatter audit findings (Full mode only) for human approval
5.  Present `.gitignore` additions for human review
6.  Prompt user to run `direnv allow` after `.envrc` is written
7.  Confirm pre-commit validation passes (Full mode only)
8.  Offer to create a GitHub/Forgejo repo via `gh repo create`
9.  Guide staging of only DocWright-managed files for initial commit

### 12\. Document the full adoption model in `docs/vault-portability.md`

Covers:

*   The three modes and when to use each
*   The manifest-based upgrade contract including new-file propagation
*   The `js-yaml` baked-path approach and what to do when DocWright moves (re-run `hook:install` or `adopt --upgrade`)
*   How to move a vault to a new machine: update `DOCWRIGHT_PATH` in `.env`, run `direnv allow`, run `adopt --upgrade` to refresh baked paths in the hook and any absolute-path configs
*   How to open a vault in CI: set `DOCWRIGHT_ROOT` and `DOCWRIGHT_VAULT_ROOT` as CI env vars; no hook install or direnv needed
*   The two distinct env vars: `DOCWRIGHT_ROOT` (Web UI file routes) vs `DOCWRIGHT_VAULT_ROOT` (MCP server)

## Out of Scope

| Idea | Why deferred |
| --- | --- |
| Auto-migrate all frontmatter without interactive review | Frontmatter changes are governance mutations — human must approve per DocWright's core principle |
| VS Code / IDE extension wizard for adoption | Deferred to Phase 4 (VSCodium extension) |
| Detecting and handling non-Obsidian vault types (plain markdown, Logseq, etc.) | Phase 3 scope is Obsidian + generic markdown; specialised adapters are follow-on work |
| `--dry-run` flag showing what would change without writing | Useful but not blocking; add in iteration |
| Bundled self-contained hook (`esbuild --bundle js-yaml` into hook) | Proper long-term fix for js-yaml dep; deferred — baked path is sufficient for Phase 3 |
| Gemini CLI `agents/` skill bridge | Requires DocWright to first ship Gemini-format skill files; follow-on once `.gemini/agents/` format is established |
| OpenCode/BigPickle `.opencode/` config file bridge | OpenCode's project config discovery mechanism needs investigation; skills bridge is covered, config is not |

## Validation Milestones

This proposal is not complete until both adoption code paths are validated against real data:

1.  **DAFO Infrastructure Vault — fresh adoption path:** Branch or copy the DAFO vault, wipe the DocWright infrastructure files (`.env`, `.mcp.json`, `.claude/`, `.opencode/`, `.docwright/`), run `adopt-vault.ts --mode full`. Must complete without manual steps.
    
2.  **DAFO Infrastructure Vault — upgrade path:** Run `adopt-vault.ts --upgrade` on the result of milestone 1 (or on the original manually-adopted vault). Must detect and update stale files, propagate any new-version files, and leave user-modified files untouched.
    
3.  **Cascade STEAM vault — second real repo:** Adopt using the same script on a structurally different repo without manual intervention. Any new friction is filed as bugs before the plan closes.
    

All three must pass the pre-commit validation gate without manual frontmatter fixes not performed by the script's guided audit.

## Real-World Validation

This proposal was derived directly from the DAFO Infrastructure Vault adoption session (2026-06-16). The complete manual process that `adopt-vault.ts` would automate is documented in `plans/phase-vault-portability-pilot.md` under "Real-World Pilot: DAFO Infrastructure Vault."

## Related

*   \[\[plans/phase-vault-portability-pilot.md\]\] — Phase 3 plan; DAFO pilot findings documented there
*   \[\[proposals/approved/sub-plan-docwright-init-scaffold.md\]\] — the `init.ts` script this extends; also needs manifest/stamp changes
*   \[\[proposals/sub-plan-cascade-steam-early-access.md\]\] — next planned vault adoption; required validation milestone
*   \[\[scripts/vault-migrate.ts\]\] — existing schema migration script; `adopt --upgrade` delegates schema bumps to this
*   \[\[scripts/install-hooks.sh\]\] — hook installer; js-yaml baked-path fix lands here before adopt-vault.ts ships
*   \[\[policies/core/bugs-before-features.md\]\] — install-hooks.sh js-yaml fix is a pre-condition