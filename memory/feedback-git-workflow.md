---
name: feedback-git-workflow
description: DocWright branches must be merged via GitHub/Forgejo PR, not local merge — Forgejo branch protection enforces no merge commits, PR required, and status checks
metadata:
  type: feedback
---

Always merge feature branches into `develop` (and `develop` into `main`) via a **GitHub/Forgejo pull request**, not a local `git merge`. Do NOT run `git merge` locally and push.

**Why:** Forgejo branch protection on this repo enforces:
- No merge commits on protected branches
- Changes must go through a pull request
- 3 required status checks must pass

Pushing a local merge bypasses these gates and triggers rule violation warnings (even if the push succeeds).

**How to apply:** When the user asks to merge a branch, use `gh pr create` to open a PR instead of `git merge`. For example:
```
git push origin feature/my-branch
gh pr create --base develop --head feature/my-branch --title "..." --body "..."
```
Then let the user approve and merge via the Forgejo UI, or merge via `gh pr merge` once checks pass.
