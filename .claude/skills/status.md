# /status skill

Print a plain-text summary of the current vault workflow state.

## When to use

Run at the start of any session to orient before suggesting work.
Also useful when the user asks "where are we?" or "what's left to do?"

## Adoption health check

If `.docwright/config.json` exists, read `adopt_version` and compare to the
DocWright installation version (`$DOCWRIGHT_PATH/package.json`). If they differ,
emit before the status summary:

```
ℹ  This vault was adopted with DocWright <adopt_version>. Current: <current>.
   Run: npm run adopt -- --dest . --upgrade  (from $DOCWRIGHT_PATH)
```

Skip silently if `.docwright/config.json` is absent.

## How to run

```bash
node scripts/vault-status.js
```

For JSON output (useful for piping into other tools):

```bash
node scripts/vault-status.js --json
```

The script lives at `scripts/vault-status.js` — a standalone Node.js file
with no external dependencies. It can be called by Claude Code, OpenCode,
CI pipelines, or any tool that can execute a shell command.

## Example output

```
=== Vault Status ===

Open proposals (1)
  - context of new

Active plans (5)
  - [approved] Collation (high)
  - [approved] Git controls (medium)
  ...

Approved — awaiting plan (1)
  - Test cycle option for code-based plans

Completed plans: 3
```

## Notes

- Mirrors the `/status` web dashboard (`http://localhost:5173/status`)
- Excludes `misc.md` (intentional catch-all)
- No AI tokens, no network — pure filesystem scan
- `DOCWRIGHT_ROOT` env var overrides the repo root if needed
