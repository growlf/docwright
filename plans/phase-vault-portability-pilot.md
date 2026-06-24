---
title: Phase 3 — Vault Foundation, Perception & Real-World Pilots
status: in-progress
author: NetYeti
created: 2026-06-08
phase: 3
tags:
  - phase-3
  - vault-portability
  - msp-pilot
  - vault-write-api
  - vault-document-index
  - knowledge-graph
proposal_source: proposals/approved/phase-vault-portability-pilot.md
priority: high
mode: guided
assigned_to: NetYeti
gate_reviewer: NetYeti
gate_status: reviewed
tests_defined: true
tests_human_reviewed: false
depends_on:
  - phase-2-foundation
related_to:
  - proposals/sub-plan-vault-write-api.md
  - proposals/sub-plan-vault-document-index.md
  - proposals/knowledge-graph-cross-document-idea-linkage.md
  - proposals/sub-plan-msp-pilot-vault.md
  - proposals/sub-plan-cascade-steam-early-access.md
total_steps: 14
completed_steps: 10
scenario_synthesis: Vault portability and real-world pilot — TypeScript MCP server, docwright init scaffold, MSP pilot vault, Cascade STEAM early access, upstream contribution pipeline; no VS Code extension or IDE-specific steps
_path: plans/phase-vault-portability-pilot.md
consumed_by: plans/completed/plan-script-skill-docwright-adopt-initialize-docwright-on-existing-vaults.md
github_epic: null
---
# Phase 3 — Vault Portability, Real-World Pilot & Upstream Contribution Pipeline

## Overview

Establishes the foundational infrastructure DocWright needs before any real work can be trusted: a vault write API that maintains referential integrity across all file moves, a unified document index that covers both frontmatter relationships and body-text wikilinks, and a knowledge graph that makes the structure of work visible before problems compound. These three items land before the pilots run.

Then delivers the real-world pilots (MSP + Cascade STEAM early-access) against that foundation, proving DocWright can be adopted on any external vault with no manual file edits and no stale references.

The contribution pipeline (`sub-plan-contribution-pipeline`) is in-progress but does not gate Phase 3 — it runs in parallel and closes in Phase 5.

See [[proposals/approved/phase-vault-portability-pilot.md]] for the original design rationale.

**Prerequisite:** Phase 2 gate review by NetYeti must complete before this plan begins.

## Deliverables

| # | Deliverable | Sub-Plan Proposal | Status |
|---|-------------|-------------------|--------|
| 1 | TypeScript MCP Server with `--mode` flag | [[proposals/approved/sub-plan-ts-mcp-server.md]] | ✅ Done |
| 2 | Vault Portability Foundation (path resolution + .mcp.json) | [[proposals/sub-plan-vault-portability-foundation.md]] | ✅ Done |
| 3 | `docwright init` scaffold | [[proposals/sub-plan-docwright-init-scaffold.md]] | ✅ Done |
| 4 | Profile override merge engine | [[proposals/approved/sub-plan-profile-override-merge.md]] | ✅ Done |
| 5 | Vault migration system (`MIGRATION.md` + `vault:migrate`) | [[proposals/approved/sub-plan-vault-migration-system.md]] | ✅ Done |
| 6 | Contribution pipeline & friction log | [[proposals/approved/sub-plan-contribution-pipeline.md]] | 🔀 In progress — moved to Phase 5 (5e); does not gate Phase 3 |
| 7 | MSP pilot vault (non-profit managed services) | [[proposals/sub-plan-msp-pilot-vault.md]] | ⏳ Needs approval |
| 8 | Cascade STEAM early-access vault | [[proposals/sub-plan-cascade-steam-early-access.md]] | ⏳ Needs approval |
| 9 | Architecture boundary document (`docs/vault-portability.md`) | [[proposals/sub-plan-architecture-boundary-doc.md]] | ✅ Done |
| 10 | `docwright adopt` — existing vault adoption tooling | [[proposals/approved/docwright-adopt-existing-vault.md]] | ✅ Done |
| 11 | Vault Write API (moveDocument, renameDocument, canonical setField) | [[proposals/approved/sub-plan-vault-write-api.md]] | ✅ Done |
| 12 | Vault Document Index (unified frontmatter + wikilink edges) | [[proposals/approved/sub-plan-vault-document-index.md]] | ✅ Done |
| 13 | Knowledge Graph (D3 force-directed, 4th status tab, gap detection) | [[proposals/knowledge-graph-cross-document-idea-linkage.md]] | ✅ Done — proposal approval pending |

