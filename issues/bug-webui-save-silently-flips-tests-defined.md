---
title: "Web UI save silently flips tests_defined and reruns syncTestCriteria as a side effect"
status: open
github_issue: 148
author: NetYeti
author-role: contributor
created: 2026-07-01
category: bug
priority: high
complexity: medium
estimated_effort: M
tags:
  - webui
  - governance
  - data-integrity
  - plans
created_by: "NetYeti@cluster-llm"
assigned_to: ""
closed_by_pr: ""
cross_link: "issues/bug-webui-lifecycle-actions-not-committed-to-git"
milestone: future
---

> Found 2026-07-01 while dogfooding #68. Originally filed as "rewrites plan frontmatter
> just from viewing it" — **that premise was disproven** (see Correction). Sibling of
> [[issues/bug-webui-lifecycle-actions-not-committed-to-git]].

## Correction (2026-07-01): it is NOT an on-view write

Empirically tested against the running webui: a pure view (GET the plan page + `/api/read`)
leaves the file **unchanged**. The earlier "mutates on view" conclusion was wrong. The
mutation requires a client **save** action (any PropertiesPane control that calls `onsave`).
When the plan was open and being clicked through, saves fired and produced the observed diff:

```
-automated: guided      +automated: full
-tests_defined: false   +tests_defined: true
```

## Root cause (two parts)

1. **Server side-effect — the real bug.** `src/webui/src/routes/api/write/+server.ts`
   `updateTestsDefined()` flips `tests_defined: false → true` on **every save** whenever a
   `## Testing Plan` section merely *exists*, and `applySyncTestCriteria()` rewrites the body.
   Our plan carries a template Testing Plan section, so any save silently sets
   `tests_defined: true` — conflating "has a Testing Plan heading" with "tests are defined
   and verified." That is a governance-integrity violation: `tests_defined` is a gate input
   and should only be set by the explicit run-tests flow (`/api/lifecycle/run-tests`) or the
   deliberate toggle — never as a side effect of an unrelated field edit.

2. **Client resends `automated`.** `automated: full` originates from a click on the "Auto"
   execution-mode badge (`PropertiesPane.svelte:445`) — there is no server coercion. Once set
   (possibly accidentally), every subsequent save re-persists it, so restoring it to `guided`
   on disk got clobbered on the next save. This half is user-originated, not a phantom write,
   but the fact that a single accidental badge click permanently flips a governance field with
   no confirmation is worth hardening.

## Impact

Editing any one field on a plan silently mutates `tests_defined` (a completion-gate input),
and the Testing Plan body gets rewritten. Combined with
[[issues/bug-webui-lifecycle-actions-not-committed-to-git]] (UI writes aren't committed),
this leaves governance state changed without intent and the working tree dirty.

## Proposed Fix

- **Remove the `tests_defined` auto-flip from `/api/write`.** A save must not change
  `tests_defined`; leave it to `/api/lifecycle/run-tests` and the explicit toggle. (Verify
  `create-plan` still works — it sets `tests_defined` itself, not via `/api/write`.)
- **Make `syncTestCriteria` on save additive-only / opt-in**, or skip it on plans that
  already have a Testing Plan section, so a save never rewrites human-authored test content.
- **Optional hardening:** confirm before changing execution mode (`automated`), or at least
  don't re-persist unchanged governance fields the user didn't touch.

## Verification

- Editing an unrelated plan field via the UI leaves `tests_defined` and the Testing Plan
  section unchanged on disk.
- `tests_defined: true` is only reachable via run-tests or the explicit toggle.
- A pure view never writes (already true).

## Scope update (2026-07-04)

Core bug fixed by PR #86 (d4c6551): `updateTestsDefined` is now demote-only and never
promotes `tests_defined` on save. Remaining: `applySyncTestCriteria` still runs
`syncTestCriteria` unconditionally on every plan save (rewriting the Testing Plan body),
and the client `automated`-field re-persist hardening was not done. Stays open for those.
