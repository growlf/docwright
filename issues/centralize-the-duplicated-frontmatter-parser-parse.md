---
title: "Centralize the duplicated frontmatter parser (parseFm copied across 4+ files)"
status: open
github_issue: 94
category: feature
priority: high
tags:
  - github-issue
  - issue-workflow
  - enhancement
  - tech-debt
created: 2026-07-05
created_by: "NetYeti@host"
assigned_to: ""
milestone: future
---

`parseFm` is copy-pasted into `src/dispatch/release.ts`, `src/dispatch/bridge.ts`, `api/release/channel/+server.ts`, and `api/issues/report/+server.ts` (and elsewhere) — despite `src/dispatch/frontmatter.ts` already exporting `parseFrontmatter`, and despite #89's commit claiming "centralization."

## Acceptance criteria
- [ ] All copies replaced with the shared `parseFrontmatter` (or one shared helper).
- [ ] No behavior change; existing tests green.
- [ ] A lint/grep check (or note) to discourage re-duplication.
