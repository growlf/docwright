---
title: "Sub-Plan: TypeScript MCP Server Migration"
status: in-progress
author: NetYeti
created: 2026-06-09
tags:
  - phase-3
  - mcp-server
  - typescript
  - vault-portability
proposal_source: proposals/approved/sub-plan-ts-mcp-server.md
priority: high
complexity: high
phase: 3
automated: guided
assigned_to: NetYeti
parent_plan: phase-vault-portability-pilot.md
parent_deliverable: 1
tests_defined: true
scenario_synthesis: Migrate Python MCP server logic to TypeScript; implement standard MCP lifecycle; no external network access beyond dev dependencies.
total_steps: 9
completed_steps: 0
_path: plans/sub-plan-ts-mcp-server.md
---
# Sub-Plan: TypeScript MCP Server Migration

## Overview

Rewrite `scripts/mcp-server.py` in TypeScript with a `--mode` flag (`vault`/`upstream`) so DocWright's MCP server is vault-portable and lives in the same language ecosystem as the web UI. All existing MCP tools must pass parity tests in both modes. Remove the Python server and Python runtime after a soak period.

### Architecture

```
src/mcp/
├── server.ts           # Entrypoint: args parsing, transport init, tool registration
├── config.ts           # Env var resolution + validation
├── tools/
│   ├── index.ts        # Tool registry — exports all tools, attaches to server
│   ├── query.ts        # get_plan, get_status, list_active_plans, get_session_context, get_facts
│   ├── mutation.ts     # update_step, update_plan_status, append_history, set_plan_field, write_plan
│   ├── transitions.ts  # transition_to_approved, transition_to_completed, transition_to_canceled
│   └── utility.ts      # collate, audit_log, run_dry_run
├── lib/
│   ├── frontmatter.ts  # Frontmatter parse/write helpers
│   ├── steps.ts        # Step counting, status replacement, gate validation
│   ├── identity.ts     # Human identity resolution (.env → git config → fallback)
│   ├── audit.ts        # Audit log append/read (.docwright/audit.jsonl NDJSON)
│   ├── collate.ts      # Jaccard similarity engine
│   └── paths.ts        # REPO_ROOT / VAULT_ROOT resolution, file I/O wrappers
└── types.ts            # Shared interfaces (Plan, Config, Step, etc.)
```

**Tool loading**: Explicit registry in `tools/index.ts` — each tool file exports an `interface McpTool { name, description, handler }` and `tools/index.ts` iterates to register. No automatic discovery. Makes rollback per-tool explicit.

**Transport**: Support both `stdio` (default, for Claude Code) and `SSE` (for Docker/docker-entrypoint.sh). `--transport stdio|sse` flag. SSE port from `DOCWRIGHT_MCP_PORT` (default 3100; old default 3002 retained as fallback).

See \[\[proposals/approved/sub-plan-ts-mcp-server.md\]\] for full problem analysis and alternatives considered.

## Implementation Steps

