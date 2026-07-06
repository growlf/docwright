---
title: Release dogfood-window uses a fixed 7-day clock (contradicts plan §5)
status: scope-checked
created: 2026-07-05
category: bug
priority: high
tags: []
triage_date: 2026-07-05
triage_by: NetYeti
triage_notes: Triaged as bug / high.
scope_check_date: 2026-07-05
scope_check_by: NetYeti
scope_assessment: Issue is in active backlog.
scope_decision: in-scope
github_issue: 93
milestone: backlog
assigned_to: []
created_by: NetYeti@host
---

`src/dispatch/release.ts` computes the dogfood window as `actualDays >= 7` measured from the earliest `created` date of milestone items.

Plan §5 is explicit: the window "must span a real dogfood **session**, **not a fixed clock**." A fixed 7-day timer both under- and over-counts (a milestone created 8 days ago with no dogfooding passes; an intensively-dogfooded 5-day one fails).

## Acceptance criteria
- [ ] Window is satisfied by a real dogfood signal (e.g. a recorded dogfood session / beta-channel activity), not just elapsed calendar days.
- [ ] Threshold is documented and testable.
