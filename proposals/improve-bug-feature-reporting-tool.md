---
title: Improve Bug & Feature Reporting Tool — Modal Form, Feature Requests, GitHub Linkage
author: NetYeti
created: 2026-07-06
priority: medium
complexity: medium
estimated_effort: M
approved: false
milestone: v0.5.0
tags:
  - reporting
  - ux
  - intake
category:
  - ux
  - intake
created_by: "NetYeti@cluster-llm"
assigned_to: []
depends_on:
  - "[[issues/bug-report-bug-button-should-pop-up-a-form.md]]"
  - "[[issues/bug-report-button-should-offer-feature-as-well.md]]"
  - "[[issues/bug-issues-created-from-report-bug-dont-create-the-gh-.md]]"
---

# Improve Bug & Feature Reporting Tool

## Summary

Consolidate three fragmented reporting-tool issues into one coherent proposal:

1. **Modal form UI** — Report Bug button currently opens a form at the bottom of the page (invisible/unstyled). Pop up a proper modal instead.
2. **Feature requests** — Extend the tool to capture feature requests, not just bugs. New features then surface in the demand heatmap.
3. **GitHub linkage** — Issues created from reports don't get the `github_issue:` backlink. Wire the Frappe HD → GitHub sync so reported issues auto-link.

Together, these make the intake pipeline functional end-to-end: users report issues/features → they land in the vault with GitHub sync → they surface in the heatmap for demand tracking.

## Problem Statement

The Report Bug button is underused and fragmented:
- UX is poor (form pops at bottom, no visual feedback, no styling)
- Only captures bugs, not feature requests → missed signal on demand
- Doesn't create GitHub issue backlinks → vault and GitHub drift apart

## Proposed Solution

**Step 1: Modal form UI**
- Replace the inline form (currently at bottom of `/status` page) with a modal dialog
- Clean form layout: category toggle (bug / feature), title, description, priority (optional), system info
- Success toast + redirect after submit

**Step 2: Feature request support**
- Add category toggle or radio group: "Bug" / "Feature Request"
- Route to appropriate intake template (issue vs. proposal)
- Both appear in the heatmap (demand tracking applies equally to bugs and features)

**Step 3: GitHub issue linkage**
- Wire `/api/issues/report/create` to call the Frappe HD ticket API (already in place) and capture the ticket response
- Extract the created GitHub issue number from the response
- Write the `github_issue:` field into the vault issue file
- Confirm the round-trip link in the success message

## Expected Outcomes

- Report button is the primary intake path (high UX, visible, non-intrusive)
- Users can report both bugs and feature requests in one place
- Reported issues are automatically synced to GitHub and linked (no manual mirror work)
- Demand heatmap is complete (both bugs and features contribute to signal)

## Resources Required

- Modal form component (Svelte) — reusable for other intake dialogs
- Route updates to `/api/issues/report/create` to wire Frappe → GitHub
- Testing: end-to-end report → GitHub sync verification

## Related Documents

- [[issues/bug-report-bug-button-should-pop-up-a-form.md]]
- [[issues/bug-report-button-should-offer-feature-as-well.md]]
- [[issues/bug-issues-created-from-report-bug-dont-create-the-gh-.md]]
