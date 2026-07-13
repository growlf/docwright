/**
 * migrate-issues.ts — Step 5 of the GH-pivot: lossless, two-way, idempotent migration
 * of local `issues/*.md` onto GitHub Issues + the Project board.
 *
 * LOSSLESS (Bar B): every field maps to a durable GitHub home — demand_count + EVERY
 * reported_date into the board's Demand / Reported Dates fields; status→Lifecycle;
 * scope_* + description + history into the issue body verbatim; category/demand as labels.
 *
 * TWO-WAY / NO DUPLICATES: reconciles against issues already on GitHub. An issue with a
 * `github_issue:` backlink (59 of 96) is UPDATED in place; a title match adopts that
 * number; only genuinely-novel issues are CREATEd. Re-running is a no-op once everything
 * is mirrored and on the board with matching fields (→ every action becomes `skip`).
 *
 * NON-DESTRUCTIVE: this step never deletes or archives — originals stay until the Step 6
 * parity gate passes (Step 7 does the archive). Pure planning here; GH I/O in
 * executeMigration; fs stays in the CLI. No VS Code deps.
 */
import { parseFrontmatter } from './frontmatter';
import type { GitHubClient } from './github-issues';

export interface LocalIssue {
  path: string;   // e.g. issues/bug-foo.md
  slug: string;   // e.g. bug-foo
  fm: Record<string, any>;
  body: string;   // markdown after the frontmatter block
}

export interface ExistingGhIssue {
  number: number;
  nodeId: string;
  title: string;
  labels: string[];
}

export type MigrationKind = 'create' | 'update' | 'skip';

export interface MigrationAction {
  slug: string;
  localPath: string;
  title: string;
  kind: MigrationKind;
  ghIssueNumber?: number;     // set for update/skip
  ghNodeId?: string;          // set for update/skip (needed for board placement)
  labels: string[];
  body: string;
  fields: Record<string, string | number>;
  reason: string;
}

export interface MigrationPlan {
  actions: MigrationAction[];
  summary: { create: number; update: number; skip: number; total: number };
}

const LIFECYCLE = new Set(['new', 'triaged', 'scope-checked', 'awaiting-proposal', 'proposal-linked', 'resolved', 'deferred', 'duplicate']);

/** Map a local `status` to a valid Lifecycle option (the board single-select enum). */
export function statusToLifecycle(status: string): string {
  const s = String(status ?? '').trim();
  if (LIFECYCLE.has(s)) return s;
  if (s === 'wont-fix' || s === 'closed') return 'resolved';
  if (s === 'open' || s === '') return 'new';
  return 'triaged';
}

function priorityOf(p: unknown): string {
  const v = String(p ?? '').trim();
  return ['critical', 'high', 'medium', 'low'].includes(v) ? v : 'medium';
}

function datesOf(fm: Record<string, any>): string[] {
  const raw = fm.reported_dates;
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === 'string' && raw.trim()) {
    return raw.replace(/^\[|\]$/g, '').split(',').map(s => s.trim()).filter(Boolean);
  }
  return fm.created ? [String(fm.created)] : [];
}

function categoryLabel(fm: Record<string, any>): string {
  const c = String(fm.category ?? 'bug');
  if (c === 'feature') return 'enhancement';
  if (c === 'bug') return 'bug';
  return `category:${c}`;
}

