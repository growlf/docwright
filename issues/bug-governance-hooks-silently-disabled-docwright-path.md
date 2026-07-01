---
title: "Governance hooks silently disabled when DOCWRIGHT_PATH is unset (non-interactive shells)"
status: open
author: NetYeti
author-role: contributor
created: 2026-07-01
category: bug
priority: high
complexity: low
estimated_effort: S
tags:
  - governance
  - hooks
  - claude-code
  - fail-safe
created_by: "NetYeti@cluster-llm"
assigned_to: ""
milestone: v0.5.0
---

> Observed at session start on 2026-07-01: a burst of
> `PostToolUse:Bash hook error … missing file` messages, all pointing at
> `claude-tag-push-watch.sh`. The script exists — the path did not resolve.

## Problem

`.claude/settings.json` wires three Claude Code hooks — `PreToolUse` (the
lifecycle governance gate `claude-lifecycle-hook.sh`), and two `PostToolUse`
hooks (`claude-session-boundary-hook.sh`, `claude-tag-push-watch.sh`) — each as:

```
bash "${DOCWRIGHT_PATH}/scripts/<hook>.sh"
```

`DOCWRIGHT_PATH` is exported in `~/.bashrc`, but `~/.bashrc` returns early for
**non-interactive** shells (`case $- … *) return`). Claude Code runs hook
commands in a non-interactive shell, so `DOCWRIGHT_PATH` is empty there. The
path collapses to `/scripts/<hook>.sh`, which does not exist.

The **cosmetic** symptom is the loud `claude-tag-push-watch.sh` error (it fires
after every Bash call). The **serious** symptom is silent: the `PreToolUse`
lifecycle gate — the in-code enforcement of [[policies/core/ai-governance-boundaries]]
— also fails to run, with no visible error unless a Write/Edit happens to trip it.
Governance was effectively **off** and nothing said so.

## Impact

The mechanism meant to enforce AI governance boundaries can be silently absent on
any machine where `DOCWRIGHT_PATH` isn't in the hook environment (fresh clone,
CI, cron, a shell that skips `.bashrc`). This violates fail-safe: a governance
control that no-ops silently is worse than one that refuses to run.

## Proposed Fix

- **Fail loud, not silent.** Each `claude-*-hook.sh` should, as its first act,
  verify it can resolve its own repo root (e.g. via `git rev-parse --show-toplevel`
  or `$CLAUDE_PROJECT_DIR`) and emit a visible error + non-zero exit if it cannot,
  rather than letting an unset `${DOCWRIGHT_PATH}` produce a missing-file error.
- **Stop depending on an interactive-shell env var** for hook paths. Prefer
  `$CLAUDE_PROJECT_DIR` (Claude Code sets it for hooks) when the repo is its own
  vault, or resolve via git. Reserve `DOCWRIGHT_PATH` for the genuine
  vault-adopts-separate-install case, and set it in the `env` block of
  `.claude/settings.json`/`settings.local.json` (which Claude Code injects into
  hook execution) rather than relying on `.bashrc`.
- **Document** the `env`-block requirement in the adopt flow so adopted vaults
  arm their hooks.

## Workaround applied 2026-07-01

Added an `env` block to `.claude/settings.local.json` (machine-local, untracked)
setting `DOCWRIGHT_PATH`. This re-arms the hooks on next session start. It does
not fix the fail-silent behavior — hence this proposal.

## Related

- [[policies/core/ai-governance-boundaries]] — the boundary the dormant gate enforces
- [[policies/core/code-over-memory]] — enforcement must actually run to count
- [[proposals/bug-hook-source-divergence-and-commit-msg-not-installed]] — sibling install/deploy defect
- [[migration-hooks-path]] — related: core.hooksPath must be set after clone
