---
title: "Pivot issue tracking to GitHub Issues + Projects (break the self-hosting cyclic reference)"
author: "NetYeti"
created: "2026-07-13"
tags: [architecture, issues, github, github-projects, dogfooding, decision]
category:
  - process-change
  - integration
complexity: high
approved: true
priority: high
created_by: "NetYeti@cluster-llm"
assigned_to: NetYeti
related_to:
  - [[proposals/approved/issue-heatmap-and-dedup-pipeline]]
  - [[proposals/approved/collaboration-issue-model-and-roadmap-sync]]
  - [[proposals/phases-and-the-master-plan-are-mostly-invisible-to-the-user]]
  - plans/pivot-issue-tracking-to-github.md
depends_on: []
blocks: []
consumed_by: plans/plan-pivot-issue-tracking-to-github-issues-projects-break-the-self-hosting-cyclic-reference.md
---

# Pivot issue tracking to GitHub Issues + Projects (break the self-hosting cyclic reference)

## Summary

**Separation of concerns, not an invariant-breaking pivot.** Governance/direction
(proposals, plans, policies, decisions) stays git-native in the vault; the **actual
development work** moves to **GitHub Issues + a GitHub Project board** — where the code
and PRs already live. DocWright **reads and links** GH issues so proposals reference
stable GitHub issue URLs, and it keeps the **Project board current** (every issue on the
board with the right status column). This breaks the self-hosting cyclic reference by
moving the high-churn *execution* layer out of the code repo, while the *governance* it
serves stays put. BDFL decision, 2026-07-13.

## Problem Statement — the cyclic reference

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

## Proposed Solution

1. **GitHub Issues + Projects are canonical for issues.** Bugs/code-tasks/friction are
   created and maintained in GitHub (Issues + a Project board), *outside* the file tree,
   breaking that arm of the cycle. GH Projects gives real boards, status columns, and
   automation the markdown folder never could.
2. **DocWright becomes a read/relate layer for issues.** The Web UI reads GH Issues/Projects
   (via the API) and renders them; proposals/plans link to stable GH issue URLs. No issue
   is stored as a governed file.
3. **Rework the capture pipeline onto the GH API.** `capture_bug_report`
   (suggest/confirm/create), the demand heatmap, and cross-source dedup are reimplemented
   against GitHub Issues (labels for demand, search for dedup) instead of `issues/*.md`.
4. **Migrate losslessly, then retire `issues/`.** Migrate the existing ~60 local issues to
   GitHub with **full fidelity** (see the migration-fidelity section — this is a hard
   gate), keep an **archived copy** of the originals, and only then remove the folder and
   its linter/hook rules. No destructive step runs before parity is proven.
5. **Full GitHub Projects awareness (code projects).** Board columns mapped to the issue
   lifecycle; issue↔PR linkage; the `/status` "needs your attention" queue reads GH.
6. **Clarify (not break) the core invariant.** CLAUDE.md §"Git is the canonical store.
   No auxiliary database" always meant the **governance layer** — proposals, plans,
   policies, decisions — which stays git-native in the vault. **Development-issue tracking
   is GitHub's job** (Issues + Projects), where the code already lives. This is a wording
   clarification that separates governance-of-record (git) from work-tracking (GitHub).
7. **Two-way reconcile + keep the Project current.** Migration and capture reconcile
   against issues ALREADY on GitHub (reuse `github_issue:` ids — never duplicate), and
   every issue (migrated + newly captured) is placed on the DocWright GitHub Project with
   the correct status column; status changes update the board.

## What stays git-native (deliberately)

Proposals, plans, policies, decisions — the *governance/direction* layer — remain in the
vault as Markdown. Only *issues* (the high-churn, code-adjacent tracking layer) move out.
This keeps DocWright's governance model intact while severing the specific cyclic
dependency that issues create. (Whether plans/proposals should later decouple from the
code repo too is a separate, larger question — out of scope here.)

## Scope of change

- New: `src/dispatch/github-issues.ts` (or extend `bridge.ts`) — GH Issues/Projects API
  client (list/search/create/label), auth via existing GH token.
- Rework: `capture_bug_report` MCP tool + Web-UI report flow → GH-backed.
- Rework: demand heatmap + dedup (`/api/status`, dispatch) → read GH.
- Migration script: `issues/*.md` → GH Issues (idempotent; records the mapping).
- Retire: `issues/` folder, its pre-commit `validate_issue_workflow`, dispatch linter
  issue-status rules, the local `github_issue:` backlink convention (inverted).
- Docs: amend CLAUDE.md invariant + PROJECT.md issue-model section.

## Migration fidelity — preserve the content base (no lost "juice") [HARD GATE]

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

## Security implications

- GitHub becomes a hard dependency for issue tracking on code projects — acceptable for
  code projects (they already live on GitHub) but NOT for air-gapped/offline org vaults;
  the pivot is scoped to **code projects**, and org-ops/knowledge-base vaults keep the
  git-native issue model (profile-gated).
- The GH token's scope must be least-privilege (issues + projects on the one repo).
- No secrets leave the repo; issue content is already public/team-visible on GitHub.

## Verification

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

## Risks / tradeoffs

| Risk | Mitigation |
|------|------------|
| Offline/air-gapped vaults lose issue tracking | Scope pivot to code projects; org vaults keep git-native issues (profile-gated) |
| Departs from "git is canonical / no aux DB" | Explicit invariant amendment scoping git-canonical to governance docs |
| Large rework of the capture/heatmap pipeline | Stage it: read-layer first, then capture, then retire local folder + migrate |
| GH API rate limits / availability | Cache reads; degrade gracefully; the UI reads, doesn't block on GH |

## Related

- [[proposals/approved/issue-heatmap-and-dedup-pipeline]] — the pipeline being reworked.
- [[proposals/approved/collaboration-issue-model-and-roadmap-sync]] — the issue model.
- [[proposals/phases-and-the-master-plan-are-mostly-invisible-to-the-user]] — visibility.
- Motivating friction: the 2026-07-11..13 dogfood↔main reconcile churn (session notes).
