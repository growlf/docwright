# Friction Log

Track UX friction, bugs, and feature requests encountered while using DocWright.

**Review cadence: weekly.** Triage every entry within 7 days —
link it to an upstream issue (see `contribute_upstream`), fix it, or strike it.
Aged, untriaged entries surface as a notification badge on the vault status page.

## Format

| Date | Category | Severity | Description | Upstream Issue |
|------|----------|----------|-------------|----------------|
| 2026-07-05 | bug | medium | complete_issue_branch merge=true fails on every use under branch protection — merges before required checks finish, forcing a manual watch-then-merge dance per PR (NetYeti) | #166 |
| 2026-07-05 | ux-friction | medium | capture_bug_report suggest only matches near-exact titles (0.77 on verbatim) — a plain paraphrase of an existing bug returned zero suggestions, so real duplicates will slip past the dedup check (NetYeti) |  |

---
Categories: bug | feature-request | ux-friction | docs-gap | missing-abstraction
Severities: low | medium | high