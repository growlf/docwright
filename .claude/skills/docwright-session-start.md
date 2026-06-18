---
name: docwright-session-start
description: Automated session startup — resolves identity, gathers active plans, session history, git status, and sets up todo
triggers:
  - what's next
  - what is next
  - session start
  - resume
  - continue
  - start session
  - wake up
---

# DocWright Session Start Skill

Do NOT ask for permission. Execute all steps automatically. Return a concise summary.

## Steps

### 1. Gather vault state

Run in parallel:

```bash
node scripts/vault-status.js --json
```

```bash
git log --oneline -5
```

```bash
git status --short
```

```bash
hostname
```

```bash
traceroute -n -m 5 8.8.8.8 2>/dev/null | tail -3
```

Read the last 40 lines of `SESSION-LOG.md` to find the most recent session entry.

### 2. Per-plan progress

For each active plan path returned by vault-status, run:

```bash
grep -c "\- \[x\]" <path>   # steps done
grep -c "\- \[ \]" <path>   # steps open
```

### 3. Adoption health check

If `.docwright/config.json` exists, read `adopt_version` and compare to
`$DOCWRIGHT_PATH/package.json` version. If they differ, emit **before** the
summary:

```
ℹ  This vault was adopted with DocWright <adopt_version>. Current: <current>.
   Run: npm run adopt -- --dest . --upgrade  (from $DOCWRIGHT_PATH)
```

Skip silently if `.docwright/config.json` is absent.

### 4. Report summary

Print in this exact format:

```
Session: <YYYY-MM-DD> | <hostname> | <last traceroute hop>
Human: NetYeti | garth.johnson@cascadesteam.org

Active plans (<N>):
  - <title> [<status>] (<priority>) — <done>/<done+open> steps · <file>

Pending proposals: <open> open, <approved_pending> approved-pending
Git: <N staged> staged, <N modified> modified

Last session: <date from SESSION-LOG.md> — <focus line>

Next: <1-sentence recommendation for where to start>
```

### 5. Set up todo list

Create a TaskCreate entry for each active plan, ordered by priority
(critical → high → medium → low), then by steps done descending (most
progress first). Mark the top item `in_progress` only if it has a clear
open step; otherwise leave all `pending`.
