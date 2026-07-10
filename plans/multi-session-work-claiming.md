---
title: Multi-session work claiming — git-native issue claims so parallel sessions stop double-building
status: draft
author: NetYeti
created: 2026-07-10
tags:
  - governance
  - workflow
  - multi-agent
  - tooling
proposal_source: proposals/approved/multi-session-work-claiming.md
priority: high
automated: guided
assigned_to: NetYeti
tests_defined: false
tests_human_reviewed: false
_path: plans/multi-session-work-claiming.md
---

# Multi-session work claiming — git-native issue claims so parallel sessions stop double-building

## Overview

Delivers the approved proposal [[proposals/approved/multi-session-work-claiming.md]] — see it for the full *what & why*.
Held at `status: draft`; fill in the implementation steps below before moving to `in-progress`.



## Implementation Steps

| Step | Action | Details | Status |
|------|--------|---------|--------|
| 1 | Add claim fields to schema | Add `claimed_by` and `claimed_date` string fields to the issue frontmatter schema and validation. | ⏳ Pending |
| 2 | Stamp issue on branch create | Write `claimed_by`/`claimed_date` into `issues/<slug>.md` when `start_issue_branch` creates a new branch. | ⏳ Pending |
| 3 | Guard against existing branch | Refuse `start_issue_branch` if the remote branch already exists and return the existing branch info. | ⏳ Pending |
| 4 | Push branch immediately | Push the newly created branch to origin right after creation in `start_issue_branch`. | ⏳ Pending |
| 5 | Clear claim on merge | Remove `claimed_by`/`claimed_date` from the issue file when `complete_issue_branch` merges the PR. | ⏳ Pending |
| 6 | Clear claim on abandon | Remove `claimed_by`/`claimed_date` from the issue file when a branch is abandoned without merging. | ⏳ Pending |
| 7 | Surface claims in preflight | Include `claimed_by`/`claimed_date` and branch-exists status in `issue_preflight` response payload. | ⏳ Pending |
| 8 | Surface claims in bug suggest | Include claim info alongside deduplicated matches in `capture_bug_report` suggest output. | ⏳ Pending |
| 9 | List claims at session start | Add a repo-wide summary of open claims to `session_context` and the session-start skill output. | ⏳ Pending |
| 10 | Flag stale claims | Compare each claimed branch against `git ls-remote`; flag claims where the remote branch no longer exists. | ⏳ Pending |
| 11 | Auto-clear stale claims | Remove `claimed_by`/`claimed_date` from issue files whose remote branch is confirmed gone. | ⏳ Pending |

## Testing Plan

### Step Verification

- [ ] `start_issue_branch` for an open issue creates a branch, stamps the issue file with `claimed_by` and `claim_date` frontmatter, and pushes immediately
- [ ] `start_issue_branch` for an issue whose branch already exists (open or merged) returns an error with the existing branch name and does not create a duplicate
- [ ] `complete_issue_branch` on a claimed issue clears `claimed_by` and `claim_date` from the issue file on merge
- [ ] `complete_issue_branch` with `skipTests` on an abandoned branch clears `claimed_by` and `claim_date` from the issue file
- [ ] `issue_preflight` for an issue claimed by another session returns the claim details (claimant, date) in its output
- [ ] `capture_bug_report suggest` returns matching issues that are currently claimed, including claimant and claim date
- [ ] Session-start context output includes a list of all repo-wide claims and flags any claim whose remote branch no longer exists as stale
- [ ] Stale-claim self-heal clears `claimed_by` and `claim_date` from issue files whose remote branch has been deleted, and logs the cleanup

### Integration & Regression

- [ ] `npm test` passes with zero failures after all changes
- [ ] `npm run typecheck` (or equivalent) passes with no new errors
- [ ] Existing `start_issue_branch` behavior for unclaimed issues is unchanged — branch is created, pushed, and issue file linked
- [ ] Existing `complete_issue_branch` behavior for unclaimed issues is unchanged — tests run, PR created, issue closed
- [ ] `issue_preflight` output for unclaimed issues returns no claim fields — no regressions in preflight structure

