---
title: Version display drift — UI shows 0.5.0 but code is 0.4.9
status: scope-checked
author: NetYeti
author-role: user
created: 2026-07-06
category: bug
priority: critical
complexity: medium
estimated_effort: M
tags: [versioning, deployment, audit-trail]
reported_dates: [2026-07-06]
demand_count: 1
triage_date: 2026-07-06
triage_by: NetYeti
triage_notes: Critical for operational visibility. Version must be reliable and match deployed code.
scope_check_date: 2026-07-06
scope_check_by: NetYeti
scope_assessment: Version drift creates audit/visibility risk. Blocks dogfood multi-user rollout.
scope_decision: in-scope
github_issue: null
assigned_to: [NetYeti]
created_by: NetYeti@cluster-llm
channel: dev
related: []
---

# Version display drift — UI shows 0.5.0 but code is 0.4.9

## Problem

**Version state is out of sync across the system.** The status dashboard and UI report v0.5.0, but the actual codebase (VERSION file, git tags, releases) is at 0.4.9. This breaks operational visibility and makes it impossible to know which version is actually deployed.

**Impact:**
- Dogfood deployment showing wrong version
- Can't tell which version is running without checking code
- Blocks multi-user rollout verification (can't confirm all 4 instances have correct version)
- Version footer now displays (committed), but shows wrong value

## Root Causes to Investigate

1. **Uncommitted edits on dogfood branch** — VERSION file may have been manually changed but not committed
2. **dogfood branch is ahead of main** — version bump to 0.5.0 made locally but never pushed/tagged
3. **Different DOCWRIGHT_ROOT on running instance** — dev server reading VERSION from wrong directory
4. **Build/cache artifact** — compiled assets showing stale version

## Solution

### Immediate (restore consistency)
1. Verify actual state of VERSION on dogfood branch + running instance
2. Merge main → dogfood to bring it to current (0.4.9)
3. Push dogfood; verify UI shows 0.4.9
4. Clear any build caches

### Long-term (prevent recurrence)
- [ ] CI gate: block commits that change VERSION outside of release process
- [ ] Pre-commit hook: warn if VERSION doesn't match a released git tag
- [ ] Deployment checklist: version validation before deploying
- [ ] Monitoring: alert if running version diverges from source VERSION

## Verification

**Done when:**
- [ ] UI footer (bottom left) shows v0.4.9
- [ ] All 4 deployments report same version
- [ ] Version matches git tag (v0.4.9 points to current HEAD)
- [ ] No uncommitted VERSION edits on any branch
