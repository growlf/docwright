---
title: "Multi-session work claiming — git-native issue claims so parallel sessions stop double-building"
author: NetYeti
author-role: contributor
created: 2026-07-06
tags:
  - governance
  - workflow
  - multi-agent
  - tooling
approved: true
created_by: "NetYeti@phoenix"
assigned_to: NetYeti
priority: high
complexity: medium
_path: proposals/approved/multi-session-work-claiming
consumed_by: plans/multi-session-work-claiming.md
---

## Problem

Two sessions working the same repo have no way to see what the other is
mid-flight on, so they duplicate or collide. This week alone:

1. **#141 was implemented twice on 2026-07-06** — one session shipped PR #216
   (short-circuit-only-when-target-exists) while a parallel session shipped
   PR #222 (clear stale pointers) within the same hour. Both merged; the
   second was redundant rework plus a rebase conflict during plan completion.
2. **The #218/#220/#224 cluster was announced as next work by one session and
   two-thirds consumed by another** (PRs #227, #230) before the first session
   resumed — benign this time only because the survivor was checked before
   starting.
3. **Session-note landing races** — every `endsession` this week rebased over
   commits another session landed mid-shutdown (#194, #201, #222, #227/#230).

The existing guidance (AGENTS.md §Multi-Agent Collaboration: "pull latest
trunk before starting") prevents stale-base work but says nothing about
in-flight intent. Relying on sessions to announce plans in notes is memory,
not code — a known failure mode ([[policies/core/code-over-memory]]).

## Proposed Solution

Make the claim git-native and enforce it in the tools sessions already use.
No auxiliary database (invariant: git is the canonical store); the claim IS
the remote branch plus an issue-store field.

1. **`start_issue_branch` claims on create.** Before creating
   `<type>/<num>-<slug>`, it queries `git ls-remote --heads origin` for any
   existing branch matching `*/<num>-*`. If one exists, it refuses with the
   branch name and last-commit info ("claimed by <branch>, last activity
   <date> — coordinate or pass force=true"). On create, it **pushes the
   branch immediately** so the claim is visible to every other session, and
   stamps the issue file: `claimed_by: <branch>`, `claim_date: <date>`.
2. **`complete_issue_branch` / issue resolution releases the claim** —
   clears `claimed_by`/`claim_date` when the branch merges or is abandoned;
   deleting the remote branch (merge --delete-branch) is the hard release.
3. **`issue_preflight` and `capture_bug_report suggest` surface claims** —
   any suggest/confirm hit that carries a live `claimed_by` says so, so a
   session learns about in-flight work at intake time, not merge time.
4. **Session-start surfaces claims repo-wide** — vault-status already lists
   parked branches; add a `claims` view: open issues with `claimed_by` set,
   flagging stale claims (branch with no commits in N days) for manual
   release.
5. **Stale-claim self-heal** — a claim whose branch no longer exists on
   origin is cleared automatically by the next `issue_preflight` (same
   pattern as the #141 consumed_by self-heal).

Plans get the same treatment for free: plan step work goes through
`start_issue_branch` per the issue-per-step pattern, so claiming the issue
claims the step.

## What this does NOT do

- No locking of files or docs — claims are advisory-but-visible; `force=true`
  overrides with an audit trail.
- No new server or database — `git ls-remote` + frontmatter only.
- No human workflow change — the BDFL's UI actions are already serialized
  through one working copy.

## Security / Policy / Verification

- **Security:** no new surface; claims ride existing git auth.
- **Policy:** [[policies/core/code-over-memory]] (enforce with tools, not
  discipline); AGENTS.md multi-agent section gets the claim protocol added.
- **Verification:** unit tests for the refuse/force/release paths in
  `start_issue_branch`/`complete_issue_branch`; integration test that two
  simulated sessions cannot both claim the same issue; stale-claim self-heal
  covered by a fixture with a deleted remote branch.

## Expected Outcomes

- A second session attempting `start_issue_branch(N)` learns immediately that
  N is taken, instead of after building a duplicate fix.
- Session-start shows what every other session is mid-flight on.
- Third collision this week does not happen.
