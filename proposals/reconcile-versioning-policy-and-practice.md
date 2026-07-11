---
title: "Reconcile versioning policy with practice (patch semantics, retired-develop refs, phase-close docstring)"
author: NetYeti
author-role: contributor
created: 2026-07-11
tags:
  - versioning
  - policy
  - release
  - docs
approved: false
created_by: "NetYeti@cluster-llm"
assigned_to: ""
priority: medium
milestone: backlog
related_to:
  - issues/bug-version-patch-number-diverged-from-completed-plan-.md
  - issues/bug-versioning-policy-still-references-retired-develop.md
  - issues/bug-phase-closets-docstring-claims-step-verification-b.md
---

## Problem

The versioning story has drifted between what policy says and what actually
happens, causing confusion and a code-over-memory gap:

- **Patch semantics**: `policies/core/versioning.md` defines PATCH as "completed
  plan count within the current phase", but in practice patch is bumped
  per-release (v0.4.10, .11, .12) with `plans/completed/phase-4-*.md` count = 0.
  Policy and practice disagree; the count is never actually derived.
- **Retired `develop`**: the versioning policy still references the retired
  `develop` branch (trunk-based since 2026-06-30).
- **`phase-close.ts` docstring** claims a step-verification behaviour it doesn't
  implement.

## Proposed Solution

Pick ONE coherent model and make it code-enforced:
- Either amend the policy to **patch = per-release** (and drop the completed-plan
  count claim), OR automate the patch bump at `transition_to_completed` so the
  count stays true — not manual. (Recommend per-release + a CI drift check.)
- Scrub `develop` references from `policies/core/versioning.md`.
- Fix the `phase-close.ts` docstring to match actual behaviour.

## Verification

- `policies/core/versioning.md` matches the release scripts' actual behaviour;
  no `develop` references remain.
- A CI check (or the existing drift gate) fails if VERSION and the declared
  scheme diverge.
