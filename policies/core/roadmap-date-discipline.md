---
title: Roadmap date discipline
author-role: core
tags: [governance, roadmap, milestones, dates, planning]
---

# Roadmap date discipline

**Versions and milestones carry committed target dates, and issues are scheduled within
their milestone's range.** This is what makes "are we on track for the next version?"
answerable — a real burndown instead of an ad-hoc, date-free backlog. Adopted 2026-07-13
alongside the move of dev-issue tracking to GitHub ([[plans/plan-pivot-issue-tracking-to-github-issues-projects-break-the-self-hosting-cyclic-reference]]).

## The rules

1. **Every version/milestone carries a target date.** A dated milestone is opened with an
   initial target; a dateless *active* milestone is a violation. Dates are revisable (the
   change is recorded), not immutable.
2. **Issues fall within their milestone's window,** inheriting the milestone's range by
   default — only *explicit* per-issue Start/Target dates that fall outside the window (or
   invert) are flagged. No per-issue busywork.
3. **`backlog` / `future` are undated buckets** — explicitly exempt from the date requirement.
4. **DocWright never fabricates dates.** Humans set dates in GitHub (milestone due dates,
   Project Start/Target fields); DocWright *reads and validates* — it never invents a schedule.

## The split (why it lives in two places)

GitHub cannot natively enforce "issue within its milestone's date range," so the discipline
is split: **GitHub is the store + display** (milestone due dates, `Start date`/`Target date`
Project fields, the Roadmap view), and **DocWright is the enforcer**.

## Enforcement (code, not memory)

Per [[policies/core/code-over-memory]]: the rules are a validator, not a reminder.
- `src/dispatch/roadmap-dates.ts` — the pure validator (`auditRoadmapDates`).
- `npm run roadmap:check` — reports violations; **warn during rollout, `--strict` (hard-fail)
  once every active milestone is dated**. Wired into CI.
- `/status` "needs attention" surfaces dateless milestones / out-of-range issues.

## Related

- [[proposals/roadmap-date-discipline]] · [[plans/roadmap-date-discipline]] — proposal + plan.
- [[docs/github-project-schema]] — the board's date fields + milestone mapping.
- [[proposals/approved/formalize-roadmap-sequencing-enforcement]] — phase sequencing (complementary).
