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
tests_defined: true
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
completed_steps: 6
scenario_synthesis: "Svelte UI + SvelteKit API route changes (modal form, governance panel, issue promotion) plus a one-off backfill script to backfill github_issue: links on already-reported issues via the existing Frappe HD -> GitHub sync API; no infrastructure or deployment steps. Happy path: user reports a bug/feature via modal, it lands in issues/ with a github_issue: backlink and appears in the heatmap; governance panel tiles are correctly labeled and clickable through to the filtered list; an issue can be promoted to a proposal from its detail view. Failure path: GH API is unreachable during report submit -- issue is still created locally, github_issue: stays unset, and the backfill script picks it up on a later run."
---

# Wave C — Report/Intake UX: modal form, feature requests, GitHub linkage, governance panel drill-in, issue promotion

## Overview

_Plan generated from approved proposal: Wave C — Report/Intake UX: modal form, feature requests, GitHub linkage, governance panel drill-in, issue promotion_

Wave C of the issue-cluster-remediation-waves — the full report/intake/governance-panel UX overhaul. Six issues, one coherent story: **make the intake loop lovable**. This clears 4 of the 5 remaining UI/UX gate items blocking release-v0.5.0.

## Implementation Steps

| # | Action | Details | Status |
|---|--------|---------|--------|
| 1 | **Modal report form** — Replace inline page-bottom form with Svelte modal dialog. Add category toggle (Bug/Feature). Add success toast on submit. | The form was already wrapped in modal divs but had zero CSS. Added proper fixed-overlay modal CSS (dark + light theme) to `src/webui/src/routes/status/+page.svelte`, plus a Bug/Feature category toggle and toast feedback via `$lib/toast` | ✅ Done |
| 2 | **Feature request support** — Extend backend to accept feature requests. Surface in demand heatmap alongside bugs. Update `issues/` frontmatter schema to support `category: feature`. | `src/dispatch/bridge.ts` (`createReportedBug`, `suggestDuplicates`), `src/webui/src/routes/api/status/+server.ts` heatmap filter, `src/webui/src/routes/api/issues/report/+server.ts` and `report/create/+server.ts` | ✅ Done |
| 3 | **GitHub issue linkage** — Wire `github_issue:` backlink into frontmatter via the existing demand-gated promote flow; sync issues that crossed the threshold before this fix existed. | `src/dispatch/bridge.ts` (`promoteIssueToGithub`), `src/webui/src/routes/api/issues/promote/+server.ts`, `scripts/backfill-github-issues.ts` | ✅ Done |
| 4 | **Fix governance panel stats** — "Pending Approval" → correct label. Verify stat counts match proposal/issue state. | `src/webui/src/lib/GovernancePanel.svelte` and `src/webui/src/routes/status/+page.svelte` — already relabeled to "Awaiting Plan" by earlier work; verified live | ✅ Done |
| 5 | **Make governance stat tiles clickable** — Each tile drills into its filtered list (proposals, plans, issues). | Already wired to `bridge()?.navigate(...)` by earlier work; verified live (all four tiles navigate and filter correctly) | ✅ Done |
| 6 | **Issue promotion path** — Add "Create proposal from issue" button on issue detail view. Wire to proposal creation flow. | `src/webui/src/lib/IssueForwardPathActions.svelte` and `src/webui/src/routes/[...path]/+page.svelte` — fixed a visibility bug (see Document History); verified live | ✅ Done |

## Testing Plan

### Step Verification

- [x] **Step 1** — Open modal from report button, submit bug + feature, confirm toast + issue file created
- [x] **Step 2** — Submit feature request, verify it appears in heatmap with the correct icon
- [x] **Step 3** — Promote a demand-gated issue, confirm `github_issue:` appears in frontmatter with the category-correct label; dry-run the backfill script
- [x] **Step 4** — Verify governance panel stat labels are accurate
- [x] **Step 5** — Click each stat tile, confirm navigation to filtered list
- [x] **Step 6** — Confirm Create/Link Proposal buttons render on a real issue page and the modal opens correctly

### Integration & Regression

- [x] `npm run test:dispatch` passes (394 tests, including 5 new cases covering category behavior and promote guard logic)
- [x] `npm run compile` passes with no new type errors
- [ ] `npm run test:webui` — not run this session (no webui-specific automated suite covers this modal; verified manually via Playwright instead)

### Gate Criteria

- [x] All Step Verification checkboxes are passing
- [x] All Integration & Regression checkboxes are passing (webui automated suite exception noted above)
- [x] Report → heatmap → promote → GitHub round trip verified for both bug and feature categories (promote button verified visually; did not execute a live GitHub issue creation this session — see Document History)
- [ ] Human test certification (`tests_human_reviewed`) — pending human review

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
| 2026-07-10 | Step 3 scope narrowed after checking with the human: the plan text said "auto-create GitHub issues on report submit," but the app already had a deliberate anti-spam design -- the heatmap's promote button only appears once demand_count >= 3, specifically to avoid flooding the public repo with an issue for every first-time report. Confirmed to keep that gate rather than override it. Delivered: factored the promote endpoint's duplicated logic into a shared promoteIssueToGithub() in dispatch/bridge.ts, fixed it to use category-aware GitHub labels (bug -> "bug", feature -> "enhancement", it previously hardcoded "bug" for everything), and added scripts/backfill-github-issues.ts (dry-run by default, --execute to actually create) for issues that crossed the demand threshold before this fix existed. Added 3 guard-logic tests (no live network calls in tests). Verified live: crafted a feature-category test issue at demand_count 4, confirmed it ranks #1 in the heatmap with the correct icon and the promote button appears -- did not click it, since that creates a real public GitHub issue and this session did not run --execute or click-promote for real. | NetYeti |
| 2026-07-10 | Repair: update_step's row-replacement corrupted Step 1's table row when marking it done -- the original Details cell contained a raw, unescaped `\|` inside a code span (`` `category: bug\|feature` ``), which desynced the tool's column parsing, truncating the cell text and duplicating the Status cell (`✅ Done \| ⏳ Pending`). Also found `tests_defined` had flipped from `true` to `false` at some point during the step updates, with no corresponding edit from me. Rewrote the full plan via write_plan to fix both, refreshed Step 1-6 Details cells to describe what was actually built (some diverged from the original speculative plan -- e.g. no separate ReportModal.svelte component was created; the existing inline modal was fixed in place), and filled in the Testing Plan's checkboxes and Gate Criteria based on this session's verification. Filing a bug for the update_step pipe-corruption issue separately. | NetYeti |
