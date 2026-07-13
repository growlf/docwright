/**
 * roadmap-dates.ts — the DocWright side of roadmap date discipline
 * ([[proposals/roadmap-date-discipline]]). GitHub stores + displays (milestone due
 * dates, Project Start/Target date fields, the Roadmap view); DocWright ENFORCES:
 *   1. every non-exempt (dated) milestone/version carries a target date;
 *   2. issues fall within their milestone's [start, target] window.
 *
 * Pure functions over plain shapes (no GH, no fs, no VS Code deps) — the CI check
 * and /status surfacing feed these from the GH client. Settled decisions
 * (BDFL 2026-07-13): issues INHERIT the milestone range by default (only explicit
 * per-issue dates are range-checked); `backlog`/`future` are exempt buckets;
 * severity is WARN during rollout, hardening to error once the board is dated.
 * Dates are ISO `YYYY-MM-DD` strings (lexicographic comparison is date-correct).
 */

import type { ProjectItemDetail, GitHubMilestone } from './github-issues';

export interface MilestoneDates {
  title: string;
  start?: string | null;
  target?: string | null;
  /** Undated bucket (backlog/future) — exempt from the target-date requirement. */
  exempt?: boolean;
}

export interface IssueDates {
  id: string | number;
  milestone?: string | null;
  start?: string | null;
  target?: string | null;
}

export type ViolationKind = 'dateless-milestone' | 'issue-out-of-range' | 'issue-inverted';

export interface DateViolation {
  kind: ViolationKind;
  subject: string;
  detail: string;
}

/** Undated planning buckets — never require a date. */
const EXEMPT_BUCKETS = new Set(['backlog', 'future', 'icebox']);
export function isExemptMilestone(m: Pick<MilestoneDates, 'title' | 'exempt'>): boolean {
  return m.exempt === true || EXEMPT_BUCKETS.has(String(m.title).trim().toLowerCase());
}

/** Rule 1: every non-exempt milestone/version must carry a target date. */
export function checkMilestoneDates(milestones: MilestoneDates[]): DateViolation[] {
  const out: DateViolation[] = [];
  for (const m of milestones) {
    if (isExemptMilestone(m)) continue;
    if (!m.target) {
      out.push({ kind: 'dateless-milestone', subject: m.title, detail: `version/milestone '${m.title}' has no target date` });
    }
  }
  return out;
}

/**
 * Rule 2: issues fall within their milestone's window. Inherit-by-default — an issue
 * with no explicit start/target inherits the milestone's range (never a violation).
 * Only EXPLICIT per-issue dates that fall outside the window (or invert) are flagged.
 */
export function checkIssuesInRange(issues: IssueDates[], milestones: MilestoneDates[]): DateViolation[] {
  const byTitle = new Map(milestones.map(m => [String(m.title).trim(), m]));
  const out: DateViolation[] = [];
  for (const iss of issues) {
    if (!iss.milestone) continue;
    const m = byTitle.get(String(iss.milestone).trim());
    if (!m || isExemptMilestone(m)) continue;
    if (iss.start && iss.target && iss.start > iss.target) {
      out.push({ kind: 'issue-inverted', subject: String(iss.id), detail: `start ${iss.start} is after target ${iss.target}` });
    }
    if (m.start && iss.start && iss.start < m.start) {
      out.push({ kind: 'issue-out-of-range', subject: String(iss.id), detail: `start ${iss.start} precedes milestone '${m.title}' start ${m.start}` });
    }
    if (m.target && iss.target && iss.target > m.target) {
      out.push({ kind: 'issue-out-of-range', subject: String(iss.id), detail: `target ${iss.target} exceeds milestone '${m.title}' target ${m.target}` });
    }
  }
  return out;
}

export interface RoadmapAudit {
  ok: boolean;
  violations: DateViolation[];
}

/** Combined audit — feeds the CI check + the /status "needs attention" surfacing. */
export function auditRoadmapDates(input: { milestones: MilestoneDates[]; issues: IssueDates[] }): RoadmapAudit {
  const violations = [
    ...checkMilestoneDates(input.milestones),
    ...checkIssuesInRange(input.issues, input.milestones),
  ];
  return { ok: violations.length === 0, violations };
}

/**
 * Map the GH board (Project items + repo milestones) into the validator's shapes. Pure —
 * the CLI / status layer fetches `items` (listProjectItemsDetailed) + `milestones`
 * (listMilestones) and feeds them here, then to auditRoadmapDates. Milestone target = its
 * due date; issue Start/Target come from the Project date fields (blank → inherits).
 */
export function roadmapDataFromBoard(
  items: ProjectItemDetail[],
  milestones: GitHubMilestone[],
): { milestones: MilestoneDates[]; issues: IssueDates[] } {
  const ms: MilestoneDates[] = milestones.map(m => ({ title: m.title, start: null, target: m.dueOn }));
  const issues: IssueDates[] = items
    .filter(i => i.issue)
    .map(i => ({
      id: i.issue!.number,
      milestone: i.issue!.milestone,
      start: typeof i.fields['Start date'] === 'string' ? (i.fields['Start date'] as string) : null,
      target: typeof i.fields['Target date'] === 'string' ? (i.fields['Target date'] as string) : null,
    }));
  return { milestones: ms, issues };
}