**Ordering:** Deliverables 11 → 12 → 13 must land before pilots (7, 8). Everything else can run in parallel around that spine. Deliverable 6 runs independently and closes in Phase 5.

## Implementation Steps

| Step | Action | Details | Status | Issue | Branch |
|------|--------|---------|--------| --- | --- |
| 1 | Vault-portable TypeScript MCP server with `--mode` flag | Rewrite `scripts/mcp-server.py` in TypeScript. `DOCWRIGHT_VAULT_ROOT` env var is first-class config. `--mode upstream` flag switches the server to target DocWright's own repo instead of the vault. Zero hard-coded paths. Replaces Python server; remove Python from Dockerfile. Parity test: all existing tools pass against both vault and upstream modes. | ✅ Done | — | — |
| 2 | Contribution pipeline tools on dw-upstream | **Delegated to `plans/sub-plan-contribution-pipeline.md`** — that plan is the authoritative spec for Steps 1–3 (contribute_upstream, log_friction, list_docwright_issues). See sub-plan for full details. Does not gate Phase 3. | ⏳ Pending | — | — |
| 3 | Path resolution — no hardcoded paths | `docwright init` writes `.env` with `DOCWRIGHT_PATH` as first step. All vault-side files reference `$DOCWRIGHT_PATH` — never absolute paths. Update `.claude/settings.json` hook commands to use `$DOCWRIGHT_PATH`. Hook install script: `npm run hook:install -- --vault /path`. | ✅ Done | — | — |
| 4 | `.mcp.json` template | Define `.mcp.json` template wiring `dw-vault` (vault mode) and `dw-upstream` (upstream mode). Both reference `$DOCWRIGHT_PATH`. Template generated by `docwright init`. | ✅ Done | — | — |
| 5 | `docwright init` scaffold | `npm run init -- --dest /path/to/new-vault --profile org-operations` creates full vault structure, `.docwright/config.json`, `.env`, `.mcp.json`, `.claude/settings.json`, pre-commit hook, `profile.json` stub, `docs/friction-log.md`. Must work end-to-end: init → open in web UI → create proposal → approve → create plan. | ✅ Done | — | — |
| 6 | `vault:migrate` script + `MIGRATION.md` | Define `MIGRATION.md` schema (per-version BREAKING sections with migration commands). Implement `npm run vault:migrate -- --vault /path --from X --to Y`: reads `MIGRATION.md`, applies steps in version range, updates `.docwright/config.json`, never touches vault content. Write first `MIGRATION.md` entry. | ✅ Done | — | — |
| 7 | Profile override merge | Profile engine reads vault-root `profile.json` and merges onto bundled profile: scalars replace, objects deep-merge, `+array` appends, unprefixed array replaces. Test: MSP vault adds one required field without losing bundled defaults. | ✅ Done | — | — |
| 8 | MSP pilot vault | Create git repo for non-profit managed services. Run `docwright init`. Write policies: service-catalog, change-management, incident-response, security-baseline, onboarding. Complete at least one full proposal→plan→completed cycle entirely through DocWright. Record friction log entries throughout. Acceptance bar: full lifecycle works with no manual file edits required. | ⏳ Pending | — | — |
| 9 | Cascade STEAM early-access vault | Using `docwright init` and the Phase 3 architecture, provision a Cascade STEAM vault on a local git repo. No Forgejo, no AI stack yet — just the vault structure, org-operations profile, and stub policies from the Drive vault seed. Gives leadership hands-on access and validates the vault seed content before Phase 5 production infrastructure begins. Acceptance bar: leadership can open the Web UI, read the vault seed, and submit their first proposal. | ⏳ Pending | — | — |
| 10 | Friction log tooling | **Delegated to `plans/sub-plan-contribution-pipeline.md` Step 2.** See sub-plan for full details (log_friction MCP tool, docs/friction-log.md structure, periodic review cadence). | ⏳ Pending | — | — |
| 11 | Architecture boundary document | `docs/vault-portability.md` written covering: three adoption modes, manifest upgrade contract, js-yaml baked-path approach, moving vaults between machines, CI usage, DOCWRIGHT_ROOT vs DOCWRIGHT_VAULT_ROOT. | ✅ Done | — | — |
| 12 | Vault Write API | `moveDocument(src, dest)`, `renameDocument(path, newName)`, `setDocumentField(path, field, value)` implemented in `src/dispatch/vault-write.ts`. Full rollback on failure, wikilink cascade, cross-ref update, write-audit.jsonl. `fix-stale-approvals.ts` marked @deprecated — approve/rename endpoints wired to canonical API. 13 tests passing. | ✅ Done | — | — |
| 13 | Vault Document Index | `buildIndex`, `readIndex`, `writeIndex`, `rebuildIfStale`, `getBacklinksFor`, `queryDocuments` implemented in `src/dispatch/vault-index.ts`. `/api/graph` and `/api/vault/query` live. SSE wires index rebuild on file change. Two test files (24 tests). Proposal `approved: true`. | ✅ Done | — | — |
| 14 | Knowledge Graph | `KnowledgeGraph.svelte` (580 lines) and `GraphView.svelte` (228 lines) implemented. D3 force-directed, 4th status tab, 6 gap-detection categories, filter sidebar. Wired into status page. Proposal code-complete but `approved: false` — NetYeti to approve `proposals/knowledge-graph-cross-document-idea-linkage.md`. | ✅ Done | — | — |

