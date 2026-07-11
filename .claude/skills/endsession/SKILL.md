---
name: endsession
description: Automated session shutdown — writes the session note, updates SESSION-LOG.md, commits outstanding work, and pushes all branches. Use when the user says "endsession", "end session", "shutdown", "wrap up", or "session end".
---

# DocWright Session Shutdown Skill

The shutdown procedure is **code, not a manual checklist**. It lives in
`scripts/end-session.ts` (run via `npm run session:end`) so it is deterministic
and identical every time. The script resolves identity, collects the session's
commits and `git status`, runs the phase close-out gate, writes the session
note, appends to `SESSION-LOG.md`, then commits and pushes outstanding work
across every worktree — and reports what it did.

## Steps

1. Compose the judgement the script can't derive — the focus, a short narrative
   summary, key decisions, and next-session action items — from the conversation.
2. Run from the repo root (run it once; do **not** perform the steps by hand):

```bash
npm run session:end -- \
  --focus "<2-5 word focus>" \
  --summary "<3-5 sentence summary>" \
  --decision "<a key decision>" \
  --decision "<another>" \
  --next "<top next-session action>" \
  --next "<second>"
```

All flags are optional — with none, the script derives the focus and summary
from the session's commits and still completes the full shutdown.

3. Report back: the session-note path, what was committed/pushed per branch,
   and anything the script skipped or flagged.

### Flags

| Flag | Effect |
|------|--------|
| `--focus <text>` | 2-5 word session focus (default: derived from commits) |
| `--summary <text>` | Narrative summary (default: bullet list of commit subjects) |
| `--decision <text>` | A key decision; repeat for several |
| `--next <text>` | A next-session action item; repeat for several |
| `--since <date>` | Override session-start date (default: last `SESSION-LOG.md` entry) |
| `--defer-phase-close` | Acknowledge and skip the phase close-out BLOCKING gate |
| `--no-commit` | Write docs but don't commit |
| `--no-push` | Commit but don't push |
| `--dry-run` | Print intended actions and the rendered note; change nothing |

## Failure handling

- **Phase close-out gate blocks:** a `plans/completed/phase-N-*.md` plan was
  completed this session but `VERSION` hasn't been bumped past phase N. Ask the
  user: run `npm run phase:close -- <N>` then re-run `session:end`, or pass
  `--defer-phase-close` to skip intentionally. Do not decide alone.
- **Validation/pre-commit failure on unrelated working-tree debt:** report the
  failing files to the user and ask whether to fix, stash, or `--no-commit`;
  do not silently drop the session note.
- **Push rejected (protected branch):** commit locally, report, and let the
  human push or open a PR — never force-push.

## Never auto-committed

The script stages everything outstanding except secrets and machine-local churn
(`.env*`, `.gemini/settings.json`) and anything already in `.gitignore`. If you
need one of those committed, do it manually and explain why.
