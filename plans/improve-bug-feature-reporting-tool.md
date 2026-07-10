---
title: "Wave C — Report/Intake UX: modal form, feature requests, GitHub linkage, governance panel drill-in, issue promotion"
status: in-progress
author: NetYeti
created: 2026-07-09
tags:
  - reporting
  - ux
  - intake
proposal_source: proposals/approved/improve-bug-feature-reporting-tool.md
priority: medium
complexity: medium
automated: guided
assigned_to: NetYeti
tests_defined: false
tests_human_reviewed: false
related_to:
  - plans/release-v0.5.0.md
  - issues/bug-report-bug-button-should-pop-up-a-form.md
  - issues/bug-report-button-should-offer-feature-as-well.md
  - issues/bug-issues-created-from-report-bug-dont-create-the-gh-.md
  - issues/governance-panel-pending-approval-stat-is-mislabel.md
  - issues/governance-panel-status-stat-tiles-aren-t-clickabl.md
  - issues/bug-issues-have-no-forward-path.md
total_steps: 6
completed_steps: 5
scenario_synthesis: "Svelte UI + SvelteKit API route changes (modal form, governance panel, issue promotion) plus a one-off backfill script to backfill github_issue: links on already-reported issues via the existing Frappe HD -> GitHub sync API; no infrastructure or deployment steps. Happy path: user reports a bug/feature via modal, it lands in issues/ with a github_issue: backlink and appears in the heatmap; governance panel tiles are correctly labeled and clickable through to the filtered list; an issue can be promoted to a proposal from its detail view. Failure path: GH API is unreachable during report submit -- issue is still created locally, github_issue: stays unset, and the backfill script picks it up on a later run."
---

# Wave C — Report/Intake UX: modal form, feature requests, GitHub linkage, governance panel drill-in, issue promotion

## Overview

_Plan generated from approved proposal: Wave C — Report/Intake UX: modal form, feature requests, GitHub linkage, governance panel drill-in, issue promotion_

Wave C of the issue-cluster-remediation-waves — the full report/intake/governance-panel UX overhaul. Six issues, one coherent story: **make the intake loop lovable**. This clears 4 of the 5 remaining UI/UX gate items blocking release-v0.5.0.

## Implementation Steps

| # | Action | Details | Status |
|---|--------|---------|--------|
| 1 | **Modal report form** — Replace inline page-bottom form with Svelte modal dialog. Add category toggle (Bug/Feature). Add success toast on submit. | `src/webui/src/lib/components/ReportModal.svelte` — reusable modal; `src/webui/src/routes/+page.svelte` — wire report button to modal; `src/webui/src/routes/api/issues/report/+server.ts` — accept `category: bug| ✅ Done | ⏳ Pending |
| 2 | **Feature request support** — Extend backend to accept feature requests. Surface in demand heatmap alongside bugs. Update `issues/` frontmatter schema to support `category: feature`. | Backend intake handler; heatmap data source; frontmatter templates | ✅ Done |
| 3 | **GitHub issue linkage** — Auto-create GitHub issues on report submit. Wire `github_issue:` backlink into frontmatter. Sync existing reported issues. | `src/webui/src/routes/api/issues/report/create/+server.ts` — GH API integration; backfill script | ⏳ Pending |
| 4 | **Fix governance panel stats** — "Pending Approval" → correct label. Verify stat counts match proposal/issue state. | `src/webui/src/routes/status/+page.svelte` or governance panel component | ✅ Done |
| 5 | **Make governance stat tiles clickable** — Each tile drills into its filtered list (proposals, plans, issues). | Click handler + route navigation from governance panel | ✅ Done |
| 6 | **Issue promotion path** — Add "Create proposal from issue" button on issue detail view. Wire to proposal creation flow. | Issue page UI; `/api/proposals/create-from-issue` endpoint | ✅ Done |

## Testing Plan

- **Step 1:** Open modal from report button, submit bug + feature, confirm toast + issue file created
- **Step 2:** Submit feature request, verify it appears in heatmap
- **Step 3:** Submit issue, confirm `github_issue:` appears in frontmatter
- **Step 4:** Verify governance panel stat labels are accurate
- **Step 5:** Click each stat tile, confirm navigation to filtered list
- **Step 6:** Create proposal from issue, confirm plan is reachable

## Rollback Procedures

- Revert individual PRs per step
- Disable GH sync by reverting Step 3 changes
- Modal can be disabled via feature flag if needed

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| GH API rate limiting | Low | Medium | Queue/retry pattern on sync |
| Modal conflicts with existing form state | Low | Medium | Test edge cases (rapid submit, network fail) |
| Stat label change breaks downstream filters | Low | Low | Search for all references before renaming |

## Document History

| Date | Change | Author |
| --- | --- | --- |
| 2026-07-09 | Created from approved proposal | NetYeti |
| 2026-07-09 | Filled implementation steps, testing plan, risk assessment | NetYeti |
| 2026-07-09 | Steps 4-6 verified live via Playwright against the running dev server rather than assumed from source. Steps 4 (governance panel label) and 5 (clickable stat tiles) were already correctly implemented by earlier merged work -- confirmed working, no code change needed. Step 6 (issue forward-path buttons) was NOT actually working: IssueForwardPathActions.svelte gated visibility on frontmatter.type === 'issue', a field the org-operations schema never requires and only 6/62 existing issue files happen to have. Fixed by passing the document path into the component and detecting issue documents by their issues/ path prefix instead; re-verified live (buttons render, Create Proposal modal opens correctly). | NetYeti |
| 2026-07-10 | Steps 1-2 implemented and verified live via Playwright. The report modal had zero CSS despite being wrapped in modal-overlay/modal-card divs -- it rendered as an unstyled block at the bottom of the page, so GH #177 was never actually fixed. Added proper fixed-overlay modal CSS (dark + light theme) plus a Bug/Feature category toggle with dynamic labels. Backend: BugReport.category threaded through createReportedBug (feature- filename prefix, category: feature frontmatter), the dedup/suggest flow now scopes matches to the same category (bug vs feature never cross-suggest), and the demand heatmap widened to include feature requests with a distinct icon. Replaced blocking alert() calls in the report flow with the existing toast system. Added 2 new bridge.test.ts cases; full test:dispatch suite (391 tests) passes. Also discovered and resolved proposals/approved/improve-bug-feature-report-dialog.md -- an already-approved proposal covering the same two source issues that had never been moved to proposals/approved/ or given its own plan; marked consumed_by this plan instead of duplicating the work. | NetYeti |