## Parallelism Map

Steps that share no overlapping files can be worked simultaneously on separate `feat/` branches.
Fill in Depends On and Parallel With based on reviewing the step details above.

| Step | Depends On | Parallel With | Notes |
| --- | --- | --- | --- |
| 1 | — | — | |
| 2 | — | — | |
| 3 | — | — | |
| 4 | — | — | |
| 5 | — | — | |
| 6 | — | — | |
| 7 | — | — | |
| 8 | — | — | |
| 9 | — | — | |
| 10 | — | — | |
| 11 | — | — | |
| 12 | — | — | |
| 13 | — | — | |
| 14 | — | — | |

## Testing Plan

- [ ] Step 1: Vault-portable TypeScript MCP server with `--mode` flag
- [ ] Step 2: Contribution pipeline tools on dw-upstream
- [ ] Step 3: Path resolution — no hardcoded paths
- [ ] Step 4: `.mcp.json` template
- [ ] Step 5: `docwright init` scaffold
- [ ] Step 6: `vault:migrate` script + `MIGRATION.md`
- [ ] Step 7: Profile override merge
- [ ] Step 8: MSP pilot vault
- [ ] Step 9: Cascade STEAM early-access vault
- [ ] Step 10: Friction log tooling
- [ ] Step 11: Architecture boundary document
- TypeScript MCP server: parity test all tools in both vault and upstream modes against Python baseline
- `docwright init`: end-to-end smoke test — init, open in web UI, complete proposal→plan→completed cycle
- Profile override merge: unit test all three merge modes (scalar replace, deep-merge, `+array` append vs replace)
- `vault:migrate`: test no-op migration and a breaking migration (field rename); vault content untouched
- MSP pilot: manual acceptance — full lifecycle cycle with zero manual file edits
- Cascade STEAM early access: leadership can open Web UI and submit a proposal
- Contribution pipeline: test with/without token; verify `DOCWRIGHT_CONTRIB_APPROVED=1` gate

## Real-World Pilot: DAFO Infrastructure Vault (2026-06-16)

*First unplanned external vault adoption. Garth Johnson (growlf / Cascade Steam Technology) used DocWright to scaffold and version-control an existing Obsidian client vault for DAFO, a non-profit serving the public good. Documents discoveries that directly inform Steps 8, 9, and 11.*

### What was done

An existing Obsidian vault (`~/Obsidian/DAFO`) containing client notes, project logs, system documentation, and six newly-written infrastructure proposals was adopted into DocWright governance and pushed to a new private GitHub repo (`growlf/dafo-infrastructure`).

The vault was **not** a fresh directory — `docwright init` was therefore blocked. The full adoption was performed manually in a single session, producing the following deliverables:
- 6 fully critiqued infrastructure proposals (critique cycle, effort estimates, DocWright frontmatter)
- Cover letter and engagement summary
- Complete DocWright directory scaffold
- Pre-commit hook validation passing
- Private GitHub repo with all sensitive Obsidian content gitignored

