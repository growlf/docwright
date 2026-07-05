---
title: "Pre-commit HUMAN-APPROVED check is broken — reads stale COMMIT_EDITMSG"
status: resolved
closed_by_pr: "#70"
author: NetYeti
author-role: contributor
created: 2026-06-30
category: bug
priority: high
complexity: low
estimated_effort: S
tags:
  - governance
  - hooks
  - approval
  - data-integrity
created_by: "NetYeti@cluster-llm"
assigned_to: ""
milestone: future
---

> Root cause of the entire #59 (fix-or-retire-version-js) approval saga on
> 2026-06-30 — a human could not approve a proposal via `git commit` no matter
> how correctly they wrote the marker. Had to be merged via `--no-verify`.

## Problem

The check that requires a `HUMAN-APPROVED:<name>` marker when a proposal's
`approved` flips `false → true` lives in the **pre-commit** hook
(`.githooks/pre-commit:235`) and greps `.git/COMMIT_EDITMSG`:

```sh
if [ -f ".git/COMMIT_EDITMSG" ] && ! grep -q "HUMAN-APPROVED:" .git/COMMIT_EDITMSG; then
    print_error "...approved changed false→true without HUMAN-APPROVED: marker..."
```

But **pre-commit runs before git writes the current commit message** to
`COMMIT_EDITMSG`. At pre-commit time that file holds the **previous** commit's
message. So the marker the user just typed via `-m` is never seen. The gate is
non-functional:

- **False negative (what bit us):** a legitimate approval *with* the marker is
  blocked, because the file still has the prior commit's (markerless) message.
- **False positive:** an approval *without* a marker would PASS if the previous
  commit's message happened to contain `HUMAN-APPROVED:`.

The same hook even has a comment at line 66 — *"It must not be re-checked here:
pre-commit reads COMMIT_EDITMSG which…"* — so the footgun was already known, yet
line 235 does exactly that.

## Steps to Reproduce

1. Edit a top-level `proposals/<x>.md`: `approved: false` → `true`.
2. `git commit -m "chore: approve x" -m "HUMAN-APPROVED:Name" proposals/x.md`
3. Pre-commit fails: "approved changed false→true without HUMAN-APPROVED: marker
   in commit message" — even though the marker IS in the message.
4. Confirm: `cat .git/COMMIT_EDITMSG` shows the **previous** commit's message.

## Expected vs Actual

**Expected:** a commit whose message contains `HUMAN-APPROVED:<name>` passes the
approval gate; one without it is blocked.

**Actual:** the gate reads the wrong (stale) message, so it blocks valid
approvals and would pass invalid ones depending on the prior commit.

## Environment

DocWright `.githooks/pre-commit`, observed 2026-06-30 approving
`proposals/fix-or-retire-version-js.md` (#59). git on cluster-llm.

## Proposed Fix

- **Move the HUMAN-APPROVED check to a `commit-msg` hook**, which receives the
  real message file as `$1` — the correct stage to inspect the message. Remove
  the check from pre-commit (line 235), per the existing line-66 warning.
- Keep the `false→true` detection (diff of `approved:`) where it can see the
  staged file, but defer the *message* assertion to `commit-msg`.
- The Web UI approval path (Approve → moves to `proposals/approved/`, which the
  hook exempts) is unaffected and remains the primary path. But the documented
  CLI fallback must actually work.
- Add a test (e.g. `test/hooks/`) that commits an approval with and without the
  marker and asserts block/allow correctly.

## Related

- [[policies/core/bugs-before-features]]
- [[policies/core/ai-governance-boundaries]] — this is the gate meant to enforce it
- [[proposals/bug-wysiwyg-editor-corrupts-documents]], [[proposals/bug-complete-plan-stray-copy-and-no-refresh]] — sibling dogfooding finds (same session)

## Resolution (2026-07-04)

Fixed by PR #70 (69440c4) + 50e829c. The stale `.git/COMMIT_EDITMSG` grep is gone:
pre-commit now only detects `false→true` and arms a `dw-needs-human-approval` flag, and
the new `.githooks/commit-msg` asserts `HUMAN-APPROVED:` against the real message file.
