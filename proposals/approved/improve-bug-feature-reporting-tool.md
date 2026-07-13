---
title: "Wave C — Report/Intake UX: modal form, feature requests, GitHub linkage, governance panel drill-in, issue promotion"
author: NetYeti
created: 2026-07-06
priority: medium
complexity: medium
estimated_effort: M
approved: true
milestone: v0.5.0
tags:
  - reporting
  - ux
  - intake
category:
  - ux
  - intake
part_of: plans/release-v0.5.0.md
created_by: "NetYeti@cluster-llm"
assigned_to: NetYeti
depends_on:
  - "[[proposals/issue-cluster-remediation-waves.md]]"
related_to:
  - "[[https://github.com/growlf/docwright/issues/177]]"
  - "[[https://github.com/growlf/docwright/issues/178]]"
  - "[[issues/bug-issues-created-from-report-bug-dont-create-the-gh-.md]]"
  - "[[https://github.com/growlf/docwright/issues/112]]"
  - "[[https://github.com/growlf/docwright/issues/113]]"
  - "[[https://github.com/growlf/docwright/issues/176]]"
_path: proposals/approved/improve-bug-feature-reporting-tool
consumed_by: plans/improve-bug-feature-reporting-tool.md
---

# Improve Bug & Feature Reporting Tool

## Summary

**Wave C** of the [[proposals/issue-cluster-remediation-waves.md|issue-cluster-remediation-waves]] — the full report/intake/governance-panel UX overhaul. Six issues, one coherent story: **make the intake loop lovable**.

1. **Modal form UI** — Report Bug button pops at bottom (invisible/unstyled). Modal instead.
2. **Feature requests** — Extend to capture features, not just bugs. Surfaces in demand heatmap.
3. **GitHub linkage** — Reported issues don't get `github_issue:` backlinks. Wire Frappe HD → GitHub sync.
4. **Governance panel drill-in** — "Pending Approval" stat is mislabeled and non-clickable. Clickable tiles that drill into proposals/issues.
5. **Issue promotion path** — Issues have no forward path to plans in the UI. Wire issue→proposal→plan flow.

Together: users report issues/features → they land in the vault with GitHub sync → they surface in the heatmap → they're clickable in the governance panel → they promote to plans when ready.

## Problem Statement

The intake loop (report → triage → promote to plan) is functional but **unlovable**. Multiple friction points:

**Report phase:** form is invisible/unstyled (bottom of page), only captures bugs (no feature demand signal), doesn't link to GitHub
**Triage phase:** governance panel stats are mislabeled ("Pending Approval" means awaiting-plan, not awaiting approval) and non-clickable (can't drill into issues)
**Promotion phase:** issues have no forward path in the UI (no issue→proposal→plan flow visibility)

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

- **Report phase:** Modal form, high UX. Bugs + features captured. Auto-synced to GitHub (no manual mirror).
- **Triage phase:** Governance panel stats are correct and clickable. Drill into any proposal/issue from the dashboard.
- **Promotion phase:** Issues have a visible forward path. UI shows: issue → propose → plan → complete.
- **Demand signal:** Heatmap is complete (bugs + features). Most-reported items bubble to the top.
- **Outcome:** Intake loop is *delightful*, not friction. Contributors report freely; governance sees signals clearly; promotion is obvious.

## Resources Required

**Report phase:**
- Modal form component (Svelte) — reusable for other intake dialogs
- Route `/api/issues/report/create` wiring (Frappe → GitHub sync)

**Triage phase:**
- Governance panel component fixes (stat labels, clickable tiles)
- Issue drill-in modal or panel

**Promotion phase:**
- Issue page UI additions (forward-path breadcrumb/button to create proposal)
- Proposal/plan creation workflow from issue context

**Testing:** end-to-end report → proposal → plan flow verification

## Context & Relationship

This is **Wave C** of [[proposals/issue-cluster-remediation-waves.md|issue-cluster-remediation-waves]], promoted from deferred to v0.5.0 milestone. The issue-cluster proposal groups open work into three waves (B: governance enforcement, C: intake UX, D: workflow tooling); Wave C covers the full intake loop.