### Gaps discovered (directly actionable for Steps 8, 9, 11)

| Gap | Severity | Current Workaround | Proposed Fix |
|-----|---------|--------------------|--------------|
| `init.ts` refuses non-empty directories | 🚫 **Resolved** | `npm run adopt` — three-mode adoption (open/lightweight/full), manifest-based upgrade contract | `scripts/adopt-vault.ts` shipped; bms-ai-cluster + DAFO validated — see [[plans/completed/plan-script-skill-docwright-adopt-initialize-docwright-on-existing-vaults.md]] |
| Pre-commit hook required `js-yaml` in vault's `node_modules` | ⚠️ **Resolved** | Baked absolute path via `sed` substitution in `install-hooks.sh` at install time | Fixed in `install-hooks.sh`; no symlink needed; documented in `docs/vault-portability.md` |
| `.docwright/.gitignore` silently blocks `config.json` and itself from staging — confusing | ⚠️ Warn | Force-add or just don't add them (they're intentionally local) | Clarify in `docs/vault-portability.md` that only `registry.example.json` is committed |
| Non-proposal markdown in `proposals/` (e.g. cover letters, SOW docs) must carry full proposal frontmatter or the hook rejects them | ⚠️ Warn | Added minimal frontmatter with `type: proposal` | Loosen hook to allow `type: document` or similar non-lifecycle type in `proposals/` |
| No status migration path — existing notes using `status: pending` fail validation | ⚠️ Warn | Manual sed/python pass across all files | `adopt-vault.ts` should normalise status values during adoption |
| Sensitive Obsidian vault content (Dailys, system docs, stack files) needs gitignore before first commit — not guided | ⚠️ Warn | Manual `.gitignore` construction | `adopt-vault.ts` should audit existing content and generate a protective gitignore interactively |

### What worked well

- `npm run hook:install -- --vault /path` worked perfectly on a pre-existing git repo
- Profile override merge and `.mcp.json` template applied without issues
- The `docwright-raw-proposal` skill pattern (even applied manually) produced solid, critiqued proposals from vault notes in a single session
- Git + GitHub private repo creation via `gh` CLI integrated cleanly

### Implications for upcoming steps

- **Step 8 (MSP pilot):** `npm run adopt` now handles existing repos — no longer blocked by `init.ts` refusing non-empty directories. Run `npm run adopt -- --dest /path/to/msp-vault --mode full`.
- **Step 9 (Cascade STEAM early access):** `bms-ai-cluster` was adopted as Phase 3 validation test (June 2026) using `npm run adopt`. Cascade STEAM can follow the same process.
- **Step 11 (Architecture boundary doc):** `docs/vault-portability.md` was written as part of the adopt-vault plan — covers all three modes, manifest upgrade contract, js-yaml baked-path, CI usage. ✅ Done.

## Phase Gate