| Step | Action | Details | Status |
| --- | --- | --- | --- |
| 1 | TypeScript project scaffold | Create `src/mcp/` directory tree as specified in Architecture above. Add `@modelcontextprotocol/sdk` (runtime) and `js-yaml`, `@types/js-yaml` (frontmatter parsing) to root `package.json`. Add build scripts `compile:mcp` and `start:mcp` to root `package.json`. Update root `tsconfig.json` — add `"src/mcp/**/*.ts"` to `include` array, and add `"src/mcp"` to the `exclude`\-override or separate tsconfig if different module settings needed (MCP server uses CommonJS to match root config). **Done when**: `npx tsc --noEmit` compiles `src/mcp/` without errors, `npm run start:mcp -- --help` prints flag documentation. | ⏳ Pending |
| 2 | `config.ts` — env var resolution | Implement `src/mcp/config.ts`: read `DOCWRIGHT_VAULT_ROOT`, `DOCWRIGHT_MCP_PORT` (default 3100, fallback 3002), `DOCWRIGHT_PROFILE`, `DOCWRIGHT_LOG_LEVEL` (default `info`, enum \`debug | info |
| 3 | `server.ts` — entrypoint + `--mode` flag | Implement `src/mcp/server.ts`: parse \`--mode vault | upstream`(default`vault`),` \--transport stdio |
| 4 | Lifecycle transition tools | Port `transition_to_approved`, `transition_to_completed`, `transition_to_canceled` to `src/mcp/tools/transitions.ts`. Validation rules (identical to Python): (a) `transition_to_approved` — proposal must exist, `approved: true`, `assigned_to` non-empty; carries over `priority`, `phase`, `complexity`, `tags`, `parent_plan`, `parent_deliverable`; creates plan file with Implementation Steps skeleton, Testing Plan placeholder, Rollback placeholder, Risk Assessment placeholder. Moves proposal to `proposals/approved/`. Writes audit log entry. (b) `transition_to_completed` — plan must have `status: completed`, no pending steps; updates parent plan's Deliverables table if `parent_plan`+`parent_deliverable` set; injects `completed_date`; moves plan to `plans/completed/`; generates doc in `docs/`. (c) `transition_to_canceled` — requires non-empty `cancellation_reason`; injects `canceled_date`; moves to `plans/completed/`. All write audit log entries via `src/mcp/lib/audit.ts`. **Done when**: parity test suite confirms identical return values and error messages vs Python server for all validation branches. | ⏳ Pending |
| 5 | Plan mutation tools | Port `update_step`, `update_plan_status`, `append_history`, `set_plan_field`, `write_plan` to `src/mcp/tools/mutation.ts`. Rules identical to Python: (a) `update_step` — step\_match substring match in any Implementation Steps section; status normalized via `done/complete/completed → ✅ Done` and `pending/todo/not done → ⏳ Pending`; auto-recounts `total_steps`/`completed_steps`; auto-resets `tests_defined` to `false`. (b) `update_plan_status` — validates status is in {draft, approved, in-progress, completed, canceled}; blocks `completed` if any pending steps; runs completion gate check (`tests_defined: true`, Phase Gate section exists, no unchecked `[ ]` items). (c) `append_history` — resolves identity from `.env` → `git config user.name` → fallback `NetYeti`; creates Document History table if absent; appends row. (d) `set_plan_field` — blocks 5 restricted fields: `status` (use update\_plan\_status), `gate_status` (human-only), `approved` (proposals only), `total_steps` (auto-managed), `completed_steps` (auto-managed). (e) `write_plan` — full content rewrite; validates required `title` frontmatter; blocks `status: completed` with pending steps; blocks `gate_status: approved/waived`; auto-detects `tests_defined` from presence of Testing Plan section; auto-recounts step counts. **Done when**: parity test suite confirms identical output shapes, error messages, and frontmatter mutations vs Python for every sub-branch. | ⏳ Pending |
| 6 | Query & utility tools | Port `get_plan`, `get_status`, `list_active_plans`, `get_session_context`, `get_facts`, `audit_log`, `collate`, `run_dry_run` to `src/mcp/tools/query.ts` and `src/mcp/tools/utility.ts`. Format conformance: (a) `get_plan` — appends governance footer listing 5 mutation tools; tries `plans/` first, falls back to `plans/completed/` with `[completed plan]` prefix. (b) `get_status` — 60s TTL file cache at `DOCWRIGHT_CACHE_DIR/docwright-status-cache.txt`; stale fallback on fetch error. (c) `get_session_context` — reads SESSION-LOG.md, truncates to last 100 lines with count header; appends active plans summary. (d) `collate` — Jaccard similarity on tokenized words (stop-word filtered, 3+ char tokens); default threshold 0.12. (e) `audit_log` — reads `.docwright/audit.jsonl` (NDJSON), returns last `limit` entries as markdown table. (f) `run_dry_run` — scans for proposals ready-to-approve (approved:true + assigned\_to) and plans ready-to-complete (status:completed). (g) `get_facts` — returns hardcoded invariants plus SOP listing from `docs/SOPs/`. **Done when**: every tool returns byte-identical output to Python server when run against the same fixture vault in the parity test suite. | ⏳ Pending |
| 7 | Parity test suite | Write `test/mcp/parity.test.ts` using mocha + tsx (matching project convention at `test/dispatch/*.test.ts`). Test every tool in both `--mode vault` and `--mode upstream` against fixture repos. **Baseline capture protocol**: Run Python server against a fixture vault, capture each tool's stdout to `test/mcp/fixtures/python-baseline/<tool-name>.txt`. Parity test reads the baseline file and compares TS server output character-for-character for success paths; compares error message text for error paths. Use existing `_test-fixture` pattern from `test/mcp/test-plan-tools.py` for plan mutation tests. Add `test/mcp/fixtures/sample-vault/` with a minimal vault structure (1 proposal, 1 plan, 1 completed plan, SESSION-LOG.md stub). **Performance benchmark**: Run `get_status` (most I/O-heavy tool) 100 times in both servers, assert TS server is not more than 2x slower than Python on same hardware. **Done when**: `npm run test:mcp` passes — all parity assertions green, no regressions. | ⏳ Pending |
| 8 | Docker & deployment update | **This step has 5 sub-steps executed in sequence:** (8a) Add TypeScript build stage to Dockerfile: compile `src/mcp/` to `dist/mcp/` during build; copy only compiled JS to production image (no tsx/tsc runtime). (8b) Update `docker-entrypoint.sh` to start both MCP servers side-by-side: Python on port `3002` (existing), TypeScript on port `3100` (new). Add `MCP_TRANSPORT=sse` env var propagation. (8c) **Soak period**: Both servers run in production for 7 days (or 10 completed lifecycle transitions, whichever comes later). Automated health check curls both servers' `get_status` endpoints and compares output. Log any discrepancies to `.docwright/soak-discrepancies.log`. Soak passes when zero discrepancies for 72 consecutive hours of uptime. (8d) After soak passes: change default entrypoint to TS server only; remove Python server `scripts/mcp-server.py`; remove `scripts/test-transitions.py`; remove `test/mcp/test-plan-tools.py`. (8e) Remove Python runtime from Dockerfile: remove `python3`, `python3-pip`, `python3-venv` from apt install; remove `.venv` creation; remove pip deps. Remove Python setup steps from CI. **Done when**: `docker build` succeeds, TS-only container starts and passes health check, all parity tests pass against the TS-only container. | ⏳ Pending |
| 9 | Hook & CI reference update | Update `scripts/pre-commit.sh`: replace `python3 -c "import sys,yaml..."` in `validate_assigned_to()` with equivalent shell or Node.js invocation (`node -e "JSON.parse(...)"` or `grep`\-based parsing). Update `.claude/settings.json`: hooks reference shell scripts, not the MCP server directly — verify no hooks reference `scripts/mcp-server.py` or Python paths. Update `.github/workflows/ci.yml`: remove `Setup Python` step, remove `Install Python dependencies` step, remove `Test MCP plan mutation tools` step (replaced by `npm run test:mcp`), update `Docker build` step to test against TS-only container. Remove `.venv` from `.dockerignore` or update it. **Done when**: `bash scripts/pre-commit.sh` passes on a staged plan file without Python installed, CI pipeline passes with zero Python steps. | ⏳ Pending |

## Testing Plan

| Test | Scope | Method |
| --- | --- | --- |
| Tool parity — vault mode | All 15+ tools | Run each tool against `test/mcp/fixtures/sample-vault/`; compare output char-for-char against Python baseline in `test/mcp/fixtures/python-baseline/` |
| Tool parity — upstream mode | All 15+ tools | Same, against DocWright's own repo at a pinned commit SHA |
| Error validation parity | All error branches | For each tool, trigger every possible error condition (missing file, invalid status, pending steps, restricted field, empty cancellation\_reason, missing approved, missing assigned\_to, invalid mode flag). Expected: identical error message text to Python server |
| Env var validation | Config module | Missing `DOCWRIGHT_VAULT_ROOT` → graceful error message (not crash); invalid `DOCWRIGHT_LOG_LEVEL` → warn + default to `info`; missing both `DOCWRIGHT_VAULT_ROOT` and `DOCWRIGHT_ROOT` → error in vault mode |
| `--mode` flag | Server entrypoint | Invalid flag → help text to stderr, exit code 1; `--mode vault` with no root env var → descriptive error; valid flags select correct root directory |
| `--test` smoke mode | Server entrypoint | `npx tsx src/mcp/server.ts --test` runs every tool against in-memory fixtures and reports pass/fail count; exit code 0 only if all pass |
| Transition validation | transition\_to\_\* tools | Test all rejected transitions: no approved flag, empty assigned\_to, pending steps remain, cancellation\_reason empty. Test success path for each. Verify audit log written |
| Mutation auto-counting | update\_step, write\_plan | After status change: verify `total_steps` and `completed_steps` match actual table rows |
| Completion gate | update\_plan\_status, write\_plan | Verify `tests_defined: false` blocks completed; missing Phase Gate section blocks completed; unchecked `[ ]` items block completed; all clear allows completed |
| Config parse | config.ts | Unit tests for every env var path — present, absent, empty, malformed. In `test/mcp/config.test.ts` |
| Performance benchmark | get\_status | 100 iterations on each server; TS not more than 2x slower than Python |
| Docker build | Dockerfile | `docker build` succeeds, container passes health check, tools respond via SSE on port 3100 |
| Side-by-side soak | Both servers in Docker | Automated health check curls both get\_status; zero discrepancies for 72 consecutive hours |
| No-Python pre-commit | pre-commit.sh | `bash scripts/pre-commit.sh` passes on staged plan file with `python3` removed from PATH |
| CI zero-python | CI pipeline | All CI jobs pass without Python setup step, without pip install, without Python test runner |

## Baseline Capture Protocol (for parity testing)

1.  Ensure Python MCP server is operational on this machine
2.  Set `DOCWRIGHT_VAULT_ROOT` to `test/mcp/fixtures/sample-vault/`
3.  Run: `python3 scripts/mcp-server.py --test > test/mcp/fixtures/python-baseline/smoke-output.txt`
4.  For each tool with specific arguments, run individually and capture: `python3 scripts/run-tool-test.py get_plan "collation" > test/mcp/fixtures/python-baseline/get_plan.txt`
5.  Commit baseline files alongside the parity test suite

## Rollback Procedures

*   **Per-tool rollback:** Revert individual `src/mcp/tools/*.ts` files via `git checkout`; the Python server remains available for that tool during soak period. No config changes needed.
*   **Full rollback:** `git revert HEAD` on the migration commit; restore `Dockerfile` to Python-only image; delete `src/mcp/` entirely; restore `.claude/settings.json`, `pre-commit.sh`, and CI config to pre-migration state. No vault config changes needed.
*   **Docker rollback:** Revert `Dockerfile` to remove TS build stage; restore `docker-entrypoint.sh` to Python-only; no config changes needed on vaults.
*   **Soak failure rollback:** If soak period detects discrepancies, file issues for each discrepancy, do NOT remove Python server until all issues resolved and 72-hour clean window achieved.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Tool behavior mismatch between Python and TS servers | Medium | High | Parity test suite compares char-for-char output against captured baseline; soak period catches edge cases; per-tool rollback path defined |
| YAML frontmatter parsing differences (`yaml.safe_load` vs `js-yaml`) | Medium | High | Pin `js-yaml` version; include explicit tests for edge cases (quoted strings, multiline values, empty fields, list indentation) in parity suite |
| Regex engine differences (`re.MULTILINE` `$` vs JS `m` flag) | Low | Medium | Port all regexes one-by-one with test coverage; `$` in `re.MULTILINE` matches at `\n` before end while JS `m` flag `$` also matches at `\n` — same behavior, but verify each |
| Async pattern differences (Python asyncio vs Node event loop) | Low | Low | All tools are I/O-bound (file reads/writes); no CPU-bound or network async patterns to diverge. Test confirms same output regardless of scheduling |
| Identity resolution edge cases | Low | Medium | `.env` missing, `git config user.name` missing, conflicting values — test all combinations in `test/mcp/config.test.ts` |
| File path resolution (Python `Path` vs Node `path`) | Low | Medium | Use `path.resolve()` consistently; test with symlinked vaults and relative paths |
| Env var name drift between vault and upstream modes | Low | Medium | Single `Config` interface in `config.ts` validates all vars at startup; both modes use same resolution path |
| `--mode` flag forgotten by operator | Low | Low | Default to `--mode vault`; log a warning if not set explicitly |
| Python MCP server used by external tooling | Low | Medium | Deprecation notice in Python server logs at startup; soak period before removal; CI tooling switches first, human workflows last |
| Step count auto-calculation regression (multi-section tables, nested tables) | Low | Medium | Only counts inside `## Implementation Steps` sections; nested `###` subsections are excluded by design. Regression test: plan with 3 subsections and 2+ implementations sections |

## Document History

| Date | Change | Author |
| --- | --- | --- |
| 2026-06-09 | Created from approved proposal | NetYeti |