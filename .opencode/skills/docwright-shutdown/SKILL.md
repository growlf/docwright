---
name: docwright-shutdown
description: Automated session shutdown — saves session note, updates SESSION-LOG.md, reports status
triggers: prepare for session shutdown, end session, shutdown, wrap up, session end
required_permission: none
---

# DocWright Session Shutdown Skill

Triggered by: "prepare for session shutdown", "end session", "shutdown"

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

### 3. Create session note

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

### 4. Update SESSION-LOG.md

Append a new entry after the last `---`:

```markdown
---

## Session: YYYY-MM-DD — <focus>

**Focus:** <2-5 word summary>

**Completed:**
- [x] <what was done>

**Session note:** `docs/session-notes/session_note_YYYYMMDDHHMM.md`
```

### 5. Report

Print a concise summary: session note path, plans active, git status, and any action items for next session.
