---
title: Reconcile versioning policy with practice
status: approved
author: NetYeti
created: 2026-07-11
tags:
  - versioning
  - policy
  - release
proposal_source: proposals/reconcile-versioning-policy-and-practice.md
priority: medium
complexity: low
automated: guided
assigned_to: NetYeti
tests_defined: true
tests_human_reviewed: true
scenario_synthesis: "Happy path: policy, scripts, and CI agree on ONE versioning model (recommend patch = per-release + a CI drift gate), with no references to the retired develop branch and a phase-close docstring that matches behaviour. Failure avoided: the current drift (policy says patch = completed-plan count, practice bumps per-release with count=0) confuses releases and violates code-over-memory."
total_steps: 3
completed_steps: 3
gate_note: "Changed files are untestable types: plans/reconcile-versioning-policy-and-practice.md"
tests_last_run: "2026-07-11T16:16:58.162Z"
tests_last_result: pass
tests_last_commit: 8eda38b
---

# Reconcile versioning policy with practice

## Overview

The versioning story drifted between policy and practice: `policies/core/versioning.md`
defines PATCH as "completed plan count within the current phase" but practice bumps
per-release (count is never derived); the policy still references the retired
`develop` branch; and `phase-close.ts`'s docstring claims behaviour it doesn't
implement. Pick ONE coherent, code-enforced model. Full detail:
[[proposals/reconcile-versioning-policy-and-practice]].

## Constraints & Invariants

1. **One model, code-enforced.** Whatever the chosen patch semantics, a check
   (CI or the existing drift gate) must enforce it — not human memory.
2. Policy edits are docs; the CI/script behaviour is the source of truth they must
   describe accurately.

## Implementation Steps

| # | Action | Details | Status |
| --- | --- | --- | --- |
| 1 | Decide + document the patch model | Amend `policies/core/versioning.md` to state the ACTUAL model. Recommend: **patch = per-release** (drop the "completed plan count within the phase" definition, which is never derived and diverges — VERSION 0.4.12 vs 0 completed `phase-4-*` plans). Keep minor = phase. Verify: the policy's PATCH definition matches what the release scripts do. | ✅ Done |
| 2 | Scrub retired-`develop` references + fix phase-close docstring | Remove `develop`-branch references from `policies/core/versioning.md` (trunk-based since 2026-06-30). Fix the `scripts/phase-close.ts` docstring to match its actual behaviour (it does not do the step-verification it claims). Verify: `grep -n develop policies/core/versioning.md` → none; the docstring matches the code. | ✅ Done |
| 3 | CI drift gate (VERSION ↔ package.json ↔ policy) | Add/verify a CI check that fails if `VERSION` and `package.json` version disagree (this also serves the release-v0.5.0 plan's step 5). Verify: a deliberate mismatch fails the check locally; matched passes. | ✅ Done |

## Testing Plan

*   Step 1/2: `policies/core/versioning.md` PATCH definition matches the release scripts; no `develop` references; phase-close docstring matches code (doc review + grep assertions).
*   Step 3: the drift gate fails on a deliberate VERSION/package.json mismatch and passes when aligned (run the check both ways).

## Phase Gate

*   Policy, release scripts, and CI agree on one patch model; no retired-`develop` references remain.
*   A CI drift gate enforces VERSION ↔ package.json (code-over-memory).
*   `tests_defined` + human review confirmed.

## Document History

| Date | Change | By |
| --- | --- | --- |
| 2026-07-11 | Drafted from the proposal. Status draft, awaiting BDFL approval. | NetYeti |
| 2026-07-11 | All 3 steps executed + landed on main via PR #327 (squash 71645e5). Patch=per-release documented; phase-close docstring + Automation section corrected; develop refs scrubbed (trunk-based); CI version gate extended to src/webui/package.json and real drift fixed (webui 0.4.9 → 0.4.12). Ready for completion. | NetYeti |
| 2026-07-11 | Test run recorded via verify_plan_tests: npm run test:dispatch → PASS @ 8eda38b | NetYeti |
