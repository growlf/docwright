---
type: issue
status: resolved
resolved: 2026-07-10
created: 2026-07-07
author: NetYeti
author-role: contributor
ai-last-action: file issue 2026-07-07
part_of: plans/release-v0.5.0.md
consumed_by: plans/enhance-roadplan-pending-work-visibility.md
github_issue: 351
---

# UX: Release criteria checks lack visibility — "1/2 done" but no details on blockers

## Summary

Status page roadplan view shows "Awaiting all release criteria checks (Blockers, Majors, Dogfood, Burn-down)" with a progress indicator (1/2 done), but provides no details about:
- Which specific checks are passing vs failing
- What's blocking the remaining checks
- What action is needed to move forward

User must infer from individual metric cards what's blocking, but the summary message gives no guidance.

## Current Behavior

```
⏳ Awaiting all release criteria checks (Blockers, Majors, Dogfood, Burn-down).
[Promote to Beta (1/2)] button
```

User sees:
- Generic warning message
- Metric cards with progress bars (Blockers, Majors, Dogfood, Burn-down)
- "1/2" indicator but unclear what the "2" items are

## Expected Behavior

User should immediately see:
- ✅ Blockers: 0 open
- ✅ Majors: 3/5 resolved
- ❌ Dogfood: 4 days / 7 days required
- ❌ Burn-down: 85% complete (need 90%)

**Why it's blocked:**
- Dogfood window needs 3 more days
- Burn-down needs 5% more closure

Or:
```
⏳ Release blocked by:
  • Dogfood window: 4 days / 7 days (need 3 more days until 2026-07-10)
  • Burn-down: 85% / 90% required
```

## Impact

- Users don't know what to do next
- Unclear if they're waiting for time (dogfood) or work (burn-down)
- Reduces confidence in release readiness assessment

## Suggested Fix

1. Show per-criterion status badges (✅/❌) alongside summary
2. List blockers explicitly: "Release blocked by: Dogfood (3 days remaining), Burn-down (need 5% more)"
3. Add estimated completion date if time-dependent
4. Link to unresolved issues if work-dependent

## Severity

Low — visual clarity issue, no functionality broken
