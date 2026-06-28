---
name: endsession
description: Automated session shutdown — saves session note, updates SESSION-LOG.md, commits all remaining changes, pushes all branches, reports status
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
- Run `git status --short` across the main worktree and any known sibling worktrees
  (`../DocWright-kg`, `../DocWright-plugin`, etc. — check if they exist)
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

<none or list — will be committed in Step 6>

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

### 6. Commit all remaining changes

After all docs and logs are written, commit everything outstanding across all worktrees.

For each worktree with uncommitted or untracked content:
1. `git status --short` — identify what's pending
2. Stage all relevant files. Exclude:
   - `.env` and any file that looks like credentials/secrets
   - `node_modules/`, `dist/`, `.next/`, build artifacts
   - Screenshot directories (`test/webui/screenshots/`, `/tmp/`)
   - Files already in `.gitignore`
3. If anything to commit: `git commit -m "docs: session note YYYY-MM-DD — <focus>"`
4. If a worktree has no changes, skip it silently

### 7. Push all branches

Push every branch that has unpushed commits:

```bash
# For each worktree / branch with commits ahead of remote
git push origin <current-branch>

# If no remote tracking ref yet:
git push -u origin <current-branch>
```

Report which branches were pushed and which were already up-to-date.

### 8. Report

Print a concise summary:
- Session note path
- Files committed and pushed (per worktree/branch)
- Active plans and their priorities
- Branches pushed / already up-to-date
- Top 3 action items for next session, ordered by priority
