---
title: "Release dogfood-window uses a fixed 7-day clock (contradicts plan §5)"
status: open
github_issue: 93
category: bug
priority: high
tags:
  - github-issue
  - issue-workflow
created: 2026-07-05
created_by: "NetYeti@host"
assigned_to: ""
milestone: future
---

`src/dispatch/release.ts` computes the dogfood window as `actualDays >= 7` measured from the earliest `created` date of milestone items.

Plan §5 is explicit: the window "must span a real dogfood **session**, **not a fixed clock**." A fixed 7-day timer both under- and over-counts (a milestone created 8 days ago with no dogfooding passes; an intensively-dogfooded 5-day one fails).

## Acceptance criteria
- [ ] Window is satisfied by a real dogfood signal (e.g. a recorded dogfood session / beta-channel activity), not just elapsed calendar days.
- [ ] Threshold is documented and testable.
