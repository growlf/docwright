---
title: "roadplan CLI: add --check drift guard (fail CI if docs/roadplan.md is stale)"
status: open
github_issue: 97
category: feature
priority: high
tags:
  - github-issue
  - issue-workflow
  - enhancement
  - good first issue
  - priority:low
created: 2026-07-05
created_by: "NetYeti@host"
assigned_to: ""
milestone: backlog
---

`scripts/generate-roadplan.ts` generates `docs/roadplan.md` but has no way to verify the committed copy is current. A `--check` mode (regenerate in-memory, diff against the committed file, exit non-zero if stale) lets CI catch a forgotten regen.

Prototyped in an abandoned branch during review; small, self-contained — good first issue.

## Acceptance criteria
- [ ] `tsx scripts/generate-roadplan.ts --check` exits 0 if up to date, non-zero with a clear message if stale.
- [ ] Output comparison is deterministic (no timestamp-only diffs).
- [ ] Optionally wired into CI.
