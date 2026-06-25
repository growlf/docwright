---
title: "Sub-Plan: Contribution Pipeline & Friction Log"
status: in-progress
author: NetYeti
created: 2026-06-14
tags:
  - mcp
  - upstream
  - friction-log
proposal_source: proposals/approved/sub-plan-contribution-pipeline.md
priority: medium
mode: autonomous
scenario_synthesis: "Contribution pipeline and friction log — MCP tools (contribute_upstream, log_friction, list_docwright_issues, create_docwright_proposal); structured logging; GitHub issue/URL generation; no VS Code or IDE-specific steps"
assigned_to: NetYeti
tests_defined: true
tests_human_reviewed: false
phase: 5
total_steps: 3
completed_steps: 0
_path: plans/contribution-pipeline.md
github_epic: null
---
# Sub-Plan: Contribution Pipeline & Friction Log

## Overview

Closes the feedback loop between DocWright vault users and DocWright's own development.
When a user hits a bug or missing feature while using DocWright, there is currently no
structured path to report it. This sub-plan adds three MCP tools:

- `contribute_upstream` — human-gated issue filing to the DocWright GitHub repo
- `log_friction` — structured friction log entry to `docs/friction-log.md`
- `list_docwright_issues` + `create_docwright_proposal` — consent-based intake flow

**Parent plan:** Phase 3 — Vault Portability (`plans/phase-3-vault-foundation.md`,
Steps 2 + 10). This sub-plan is the authoritative spec; Steps 2 and 10 in the parent
delegate here. Does not gate Phase 3 completion.

**Prerequisite:** TypeScript MCP Server (already complete).

## Implementation Steps

| Step | Action | Details | Status | Issue | Branch |
| --- | --- | --- | --- | --- | --- |
| 1 | `contribute_upstream` MCP tool | Available in upstream mode only. Gated by `DOCWRIGHT_CONTRIB_APPROVED=1` env var (human-set; AI cannot forge). Validates input via sanitization schema. Creates GitHub issue via `DOCWRIGHT_GITHUB_TOKEN` env var, or generates a pre-filled URL fallback if token absent. Logs every call to `.docwright/contributions.log` (NDJSON: ts, title, category, docwright_version, issue_url_or_prefill, actor). | ⏳ Pending | — | — |
| 2 | `log_friction` MCP tool + periodic review | Available in vault mode. Creates structured entry in `docs/friction-log.md` with fields: description, category (`bug`\|`feature-request`\|`ux-friction`\|`docs-gap`\|`missing-abstraction`), severity, date. Documents review cadence (recommended: weekly). Wires periodic review: aged friction entries surface in the status page as a notification badge. | ⏳ Pending | — | — |
| 3 | `list_docwright_issues` + consent intake flow | `list_docwright_issues(filter?)` queries GitHub issues on the DocWright repo by label/assignee. `create_docwright_proposal(title, body, category)` generates a pre-filled proposal creation URL (not a direct write — requires human consent). Together these form a loop: friction entry → related open issues → propose upstream if novel. | ⏳ Pending | — | — |

## Parallelism Map

| Step | Depends On | Parallel With | Notes |
| --- | --- | --- | --- |
| 1 | — | 2 | Upstream mode only; no shared files with Step 2 |
| 2 | — | 1 | Vault mode; log file is independent of Step 1 |
| 3 | 1 | — | Needs `contribute_upstream` to exist before wiring the intake loop |

## Testing Plan

### Step Verification

- [ ] Step 1: `contribute_upstream` with valid token creates a GitHub issue and logs the entry
- [ ] Step 1: `contribute_upstream` without token returns a pre-filled URL and still logs
- [ ] Step 1: Call without `DOCWRIGHT_CONTRIB_APPROVED=1` is rejected with clear error
- [ ] Step 2: `log_friction` creates a well-formed entry in `docs/friction-log.md`
- [ ] Step 2: Status page shows notification badge when aged friction entries exist
- [ ] Step 3: `list_docwright_issues` returns filtered results from GitHub
- [ ] Step 3: `create_docwright_proposal` returns a valid pre-filled URL, does not write

### Integration & Regression

- [ ] Existing MCP tests pass without modification
- [ ] TypeScript compiles cleanly

### Gate Criteria

- [ ] All three tools available in their respective modes (upstream/vault)
- [ ] Human approval gate (`DOCWRIGHT_CONTRIB_APPROVED`) verified non-forgeable by AI
- [ ] No direct GitHub writes — all issue creation is human-confirmed

## Rollback Procedures

All tools are additive MCP endpoints. Remove the tool registrations from the MCP server
index to roll back. `docs/friction-log.md` entries are human-readable and removable
manually. `.docwright/contributions.log` is append-only NDJSON; truncate if needed.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| AI forges `DOCWRIGHT_CONTRIB_APPROVED=1` | Low | High | Env var is human-set; AI cannot write env vars; pre-commit hook can validate |
| GitHub token leaked in contributions.log | Low | High | Log only issue URL/prefill URL, never the token itself |
| Friction log grows unbounded | Low | Low | NDJSON is line-oriented; implement log rotation when > N entries |

## Document History

| Date | Change | Author |
| --- | --- | --- |
| 2026-06-24 | Rewrote — stripped AI review noise, reset Step 1 to Pending (no documented failure root cause), added clean steps/testing/risk | NetYeti |
| 2026-06-14 | Created from approved proposal | NetYeti |
