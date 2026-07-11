---
title: Completion gate deadlocks runtime-verified plans — UI run-tests runs repo unit suites, cannot certify infra/deployment plans
status: new
created: 2026-07-11
author: agent
author-role: user
category: bug
priority: high
complexity: medium
estimated_effort: S
demand_count: 1
reported_dates: [2026-07-11]
channel: dev
related:
  - plans/image-based-deployment-any-directory.md
  - issues/bug-flaky-dispatch-bridgetestts-times-out-2000ms-inter.md
tags:
  - reported-bug
---

# Completion gate deadlocks runtime-verified plans — UI run-tests runs repo unit suites, cannot certify infra/deployment plans

## Description

OBSERVED 2026-07-11 completing plan image-based-deployment-any-directory (an infra/deployment plan verified at RUNTIME: docker build/health, docker diff, login, e2e). The UI lifecycle Complete action is gated behind a run-tests -> certify-tests flow. Clicking "run tests" (POST /api/lifecycle/run-tests) runs the whole-REPO unit suites (test:dispatch, test:hooks, test:mcp, test:compat, test:integration, atoms) and only sets tests_defined:true if ALL pass. For a plan whose verification is runtime (no plan-specific unit suite), this "comes back the same, no changes" — a suite is unrelated/flaky (e.g. dispatch/bridge.test.ts 2000ms timeout) or the run doesn't represent the plan's coverage — so it never flips tests_defined and can never advance to "certify tests", and Complete stays blocked. The user got fully stuck.

Two coupled problems:
1. run-tests conflates "this plan's tests" with "the entire repo unit suite". A deployment/docs/infra plan has no unit suite; its coverage is runtime verification. There is no in-UI way to record runtime verification as the plan's tests.
2. completion-gate.ts additionally requires a "## Phase Gate"/"### Gate Criteria" section and a Testing Plan with no unchecked boxes. create_docwright_proposal -> plan generation does NOT scaffold these sections, so an AI- or human-authored plan can reach "all steps done" and be uncompletable, with no in-UI affordance to add the missing structure.

IMPACT: any runtime-verified plan (deployment, infra, docs) deadlocks at completion. Workaround used this time: hand-add Testing Plan + Phase Gate sections via write_plan and set tests_defined/tests_human_reviewed via set_plan_field (MCP), then the human Completes. That requires MCP/CLI access the Web-UI-only user does not have — so a UI-only user is hard-stuck.

FIX DIRECTIONS (pick): (a) let run-tests/certify accept a plan-declared verification type (runtime|unit|none) and record runtime evidence as certification; (b) scaffold the Testing Plan + Phase Gate sections at plan creation; (c) add a UI affordance for a human to certify a runtime-verified plan directly (set tests_defined/tests_human_reviewed) without the unit-suite run; (d) make run-tests scope to plan-relevant suites, not the whole repo, and not fail completion on a known-flaky unrelated test.

RELATED: the flaky dispatch/bridge.test.ts (filed separately) makes run-tests non-deterministic even for plans that do have unit suites.

## System Info

None provided
