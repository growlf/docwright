---
title: "Roadmap date discipline — enforce version/milestone dates + issue-in-range scheduling (DocWright + GitHub)"
author: "NetYeti"
created: "2026-07-13"
tags: [governance, roadmap, milestones, dates, github-projects, planning]
category:
  - process-change
  - integration
complexity: high
approved: true
priority: high
created_by: "NetYeti@cluster-llm"
assigned_to: NetYeti
related_to:
  - "[[plans/plan-pivot-issue-tracking-to-github-issues-projects-break-the-self-hosting-cyclic-reference]]"
  - "[[proposals/roadmap-discipline-carryover]]"
  - "[[proposals/approved/formalize-roadmap-sequencing-enforcement]]"
  - "[[docs/github-project-schema]]"
depends_on: []
blocks: []
_path: proposals/approved/roadmap-date-discipline
consumed_by: plans/completed/roadmap-date-discipline.md
---

# Roadmap date discipline — enforce version/milestone dates + issue-in-range scheduling (DocWright + GitHub)

## Summary

The GH-pivot moved dev issues onto GitHub Issues + the DocWright Project board, but left the
**planning layer unbuilt**: milestones/versions have no target dates, issues aren't scheduled
within any range, and the "Roadmap" (GANTT) view is therefore blank. This proposal adds
**roadmap date discipline**: (1) a new version/milestone **must** carry an initial target date;
(2) issues assigned to a milestone are **enforced to fall within that milestone's date range**;
(3) it's implemented as a **split across both surfaces** — GitHub is the *store + display*
(milestone due dates, Project Start/Target date fields, the Roadmap view), and **DocWright is the
*enforcer*** (validation in dispatch + pre-commit/CI, surfaced in `/status`). This makes
progress-toward-goals trackable (a real burndown) and closes the pivot's planning gap. Extends the
GH-pivot and subsumes the "living-roadmap renderer" slice of
[[proposals/roadmap-discipline-carryover]].

## Problem statement

- After the pivot, the Project board has our issues but **no dates and no milestone due dates**
  (confirmed 2026-07-13: 0 milestones, no Date fields → the Roadmap view plots nothing).
- Milestones/versions are opened ad-hoc with no committed target (releases have been
  BDFL-timeline). There is **no enforcement** that a version has a date or that its issues fit
  within it, so "are we on track for the next version?" isn't answerable.
- GitHub natively **cannot** enforce "issue within its milestone's date range" (milestones have a
  single due date; issues have no native start/target; the Roadmap view is display-only). So the
  discipline can't live in GitHub alone — it needs DocWright's engine.

## Explicit shift (BDFL-confirmed 2026-07-13)

This moves DocWright from **BDFL-timeline** (no committed dates) to **date-committed
roadmapping** — the point is to *require* real target dates so a burndown means something. The
BDFL commits to setting (and revising) dates. **Confirmed.**

## Proposed capability

1. **Version/milestone target dates are required.** Opening a version/milestone (a GitHub
   Milestone + its Project representation) requires an **initial `start` and `target` date**.
   A dateless active milestone is a validation failure. Dates are revisable (with the change
   recorded), not immutable.
2. **Issues enforced within their milestone's range.** An issue on the board carries `Start date`
   / `Target date` (Project fields); enforcement requires `milestone.start ≤ issue.start ≤
   issue.target ≤ milestone.target`. Out-of-range assignment is rejected (or flagged, per the
   strictness decision below).
3. **Two-surface implementation (the honest split):**
   - **GitHub = store + display.** Create **Start date** + **Target date** Project fields; set
     **milestone due dates**; the **Roadmap view** plots by them (GANTT + per-milestone burndown).
   - **DocWright = enforcer.** A `src/dispatch/roadmap-dates.ts` validator (dateless-milestone
     check; issue-in-range check) run by **pre-commit / CI** and surfaced in `/api/status` (the
     "needs attention" queue flags a dateless active milestone or an out-of-range issue). Reads
     the board via the GH-pivot client (`github-issues.ts`).
4. **Direction of truth for dates.** Dates are **set in GitHub** (milestone due date / Project
   date fields — where the human plans on the Roadmap) and **validated by DocWright** (it reads
   GH, enforces the rules, never silently invents dates). DocWright does not fabricate schedules.

## Scope of change

- **GH:** add `Start date` + `Target date` Project date fields (`docs/github-project-schema.md`
  update); a helper to open a milestone with required due date; the Roadmap view configured to
  plot by them (the view field-mapping is a UI step — the Projects API can't set it).
- **DocWright:** `roadmap-dates.ts` validator + rules; pre-commit + CI enforcement; `/status`
  surfacing; extend `github-issues.ts` to read/write Project date fields + milestone due dates.
- **Docs/policy:** a `roadmap-date-discipline` policy atom; update the GH-pivot docs + the
  carryover proposal (this subsumes its living-roadmap slice).

## Settled decisions (BDFL, 2026-07-13)

1. **Strictness:** **warn during rollout → hard-fail once the current board is dated**, with a
   documented waiver (mirrors existing gate patterns).
2. **Granularity:** issues **inherit the milestone's range by default**; explicit per-issue
   start/target only when a deviation needs enforcing (no per-issue busywork).
3. **Version == GitHub Milestone** (v0.6.0, v0.7.0…) — no extra layer.
4. **`backlog`/`future` are undated buckets** — exempt from the date requirement.

## Already backfilled (2026-07-13, ahead of the plan)

Concrete first application, executed on the DocWright Dev board: created **Start date** +
**Target date** Project fields; backfilled **Start = earliest `reported_date`** (55 issues) and
**Target = actual `closed_at`** for done issues (33) — real historical data, no fabrication; set
**v0.6.0 due 2026-07-31**; created the **v0.7.0** milestone (authz home). Remaining to light up the
GANTT: point the **Roadmap view** at the Start/Target date fields (a UI step — the Projects API
can't configure a view's field-mapping). The DocWright-side *enforcement* (validator + CI) is the
plan's build work, post-approval.

## Security implications

Low — planning metadata, no new authorization surface. (Writes to GH milestones/Project fields
use the same scoped token as the rest of the pivot.)

## Verification

- Opening a milestone without a due date fails validation (or warns, per #1).
- An issue whose target exceeds its milestone's target is flagged out-of-range.
- The Roadmap view renders a dated GANTT with per-milestone burndown once dates are set.
- `/status` surfaces "milestone X has no target date" / "issue Y is out of range."

## Related

- [[plans/plan-pivot-issue-tracking-to-github-issues-projects-break-the-self-hosting-cyclic-reference]] — the pivot this completes the planning layer for.
- [[proposals/roadmap-discipline-carryover]] — this subsumes its living-roadmap-renderer slice.
- [[proposals/approved/formalize-roadmap-sequencing-enforcement]] — sequencing (phase order); complementary to dates.
- [[docs/github-project-schema]] — where the new Date fields are documented.
