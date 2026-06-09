---
title: Research Stage for DocWright — Foundational Methodology Change
status: completed
completed_date: 2026-06-08
author: NetYeti
created: 2026-06-07
tags:
  - architecture
  - workflow
  - lifecycle
  - research
  - methodology
  - phase-2
proposal_source: proposals/approved/research-stage-methodology.md
priority: medium
automated: guided
assigned_to: Netyeti
parent_plan: phase-2-foundation.md
parent_deliverable: "9"
tests_defined: true
total_steps: 8
completed_steps: 8
scenario_synthesis: AI-guided implementation plan. Each step executed by developer with AI assistance. No automated deployment scripts or shell commands.
_path: plans/research-stage-methodology.md
---

# Research Stage for DocWright — Foundational Methodology Change

## Summary

Establish a `research/` directory as a first-class lifecycle stage between idea and proposal. This plan covers Phase 2 MVP only — directory convention, document type schema, profile updates, collation engine scan, lifecycle enforcement, status page section, and file tree sidebar integration. Phase 3 AI-native tooling (assisted sessions, synthesis, multi-perspective research) is explicitly deferred to a future plan.

## Scope

**In scope (Phase 2 MVP):**
- `research/` directory and document type with frontmatter schema
- Research template with `author-role:` field
- All bundled profiles updated to recognize research type
- Collation engine scans `research/` directory
- Status page shows active/concluded research
- Pre-commit hook enforces research frontmatter validation
- File tree sidebar recognizes `research/` as special directory

**Out of scope (deferred to future plans):**
- Mandatory research gate for proposals
- AI-assisted research sessions
- Research-to-proposal generation
- Multi-perspective research comparison
- Automated research synthesis
- External source fetching / web scraping
- Full bibliography / citation management
- Multi-person concurrent research sessions

## Dependencies

| Step | Dependency | Status |
|------|-----------|--------|
| 3 (profile updates) | Knowledge of all currently bundled profiles and their locations | Verified in codebase scan |
| 4 (collation engine) | Collation engine must support configurable scan directories | Verify in `src/collate/` |
| 5 (status page) | Status page rendering framework must exist | Verify in `src/status/` |
| 6 (pre-commit hook) | Pre-commit hook infrastructure must exist | Verify in `.githooks/` or `scripts/` |
| 7 (file tree sidebar) | File tree sidebar must exist and support special directories | Verify in UI layer |

Pre-step: Scan the codebase to confirm each dependency exists. If any dependency is missing, file a bug report and update this plan before proceeding.

## Implementation Steps

| Step | Action | Details | Definition of Done | Status |
|------|--------|---------|--------------------|--------|
| 1 | Define research document type frontmatter schema | Create the schema definition for `research` documents in the profile schema system. Fields: `title` (required), `status` (required, enum: active/concluded/archived), `question` (required, one-sentence research question), `conclusion` (enum: open/recommends/inconclusive/superseded, required when status=concluded), `author` (required), `created` (required, YYYY-MM-DD), `tags` (optional), `linked_proposals` (optional, list), `related_research` (optional, list), `author-role` (required, default: contributor). Add validation rules: `conclusion` must be non-empty when `status: concluded`. | Schema file created at `profiles/[profile]/schema.json` with `research` type. Validation rules documented. Schema passes JSON Schema validation. | ✅ Done |
| 2 | Create `research/` directory and scaffold template | Create the `research/` directory at repo root with `.gitkeep`. Create template at `templates/research.md` with frontmatter scaffold, free-form investigation body sections (`## Questions Explored`, `## Approaches Compared`, `## Findings`, `## Sources`), and a `## Conclusion` section. The `+ New` menu gains a "New Research" option that scaffolds from this template. | `research/` directory exists with `.gitkeep`. `templates/research.md` exists with all sections. "New Research" option appears in `+ New` menu and generates a valid research doc. | ✅ Done |
| 3 | Update all bundled profiles to recognize research document type | For each profile in `src/profiles/` — update `profile.json` manifest to list `research` in `document_types`, update `schema.json` to include research type schema, add `templates/research.md` with `author-role:` field. Profiles to update: `org-operations`, `doc-lifecycle`, `knowledge-base`, `infra-topology`. Verify no profile is missed via automated profile discovery scan. | All 4 profiles have `research` in their manifest. Each has a `templates/research.md` with `author-role:` field. Automated scan confirms 100% coverage. | ✅ Done |
| 4 | Add `research/` to collation engine scan directories | Locate the scan directories configuration in the collation engine (`src/collate/`). Add `research/` alongside `proposals/` and `plans/`. Ensure the overlap API surfaces research relationships as a distinct type `informed-by`. Verify existing collation tests still pass. | Collation engine scans `research/`. `informed-by` relationship type appears in overlap API response. All existing collation tests pass. | ✅ Done |
| 5 | Add lifecycle enforcement for research documents | Update pre-commit hook (`.githooks/pre-commit` or `scripts/validate-frontmatter.sh`) to recognize `research/` as a governed directory. Add validation: `status: concluded` requires non-empty `conclusion` field; `## Conclusion` section must exist in the body. Research documents cannot transition to `status: archived` without setting `status: concluded` first (if a conclusion was reached). | Pre-commit hook rejects research docs with missing required frontmatter. Hook rejects `status: concluded` without `conclusion` field. Hook rejects `status: concluded` without `## Conclusion` section. Hook allows `status: archived` without conclusion only if conclusion=inconclusive. | ✅ Done |
| 6 | Add research section to status page | Add a Research section to the vault status page showing: active research questions (status: active), recent conclusions (status: concluded, last 30 days), proposals without linked research (flagged as "investigation skipped" — visible, not enforced). Wire up data from `research/` directory frontmatter scans. | Status page renders Research section. Active list shows correct docs. Recent conclusions shows last 30 days. Proposals without linked research are flagged. | ✅ Done |
| 7 | Integrate `research/` into file tree sidebar | Update the file tree sidebar component to recognize `research/` as a special directory alongside `proposals/`, `plans/`, `docs/`. Ensure it appears in navigation and is clickable to browse. | Sidebar shows `research/` directory with correct icon/annotation. Navigation works. Empty state handled gracefully. | ✅ Done |
| 8 | Integration smoke test | Create a test research document, write findings, set conclusion, verify: pre-commit hook passes, status page shows it, collation finds it, sidebar shows it, profile validation accepts it. Then create a malformed research doc and verify each validation gate catches the right error. | Smoke test script passes. All validation gates tested with positive and negative cases. | ✅ Done |

