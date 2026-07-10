---
title: Web UI Complete button only sets status field, never archives plan or redirects
status: new
created: 2026-07-10
author: agent
author-role: user
category: bug
priority: high
complexity: medium
estimated_effort: S
demand_count: 1
reported_dates: [2026-07-10]
channel: dev
related:
  - plans/completed/improve-bug-feature-reporting-tool.md
tags:
  - reported-bug
---

# Web UI Complete button only sets status field, never archives plan or redirects

## Description

Clicking "Complete" on a plan in the Web UI Properties pane (PropertiesPane.svelte, setPlanStatus('completed'), lines 174-193) only sets the `status` frontmatter field to `completed` and saves it -- it never moves the file to `plans/completed/`, never generates the completion doc, and never navigates anywhere. The button just closes/disappears with a toast, leaving the plan sitting in `plans/` with `status: completed`, which violates the same location-invariant convention pre-commit already enforces for proposals/approved/ (a completed plan should live under plans/completed/).

The correct end-to-end behavior exists as the `transition_to_completed` MCP tool ("Transition a plan with status: completed to plans/completed/ and generate doc") but the Web UI button never calls anything equivalent -- it has no knowledge of archival or doc generation at all.

User-visible symptom: user clicked Complete, "nothing seems to have happened" beyond the button closing, and they expected (reasonably) to land back on the status page with the plan showing as completed/archived.

Reproduced this session on plans/improve-bug-feature-reporting-tool.md: after clicking Complete in the UI, `status: completed` was set and committed locally, but the file remained at `plans/improve-bug-feature-reporting-tool.md` (not `plans/completed/`) with no docs/ file generated, until manually run through `verify_plan_tests` + `transition_to_completed` via MCP tools.

Fix: either have setPlanStatus('completed') call a server endpoint that performs the equivalent of transition_to_completed (move + generate docs) and then navigate to /status, or gate the Complete button on first confirming (same pattern as Certify/Approve) and route through a dedicated /api/plans/complete endpoint that wraps the same logic the MCP tool uses.

## System Info

None provided
