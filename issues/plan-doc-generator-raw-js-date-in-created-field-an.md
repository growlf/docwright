---
title: Plan doc generator: raw JS date in created: field and unquoted colon-containing title:
status: proposal-linked
created: 2026-07-05
category: bug
priority: medium
tags: []
triage_date: 2026-07-05
triage_by: NetYeti
triage_notes: Triaged as bug / medium.
scope_check_date: 2026-07-05
scope_check_by: NetYeti
scope_assessment: Issue is in active backlog.
scope_decision: in-scope
github_issue: 136
assigned_to: []
created_by: NetYeti@host
---

Found while archiving `separate-dev-tracking-milestones-and-beta-channel` via `transition_to_completed` (see PR #135).

The generated `docs/<plan>.md` frontmatter has two cosmetic bugs:

1. `created:` is emitted as a raw JS date string — `created: Tue Jun 30 2026 17:00:00 GMT-0700 (Pacific Daylight Time)` — instead of the ISO date from the source plan (`2026-07-01`).
2. `title:` is emitted unquoted even when it contains a colon (`title: Base Process-Flow: code-issue/...`), which is ambiguous YAML and can break frontmatter parsers.

Affected: the MCP `transition_to_completed` doc generator (`src/mcp/tools/transitions.ts`); the webui `transition-completed` endpoint quotes the title but should be checked for the date handling too.

Example artifact: `docs/separate-dev-tracking-milestones-and-beta-channel.md`.
