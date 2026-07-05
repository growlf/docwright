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
scenario_synthesis: Contribution pipeline and friction log — MCP tools (contribute_upstream, log_friction, list_docwright_issues, create_docwright_proposal); structured logging; GitHub issue/URL generation; no VS Code or IDE-specific steps
assigned_to: NetYeti
tests_defined: true
tests_human_reviewed: false
phase: 5
total_steps: 3
completed_steps: 3
_path: plans/contribution-pipeline.md
github_epic: ""
automated: full
milestone: next
channel: beta
gate_note: "Changed files are untestable types: plans/contribution-pipeline.md"
tests_last_run: "2026-07-05T09:06:05.963Z"
tests_last_result: pass
tests_last_commit: a016891
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
| 1 | `contribute_upstream` MCP tool | Available in upstream mode only. Gated by `DOCWRIGHT_CONTRIB_APPROVED=1` env var (human-set; AI cannot forge). Validates input via sanitization schema. Creates GitHub issue via `DOCWRIGHT_GITHUB_TOKEN` env var, or generates a pre-filled URL fallback if token absent. Logs every call to `.docwright/contributions.log` (NDJSON: ts, title, category, docwright_version, issue_url_or_prefill, actor). | ✅ Done | — | — |
| 2 | `log_friction` MCP tool + periodic review | Available in vault mode. Creates structured entry in `docs/friction-log.md` with fields: description, category (`bug`\|`feature-request`\|`ux-friction`\|`docs-gap`\|`missing-abstraction`), severity, date. Documents review cadence (recommended: weekly). Wires periodic review: aged friction entries surface in the status page as a notification badge. | ✅ Done | #153 | `feat/153-log-friction-mcp-tool-periodic-review` |
| 3 | `list_docwright_issues` + consent intake flow | `list_docwright_issues(filter?)` queries GitHub issues on the DocWright repo by label/assignee. `create_docwright_proposal(title, body, category)` generates a pre-filled proposal creation URL (not a direct write — requires human consent). Together these form a loop: friction entry → related open issues → propose upstream if novel. | ✅ Done | #155 | `feat/155-list-docwright-issues-consent-intake-flow` |

## Parallelism Map

| Step | Depends On | Parallel With | Notes |
| --- | --- | --- | --- |
| 1 | — | 2 | Upstream mode only; no shared files with Step 2 |
| 2 | — | 1 | Vault mode; log file is independent of Step 1 |
| 3 | 1 | — | Needs `contribute_upstream` to exist before wiring the intake loop |

## Testing Plan

