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

### 1.5. Surface parked and in-flight work

`vault-status.js --json` now returns a `git.parked_branches` array — remote
branches with committed-but-unmerged work (each with `ahead`/`behind` counts and
`last_commit`). This is where in-progress work lives under trunk-based flow, so it
MUST be reported. **Never** build a "what's next" recommendation from proposals and
plans alone — parked work is invisible to the filesystem scan and has silently
been lost this way before.

Then layer in GitHub state (network; degrade gracefully — if `gh` is missing,
unauthenticated, or offline, skip these two without failing the session):

```bash
gh pr list --state open --json number,title,headRefName,mergeable 2>/dev/null
```

```bash
gh issue list --state open --json number,title,labels 2>/dev/null
```

Cross-reference: a parked branch that already has a **merged/closed** PR is landed,
not parked — mention it only as a cleanup candidate (delete the stale branch). A
parked branch with **no** PR, or an **open** PR, is live work to account for.

### 2. Per-plan progress

For each active plan path returned by vault-status, run:

```bash
grep -c "\- \[x\]" <path>   # steps done
grep -c "\- \[ \]" <path>   # steps open
```

### 2.5. Plan health check

Run the plan health script. Any warnings must appear **before** the session summary:

```bash
node scripts/plan-health.js
```

If warnings are found, include them in the summary under a `Plan health warnings:` header.
Warnings indicate governance issues that should be resolved before starting new work:
- `[placeholder-steps]` — an approved plan has no real steps; fill them before starting
- `[tbd-testing]` — an in-progress plan has no testing plan; write one before completing
- `[overlap]` — two plans share significant keyword overlap; verify they aren't duplicating scope

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

Parked work (<N> unmerged branches · <N> open PRs · <N> open issues):
  - <branch> (+<ahead>/-<behind>) <PR #/issue link if any> — <last_commit>
  (omit this block entirely only when all three counts are zero)

Pending proposals: <open> open, <approved_pending> approved-pending
Git: <N staged> staged, <N modified> modified

Last session: <date from SESSION-LOG.md> — <focus line>

Next: <1-sentence recommendation for where to start — must account for parked work,
      not just active plans and proposals>
```

### 5. Set up todo list

Create a TaskCreate entry for each active plan, ordered by priority
(critical → high → medium → low), then by steps done descending (most
progress first). Mark the top item `in_progress` only if it has a clear
open step; otherwise leave all `pending`.
