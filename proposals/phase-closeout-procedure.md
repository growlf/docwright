---
title: "Formalize phase close-out procedure — version bump, tag, push"
author: NetYeti
created: 2026-06-08
tags:
  - governance
  - versioning
  - phase-lifecycle
  - tooling
  - code-over-memory
approved: false
created_by: "NetYeti@phoenix"
assigned_to: ""
---

## Problem

When a major phase closes, three things must happen in order:

1. Version bumped to `0.(N+1).0` in `VERSION` + `package.json`
2. Version bump committed
3. Tag `v0.(N+1).0` created and pushed (`npm run release:tag`)

This procedure exists only in human memory. The pre-commit hook, MCP server, and
endsession skill have no awareness of it. We already missed it once — Phase 2 closed
without a version bump until explicitly reminded mid-session.

This violates the "code over memory" policy: if a rule can be enforced by a tool,
it must be.

## Proposed Solution

### 1. `npm run phase:close [phase-number]` script

A single command that executes the full close-out sequence:

```bash
npm run phase:close -- 2
```

Steps:
1. Validates `plans/completed/phase-<N>-*.md` exists with `status: completed`
2. Calculates next version: `0.(N+1).0`
3. Checks current `VERSION` is not already at or beyond the target (idempotent)
4. Updates `VERSION` and `package.json`
5. Commits with message: `chore: bump version to 0.(N+1).0 — Phase N complete, Phase N+1 begins`
6. Runs `npm run release:tag` (tags + pushes + watches CI)

Exits non-zero if any step fails. The script is idempotent — safe to run twice.

### 2. `transition_to_completed` post-completion reminder for phase plans

In `scripts/mcp-server.py` (and the future TypeScript MCP server), after a
successful `transition_to_completed` on a plan whose name matches `phase-[0-9]`:

```
✅ Plan 'phase-2-foundation.md' completed and moved to plans/completed/.

⚠  PHASE CLOSE-OUT REQUIRED:
   Run: npm run phase:close -- 2
   This bumps the version, commits, tags, and pushes the release.
```

The reminder appears in the MCP tool response, which surfaces in the AI's context.

### 3. Endsession skill check

Add a check to `.opencode/skills/endsession/SKILL.md`: before generating the
session note, scan `plans/completed/` for any phase overview plan completed this
session (name matches `phase-[0-9]`). If found and the current `VERSION` has not
been bumped past that phase, emit a blocking warning:

```
⚠  Phase N plan was completed this session but version has not been bumped.
   Run `npm run phase:close -- N` before ending the session.
```

### 4. Policy document

`policies/core/phase-closeout.md` — canonical reference for the procedure.
Short enough to memorize, authoritative enough to cite.

## What enforces what

| Enforcement point | Catches |
|---|---|
| `transition_to_completed` reminder | AI-assisted sessions — surfaces immediately in MCP response |
| Endsession skill check | End-of-session reminder if somehow missed |
| `phase:close` script | The actual execution — one command, no manual steps |
| Policy doc | Human reference + lint target |

## Alternatives Considered

**Pre-commit hook block:** Reject commits until version is bumped after a phase
plan completes. Rejected — too aggressive; commits might legitimately follow a phase
close before the version bump (e.g. cleanup commits). A reminder is sufficient;
a block is not.

**Manual process in CLAUDE.md:** Already failed — that's why this proposal exists.

## Future

- `phase:close` could auto-update `CHANGELOG.md` with a Phase N summary section
- CI could enforce that a tag exists for every phase plan in `plans/completed/`
