---
title: Report Bug" button should pop-up a form
status: resolved
resolved: 2026-07-09
author: NetYeti
author-role: user
part_of: plans/release-v0.5.0.md
created: 2026-07-05
category: bug
priority: medium
complexity: medium
estimated_effort: S
tags: []
reported_dates: [2026-07-05]
demand_count: 1
triage_date: 2026-07-05
triage_by: NetYeti
triage_notes: Triaged as bug / medium.
scope_check_date: 2026-07-05
scope_check_by: NetYeti
scope_assessment: Issue is in active backlog.
scope_decision: in-scope
github_issue: 177
consumed_by: proposals/improve-bug-feature-report-dialog.md
assigned_to: []
created_by: NetYeti@cluster-llm
channel: dev
---

# "Report Bug" button should pop-up a form

## Description

"Report Bug" button should pop-up a form not open a form at the bottom of the page where no one will see it - and with zero style or UI beauty to it.

## System Info

None provided

## Resolution (2026-07-09)

The form was already wrapped in `modal-overlay`/`modal-card` divs, but had zero CSS -- it rendered as an unstyled block stacked at the bottom of the page, i.e. this bug was never actually fixed despite looking done in the markup. Delivered via `plans/improve-bug-feature-reporting-tool.md` (Wave C, Step 1): added a proper fixed-overlay modal with backdrop, centered card, styled form fields, and a Bug/Feature category toggle, in both dark and light themes. Verified live via Playwright screenshots.
