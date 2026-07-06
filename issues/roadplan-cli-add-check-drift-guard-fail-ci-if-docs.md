---
title: roadplan CLI: add --check drift guard (fail CI if docs/roadplan.md is stale)
status: scope-checked
created: 2026-07-05
category: feature
priority: high
tags: []
triage_date: 2026-07-05
triage_by: NetYeti
triage_notes: Triaged as feature / high.
scope_check_date: 2026-07-05
scope_check_by: NetYeti
scope_assessment: Issue is in active backlog.
scope_decision: in-scope
github_issue: 97
milestone: backlog
assigned_to: []
created_by: NetYeti@host
---

`scripts/generate-roadplan.ts` generates `docs/roadplan.md` but has no way to verify the committed copy is current. A `--check` mode (regenerate in-memory, diff against the committed file, exit non-zero if stale) lets CI catch a forgotten regen.

Prototyped in an abandoned branch during review; small, self-contained — good first issue.

## Acceptance criteria
- [ ] `tsx scripts/generate-roadplan.ts --check` exits 0 if up to date, non-zero with a clear message if stale.
- [ ] Output comparison is deterministic (no timestamp-only diffs).
- [ ] Optionally wired into CI.
