---
title: "transition_to_completed must gate on a recorded green test run + fully-checked Testing Plan"
status: resolved
github_issue: 159
closed_by_pr: "#161"
category: feature
priority: high
tags:
  - github-issue
  - issue-workflow
  - enhancement
created: 2026-07-05
created_by: "NetYeti@host"
assigned_to: ""
milestone: future
---

Found while closing out `plans/contribution-pipeline.md`: the Testing Plan checkboxes were never ticked because **no tooling connects an actual test run to the plan**, and `transition_to_completed` gates only on `status: completed` + no pending steps — a plan can complete with `tests_defined: false` and every verification box unchecked.

Per `policies/core/code-over-memory.md`, enforce it in code:

## Acceptance criteria
- [ ] New MCP tool `verify_plan_tests(plan_name, script?)` — runs a **package.json-defined** npm script (default `test`; arbitrary shell strings rejected), stamps the plan (`tests_last_run`, `tests_last_result`, `tests_last_commit`) and appends a Document History row with the result.
- [ ] `transition_to_completed` refuses unless: `tests_defined: true`, **zero unchecked `- [ ]` boxes** in the Testing Plan section, and `tests_last_result: pass` is recorded. Error message says exactly what's missing.
- [ ] Stale-evidence warning when `tests_last_commit` ≠ current HEAD (warn, not block — the human judges).
- [ ] Unit tests for the gate (each refusal path) and the runner (injected fake runner, no real npm in tests).

**Security:** the runner must not become an arbitrary-command MCP endpoint — script name is validated against package.json.
**Policy:** `policies/core/code-over-memory.md`.
**Verification:** gate refusal paths + runner behavior unit-tested; live run recorded on contribution-pipeline itself before its completion.

## Resolution (2026-07-05)

Fixed by PR #161. verify_plan_tests MCP tool records tests_last_run/result/commit +
history row (script names validated against package.json); checkCompletionGate refuses
on any unchecked Testing Plan box or missing/failing recorded run; transition_to_completed
enforces the gate itself and warns when the recorded commit no longer matches HEAD.
15 unit tests cover every refusal path with an injected fake runner.
