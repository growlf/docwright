---
title: Roadmap date discipline — enforce version/milestone dates + issue-in-range scheduling (DocWright + GitHub)
status: draft
author: NetYeti
created: 2026-07-13
tags:
  - governance
  - roadmap
  - milestones
  - dates
  - github-projects
  - planning
proposal_source: proposals/approved/roadmap-date-discipline.md
priority: high
automated: guided
assigned_to: NetYeti
tests_defined: false
tests_human_reviewed: false
_path: plans/roadmap-date-discipline.md
---

# Roadmap date discipline — enforce version/milestone dates + issue-in-range scheduling (DocWright + GitHub)

## Overview

Delivers the approved proposal [[proposals/approved/roadmap-date-discipline.md]] — see it for the full *what & why*.
Held at `status: draft`; fill in the implementation steps below before moving to `in-progress`.

The GH-pivot moved dev issues onto GitHub Issues + the DocWright Project board, but left the
**planning layer unbuilt**: milestones/versions have no target dates, issues aren't scheduled
within any range, and the "Roadmap" (GANTT) view is therefore blank. This proposal adds
**roadmap date discipline**: (1) a new version/milestone **must** carry an initial target date;
(2) issues assigned to a milestone are **enforced to fall within that milestone's date range**;
(3) it's implemented as a **split across both surfaces** — GitHub is the *store + display*
(milestone due dates, Project Start/Target date fields, the Roadmap view), and **DocWright is the
*enforcer*** (validation in dispatch + pre-commit/CI, surfaced in `/status`). This makes
progress-toward-goals trackable (a real burndown) and closes the pivot's planning gap. Extends the
GH-pivot and subsumes the "living-roadmap renderer" slice of
[[proposals/roadmap-discipline-carryover]].

## Implementation Steps

| Step | Action | Details | Status |
|------|--------|---------|--------|
| 1 | Add milestone date schema | Add `start_date` and `target_date` fields to the DocWright milestone schema definition | ⏳ Pending |
| 2 | Enforce milestone date presence | Block milestone activation if either start or target date is missing, treating dateless milestones as validation failures | ⏳ Pending |
| 3 | Add issue date fields | Extend the issue schema with `start_date` and `target_date` fields for range tracking | ⏳ Pending |
| 4 | Implement date-range validator | Create a rule that verifies `milestone.start ≤ issue.start ≤ issue.target ≤ milestone.target` for every issue | ⏳ Pending |
| 5 | Build GitHub milestone reader | Fetch milestone due dates directly from the GitHub API as the source of display truth | ⏳ Pending |
| 6 | Build GitHub Project date reader | Read Project-level date fields from GitHub to mirror the Roadmap surface | ⏳ Pending |
| 7 | Integrate validator in dispatch | Wire the date-range validator into DocWright's dispatch pipeline so violations are caught before execution | ⏳ Pending |
| 8 | Add pre-commit hook validation | Create a local hook that runs DocWright's validator against staged milestone and issue changes | ⏳ Pending |
| 9 | Add CI validation step | Add a DocWright validation job to CI that fails on any date-range or missing-date violation | ⏳ Pending |
| 10 | Surface results in /status | Expose validator outcomes and date-rule health in the DocWright `/status` command output | ⏳ Pending |
| 11 | Reject invented dates | Ensure DocWright never synthesizes dates and only enforces rules against data read from GitHub | ⏳ Pending |
| 12 | Document date truth flow | Add architecture notes clarifying GitHub as the human-facing store and DocWright as the enforcer | ⏳ Pending |

## Testing Plan

### Step Verification

- [ ] Creating a milestone without a start and target date fails validation with a clear error indicating missing date fields
- [ ] Opening an issue with a start date before its milestone's start date is rejected; opening with a target date after its milestone's target date is rejected; opening with both dates within range is accepted
- [ ] DocWright reads milestone and issue dates from GitHub Projects (not from local config or invented values) and the Roadmap GANTT view renders correct bar positions and lengths for milestones and issues with valid date ranges
- [ ] `/status` output surfaces milestone and issue date compliance status; a pre-commit or CI check blocks commits that introduce date violations; no code path in DocWright silently assigns or adjusts dates when they are missing or invalid

### Integration & Regression

- [ ] `npm test` passes with zero failures after each step is implemented
- [ ] Typecheck (`npm run typecheck` or equivalent) completes with no new errors
- [ ] Existing DocWright validation rules (e.g., title format, label requirements, body structure) continue to pass without regression
- [ ] GitHub milestone and issue creation/editing flows that do not involve date fields remain unaffected
- [ ] `/status` command continues to report all previously tracked dimensions alongside the new date-compliance dimension

### Gate Criteria

- [ ] All four step-verification checkboxes are checked and their test evidence is recorded
- [ ] `npm test` and typecheck are green on the main branch with the feature merged
- [ ] At least one milestone with start/target dates and at least three issues with start/target dates (one valid, one early, one late) exist in a test project and produce the expected pass/fail outcomes end to end
- [ ] DocWright enforcer rejects dateless active milestones and out-of-range issue dates in CI without human intervention
- [ ] No date value is generated, mutated, or silently defaulted by DocWright; all dates originate in GitHub and are read-only to the enforcer

## Rollback Procedures

## Rollback Procedures

| Scenario | Rollback |
|----------|----------|
| Milestone validation rejects valid planning | Disable DocWright milestone validator in dispatch; remove pre-commit hook; clear `/status` milestone check |
| Date enforcement blocks legitimate issue scheduling | Revert milestone range rule in validator; remove `issue.target ≤ milestone.target` constraint; redeploy CI pipeline |
| GitHub ↔ DocWright date sync breaks | Revert DocWright to read-only mode (stop writing dates); remove Roadmap date fields; manually restore dates via GitHub UI |
| Date truth source conflicts arise | Revert to GitHub-only dates; remove DocWright date validation; clear any cached date enforcement state |
| Full enforcement rollback needed | Revert DocWright to pre-enforcement version; remove all date validators; disable `/status` date checks; restore original commit hooks |

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Milestone dates set retroactively (after work begins) undermine burndown accuracy | Medium | High | DocWright validation rejects issues with start dates before the milestone start; /status surfaces stale ranges |
| GitHub Project date fields are edited directly, bypassing enforcement | High | Medium | DocWright CI gate re-validates on every issue transition; docs establish "dates are planned in Projects, enforced by DocWright" as the workflow contract |
| Team adopts milestone dates as aspirational rather than committed, causing chronic range violations | Medium | High | Validation errors block merges/dispatches rather than just warning; /status dashboard makes enforcement visible so stale ranges cannot silently accumulate |
| DocWright validator availability (service downtime, CI lag) creates a window where invalid dates ship uncaught | Low | High | Local pre-commit hook as fallback enforcement; date-range check is a pure function with no external dependencies, so it can run offline |
| Historical milestones without dates are migrated inconsistently, generating false validation failures | Medium | Low | One-time migration script sets provisional ranges for closed milestones; validator skips milestones with status `closed` or `completed` |
| Roadmap GANTT view displays stale or conflicting dates when GitHub cache hasn't refreshed | Low | Medium | DocWright reads directly from GitHub API (no intermediate cache); /status explicitly flags date freshness with last-synced timestamps |

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-07-13 | Created from approved proposal | NetYeti |