/** Split a raw issue file into frontmatter + body. */
export function parseLocalIssue(filePath: string, raw: string): LocalIssue {
  const fm = parseFrontmatter(raw);
  const m = raw.match(/^---\n[\s\S]*?\n---\n?/);
  const body = m ? raw.slice(m[0].length).trim() : raw.trim();
  const slug = filePath.replace(/^.*\//, '').replace(/\.md$/, '');
  return { path: filePath.includes('/') ? filePath : `issues/${filePath}`, slug, fm, body };
}

/** Board field values for an issue (matches docs/github-project-schema.md). */
export function buildFields(issue: LocalIssue): Record<string, string | number> {
  const fm = issue.fm;
  const fields: Record<string, string | number> = {
    Lifecycle: statusToLifecycle(String(fm.status ?? '')),
    Priority: priorityOf(fm.priority),
    Demand: Number.isFinite(Number(fm.demand_count)) ? Number(fm.demand_count) : 1,
    'Reported Dates': JSON.stringify(datesOf(fm)),
    'DocWright ID': issue.slug,
  };
  if (fm.channel) fields['Channel'] = String(fm.channel);
  if (fm.scope_decision) fields['Scope Decision'] = String(fm.scope_decision);
  return fields;
}

export function buildLabels(issue: LocalIssue): string[] {
  const demand = Number(issue.fm.demand_count) || 1;
  return [categoryLabel(issue.fm), `demand:${demand}`];
}

/** Reconstruct the GH issue body: original body + scope + related, verbatim (no lost juice). */
export function buildBody(issue: LocalIssue): string {
  const fm = issue.fm;
  const out = [issue.body.trim()];
  const scope: string[] = [];
  if (fm.scope_assessment) scope.push(`**Assessment:** ${fm.scope_assessment}`);
  if (fm.scope_decision) scope.push(`**Decision:** ${fm.scope_decision}`);
  if (fm.scope_notes) scope.push(`**Notes:** ${fm.scope_notes}`);
  if (scope.length) out.push('', '## Scope', '', scope.join('\n\n'));

  const rel = [
    ...(Array.isArray(fm.related) ? fm.related : fm.related ? [fm.related] : []),
    ...(Array.isArray(fm.consumed_by) ? fm.consumed_by : fm.consumed_by ? [fm.consumed_by] : []),
  ].map(String);
  if (rel.length) out.push('', '## Related', '', ...rel.map(r => `- ${r}`));

  out.push('', '---', `_Migrated from DocWright vault \`${issue.path}\` (demand ${Number(fm.demand_count) || 1})._`);
  return out.join('\n');
}

/** Compare the managed board fields, treating Reported Dates as a date set (order-agnostic). */
function fieldsMatch(want: Record<string, string | number>, have: Record<string, string | number>): boolean {
  for (const [k, v] of Object.entries(want)) {
    if (k === 'Reported Dates') {
      const a = new Set(datesOf({ reported_dates: v }));
      const b = new Set(datesOf({ reported_dates: have[k] }));
      if (a.size !== b.size || [...a].some(d => !b.has(d))) return false;
    } else if (String(have[k] ?? '') !== String(v)) {
      return false;
    }
  }
  return true;
}

/**
 * Plan the migration. Reconciles each local issue against GitHub:
 *   - `github_issue:` backlink that still exists → UPDATE (reuse; never duplicate).
 *   - else a title match among existing GH issues → adopt that number (UPDATE).
 *   - else CREATE.
 * An UPDATE whose issue is already on the board with matching fields becomes SKIP
 * (so a fully-migrated re-run is a no-op).
 */
export function planMigration(
  locals: LocalIssue[],
  existingGh: ExistingGhIssue[],
  boardFieldsByNumber: Map<number, Record<string, string | number>>,
): MigrationPlan {
  const byNumber = new Map(existingGh.map(g => [g.number, g]));
  const byTitle = new Map(existingGh.map(g => [g.title.trim().toLowerCase(), g]));
  const actions: MigrationAction[] = [];

  for (const issue of locals) {
    const fields = buildFields(issue);
    const labels = buildLabels(issue);
    const body = buildBody(issue);
    const base = { slug: issue.slug, localPath: issue.path, title: String(issue.fm.title ?? issue.slug), labels, body, fields };

    const linked = issue.fm.github_issue ? byNumber.get(Number(issue.fm.github_issue)) : undefined;
    const matched = linked ?? byTitle.get(String(issue.fm.title ?? '').trim().toLowerCase());

    if (matched) {
      const onBoard = boardFieldsByNumber.has(matched.number);
      const boardFields = boardFieldsByNumber.get(matched.number) ?? {};
      const skip = onBoard && fieldsMatch(fields, boardFields);
      actions.push({
        ...base,
        kind: skip ? 'skip' : 'update',
        ghIssueNumber: matched.number,
        ghNodeId: matched.nodeId,
        reason: skip
          ? `already mirrored (#${matched.number}), on board, fields match`
          : linked
            ? `github_issue #${matched.number} — update body/labels/fields${onBoard ? '' : ' + place on board'}`
            : `title matches existing #${matched.number} — adopt (no duplicate)`,
      });
    } else {
      actions.push({ ...base, kind: 'create', reason: 'novel — create GH issue + place on board' });
    }
  }

  const summary = {
    create: actions.filter(a => a.kind === 'create').length,
    update: actions.filter(a => a.kind === 'update').length,
    skip: actions.filter(a => a.kind === 'skip').length,
    total: actions.length,
  };
  return { actions, summary };
}

export interface MigrationResult {
  map: Record<string, { number: number; url: string }>;  // slug → gh
  created: number;
  updated: number;
  skipped: number;
  dryRun: boolean;
}

/**
 * Execute the plan against GitHub. `dryRun` performs NO writes — it resolves URLs for
 * already-mirrored issues and reports what would happen. fs/link-rewrite/write-back stay
 * in the CLI (this only touches the GH API, so it unit-tests against a mock client).
 */
export async function executeMigration(
  plan: MigrationPlan,
  client: GitHubClient,
  opts: { dryRun?: boolean; repoUrlBase?: string } = {},
): Promise<MigrationResult> {
  const dryRun = opts.dryRun ?? false;
  const base = opts.repoUrlBase ?? '';
  const map: Record<string, { number: number; url: string }> = {};
  let created = 0, updated = 0, skipped = 0;

  for (const a of plan.actions) {
    if (a.kind === 'skip') {
      skipped++;
      map[a.slug] = { number: a.ghIssueNumber!, url: `${base}/${a.ghIssueNumber}` };
      continue;
    }
    if (dryRun) {
      if (a.kind === 'create') created++; else updated++;
      if (a.ghIssueNumber) map[a.slug] = { number: a.ghIssueNumber, url: `${base}/${a.ghIssueNumber}` };
      continue;
    }
    if (a.kind === 'create') {
      const issue = await client.createIssue({ title: a.title, body: a.body, labels: a.labels });
      const itemId = await client.addIssueToProject(issue.nodeId);
      await setFields(client, itemId, a.fields);
      map[a.slug] = { number: issue.number, url: issue.url };
      created++;
    } else {
      // update: refresh body/labels, ensure board placement, set fields.
      await client.updateIssue(a.ghIssueNumber!, { body: a.body });
      await client.addLabels(a.ghIssueNumber!, a.labels);
      const itemId = await client.addIssueToProject(a.ghNodeId!); // idempotent: returns the existing item
      await setFields(client, itemId, a.fields);
      map[a.slug] = { number: a.ghIssueNumber!, url: `${base}/${a.ghIssueNumber}` };
      updated++;
    }
  }
  return { map, created, updated, skipped, dryRun };
}

async function setFields(client: GitHubClient, itemId: string, fields: Record<string, string | number>): Promise<void> {
  for (const [name, value] of Object.entries(fields)) {
    await client.setProjectFieldByName(itemId, name, value);
  }
}

/**
 * Compute link rewrites for governance docs: references to a migrated issue (wikilink
 * `[[issues/slug]]`, path `issues/slug.md`, or bare `issues/slug`) → the stable GH URL.
 * Pure: takes file contents, returns the edits (the CLI reads/writes disk).
 */
export function computeLinkRewrites(
  files: Array<{ path: string; content: string }>,
  slugToUrl: Record<string, { url: string }>,
): Array<{ path: string; content: string; changes: number }> {
  const out: Array<{ path: string; content: string; changes: number }> = [];
  for (const f of files) {
    let content = f.content;
    let changes = 0;
    for (const [slug, { url }] of Object.entries(slugToUrl)) {
      // Match [[issues/slug]], [[issues/slug|text]], issues/slug.md, issues/slug (word-bounded).
      const patterns = [
        new RegExp(`\\[\\[issues/${escapeRe(slug)}(\\|[^\\]]*)?\\]\\]`, 'g'),
        new RegExp(`issues/${escapeRe(slug)}\\.md`, 'g'),
        new RegExp(`(?<![\\w/-])issues/${escapeRe(slug)}(?![\\w/.-])`, 'g'),
      ];
      for (const re of patterns) {
        content = content.replace(re, () => { changes++; return url; });
      }
    }
    if (changes > 0) out.push({ path: f.path, content, changes });
  }
  return out;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
