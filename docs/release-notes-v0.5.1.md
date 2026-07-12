# Release notes — v0.5.1

Patch release within Phase 5. A focused bug-fix pass hardening the AI-agent
lifecycle tooling (the MCP tools, Web-UI routes, and git hooks the governance
workflow runs on). No new features; no breaking changes.

## Fixes

- **Table-row parsing hardened across surfaces** (#332, #331) — a literal `|` in
  a table cell (an inline code span, or a pipe in history text) no longer
  corrupts rows. Shared `splitTableRow` / `extractPlanSteps` / `escapeTableCell`
  helpers; `plan-review` and `append_history` converged onto them. Removed the
  orphaned `checkWithAI` dead code from `promote.ts`.
- **Issue-status linter parity** (#333, fixes #261) — the dispatch linter's
  issue-status enum was stale and disagreed with the pre-commit hook + schema;
  aligned to the canonical lifecycle (`new … proposal-linked … resolved`).
  `capture_bug_report` output now passes the linter with zero hand-edits.
- **YAML-safe completion docs** (#334, fixes #185/#136) — `generateCompletionDoc`
  serializes frontmatter with `js-yaml` instead of string interpolation, so a
  plan title containing a colon/pipe/quote/`#` produces loadable YAML.
- **Pre-commit location-invariant scoped to frontmatter** (#337) — an
  `approved:`/`status:` line in a document body no longer false-triggers the
  location check.
- **end-session isolates unrelated debt** (#338, fixes #306) — a shutdown no
  longer aborts (losing the session note) when the working tree has validation
  debt unrelated to the session; it commits the session artifacts and reports
  the rest.

## Also
- Versioning policy reconciled with practice (PATCH is per-release); resolved
  #299/#300.

## Verification
`test:dispatch`, `test:mcp`, and `test:hooks` green across the merged PRs.