## Testing Plan

| Test Category | Step(s) | Test Assertions | Method |
|---------------|---------|-----------------|--------|
| Schema validation | 1 | Research doc with all required fields passes validation; missing `title` fails; `status: concluded` without `conclusion` fails; invalid `status` enum value fails | Unit tests on schema validation function |
| Template scaffolding | 2 | Template generates valid frontmatter; `author-role:` default is `contributor`; all body sections present | Template render test |
| Profile coverage | 3 | Every profile in `src/profiles/` has research type registered; every research template includes `author-role:` | Automated profile discovery + assertion |
| Collation integration | 4 | `research/` files appear in overlap API results with `informed-by` relationship type; existing non-research results unchanged | Integration tests against collation engine |
| Pre-commit enforcement | 5 | Valid research doc passes hook; invalid research doc fails hook with specific error message; hook does not interfere with non-research files | Hook test harness with temp files |
| Status page rendering | 6 | Status page HTML/JSON includes research section; counts match actual research/ contents; "investigation skipped" flag appears for unlinked proposals | Snapshot or render test |
| Sidebar integration | 7 | Sidebar structure includes `research/` node; node is clickable; empty `research/` dir shows empty state (not crash) | UI component test |
| End-to-end smoke test | 8 | Full lifecycle: create → validate → commit → status page reflects → collation picks up → sidebar shows → update to concluded → hook validates → status updates | Automated smoke test script |

## Definition of Done

All of the following must be true before this plan can transition to `status: completed`:

1. All 8 implementation steps show ✅ Done status
2. All tests in the Testing Plan pass on CI
3. A human reviewer (Steward or Governance role) has confirmed the research stage is usable end-to-end by creating a research document, writing it through to conclusion, and observing it appear in the status page and collation views
4. No existing functionality is broken — all pre-existing tests pass
5. The updated lifecycle is documented in `docs/SOPs/research-stage.md`

## Rollback

| Step | Rollback Action |
|------|-----------------|
| 1 (schema) | Revert schema changes in `profiles/[profile]/schema.json`; restore previous version from git |
| 2 (directory/template) | `rm -rf research/` and `rm templates/research.md`; revert `+ New` menu changes |
| 3 (profiles) | Revert each profile's `profile.json`, `schema.json`, and `templates/research.md` via `git checkout -- src/profiles/*/` |
| 4 (collation) | Remove `research/` from scan directories list; revert config to previous value |
| 5 (pre-commit) | Revert pre-commit hook changes; remove research validation rules |
| 6 (status page) | Revert status page component changes; remove research section |
| 7 (sidebar) | Revert sidebar component changes; remove `research/` node |
| 8 (smoke test) | Delete smoke test script |

**Full rollback**: `git revert <merge-commit>` or `git checkout -- research/ templates/research.md src/profiles/ src/collate/ .githooks/ src/status/ src/sidebar/`

Rollback is safe at any point — each step is independently revertible and none migrate data irreversibly.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation | Contingency |
|------|-----------|--------|-----------|-------------|
| Profile schema change breaks existing document validation | Medium | High — blocks all document creation | Run existing schema tests before deploying profile changes. Staged rollout: validate schema change against known document corpus first. | Roll back profile changes via git. Fix schema compatibility issue. Re-deploy. |
| Collation engine doesn't support configurable scan directories | Medium | Medium — step 4 blocked | Verify dependency before starting step 4. If configurable scan dirs don't exist, add them or use a file-based config. | Implement configurable scan dirs as prerequisite. Extend plan by 1 step. |
| Pre-commit hook conflicts with existing hook logic | Low | Medium — breaks commits for all users | Review existing pre-commit hook logic before modifying. Add research validation as additive check, not replacement. Test in isolated repo first. | Revert hook changes. Re-implement as separate validation script called from main hook. |
| Sidebar/frontend changes don't render on target VSCodium version | Low | Medium — visual regression | Test sidebar changes against minimum supported VSCodium version. Use feature detection, not version detection. | Add polyfill or graceful degradation. Fall back to flat list if grouped sidebar unsupported. |
| Missing profile in update scan | Medium | High — one profile silently lacks research type | Add automated profile discovery assertion in CI. Use `src/profiles/*/profile.json` glob to enumerate all profiles. | Add the missed profile in a follow-up commit. CI test catches it before deployment. |
| Existing research content (none yet) incompatible after schema changes | Low | Low — no existing research content | N/A for initial deployment. Document migration path for after Phase 3. | N/A — no data to migrate yet. |

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-07 | Created from approved proposal | NetYeti |
| 2026-06-07 | Plan critiqued and improved — added concrete steps, DoD, testing, rollback, risk assessment | docwright-editor |
| 2026-06-07 | Plan critiqued and improved — added concrete steps, DoD, testing, rollback, risk assessment | NetYeti |
