---
title: "Plan: Pivot issue tracking to GitHub Issues + Projects (break the self-hosting cyclic reference)"
status: draft
author: "NetYeti"
created: "2026-07-13"
created_by: "NetYeti@phoenix"
tags: [planning]
proposal_source: "proposals/pivot-issue-tracking-to-github-issues-projects"
priority: medium
phase: 
automated: guided
waiting_reason:  # Populated when status = waiting-for-user
assigned_to: ["NetYeti"]
# parent_plan: phase-N-overview.md   # filename of parent plan (omit if top-level)
# parent_deliverable: "1"            # row number in parent's Deliverables table
related_to:
  - plans/plan-docwright-dev-cloud-instances-dogfood-csdocs-cs-erp-images-msp-pilot.md
depends_on: []
blocks: []
reviewed_by:
reviewed_date:
canceled_date:  # Populated when plan is canceled
cancellation_reason:  # Populated when plan is canceled
template_version: "1.0"
tests_defined: false
tests_human_reviewed: false  # Set to true after human certifies AI-generated tests
# Gate fields — populated when a lifecycle gate applies to this document
gate_reviewer:  # Who must review (set automatically by gate rules)
gate_status:    # pending | approved | waived
gate_date:      # Stamped when gate_status is set
gate_note:      # Optional reviewer note
gate_reviews: []  # Phase 1a — array of {reviewer, role, status, date, note}
gate_quorum: 1    # Phase 1a — minimum approvals needed
---

# Plan: Pivot issue tracking to GitHub Issues + Projects (break the self-hosting cyclic reference)

## Mode

Plan modes: `off` (mentorship), `guided` (agent drafts, human approves), `full` (autonomous).

**MENTORSHIP MODE — Human leads, LLM advises**

- Human carries out tasks their own way
- LLM provides SOP compliance checks and safety warnings
- LLM offers suggestions when human asks for help

## Overview

### Summary

**Separation of concerns, not an invariant-breaking pivot.** Governance/direction
(proposals, plans, policies, decisions) stays git-native in the vault; the **actual
development work** moves to **GitHub Issues + a GitHub Project board** — where the code
and PRs already live. DocWright **reads and links** GH issues so proposals reference
stable GitHub issue URLs, and it keeps the **Project board current** (every issue on the
board with the right status column). This breaks the self-hosting cyclic reference by
moving the high-churn *execution* layer out of the code repo, while the *governance* it
serves stays put. BDFL decision, 2026-07-13.

### Problem statement — the cyclic reference

DocWright is a governance layer that stores its documents as Markdown in a git repo.
When DocWright is used to develop **DocWright itself**, its development-governance
vault **is its own code repository** — the very files that compose the tool. Governance
docs (issues, plans, proposals) and source code live in the same tree, on the same
branches.

This is a **cyclic reference / self-hosting bootstrap dependency**, and it is a known
development failure mode. Its symptoms dominated the 2026-07-11..13 sessions:

- A separate `dogfood` branch had to carry governance-doc churn while `feat/*` branches
  carried code, forcing constant `dogfood ↔ main` reconciles (run ~10× in one session).
- The PreToolUse plan-edit gate fired while working on *code* branches; a stray `cd`
  committed governance docs onto the wrong branch; squash-merges left `dogfood` perpetually
  "ahead" of `main` with near-empty diffs.
- **Issues are the worst offenders**: ~60 high-churn `issues/*.md` files collide with
  almost every code branch, and the capture/dedup/heatmap machinery mutates them
  constantly — maximizing the collision surface of the cycle.

Storing the tool's issue tracker inside the tool's own source tree couples two things
that must be able to move independently.

### What stays git-native (deliberately)

Proposals, plans, policies, decisions — the *governance/direction* layer — remain in the
vault as Markdown. Only *issues* (the high-churn, code-adjacent tracking layer) move out.
This keeps DocWright's governance model intact while severing the specific cyclic
dependency that issues create. (Whether plans/proposals should later decouple from the
code repo too is a separate, larger question — out of scope here.)

### Scope of change

- New: `src/dispatch/github-issues.ts` (or extend `bridge.ts`) — GH Issues/Projects API
  client (list/search/create/label), auth via existing GH token.
- Rework: `capture_bug_report` MCP tool + Web-UI report flow → GH-backed.
- Rework: demand heatmap + dedup (`/api/status`, dispatch) → read GH.
- Migration script: `issues/*.md` → GH Issues (idempotent; records the mapping).
- Retire: `issues/` folder, its pre-commit `validate_issue_workflow`, dispatch linter
  issue-status rules, the local `github_issue:` backlink convention (inverted).
- Docs: amend CLAUDE.md invariant + PROJECT.md issue-model section.

### Migration fidelity — preserve the content base (no lost "juice") [hard gate]