> Evidence: `test/mcp/contribution.test.ts`, `test/mcp/intake.test.ts`,
> `test/dispatch/friction.test.ts` (all in the CI `test:mcp` / `test:dispatch` chains,
> green in PRs #154/#156/#157/#164). Full `npm test` recorded green @ a016891 via
> verify_plan_tests (research-smoke fixed in #145/PR #164). The one unchecked box
> below is a human sign-off, not missing verification.

### Step Verification
- [x] Step 1: `contribute_upstream` MCP tool (`contribution.test.ts` — retroactive coverage added in PR #154)
- [x] Step 2: `log_friction` MCP tool + periodic review (`contribution.test.ts`, `friction.test.ts`)
- [x] Step 3: `list_docwright_issues` + consent intake flow (`intake.test.ts`)

- [x] Step 1: `contribute_upstream` with valid token creates a GitHub issue and logs the entry
      (`contribution.test.ts` token-path tests, PR #164: stubbed fetch asserts Bearer-auth POST to
      the GitHub API with correct labels, created-URL logged, token never logged, prefill fallback
      on API failure)
- [x] Step 1: `contribute_upstream` without token returns a pre-filled URL and still logs (`contribution.test.ts`)
- [x] Step 1: Call without `DOCWRIGHT_CONTRIB_APPROVED=1` is rejected with clear error (`contribution.test.ts`)
- [x] Step 2: `log_friction` creates a well-formed entry in `docs/friction-log.md` (`contribution.test.ts`; parse/append/legacy-table cases in `friction.test.ts`)
- [x] Step 2: Status page shows notification badge when aged friction entries exist
      (verified live 2026-07-05: webui dev server against a fixture vault with 2 aged + 1 fresh
      entries — `/api/status` returned exactly the 2 aged, and Playwright confirmed the amber
      `.friction-badge` rendered "⚠ 2 aged friction" with the cadence tooltip, linking to
      /docs/friction-log; screenshot captured)
- [x] Step 3: `list_docwright_issues` returns filtered results from GitHub (`intake.test.ts` stubbed; live run 2026-07-05: `label=governance` → 7 real issues, PRs excluded)
- [x] Step 3: `create_docwright_proposal` returns a valid pre-filled URL, does not write (`intake.test.ts`; live URL generation confirmed 2026-07-05)

### Integration & Regression

- [x] Existing MCP tests pass without modification (full `test:mcp` chain green in CI, PRs #154/#156)
- [x] TypeScript compiles cleanly (`tsc --noEmit` in CI Lint/Typecheck job)

### Gate Criteria

- [x] All three tools available in their respective modes (upstream/vault) — mode-gate rejection tests in `contribution.test.ts`; intake tools mode-agnostic by design (read-only)
- [ ] Human approval gate (`DOCWRIGHT_CONTRIB_APPROVED`) verified non-forgeable by AI
      — *rejection without the env var is tested; the non-forgeability claim is a deployment
      property (server env is human-set) — BDFL judgment call, left for human sign-off*
- [x] No direct GitHub writes — all issue creation is human-confirmed (`create_docwright_proposal`/`list_docwright_issues` write nothing, tested; `contribute_upstream` writes only behind the human-set env gate)

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
| 2026-07-03 | Step 1: Implemented contribute_upstream MCP tool — mode gate, human approval gate (DOCWRIGHT_CONTRIB_APPROVED), sanitization, GitHub issue creation via DOCWRIGHT_GITHUB_TOKEN or pre-filled URL fallback, NDJSON logging to .docwright/contributions.log | NetYeti |
| 2026-07-05 | Step 2 delivered (GH #153, PR #154): log_friction MCP tool (vault mode) with sanitization + category/severity validation; friction parse/append/age engine in src/dispatch/friction.ts (shared by MCP tool, /api/status, and init scaffold); weekly review cadence documented in the scaffold; aged-entry amber badge on the status page linking to docs/friction-log. Retroactive Step 1 test coverage added (mode gate, human gate, prefill fallback, NDJSON log). 332 dispatch + 26 friction/contribution/parity tests pass; webui builds clean. | NetYeti |
| 2026-07-05 | Step 3 delivered (GH #155): list_docwright_issues (label/assignee/state filters, PR filtering, rate-limit hint) + create_docwright_proposal (pre-filled URL only — consent-based, no upstream writes, so no approval gate needed). Upstream slug derives from origin in upstream mode, defaults to growlf/docwright in vault mode, DOCWRIGHT_UPSTREAM_REPO override. 10 new offline tests (fetch stubbed); full MCP suite green. All three plan steps now done. | NetYeti |
| 2026-07-05 | Testing Plan reconciled with evidence: deduplicated the doubled Step Verification block, ticked boxes with named test/CI citations (incl. live list_docwright_issues run), left three genuinely-unverified boxes unchecked with reasons (token-path issue creation, badge visual render, non-forgeability sign-off). | NetYeti |
| 2026-07-05 | Test run recorded via verify_plan_tests: npm run test:dispatch → PASS @ d165862 | NetYeti |
| 2026-07-05 | Test run recorded via verify_plan_tests: npm run test:mcp → PASS @ d165862 | NetYeti |
| 2026-07-05 | Test run recorded via verify_plan_tests: npm test → PASS @ a016891 | NetYeti |
| 2026-07-05 | Closed the two open verification gaps: token-path tests added (PR #164, with #145 research-smoke fix making full npm test green); badge render verified live via Playwright against a fixture vault (2 aged entries → amber badge + tooltip + friction-log link). Cleared the stale "❌ Failed" Step 1 Branch artifact. Only the non-forgeability BDFL sign-off (and tests_human_reviewed) remain before completion. | NetYeti |
