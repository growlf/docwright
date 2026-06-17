# Vault Portability — Architecture Reference

How DocWright manages existing repos, the adoption lifecycle, and the upgrade contract.

## Three Modes of Engagement

| Mode | Command | Files written | git hook | Use case |
|------|---------|--------------|----------|---------|
| **Open** | `npm run open -- --vault <path>` | None (or `.dw-session.json`) | No | Browse/evaluate a repo with the DocWright Web UI. Zero commitment. |
| **Lightweight Adopt** | `npm run adopt -- --dest <path> --mode lightweight` | `.env`, `.envrc`, `.mcp.json`, `.gemini/settings.json`, `.claude/settings.json`, `.docwright/config.json`, `.docwright/manifest.json` | No | MCP tools + all AI surface hooks work; no git commit enforcement. |
| **Full Adopt** | `npm run adopt -- --dest <path> --mode full` | Everything above + DocWright directory structure + pre-commit hook | Yes | Permanent governance: lifecycle, frontmatter enforcement, versioned upgrades. |

Each mode is idempotent and re-runnable. Open can escalate to Lightweight, Lightweight to Full, at any time.

## Environment Variable Contract

All DocWright scripts require `DOCWRIGHT_PATH` in the environment. The canonical mechanism is [direnv](https://direnv.net/):

1. The vault's `.env` sets `DOCWRIGHT_PATH` and `DOCWRIGHT_VAULT_ROOT`.
2. `.envrc` (one line: `dotenv`) tells direnv to load `.env` on directory entry.
3. Run `direnv allow` once per vault.

After this, every tool launched from the vault directory — Claude Code, Gemini CLI, the Web UI server, and `npm run` scripts — has the vars in its environment.

**If direnv is not available:** `export DOCWRIGHT_PATH=/path/to/docwright` before running any script. All scripts fail-hard with a clear diagnostic if `DOCWRIGHT_PATH` is unset.

**Two distinct env vars:**

| Var | Used by | Value |
|-----|---------|-------|
| `DOCWRIGHT_ROOT` | Web UI file API routes (read, write, list, watch, etc.) | Vault root path |
| `DOCWRIGHT_VAULT_ROOT` | MCP server (`--mode vault`) | Vault root path |

Both are set to the same vault root in normal usage. They are separate because the Web UI and MCP server are independent processes.

## The `.mcp.json` `${VAR}` Syntax

`.mcp.json` uses `${DOCWRIGHT_PATH}` and `${DOCWRIGHT_VAULT_ROOT}` placeholders. These are expanded at runtime by Claude Code's MCP client from the process environment — which is populated by direnv. This is correct, not a bug. If the vars are not in the environment, the MCP server will fail to start; fix by running `direnv allow`.

## The Manifest-Based Upgrade Contract

Every adoption writes `.docwright/manifest.json` — a map of `relative-path → SHA-256` for every file DocWright manages. On `--upgrade`:

1. Hash each manifest entry on disk.
2. **Hash matches stored hash** → user has not modified it → overwrite with current DocWright version's template; update manifest entry.
3. **Hash differs** → user-modified → skip with a warning (`--force` to override).
4. **File in current DW templates but not in manifest** → new in this DocWright version → add silently; record in manifest.
5. **File in manifest but no longer in DW templates** → warn; do not delete.
6. Update `adopt_version` and `adopt_date` in `.docwright/config.json`.

The manifest must be committed to the vault repo (`.docwright/.gitignore` has a `!manifest.json` exception). Without a committed manifest, `--upgrade` on a fresh clone cannot distinguish DocWright-managed files from user content.

## The `js-yaml` Hook Dependency

The pre-commit hook calls `js-yaml` via `node -e`. When installed into a vault via `hook:install`, the hook has an absolute require path baked in at install time:

```bash
require('/home/user/Projects/DocWright/node_modules/js-yaml')
```

**If DocWright moves** (new machine, renamed directory):
1. Update `DOCWRIGHT_PATH` in the vault's `.env`.
2. Run `direnv allow`.
3. Run `npm run hook:install -- --vault <vault-path>` or `npm run adopt -- --dest <vault-path> --upgrade`.

The hook in `.git/hooks/` will be reinstalled with the new baked path.

## Moving a Vault to a New Machine

1. Clone the vault repo on the new machine.
2. Clone DocWright on the new machine.
3. Update `DOCWRIGHT_PATH` in the vault's `.env` to the new DocWright path.
4. Run `direnv allow` in the vault root.
5. Run `npm run adopt -- --dest . --upgrade` from DocWright's directory.

The upgrade will refresh `.gemini/settings.json`, `.claude/settings.json`, and the pre-commit hook with paths correct for the new machine. User-modified files are skipped.

## Using DocWright in CI

CI environments don't use direnv. Set env vars explicitly:

```yaml
env:
  DOCWRIGHT_ROOT: ${{ github.workspace }}
  DOCWRIGHT_VAULT_ROOT: ${{ github.workspace }}
  DOCWRIGHT_PATH: /path/to/docwright/install
```

No `hook:install` or `direnv allow` needed in CI. The pre-commit hook runs only on `git commit`, not in CI pipelines that don't commit.

## Adoption Health Check

The `docwright-session-start` skill (OpenCode) and `/status` skill (Claude Code) compare `.docwright/config.json`'s `adopt_version` against the current DocWright installation version at session start. If they differ:

```
ℹ  This vault was adopted with DocWright 0.2.1. Current installation is 0.3.1.
   Run `npm run adopt -- --dest . --upgrade` to update hooks and skills.
```

This check is non-blocking. If `.docwright/config.json` doesn't exist (DocWright repo itself), the check is silently skipped.

## Files That Must Never Be Committed

The vault's `.gitignore` (managed by `adopt-vault.ts`) excludes:

| File/Dir | Reason |
|----------|--------|
| `.env` | Contains identity and absolute paths — machine-local |
| `.gemini/settings.json` | Contains absolute `DOCWRIGHT_PATH` — machine-local |
| `.claude/skills/` | DocWright infrastructure copies — not vault content |
| `.opencode/skills/` | Same |
| `.gemini/agents/` | Same |
| `.dw-session.json` | Transient session marker written by `npm run open` |
| `node_modules` | Standard exclusion |

The `.docwright/manifest.json` **is** committed — it is the upgrade baseline.
