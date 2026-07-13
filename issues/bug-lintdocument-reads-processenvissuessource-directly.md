---
title: lintDocument reads process.env.ISSUES_SOURCE directly (ambient env coupling in pure dispatch fn)
status: new
created: 2026-07-13
author: agent
author-role: user
category: bug
priority: medium
complexity: medium
estimated_effort: S
demand_count: 1
reported_dates: [2026-07-13]
channel: dev
github_issue: https://github.com/growlf/docwright/issues/406
related: []
tags:
  - reported-bug
---

# lintDocument reads process.env.ISSUES_SOURCE directly (ambient env coupling in pure dispatch fn)

## Description

`src/dispatch/linter.ts` computes `const localIssuesGoverned = process.env.ISSUES_SOURCE !== 'github'` inside `lintDocument()` and gates the issue-status + milestone-open rules on it (GH-pivot Step 8). Reading ambient `process.env` inside a dispatch function violates the dispatch invariant that public functions are unit-testable with plain params and hold no state between calls beyond their inputs. It makes callers/tests environment-fragile: the same `lintDocument('issues/x.md', {status:'open'})` call returns a violation when ISSUES_SOURCE is unset (CI/host) but no violation when ISSUES_SOURCE=github (every deployed/dev instance).

Impact observed: the Web UI "Run Tests" button ran the dispatch suite with the instance env (ISSUES_SOURCE=github), so two tests asserting the governed behavior failed only inside a deployed instance — the button silently bounced back to "Run Tests". Symptom fixed at the test layer in commit 572fcb9 (scoped save/restore of ISSUES_SOURCE in the affected describe blocks), but the root coupling remains and will bite the next caller/test.

Proper fix: thread the issue-source (or a boolean `localIssuesGoverned`) into `lintDocument()` as a parameter/option, resolved once at the call sites from `getIssueSource(env)` (which already exists in issue-source.ts and takes an env object). Keep the dispatch core env-free. Update the linter call sites (pre-commit check.ts mirror, capture bridge, /status reader) to pass it. Add a test that the same input yields the same result regardless of process.env.

Verification: dispatch unit tests pass with ISSUES_SOURCE set to each of unset/local/github without any per-test env juggling; the pure function's output depends only on its arguments.

## System Info

None provided
