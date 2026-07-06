---
title: Release process leaves VERSION and package.json on main stale — bump only lands on release branch
status: open
github_issue: 205
created: 2026-07-06
author: NetYeti
author-role: user
category: bug
priority: medium
complexity: medium
estimated_effort: S
demand_count: 1
reported_dates: [2026-07-06]
milestone: backlog
channel: dev
tags:
  - reported-bug
---

# Release process leaves VERSION and package.json on main stale — bump only lands on release branch

## Description

Releases v0.4.6, v0.4.7, and v0.4.8 each bumped VERSION, package.json, package-lock.json, src/webui/package.json, and src/webui/package-lock.json in a single commit on the release/vX.Y.Z branch that was never merged back, so main still said 0.4.5 three releases later (observed 2026-07-06 while cutting v0.4.9). Consequences: (1) scripts/release-tag.sh defaults to the VERSION file, so running it without an argument from main would re-tag a stale version; (2) .docwright/config.json adopt_version comparisons and the session-start adoption check compare against a wrong current version; (3) any UI/status surface reading VERSION or package.json under-reports what is actually deployed. Fix options: bump on main via PR first and cut the release branch from the bump commit (used for v0.4.9 as fix-forward), or make release-tag.sh refuse to tag when HEAD's VERSION does not match the requested tag, or have the release script open the bump PR to main itself. Enforcement belongs in code (release-tag.sh guard) per code-over-memory. Related: proposals/approved/fix-or-retire-version-js.md (version.js miscomputes below current — same family of version-source drift).

## System Info

DocWright main @ ad32927, phoenix, discovered during v0.4.9 release cut
