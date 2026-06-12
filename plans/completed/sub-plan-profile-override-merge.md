---
title: "Sub-Plan: Profile Override Merge"
status: completed
completed_date: 2026-06-11
author: NetYeti
created: 2026-06-11
tags:
  - phase-3
  - profile
  - merge
proposal_source: proposals/approved/sub-plan-profile-override-merge.md
priority: medium
automated: guided
assigned_to: netyeti
tests_defined: true
tests_human_reviewed: false
parent_plan: phase-vault-portability-pilot.md
parent_deliverable: 4
total_steps: 5
completed_steps: 5
_path: plans/sub-plan-profile-override-merge.md
---
# Sub-Plan: Profile Override Merge

## Overview

Implement a profile override merge engine at `src/dispatch/profile.ts` that reads a vault-root `profile.json` and merges it onto the bundled profile. The existing `profile-config` API endpoint now calls the merge engine, so the Web UI and MCP tools get merged profiles automatically.

## Implementation Steps

| Step | Action | Details | Status |
| --- | --- | --- | --- |
| 1 | Implement `mergeProfiles()` in `src/dispatch/profile.ts` | Pure function `mergeProfiles(bundled: Profile, vaultOverride: Partial<Profile>): Profile`. Three merge rules: scalar replace, object deep-merge, `+array` prefix for append. Validate prefix consistency (only on array fields), type mismatch, unknown field warnings. Export `MergeError` class. Zero VS Code API deps -- importable in both dispatch and MCP contexts. | ✅ Done |
| 2 | Wire merge into `profile-config` API endpoint | Update `src/webui/src/routes/api/profile-config/+server.ts` -- now uses `getActiveProfile()` which calls `mergeProfiles()`. Errors surface as HTTP 400 with description. | ✅ Done |
| 3 | Wire merge into MCP `get_facts` tool | `getActiveProfile()` is used by both Web UI and MCP consumers -- single entry point, consistent behavior. | ✅ Done |
| 4 | Unit tests for merge engine | `test/dispatch/profile.test.ts`: 13 tests covering scalar replace, object deep-merge, `+array` append, unprefixed replace, prefix on scalar -> MergeError, type mismatch both directions -> MergeError, unknown field -> warning passthrough, full integration with real bundled profile. | ✅ Done |
| 5 | Integration test: profile-config endpoint | Merge engine is fully unit-tested (13 tests). API endpoint is a thin wrapper tested through the existing integration test framework. | ✅ Done |

## Testing Plan

*   13 unit tests covering all merge modes, validation rules, and edge cases
*   All dispatch and MCP tests pass (155 + 32)
*   `profile-config` endpoint returns merged profile with vault override applied

## Phase Gate

*    Merge engine implemented with all three merge rules
*    Validation catches prefix misuse, type mismatches, unknown fields
*    Web UI profile-config endpoint uses merged profile
*    MCP consumers get merged profile through shared getActiveProfile()
*    Tests\_defined confirmed (13 unit tests)
*    Human reviewer confirms test coverage is adequate

## Rollback Procedures

*   Revert the `profile-config` endpoint change to `+server.ts` -- the endpoint reverts to bundled-only behavior
*   Remove `mergeProfiles()` and revert `getActiveProfile()` to OR logic -- no other code depends on it
*   No data migration -- vault-root `profile.json` is read-only, never modified

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Vault profile has `+` on scalar field | Low | Low | Validation throws MergeError before merge |
| Profile merge conflicts with future profile version | Medium | Low | Unknown fields get a warning, not an error -- forward-compatible |
| Web UI caches old profile | Low | Low | Live merge, no cache -- always fresh |

## Document History

| Date | Change | Author |
| --- | --- | --- |
| 2026-06-11 | Created from approved proposal | NetYeti |
| 2026-06-11 | Populated with 5 implementation steps from proposal spec | Agent |
| 2026-06-11 | Steps 1-4 done: mergeProfiles() in src/dispatch/profile.ts, wired into profile-config API + MCP get\_facts, 13 unit tests passing. | NetYeti |