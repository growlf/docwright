---
title: Phase Gate / Gate Criteria boxes have no write path — never auto-checked, and no UI control to check them (plans dead-end at Complete)
status: new
created: 2026-07-13
author: agent
author-role: user
category: bug
priority: high
complexity: medium
estimated_effort: S
demand_count: 1
reported_dates: [2026-07-13]
channel: dev
github_issue: https://github.com/growlf/docwright/issues/407
tags:
  - reported-bug
---

# Phase Gate / Gate Criteria boxes have no write path — never auto-checked, and no UI control to check them (plans dead-end at Complete)

## Description

The plan completion gate (src/dispatch/completion-gate.ts checkCompletionGate) refuses completion while any `- [ ]` remains in the '## Phase Gate' / '### Gate Criteria' section. But nothing in the system can check those boxes:

1. No auto-check on completion. update_step only writes the Status column of the '## Implementation Steps' table; it has no linkage to the Phase Gate checklist. So as each step is completed (marked ✅ Done), the corresponding gate criterion stays `- [ ]`. Marking all steps done + certifying tests still leaves every gate box unchecked.

2. No UI control to check them. PropertiesPane.svelte (uncheckedGateItems, ~line 300) COUNTS unchecked gate items and lists them as a Complete blocker ('{n} gate criteria unchecked'), but the plan detail view renders no checkbox/toggle to satisfy them. There is no gate-check endpoint either.

Result: every plan dead-ends at Complete. The human certifies tests, clicks Complete, gets 'N gate criteria unchecked', and has NO in-UI way to resolve it — the only mechanism is hand-editing the body via write_plan (MCP), which direct-edit hooks otherwise block. Observed live on plans/roadmap-date-discipline (2026-07-13): all 7 steps done, tests certified + green, yet Complete refused on 5 unchecked Phase Gate boxes; unblocked only by checking them via write_plan.

Design question to resolve (not obvious — needs BDFL intent): should gate criteria be
  (a) auto-checked when their backing evidence exists (e.g. tie criteria to steps / tests_last_result / CI), reducing them to a derived view; or
  (b) an explicit human sign-off with a real UI affordance (a checkbox in the plan review pane that saves through the sanctioned plan-write path, gated by ACL); or
  (c) both — auto-derive the technical criteria, leave a single explicit human 'verification reviewed' toggle.
Whatever the choice, there must be a sanctioned write path (auto or UI) so completion is reachable without hand-editing plan markdown.

Verification: from the Web UI, a plan with all steps done + tests certified can be driven to Complete without any manual markdown edit or MCP call — the gate criteria are satisfiable through a supported surface.

## System Info

None provided
