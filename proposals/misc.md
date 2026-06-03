---
complexity: low
title: "Misc / Catch-all Inbox"
author: NetYeti
created: 2026-06-02
tags:
  - inbox
  - collation-test
approved: false
created_by: "NetYeti@phoenix"
assigned_to: ""
---
## Purpose

This is a deliberate catch-all for random UX/UI thoughts that don't yet warrant
their own proposal. It is also the **reference test case** for the collation
feature (`ux-collating-proposals-into-apropriate-plans.md`): when that feature
is built, running it against this file should automatically detect overlaps with
existing proposals, suggest promoting the novel ideas to new proposals, and offer
to move matched items out — leaving this file as an empty inbox ready for the
next batch of thoughts.

Do not manually resolve the items below. Leave them for the collation feature
to process.

## Ideas

Below are the raw ideas captured during development. Each is either now
covered by an existing or new proposal, or still pending extraction.

| # | Idea | Status | Proposal |
|---|------|--------|----------|
| 1 | Immutable H1 from frontmatter title | **Promoted** | [[proposals/ui-immutable-title-h1.md]] |
| 2 | Auto-open WYSIWYG on proposal create | **Covered** | [[proposals/approved/ux-new-proposal.md]] |
| 3 | AI-assisted proposal review/fill button | **Covered** | [[proposals/ai-proposal-improve-on-save.md]] |
| 4 | "Critique this plan" stress-test button | **Pending** | Not yet proposed — see [[proposals/multi-perspective-review-feature.md]] which partially covers (generic "second opinion" quick action) |

## Collation Note

When the collation feature (`ux-collating-proposals-into-apropriate-plans.md`)
is built, it should:
- Remove rows marked **Covered** from this table
- Offer to promote **Pending** items to new proposals
- Leave the file as an empty inbox