### Gate Criteria

- [ ] All eight Step Verification checkboxes are checked
- [ ] All five Integration & Regression checkboxes are checked
- [ ] A two-session dry run confirms: session A claims an issue, session B sees the claim at intake and at session-start, session A completes the issue, session B no longer sees the claim
- [ ] A stale-claim scenario is verified: delete a remote claim branch, run session-start, confirm the claim is auto-cleared from the issue file
- [ ] No plaintext credentials or secrets are introduced or logged by claim-related code paths

## Rollback Procedures

## Rollback Procedures

| Scenario | Rollback |
|----------|----------|
| `start_issue_branch` fails after claiming but before push succeeds | Delete the remote branch if it was pushed (`git push origin --delete <branch>`). Clear `claimed_by` and `claim_date` from the issue file. Commit the cleaned issue file. |
| `start_issue_branch` succeeds but issue file stamp is malformed or missing fields | `git checkout` the issue file to its prior state (`git checkout HEAD~1 -- issues/<slug>.md`). Branch and claim remain valid; re-stamp the file manually or re-run intake. |
| `complete_issue_branch` / merge fails mid-way (PR created but not merged) | No claim release needed — claim remains valid. Fix the merge failure (resolve conflicts, re-run checks). If abandoned, manually clear `claimed_by`/`claim_date` and commit. |
| `complete_issue_branch` releases claim but merge pollutes main | Revert the merge commit (`git revert -m 1 <merge-sha>`). The claim was already cleared — that is correct and should not be reverted. Reopen the issue if work must continue. |
| `issue_preflight` or `capture_bug_report suggest` returns stale or incorrect claim data | Regenerate the index/cache from frontmatter: re-run the indexing pass over all issue files. No file data is mutated by a read-only preflight — at worst a false negative surfaced. |
| Session-start flagging reports false stale claims (branch exists but detection missed it) | The stale-claim self-heal should not have cleared it — verify the remote branch exists (`git ls-remote origin <branch>`). If incorrectly cleared, re-stamp `claimed_by`/`claim_date` on the issue file and re-push the branch reference. |
| Stale-claim self-heal deletes a claim on a branch that still exists locally but not on remote | Push the branch first (`git push origin <branch>`), then re-stamp the claim. Self-heal only checks remote — a local-only branch will be treated as stale. To prevent this, always push immediately on claim (enforced by step 1). |

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Race condition on branch creation — two agents call `start_issue_branch` simultaneously and both believe they secured the claim | Low | High | Atomic branch creation via git push; second agent receives explicit "branch already exists" error with the existing claim surfaced |
| Stale-claim auto-clear fires on transient remote connectivity failure, incorrectly releasing an active claim | Medium | Medium | Retry remote branch check with backoff before clearing; log all auto-clear events to audit trail for manual review |
| Force-push or manual branch deletion outside tooling leaves orphaned `claimed_by`/`claim_date` metadata in issue files | Low | Medium | Stale-claim self-heal runs at session-start and periodically; orphaned claims flagged for human review before hard-clearing |
| Concurrent writes to issue file frontmatter during simultaneous tool invocations corrupt `claimed_by`/`claim_date` fields | Low | High | Atomic file write (write-to-temp + rename); validate frontmatter schema after every write; fail closed on parse error |
| Existing tool regressions from integrating claim logic into `complete_issue_branch`, `start_issue_branch`, and `issue_preflight` | Medium | Medium | Targeted test coverage for claim creation, release, and surfacing paths; feature flag to disable claim logic without removing it |
| Excessive false-positive claim notifications at session-start create coordination overhead and alert fatigue | Medium | Low | Configurable staleness threshold; suppress self-claims; only surface claims older than configurable window (default: 24h) |

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-07-10 | Created from approved proposal | NetYeti |
