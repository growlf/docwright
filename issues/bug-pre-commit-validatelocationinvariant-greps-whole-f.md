---
title: pre-commit validate_location_invariant greps whole file for approved:, not just frontmatter
status: proposal-linked
created: 2026-07-09
author: agent
author-role: user
category: bug
priority: medium
complexity: medium
estimated_effort: S
demand_count: 1
reported_dates: [2026-07-09]
channel: dev
related:
  - proposals/approved/bulk-issue-to-proposal.md
tags:
  - reported-bug
github_issue: 375
---

# pre-commit validate_location_invariant greps whole file for approved:, not just frontmatter

> **Proposal-linked 2026-07-11** (backlog cleanup) → captured by `proposals/harden-plan-proposal-lifecycle-tooling.md`. Not lost; will be delivered as part of that proposal/plan.


## Description

scripts/pre-commit.sh's validate_location_invariant() checks files under proposals/approved/ with:
  APP=$(grep "^approved:" "$FILE" | sed 's/^approved: *//')
  [ "$APP" != "true" ] && print_error ...
This greps the ENTIRE file, not just the frontmatter block (unlike get_frontmatter, which other validators in the same script correctly use). If the proposal body contains an illustrative YAML code block that happens to include a line starting with `approved:` (common when a proposal is documenting a frontmatter schema change and shows example frontmatter), grep returns multiple lines and the multi-line string never equals "true", so a correctly-approved proposal is rejected with a false "approved != true" error.

Reproduced on proposals/approved/bulk-issue-to-proposal.md, which had `approved: true` in its real frontmatter (line 11) plus an unrelated `approved: false` inside a "Proposal frontmatter additions" example code block in the body (was line 94) -- worked around this session by removing the illustrative line, but the hook should scope the grep to the frontmatter block via the same get_frontmatter() awk helper the other validators already use.

## System Info

None provided
