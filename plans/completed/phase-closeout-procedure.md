---
title: Formalize phase close-out procedure — version bump, tag, push
status: completed
completed_date: 2026-06-11
author: NetYeti
created: 2026-06-11
tags:
  - governance
  - versioning
  - phase-lifecycle
  - tooling
proposal_source: proposals/approved/phase-closeout-procedure.md
priority: high
mode: guided
assigned_to: netyeti
tests_defined: true
tests_human_reviewed: true
total_steps: 5
completed_steps: 5
---

# Formalize phase close-out procedure — version bump, tag, push

## Overview

When a major phase closes, three things must happen in order: version bump,
commit, and tag+push. This procedure existed only in human memory, and Phase 2
already missed it once. This plan builds tooling and reminders so it never slips again.

## Implementation Steps

| Step | Action | Details | Status |
|------|--------|---------|--------|
| 1 | Create `npm run phase:close` script | `scripts/phase-close.ts` — validates completed phase plan exists, calculates `0.(N+1).0`, updates `VERSION` + `package.json`, commits with standard message, runs `npm run release:tag`. Idempotent, safe to run twice. | ✅ Done |
| 2 | Add post-completion reminder to MCP server | `src/mcp/tools/transitions.ts` — `transitionToCompleted` detects `phase-N-` plan names and appends close-out reminder to response message. | ✅ Done |
| 3 | Add endsession skill check | `.opencode/skills/endsession/SKILL.md` — scans `plans/completed/` for phase plan completed this session, checks `VERSION` not bumped, emits blocking warning if missed. | ✅ Done |
| 4 | Write policy document | `policies/core/phase-closeout.md` — canonical reference for the procedure. Short enough to memorize, authoritative enough to cite. | ✅ Done |
| 5 | Verify end-to-end | `phase:close` script tested (idempotent with Phase 2). MCP reminder test added (12 transition tests pass). All 190 tests pass. | ✅ Done |

## Testing Plan

- **Step 1 unit test:** `npm run phase:close -- 2` — correctly reports already applied (idempotent)
- **Step 2 MCP test:** `transitionToCompleted` on `phase-2-test.md` returns close-out reminder in response (test added)
- **Step 3 endsession test:** SKILL.md updated with blocking warning logic (documentation)
- **Step 5 smoke test:** All 190 tests pass (MCP: 36, Dispatch: 155)

## Rollback Procedures

- `git revert HEAD` if version bump commit was wrong
- `git tag -d vX.Y.Z && git push --delete origin vX.Y.Z` if tag was wrong
- Remove `"phase:close"` from package.json and delete `scripts/phase-close.ts` to disable script
- Revert `src/mcp/tools/transitions.ts` to remove MCP reminder
- Revert `.opencode/skills/endsession/SKILL.md` to remove endsession check

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `phase:close` script runs on wrong plan | Low | Medium | Validates plan filename matches `phase-[0-9]` before proceeding |
| Script runs before phase steps fully complete | Low | Medium | Checks `status: completed` in plan frontmatter |
| Tag push fails due to network/permissions | Medium | Low | Script exits non-zero; push can be retried manually via `npm run release:tag` |
| Endsession check missed because session ends abruptly | Low | Low | MCP server reminder is primary guardrail; endsession is secondary |

## Phase Gate

- [x] Step 1: `scripts/phase-close.ts` created and tested (idempotent)
- [x] Step 2: MCP post-completion reminder added (tested)
- [x] Step 3: Endsession skill check added
- [x] Step 4: `policies/core/phase-closeout.md` written
- [x] Step 5: All tests pass (190 across MCP + dispatch)
- [x] No regressions from existing functionality

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-11 | Created from approved proposal | NetYeti |
