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

### 4. Wire Claude Code skills and hooks into adopted vaults

`adopt-vault.ts` must create two things that `init.ts` currently omits entirely:

**`.claude/settings.json`** — copied or generated from `$DOCWRIGHT_PATH/.claude/settings.json` with `$DOCWRIGHT_PATH` substituted. This wires DocWright's lifecycle hooks (PreToolUse/PostToolUse) into Claude Code sessions opened in the vault.

**`.claude/skills/` symlink or copy** — create a `.claude/skills/` directory in the vault that contains symlinks to every skill file in `$DOCWRIGHT_PATH/.claude/skills/`. This makes `/critique-plan`, `/status`, and any future Claude Code skills discoverable from the vault without maintaining separate copies.

Example structure after adoption:
```
vault/
  .claude/
    settings.json       ← generated from $DOCWRIGHT_PATH template
    skills/
      endsession.md     ← symlink → $DOCWRIGHT_PATH/.claude/skills/endsession.md
      critique-plan.md  ← symlink → $DOCWRIGHT_PATH/.claude/skills/critique-plan.md
      status.md         ← symlink → $DOCWRIGHT_PATH/.claude/skills/status.md
```

Add `.claude/skills/` to the vault's `.gitignore` — symlinks to a local installation path should not be committed. The skills themselves live under version control in DocWright; the vault just needs to point at them.

### 5. Add `.claude/skills/endsession.md` to DocWright itself

This is a DocWright-side gap independent of vault adoption. `/endsession` currently only exists as an OpenCode skill (`.opencode/skills/endsession/SKILL.md`). It has no Claude Code equivalent, so it is unreachable from Claude Code in _any_ repo — including DocWright itself.

Create `.claude/skills/endsession.md` that mirrors the OpenCode skill's steps, adapted for Claude Code's skill invocation pattern (inline execution via the Skill tool rather than OpenCode's agent dispatch). This is a prerequisite for the vault skill bridge to be complete — there is no point symlinking a skill that doesn't exist on the Claude Code side.

### 6. Document `node_modules` symlink requirement in `docs/vault-portability.md`

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
