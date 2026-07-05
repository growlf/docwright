---
title: "Approving by moving a proposal to proposals/approved/ bypasses the HUMAN-APPROVED gate"
status: open
github_issue: 140
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
  - approval
  - security
  - data-integrity
created_by: "NetYeti@cluster-llm"
assigned_to: ""
milestone: v0.5.0
---

> Found by dogfooding on 2026-07-01 while committing the approval of
> [[proposals/approved/separate-dev-tracking-milestones-and-beta-channel]] (GitHub #68).
> Sibling of [[proposals/bug-plan-generator-from-approved-proposal]] and
> [[proposals/bug-approve-not-idempotent-stale-consumed-by]]. This is the most serious of
> the three: the self-approval gate has a hole an AI (or anyone) can drive through.

## Problem

`validate_no_self_approval()` in `.githooks/pre-commit` (≈line 232) is the gate that arms
the `HUMAN-APPROVED:<name>` requirement when a proposal is approved. It only fires when a
file **in the `proposals/` root** has `approved:` flip `false → true`:

```sh
[[ ! "$FILE" =~ ^proposals/[^/]+\.md$ ]] && return 0     # only proposals/ root
[[ "$FILE" =~ ^proposals/approved/ ]] && return 0        # explicitly SKIP approved/
OLD=$(git show "HEAD:$FILE" ... approved:)
NEW=$(grep "^approved:" "$FILE" ... )
[ "$OLD" = "false" ] && [ "$NEW" = "true" ] || return 0
```

But the actual approval flow (the Web UI Approve button, and `transition_to_approved`)
**moves** the proposal from `proposals/foo.md` to `proposals/approved/foo.md` and sets
`approved: true` in the moved copy. In that commit:

- The **destination** `proposals/approved/foo.md` is skipped by the explicit
  `proposals/approved/` guard.
- The **source** `proposals/foo.md` is *deleted*, so its working-tree `NEW` value is empty
  — the `false → true` test never matches.

**Net effect: the flag is never armed, `commit-msg` never asserts the marker, and a
proposal can go from unapproved to approved with no `HUMAN-APPROVED:` seal in history.**
Verified this session — the approval commit for #68 required the marker only because it was
added by hand; the hook would have let it through silently.

## Impact

This is the exact failure mode the AI-governance boundary
([[policies/core/ai-governance-boundaries.md]]) relies on the hook to prevent. The gate is
supposed to be *code, not memory* ([[policies/core/code-over-memory.md]]) — but the code
only guards the in-place edit path, not the move path that the tooling actually uses. An AI
that moved a proposal into `proposals/approved/` with `approved: true` would self-approve
governance with zero enforcement. The one control standing between AI output and a human
seal has a bypass.

## Proposed Fix

Detect approval on the **move/add path**, not just in-place edits:

- In `validate_no_self_approval`, also handle a **newly added** `proposals/approved/*.md`
  whose prior location (`proposals/<same-name>.md` at `HEAD`) had `approved: false` — treat
  that as a `false → true` approval and arm the flag.
- Equivalently/additionally: **any** added-or-modified file under `proposals/approved/`
  with `approved: true` that did not exist in `proposals/approved/` at `HEAD` must arm the
  marker requirement.
- Cover the rename case explicitly (git may present it as delete+add or as `R`); key on the
  basename, not the full path.
- Add a hook regression test: approving by move (proposals/foo.md → proposals/approved/foo.md,
  approved:true) **fails** without a `HUMAN-APPROVED:` marker and **passes** with it.

Note the source drift risk: `.githooks/pre-commit` and `scripts/pre-commit.sh` are known to
diverge (see [[proposals/bug-hook-source-divergence-and-commit-msg-not-installed]]) — apply
the fix to the canonical source and sync both.

## Verification

- A commit that moves an unapproved proposal into `proposals/approved/` with `approved: true`
  is **rejected** unless the commit message carries `HUMAN-APPROVED:<name>`.
- The in-place `false → true` path still works (no regression).
- Hook regression test covers both the move path and the in-place path.
