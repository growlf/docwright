---
name: endsession
description: Automated session shutdown — saves session note, updates SESSION-LOG.md, reports status
triggers: endsession, end session, shutdown, wrap up, session end
required_permission: none
---

# DocWright Session Shutdown Skill

Triggered by: "endsession", "end session", "shutdown"

Do NOT ask for permission. Execute all steps automatically.

## Steps

### 1. Resolve identities

Read `.env` (fallback git config). Machine is `$(hostname)`.

### 2. Collect session data

Read:
- SESSION-LOG.md (last 100 lines)
- `git log --oneline --since="<last-session-timestamp>"` (from last session note date)
- `git status --short`
- Active plans via `dw-mcp_list_active_plans`
- Session context via `dw-mcp_get_session_context`

### 3. Phase close-out check

Scan `plans/completed/` for any file matching `phase-(\d+)-*.md` that was completed
in this session (check git log or file modification date against session start time).
Also read `VERSION` file.

If a phase plan was completed this session AND the current VERSION has NOT been
bumped past that phase (e.g. Phase 2 completed but VERSION still shows 0.2.x),
emit a BLOCKING WARNING:

```
⚠  Phase <N> plan was completed this session but version has not been bumped.
   Run `npm run phase:close -- <N>` before ending the session.
```

Stop and do not proceed until the user has taken one of:
- Run `npm run phase:close -- <N>` and it succeeds
- Explicitly acknowledge the warning and choose to defer the close-out

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

## Architecture State

<brief note on current architecture state>

## Next Session Should Start With

```bash
<commands to run>
```
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

Print a concise summary: session note path, plans active, git status, and any action items for next session.
