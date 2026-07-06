---
title: "Centralize the duplicated frontmatter parser (parseFm copied across 4+ files)"
status: resolved
github_issue: 94
closed_by_pr: "#187"
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
milestone: backlog
---

`parseFm` is copy-pasted into `src/dispatch/release.ts`, `src/dispatch/bridge.ts`, `api/release/channel/+server.ts`, and `api/issues/report/+server.ts` (and elsewhere) — despite `src/dispatch/frontmatter.ts` already exporting `parseFrontmatter`, and despite #89's commit claiming "centralization."

## Acceptance criteria
- [ ] All copies replaced with the shared `parseFrontmatter` (or one shared helper).
- [ ] No behavior change; existing tests green.
- [ ] A lint/grep check (or note) to discourage re-duplication.

## Resolution (2026-07-05)

Fixed by PR #187 (webui-write-integrity Step 1). Canonical dispatch parser
(JSON_SCHEMA + tolerant fallback) replaces 6 copies; grep-guard test prevents new
ones. Remaining known copies are scoped: +page.svelte client serializer → plan
Step 5, plain-node .js scripts allowlisted pending a loader decision.
