---
title: "Phase Close-Out Procedure"
status: active
author: NetYeti
created: 2026-06-11
tags:
  - core
  - lifecycle
  - versioning
  - release
gate_reviewer: NetYeti
gate_status: approved
gate_date: 2026-06-11
---

# Phase Close-Out Procedure

## When to close a phase

A phase is closed when:
1. All sub-plans assigned to that phase are in `plans/completed/`
2. The phase overview plan has `status: completed`
3. The phase gate review is signed off

## The procedure

Run:

```bash
npm run phase:close -- <N>
```

Where `<N>` is the phase number (e.g., `2` for Phase 2).

This single command executes the full close-out sequence:

1. **Validate** — confirms `plans/completed/phase-N-*.md` exists with `status: completed`
2. **Calculate** — next version is `0.(N+1).0`
3. **Idempotent check** — if current version is already at or beyond target, exits cleanly
4. **Bump** — updates `VERSION` and `package.json`
5. **Commit** — `chore: bump version to 0.(N+1).0 — Phase N complete, Phase N+1 begins`
6. **Tag and push** — runs `npm run release:tag` (creates annotated tag, pushes to origin, watches CI)

## Enforcement points

| Enforcement | What it catches |
|---|---|
| `transition_to_completed` MCP response | AI-assisted sessions — surfaces reminder when a phase plan completes |
| Endsession skill check | End-of-session reminder if close-out is still pending |
| `phase:close` script | The actual execution — one command, no manual steps |
| This policy document | Human reference and lint target |

## What NOT to do

- Do NOT manually edit `VERSION` or `package.json` — use `npm run phase:close -- N`
- Do NOT create the tag manually — the `release:tag` script handles CI watch
- Do NOT skip the close-out — the version is how the project tracks its progress

## Rollback

If a version bump commit needs to be undone:

```bash
git revert HEAD
git tag -d v0.N.0 && git push --delete origin v0.N.0
```

Then create a new proposal or fix commit to resolve the issue.

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-11 | Created | NetYeti |
