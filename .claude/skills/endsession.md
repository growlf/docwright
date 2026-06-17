---
name: endsession
description: Automated session shutdown — saves session note, updates SESSION-LOG.md, reports status
triggers:
  - endsession
  - end session
  - shutdown
  - wrap up
  - session end
---

# DocWright Session Shutdown Skill

Triggered by: "endsession", "end session", "shutdown"

Do NOT ask for permission. Execute all steps automatically.

## Steps

### 1. Resolve identities

Read `.env` (fallback: `git config user.name` / `git config user.email`).
Machine is always `$(hostname)` — never user-supplied.

### 2. Collect session data

- Read `SESSION-LOG.md` (last 100 lines) to find last session timestamp
- Run `git log --oneline --since="<last-session-date>"` for commits this session
- Run `git status --short` for uncommitted changes
- List active plans: any `.md` in `plans/` with `status: in-progress` or `status: approved`

### 3. Phase close-out check

Scan `plans/completed/` for any `phase-N-*.md` completed this session (check
git log or mtime vs session start). Also read `VERSION`.

If a phase plan completed AND VERSION has not been bumped past that phase, emit
a BLOCKING WARNING and do not proceed until the user runs `npm run phase:close -- <N>`
or explicitly defers.

### 4. Create session note

Write `docs/session-notes/session_note_YYYYMMDDHHMM.md`:

```markdown
# Session Note: YYYY-MM-DD — <focus>

**Date:** YYYY-MM-DD
**Author:** <human> @ <machine>
**Focus:** <2-5 word summary>

## Summary

<3-5 sentence summary of what was accomplished>

## Decisions Made

- <bullet points of key decisions>

## Plans Worked On

| Plan | Status |
|------|--------|
| <plan> | <in-progress/completed> |

## Commits This Session

<git log output>

## Uncommitted Changes

<none or list>

## Next Session Should Start With

- <action items>
```

### 5. Update SESSION-LOG.md

Append a new entry after the last `---`:

```markdown
---

## Session: YYYY-MM-DD — <focus>

**Focus:** <2-5 word summary>

**Completed:**
- [x] <what was done>

**Session note:** `docs/session-notes/session_note_YYYYMMDDHHMM.md`
```

### 6. Report

Print: session note path, active plans, git status, uncommitted changes, next-session action items.
