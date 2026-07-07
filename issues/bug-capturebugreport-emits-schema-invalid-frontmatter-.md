---
title: capture_bug_report emits schema-invalid frontmatter (status: open, milestone on new) — pre-commit rejects its own output
status: new
created: 2026-07-07
author: NetYeti@phoenix
author-role: user
category: bug
priority: high
complexity: medium
estimated_effort: S
demand_count: 1
reported_dates: [2026-07-07]
channel: dev
github_issue: https://github.com/growlf/docwright/issues/261
tags:
  - reported-bug
---

# capture_bug_report emits schema-invalid frontmatter (status: open, milestone on new) — pre-commit rejects its own output

## Description

capture_bug_report action=create writes issue files whose frontmatter violates the issue schema enforced by the git pre-commit hook, so a freshly captured bug cannot be committed without hand-editing — defeating the "code over memory" point of the tool.

Observed 2026-07-06 filing issues/bug-bmslocal-deployment-hostnames-unresolvable-from-st.md:
1. Tool wrote `status: open`; pre-commit rejected: "Invalid status 'open'. Must be one of: new, triaged, scope-checked, awaiting-proposal, proposal-linked, resolved, duplicate, deferred". Tool should write `status: new`.
2. Tool wrote `milestone: future`; pre-commit rejected: "Cannot set milestone on status='new'. Milestone is only allowed when status is proposal-linked, resolved, or deferred". Tool should omit milestone at creation.

Also note the tool stamped `created: 2026-07-07` / `reported_dates: [2026-07-07]` while local date was 2026-07-06 — likely UTC vs local timezone; worth deciding which is canonical while fixing the frontmatter emitter.

Fix: align the capture_bug_report frontmatter template with the issue schema (single source of truth — ideally the emitter and the validator read the same schema definition, per code-over-memory), and add a test that a tool-created issue file passes the pre-commit validator.

## System Info

DocWright repo main @ 024a4ec, dw-vault MCP server, git pre-commit issue validation
