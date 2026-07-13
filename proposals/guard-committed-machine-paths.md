---
title: "Guard against committing machine-specific absolute paths"
author: "NetYeti"
created: "2026-07-05"
tags: [ci, hooks, reproducibility, dx]
category:
  - infrastructure
complexity: low
approved: false
priority: 3
created_by: "NetYeti@cluster-llm"
assigned_to: []
related_to:
  - "https://github.com/growlf/docwright/issues/352"
depends_on: []
blocks: []
milestone: backlog
---

# Guard against committing machine-specific absolute paths

## Summary

Add a pre-commit hook + CI check that blocks committing **machine/user-specific absolute
paths** (and dangling symlinks that point outside the repo) into tracked files — a
non-reproducibility class that has already bitten twice this cycle.

## Problem Statement

Two separate breakages this cycle were the same root cause — a machine-specific absolute
path committed into the repo, which is wrong (or churns) on every other clone:

1. **`plugins/erp-images`** was committed as a **symlink into `/home/netyeti/…`**. It dangled
   on every other clone and 500'd `/api/plugins` (fix: #163 / https://github.com/growlf/docwright/issues/352).
2. **`opencode.jsonc`** was committed with **`/home/netyeti/…` absolute MCP paths**. Every clone
   rewrote it to its own paths → perpetual dirtiness (fix: untrack + gitignore, #194).

Nothing catches this today. It's exactly the failure mode [[policies/core/code-over-memory]]
says to enforce with code rather than rely on reviewer memory.

## Proposed Solution

- A scanner (small script) that flags, in **staged** (hook) and **tracked** (CI) files:
  - absolute home paths — `/home/<user>/`, `/Users/<user>/`, `C:\\Users\\<user>\\`;
  - **symlinks whose target is an absolute path outside the repo** (the `plugins/erp-images` case).
- Wire it into `.githooks/pre-commit` (fail fast locally) and add a CI job (belt-and-suspenders,
  since not every clone installs the hooks).
- Clear failure message naming the file + offending path + how to fix (relative path, env var,
  gitignore-if-generated).

## Expected Outcomes
- Committing a machine-specific path fails fast at commit time and in CI.
- Reproducibility protected in code, not memory.

## Resources Required
- One scanner script + `.githooks/pre-commit` wiring + one CI step. Small; no new deps.

## Related Documents
- https://github.com/growlf/docwright/issues/352 — the symlink incident.
- `docs/deployment-bms-devcloud.md` — where these paths kept surfacing.

## Discussion Notes
- **False positives are the main risk.** Docs / session notes / tickets legitimately reference
  absolute paths (this very proposal does). Options: scope the scan to code/config file types
  (exclude `docs/**`, `**/session-notes/**`, `issues/**`, `plans/**`), and/or honor an inline
  `# allow-abs-path` marker for deliberate cases. Decide the exact scope in the plan.
- **Bugs before features:** per [[policies/core/bugs-before-features]] this queues behind open
  bugs; it's preventive tooling, logged for prioritization.
