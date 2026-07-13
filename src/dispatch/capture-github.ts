/**
 * capture-github.ts — Step 4 of the GH-pivot: the GitHub-backed capture pipeline.
 *
 * Mirrors bridge.ts's suggest/confirm/create, but against GitHub Issues + the Project
 * board instead of `issues/*.md`:
 *   - suggest  → repo-scoped issue search (dedup); never writes.
 *   - create   → new GH issue, added to the Project with Lifecycle=new, Demand=1,
 *                Reported Dates=[today], Channel/Priority/DocWright ID set.
 *   - confirm  → +1 Demand + append today to Reported Dates on the board item, bump the
 *                `demand:N` label, and harvest the reporter's context as an issue comment.
 *
 * Two-way reconcile: confirm operates on an existing GH issue by number, so a report that
 * matches an already-tracked issue augments it rather than duplicating. No VS Code deps.
 */
import type { BugReport, DuplicateSuggestion } from './bridge';
import { getSimilarity, SUGGEST_THRESHOLD } from './bridge';
import { GitHubClient } from './github-issues';

const CATEGORY_LABEL: Record<'bug' | 'feature', string> = { bug: 'bug', feature: 'enhancement' };

function slugify(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').slice(0, 50) || 'report';
}

function parseDates(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === 'string' && raw.trim()) {
    try { const p = JSON.parse(raw); if (Array.isArray(p)) return p.map(String); } catch { /* fall through */ }
    return raw.replace(/^\[|\]$/g, '').split(',').map(s => s.trim()).filter(Boolean);
  }
  return [];
}

function issueBody(report: BugReport, related: string[]): string {
  const lines = [
    '## Description', '', report.description.trim(), '',
    '## System Info', '', report.system_info?.trim() || 'None provided', '',
  ];
  if (related.length) lines.push('## Related', '', ...related.map(r => `- ${r}`), '');
  lines.push('---', `_Reported by ${report.reporter} via DocWright capture._`);
  return lines.join('\n');
}

/** Phase 1 — read-only: similar open GH issues (best match first). Never writes. */
export async function ghSuggestDuplicates(
  client: GitHubClient,
  title: string,
  category: 'bug' | 'feature' = 'bug',
): Promise<DuplicateSuggestion[]> {
  const label = CATEGORY_LABEL[category];
  const issues = await client.searchIssues(`is:open label:${label} ${title}`);
  return issues
    .map(issue => ({
      path: `gh:${issue.number}`,
      title: issue.title,
      score: getSimilarity(title, issue.title),
      demandCount: parseInt((issue.labels.find(l => l.startsWith('demand:')) ?? 'demand:0').slice(7), 10) || 0,
      source: 'gh' as const,
      ghIssueNumber: issue.number,
    }))
    .filter(s => s.score >= SUGGEST_THRESHOLD)
    .sort((a, b) => b.score - a.score);
}

export interface GhCaptureResult {
  path: string;          // `gh:<number>` — stable ref used by confirm
  url: string;
  ghIssueNumber: number;
  demandCount: number;
  source: 'github';
}

/** Phase 2b — no match: create the GH issue and place it on the board with demand fields set. */
export async function ghCreateReportedBug(
  client: GitHubClient,
  report: BugReport,
  today: string,
  related: string[] = [],
): Promise<GhCaptureResult> {
  const category = report.category === 'feature' ? 'feature' : 'bug';
  const issue = await client.createIssue({
    title: report.title,
    body: issueBody(report, related),
    labels: [CATEGORY_LABEL[category], 'demand:1'],
  });
  // Place on the board and stamp the Step-2 fields. Field writes are best-effort per
  // field (resolve-by-name); a missing field must not fail the whole capture.
  const itemId = await client.addIssueToProject(issue.nodeId);
  await setField(client, itemId, 'Lifecycle', 'new');
  await setField(client, itemId, 'Demand', 1);
  await setField(client, itemId, 'Reported Dates', JSON.stringify([today]));
  await setField(client, itemId, 'DocWright ID', slugify(report.title));
  if (report.priority) await setField(client, itemId, 'Priority', report.priority);
  if (report.channel) await setField(client, itemId, 'Channel', report.channel);
  return { path: `gh:${issue.number}`, url: issue.url, ghIssueNumber: issue.number, demandCount: 1, source: 'github' };
}

/** Phase 2a — reporter confirmed a match: +1 demand on the board, append today, harvest context. */
export async function ghConfirmDuplicate(
  client: GitHubClient,
  ref: string | number,
  report: BugReport,
  today: string,
): Promise<{ path: string; ghIssueNumber: number; demandCount: number; source: 'github' }> {
  const number = typeof ref === 'number' ? ref : parseInt(String(ref).replace(/^gh:/, ''), 10);
  if (!number || Number.isNaN(number)) throw new Error(`invalid GitHub issue ref: ${ref}`);

  const items = await client.listProjectItemsDetailed();
  const item = items.find(i => i.issue?.number === number);
  if (!item) throw new Error(`issue #${number} is not on the Project board`);

  const nextDemand = Number(item.fields['Demand'] ?? 1) + 1;
  const dates = parseDates(item.fields['Reported Dates']);
  if (!dates.includes(today)) dates.push(today);

  await setField(client, item.itemId, 'Demand', nextDemand);
  await setField(client, item.itemId, 'Reported Dates', JSON.stringify(dates));
  await client.addLabels(number, [`demand:${nextDemand}`]);
  await client.addComment(number, [
    `### Additional report — ${today} (${report.reporter})`, '',
    report.description.trim(),
    report.system_info ? `\n**Environment:** ${report.system_info.trim()}` : '',
  ].join('\n'));

  return { path: `gh:${number}`, ghIssueNumber: number, demandCount: nextDemand, source: 'github' };
}

// Best-effort field write — a board missing an optional field is a warning, not a failure.
async function setField(client: GitHubClient, itemId: string, name: string, value: string | number): Promise<void> {
  try {
    await client.setProjectFieldByName(itemId, name, value);
  } catch (e) {
    // Lifecycle/Demand/Reported Dates are load-bearing; if THEY fail, surface it.
    if (name === 'Lifecycle' || name === 'Demand' || name === 'Reported Dates') throw e;
  }
}
