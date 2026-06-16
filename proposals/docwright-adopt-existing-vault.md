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

Without tooling, every new external vault adoption is a re-engineering exercise. The user mentioned wanting to repeat this process across many client repos immediately.

## Proposed Solution

### 1. `scripts/adopt-vault.ts` — new script, mirrors `init.ts` for existing directories

Accepts the same flags as `init.ts` (`--dest`, `--profile`, `--name`, `--docwright-path`) but:
- Does **not** refuse non-empty directories
- Skips creating files that already exist (same guard pattern as `init.ts` already uses for individual files)
- Adds an interactive frontmatter audit: scans `proposals/**/*.md` for invalid status values, missing required fields, and offers to normalise them
- Creates `node_modules` symlink to `$DOCWRIGHT_PATH/node_modules` if no `node_modules` exists at vault root (makes `js-yaml` available to hook without requiring `npm install` in the vault)
- Generates a **protective `.gitignore`** interactively: lists existing top-level directories and files, asks which are safe to commit, gitignores the rest. Outputs a commented, human-readable `.gitignore` rather than a blanket `*`

### 2. `npm run adopt` entry point

Add to `package.json`:
```json
"adopt": "tsx scripts/adopt-vault.ts"
```

Usage: `npm run adopt -- --dest /path/to/existing-vault --profile org-operations`

### 3. `.claude/skills/docwright-adopt-vault.md` — Claude Code skill

A skill that wraps the script for interactive use in a Claude Code session. Follows the established pattern of "skills are thin wrappers over standalone scripts":

**Detection:** User says "adopt this vault", "set up DocWright on this repo", "initialize DocWright here", or points at an existing directory.

**Process:**
1. Run `npm run adopt -- --dest <path>` from `$DOCWRIGHT_PATH`
2. Present the interactive frontmatter audit findings for human approval before writing
3. Present the proposed `.gitignore` for human review before writing
4. Run `npm run hook:install -- --vault <path>`
5. Offer to create a GitHub repo via `gh repo create`
6. Guide the user through staging only DocWright-managed files for the initial commit
7. Confirm pre-commit validation passes before pushing

The skill captures the full DAFO adoption process as a repeatable, guided flow — human stays in control of what gets committed.

### 4. Document `node_modules` symlink requirement in `docs/vault-portability.md`

The `js-yaml` hook dependency is the most surprising sharp edge. Add to the architecture boundary doc:
> Vaults do not have their own `node_modules`. The pre-commit hook resolves `js-yaml` from the vault's `node_modules` directory. If none exists, `adopt-vault.ts` creates a symlink: `$VAULT_ROOT/node_modules → $DOCWRIGHT_PATH/node_modules`. Add `node_modules` to the vault's `.gitignore`.

## Out of Scope

| Idea | Why deferred |
|------|-------------|
| Auto-migrate all frontmatter without interactive review | Frontmatter changes are governance mutations — human must approve per DocWright's core principle |
| VS Code / IDE extension wizard for adoption | Deferred to Phase 4 (VSCodium extension) |
| Detecting and handling non-Obsidian vault types (plain markdown, Logseq, etc.) | Phase 3 scope is Obsidian + generic markdown; specialised adapters are follow-on work |
| `--dry-run` flag showing what would change without writing | Useful but not blocking; add in iteration |

## Real-World Validation

This proposal was derived directly from the DAFO Infrastructure Vault adoption session (2026-06-16). The complete manual process that `adopt-vault.ts` would automate is documented in `plans/phase-vault-portability-pilot.md` under "Real-World Pilot: DAFO Infrastructure Vault."

The next planned test is the Cascade STEAM vault adoption in the same session — this will either validate the manual process is reproducible or surface additional gaps.

## Related

- [[plans/phase-vault-portability-pilot.md]] — Phase 3 plan; DAFO pilot findings documented there
- [[proposals/approved/sub-plan-docwright-init-scaffold.md]] — the `init.ts` script this extends
- [[proposals/sub-plan-cascade-steam-early-access.md]] — next planned vault adoption; direct test case