The accumulated signal in the current issues is valuable and must survive the pivot
intact — a naive port would flatten it. Every field maps to a durable GitHub equivalent,
and migration is **verified byte-for-signal before anything is deleted**:

| Local issue signal | GitHub home |
|---|---|
| `demand_count` + `reported_dates` (the heatmap's fuel) | Issue label `demand:N` + the dates in the body/comments; heatmap reads them back |
| `status` (new/triaged/scope-checked/…/resolved) | Labels / Project status column |
| `scope_assessment` / `scope_decision` / `scope_notes` | Issue body section (verbatim) |
| Cross-source dedup lineage, `related`, `consumed_by` | Issue body links + `related` cross-refs |
| Full description + system info + history | Issue body + comments (verbatim) |
| Existing `github_issue:` backlinks | Reused as the canonical id (no new issue if already mirrored) |

Safeguards:
- **Idempotent, reversible migration**: re-runnable; records a `local-path → gh-url` map;
  an issue already mirrored (`github_issue:`) is updated, never duplicated.
- **Archive, don't destroy**: the original `issues/*.md` are moved to an archived tarball
  (or a retained `issues.archive/` snapshot) committed once, not deleted outright.
- **Parity check is the gate**: a verification pass asserts every local issue has a GH
  counterpart carrying its demand_count, status, dates, and body; the heatmap rendered
  from GH matches the pre-migration heatmap. The `issues/` removal step is BLOCKED until
  this passes.
- Dedup history is preserved so the demand pipeline doesn't "reset to zero" on cutover.

### Security implications

- GitHub becomes a hard dependency for issue tracking on code projects — acceptable for
  code projects (they already live on GitHub) but NOT for air-gapped/offline org vaults;
  the pivot is scoped to **code projects**, and org-ops/knowledge-base vaults keep the
  git-native issue model (profile-gated).
- The GH token's scope must be least-privilege (issues + projects on the one repo).
- No secrets leave the repo; issue content is already public/team-visible on GitHub.

### Verification

- Round-trip: file a bug via `capture_bug_report` → it appears as a GitHub issue with the
  right labels; dedup finds it on the next suggest; the `/status` queue + heatmap render it
  from GH.
- A proposal links a GH issue URL and the link resolves in the UI.
- The `issues/` folder is gone and CI/hooks no longer reference it; nothing in the repo
  churns when an issue changes.
- Migration: every prior local issue has **exactly one** GH counterpart (reconciled
  against issues already on GitHub — no duplicates; mapping recorded).
- **Every issue (migrated + new) is on the DocWright GitHub Project** with the correct
  status column; moving an issue's status updates the board.

### Risks / tradeoffs

| Risk | Mitigation |
|------|------------|
| Offline/air-gapped vaults lose issue tracking | Scope pivot to code projects; org vaults keep git-native issues (profile-gated) |
| Departs from "git is canonical / no aux DB" | Explicit invariant amendment scoping git-canonical to governance docs |
| Large rework of the capture/heatmap pipeline | Stage it: read-layer first, then capture, then retire local folder + migrate |
| GH API rate limits / availability | Cache reads; degrade gracefully; the UI reads, doesn't block on GH |

### Related

- [[proposals/approved/issue-heatmap-and-dedup-pipeline]] — the pipeline being reworked.
- [[proposals/approved/collaboration-issue-model-and-roadmap-sync]] — the issue model.
- [[proposals/phases-and-the-master-plan-are-mostly-invisible-to-the-user]] — visibility.
- Motivating friction: the 2026-07-11..13 dogfood↔main reconcile churn (session notes).


## Implementation Steps

> When marking a task ✅ Complete, update every step row in this table
> to reflect what was actually built. Stale ⏳ rows mislead reviewers.

| Step | Action | Details | Status |
|------|--------|---------|--------|
| 1 | | | ⏳ Pending |

## Testing Plan



## Rollback Procedures



## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| | | | |

## Phase Gate

- [ ] All implementation steps resolved (delivered or formally deferred with captured proposals)
- [ ] Test coverage defined and human-reviewed (`tests_human_reviewed: true`)
- [ ] Deferred ideas captured as proposals before closing (see [[policies/core/capture-deferred-ideas.md]])
- [ ] Rollback procedures documented
- [ ] Risk assessment completed

## Testing Plan

### Step Verification

- [ ] All implementation steps complete and outcomes verified

### Integration & Regression

- [ ] Existing tests pass without modification (`npm test`)
- [ ] TypeScript compiles cleanly (`npm run typecheck`)
- [ ] Plan: Pivot issue tracking to GitHub Issues + Projects (break the self-hosting cyclic reference) functionality works end-to-end

### Gate Criteria

- [ ] `tests_defined` set to `true` in frontmatter
- [ ] Human reviewer has verified step outcomes above
- [ ] No regressions introduced to adjacent workflows

## Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-07-13 | Created | NetYeti |
