---
title: "Hook source drift — .githooks diverged from scripts/pre-commit.sh, and commit-msg is never installed for vaults"
status: open
github_issue: 144
author: NetYeti
author-role: contributor
created: 2026-07-01
category: bug
priority: high
complexity: medium
estimated_effort: M
tags:
  - governance
  - hooks
  - install
  - data-integrity
created_by: "NetYeti@cluster-llm"
assigned_to: ""
milestone: future
---

> Found while fixing [[proposals/bug-human-approved-precommit-check-broken]] on
> 2026-07-01. The approval-gate fix touched both hook files and surfaced two
> structural problems in how hooks are sourced and installed.

## Problem

There are **two** distinct defects in the hook install/sync model:

### 1. `.githooks/pre-commit` has diverged from its install source `scripts/pre-commit.sh`

Both files are tracked in git. `scripts/install-hooks.sh` treats
`scripts/pre-commit.sh` as the canonical source and copies it over the install
target (line 101). But the live hook `.githooks/pre-commit` (git runs it via
`core.hooksPath=.githooks`) currently contains **two validators the source
lacks**: `validate_plan_in_progress_steps` and `validate_testing_plan_not_tbd`.

Consequences:
- Running `npm run hook:install` on this repo would **silently revert** those two
  validators (copy older source over the newer live hook), then the integrity
  check at `install-hooks.sh:152-157` (`diff` source vs installed) would pass
  because it just made them identical — quietly downgrading enforcement.
- The two files can drift arbitrarily with no CI check catching it.

### 2. `commit-msg` is never installed for vault adoptions

`install-hooks.sh` only installs `pre-commit` (`SOURCE_HOOK` is hardcoded to
`pre-commit.sh`). The `commit-msg` hook — which now carries the second half of
the HUMAN-APPROVED approval gate — exists only in `.githooks/` and has no
`scripts/` source. This repo runs it via `core.hooksPath=.githooks`, but an
**adopted vault** (which uses the standard `.git/hooks/` path, not `.githooks`)
gets no `commit-msg` at all. So the approval gate's assertion half is missing in
every adopted vault.

## Impact

Governance enforcement silently weakens: either by reverting validators on a
routine reinstall, or by shipping vaults without the commit-msg approval
assertion. This is exactly the "code over memory" failure mode — the enforcement
mechanism itself is not reliably deployed.

## Proposed Fix

- **Establish a single canonical source of truth** for every hook. Either:
  (a) make `.githooks/` the tracked source and have `install-hooks.sh` copy FROM
  `.githooks/` (drop `scripts/pre-commit.sh`), or
  (b) keep `scripts/` as source, add `scripts/commit-msg`, and regenerate
  `.githooks/` from it. Pick one; delete the duplicate.
- **Install ALL hooks**, not just pre-commit — iterate a hook list
  (`pre-commit`, `commit-msg`, …) in `install-hooks.sh` for both self- and
  vault-installs.
- **Add a CI check** that fails if the tracked source and the installed/committed
  hook copies differ (per "code over memory") — drift must be caught mechanically,
  not by memory.

## Related

- [[proposals/bug-human-approved-precommit-check-broken]] — the fix that surfaced this
- [[policies/core/code-over-memory]] — enforcement must be reliably deployed, not assumed
- [[proposals/bug-governance-hooks-silently-disabled-docwright-path]] — sibling install/deploy defect

## Scope update (2026-07-04)

Re-verified still valid: `install-hooks.sh` hardcodes `scripts/pre-commit.sh` and never
installs `commit-msg` (no `scripts/commit-msg` source exists), and the two pre-commit
copies still diverge (a live `reviewed`-gate line) with no CI drift check. Only the
specific two-validator drift example originally cited is now obsolete.
