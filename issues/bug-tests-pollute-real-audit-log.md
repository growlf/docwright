---
title: "Test suite writes to the real audit/lifecycle.jsonl instead of an isolated temp store"
status: open
author: NetYeti
author-role: contributor
created: 2026-07-01
category: bug
priority: medium
complexity: low
estimated_effort: S
tags:
  - testing
  - audit
  - governance
  - data-integrity
created_by: "NetYeti@cluster-llm"
assigned_to: ""
closed_by_pr: ""
cross_link: ""
---

> The inaugural native code-issue in the `issues/` store — captured while dogfooding #68
> Step 2. Found 2026-07-01: running the dispatch/MCP tests appended real entries to the
> canonical audit log.

## Problem

Running the test suite appends entries to the **real** `audit/lifecycle.jsonl` — the vault's
canonical governance audit trail. Observed after `npx mocha` runs:

```
{"ts":"2026-07-01T06:43:27.771Z","doc_path":"plans/test.md","transition_from":"draft","transition_to":"in-progress","actor":"NetYeti","actor_type":"human","git_commit":"0cbfb15"}
{"ts":"2026-07-01T06:43:27.775Z","doc_path":"plans/ai-plan.md","transition_from":"draft","transition_to":"in-progress","actor":"claude","actor_type":"ai","git_commit":"0cbfb15"}
```

`plans/test.md` and `plans/ai-plan.md` are test fixtures, not real plans — yet their
transitions were written into the production audit log with a real git commit hash. Had they
not been noticed and discarded, they would have been committed as genuine-looking audit
history.

**Broader than the audit log — tests also mutate real plan files.** During #68 Step 2 the
same test run rewrote frontmatter on a real plan
(`plans/separate-dev-tracking-milestones-and-beta-channel.md`: `automated: guided → full`,
`tests_defined: false → true`). So the isolation gap is not limited to `audit/lifecycle.jsonl`
— the suite writes into the live vault (`plans/`, and likely `proposals/`/`issues/`) instead
of an isolated fixture vault. This is the more serious face of the bug: a test run can
silently alter governance documents' state.

## Impact

The audit log is a governance record ("no auxiliary database — git is canonical"). Tests
polluting it with fabricated transitions undermines its trustworthiness and can leak fixture
noise into commits. It also makes the log non-deterministic across test runs.

## Steps to Reproduce

1. `git checkout` a clean tree.
2. Run `npx mocha -r tsx 'test/dispatch/*.test.ts'` (or the MCP/hook tests).
3. `git status` → `audit/lifecycle.jsonl` shows new fixture entries.

## Proposed Fix

- Tests must run against an **isolated fixture vault** (a `mkdtemp` root), never the repo
  working tree. Point the vault root, audit writer, and plan store at the temp location via
  env/injected path in test setup — including `audit/lifecycle.jsonl`, `plans/`,
  `proposals/`, and `issues/`.
- Give the audit writer a configurable path (e.g. `DOCWRIGHT_AUDIT_LOG`) and the vault root a
  configurable base; set both to temp dirs in setup; assert against those.
- Add a guard/test that the real working tree is unchanged after the suite runs.

## Verification

- After a full `npm run test`, `git diff --exit-code` is clean for `audit/lifecycle.jsonl`,
  `plans/`, `proposals/`, and `issues/`.
- Audit/plan tests still assert their transitions (against the temp store).