- [x] Phase 2 gate review complete (prerequisite)
- [x] Sub-plan #1: TypeScript MCP server replaces Python — all tools passing
- [x] Sub-plan #2: Vault portability foundation — path resolution + .mcp.json template
- [x] Sub-plan #3: `docwright init` produces a working vault end-to-end
- [x] Sub-plan #4: Profile override merge engine tested
- [x] Sub-plan #5: Vault migration system — `MIGRATION.md` format + `vault:migrate` script
- [x] Deliverable #9: `docs/vault-portability.md` written and accurate
- [x] Deliverable #10: `docwright adopt` tooling — three modes, manifest contract, DAFO + bms-ai-cluster validated
- [x] Deliverable #11: Vault Write API — `moveDocument`, `renameDocument`, `setField` canonical write path
- [x] Deliverable #12: Vault Document Index — unified frontmatter + wikilink index, `/api/graph` live
- [x] Deliverable #13: Knowledge Graph — D3 force-directed, 4th status tab, gap detection overlays visible
- [ ] Sub-plan #7: MSP pilot vault approved and executed — one complete proposal→plan→completed cycle
- [ ] Sub-plan #8: Cascade STEAM early-access vault approved, provisioned, accessible to leadership
- [ ] Dogfooding cycle complete — friction captured, proposals filed
- 🔀 Sub-plan #6: Contribution pipeline — in progress, closes in Phase 5 (not a Phase 3 gate)
- [x] Phase 3 gate review by NetYeti

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-08 | Added Step 9 (Cascade STEAM early-access vault) — pulls Phase 5 "first governance cycle" proof into Phase 3; Phase 5 now focuses on production infrastructure only | NetYeti |
| 2026-06-08 | Filled implementation steps, testing plan, risk assessment, phase gate from approved proposal | NetYeti |
| 2026-06-08 | Created from approved proposal | NetYeti |
| 2026-06-09 | Decomposed into 9 standalone sub-plans with proposals and Deliverables table — TS MCP server, vault foundation, init scaffold, profile merge, migration system, contribution pipeline, MSP pilot, Cascade STEAM, architecture doc | NetYeti |
| 2026-06-09 | Decomposed into 9 standalone sub-plans with proposals and Deliverables table | NetYeti |
| 2026-06-11 | Gate approved by NetYeti. Step 1 marked done (sub-plan-ts-mcp-server completed). | NetYeti |
| 2026-06-11 | Steps 3-4 done: DOCWRIGHT_PATH introduced across config, .mcp.json, opencode.json, .claude/settings.json, install-hooks.sh. Vault .mcp.json template (dw-vault + dw-upstream) defined. | NetYeti |
| 2026-06-11 | Step 5 done: docwright init scaffold (scripts/init.ts, npm run init). Creates full vault structure: .env, .mcp.json, profile.json, brand.json, .docwright/, docs/friction-log.md, proposals/, plans/. | NetYeti |
| 2026-06-11 | Deliverables table synced — Dels 1-3 ✅, Phase Gate checkboxes updated. | NetYeti |
| 2026-06-11 | Sub-plan #4 (Profile Override Merge) approved and set in-progress. Plan populated with 5 steps. | NetYeti |
| 2026-06-11 | Sub-plan #4 completed: mergeProfiles() in src/dispatch/profile.ts, wired into profile-config API, 13 tests passing. | NetYeti |
| 2026-06-14 | Sub-plan #5 (Vault migration system) completed — MIGRATION.md format, vault:migrate script, first entry. Step 6 marked done. | NetYeti |
| 2026-06-17 | Plan refreshed: `docwright adopt` tooling added as Deliverable 10 (✅ Done); DAFO gaps marked resolved; Step 11 (docs/vault-portability.md) marked done; consumed_by updated to plans/completed/; completed_steps corrected to 8; Phase Gate updated with Sub-plans 5 and adopt-vault. | NetYeti |
| 2026-06-16 | Real-world pilot: DAFO Infrastructure Vault adopted by Garth Johnson (Cascade Steam Technology). First unplanned external vault adoption — existing Obsidian vault, non-empty directory, 6 proposals, GitHub private repo. Gaps documented in "Real-World Pilot" section above. Proposal [[proposals/approved/docwright-adopt-existing-vault.md]] created for adopt-vault tooling. | NetYeti |
| 2026-06-17 | Roadmap restructure: Phase 3 gains three foundational prerequisites before pilots — Vault Write API (11), Vault Document Index (12), Knowledge Graph (13). Title updated to "Vault Foundation, Perception & Real-World Pilots". total_steps 11→14. Deliverables table fixed (approved proposal paths corrected, new rows added). Phase Gate updated. Contribution pipeline noted as Phase 5 parallel track, not a Phase 3 gate. | NetYeti |
| 2026-06-24 | Deliverable #11 and Implementation Step 12 marked ✅ Done — vault-write.ts (moveDocument, renameDocument, setDocumentField) fully implemented; proposal already approved; Phase Gate was already checked; fix-stale-approvals.ts marked @deprecated; 13 tests passing. completed_steps corrected to 8 (was stale at 11). | NetYeti |
| 2026-06-24 | Deliverables #12 and #13 + Implementation Steps 13 and 14 marked ✅ Done — vault-index.ts and KnowledgeGraph.svelte fully implemented; sub-plan-vault-document-index proposal approved; Phase Gate checked for both. Knowledge Graph proposal still needs formal approval (approved: false) — flagged in table. completed_steps updated to 10. | NetYeti |
