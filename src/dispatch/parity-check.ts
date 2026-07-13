/**
 * parity-check.ts — Step 6 of the GH-pivot: the Bar B PARITY GATE.
 *
 * After migration (Step 5) and before cutover (Step 7), prove no "juice" was lost:
 *   1. Coverage / no duplicates — every local issue has EXACTLY ONE GH counterpart.
 *   2. Field fidelity (Bar B)   — demand_count + EVERY reported_date preserved; status→Lifecycle;
 *      scope decision carried; body reconstructed (not empty).
 *   3. Ranking parity (Bar B)   — the demand ranking from GH matches the pre-migration ranking
 *      (order preserved — NOT byte-identical time-weighted scores).
 *   4. Board placement          — every counterpart is on the board with a Lifecycle column set.
 *   5. Link resolution          — every governance-doc reference to a migrated issue resolves.
 *
 * Pure: takes local issues + the GH board + governance docs + the migration map, returns a
 * report. The CLI wires fs/client and BLOCKS (exit 1) when the gate fails. No VS Code deps.
 */
import { statusToLifecycle, type LocalIssue } from './migrate-issues';
import type { ProjectItemDetail } from './github-issues';

export interface ParityCheck {
  name: string;
  passed: boolean;
  detail: string;
  failures: string[];
}

export interface ParityReport {
  passed: boolean;
  checks: ParityCheck[];
  summary: string;
}

export interface ParityInput {
  locals: LocalIssue[];
  board: ProjectItemDetail[];
  docs?: Array<{ path: string; content: string }>;
  migrationMap?: Record<string, { number: number; url: string }>;
}

function parseDates(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === 'string' && raw.trim()) {
    try { const p = JSON.parse(raw); if (Array.isArray(p)) return p.map(String); } catch { /* fall through */ }
    return raw.replace(/^\[|\]$/g, '').split(',').map(s => s.trim()).filter(Boolean);
  }
  return [];
}

function localDates(fm: Record<string, any>): string[] {
  const d = parseDates(fm.reported_dates);
  return d.length ? d : (fm.created ? [String(fm.created)] : []);
}

function localDemand(fm: Record<string, any>): number {
  return Number.isFinite(Number(fm.demand_count)) ? Number(fm.demand_count) : 1;
}

/** Rank identifiers by demand desc, slug asc — a stable, source-agnostic ordering. */
function rank(items: Array<{ id: string; demand: number }>): string[] {
  return [...items].sort((a, b) => b.demand - a.demand || a.id.localeCompare(b.id)).map(i => i.id);
}

export function checkParity(input: ParityInput): ParityReport {
  const { locals, board, docs, migrationMap } = input;
  const checks: ParityCheck[] = [];

  // Index board items by their DocWright ID (the migration's reversibility/dedup key).
  const boardBySlug = new Map<string, ProjectItemDetail[]>();
  for (const item of board) {
    const slug = String(item.fields['DocWright ID'] ?? '').trim();
    if (!slug) continue;
    (boardBySlug.get(slug) ?? boardBySlug.set(slug, []).get(slug)!).push(item);
  }

  // ── 1. Coverage / no duplicates ────────────────────────────────────────────
  const missing: string[] = [];
  const dup: string[] = [];
  for (const l of locals) {
    const m = boardBySlug.get(l.slug) ?? [];
    if (m.length === 0) missing.push(l.slug);
    else if (m.length > 1) dup.push(`${l.slug} → ${m.length} counterparts (#${m.map(x => x.issue?.number).join(', #')})`);
  }
  checks.push({
    name: 'coverage-no-duplicates',
    passed: missing.length === 0 && dup.length === 0,
    detail: `${locals.length} local issues; ${missing.length} missing, ${dup.length} duplicated on the board`,
    failures: [...missing.map(s => `missing counterpart: ${s}`), ...dup],
  });

  // ── 2. Field fidelity (Bar B) ──────────────────────────────────────────────
  const fidelity: string[] = [];
  for (const l of locals) {
    const item = (boardBySlug.get(l.slug) ?? [])[0];
    if (!item) continue; // already reported as missing
    const wantDemand = localDemand(l.fm);
    const haveDemand = Number(item.fields['Demand'] ?? NaN);
    if (haveDemand !== wantDemand) fidelity.push(`${l.slug}: demand ${haveDemand} ≠ ${wantDemand}`);

    const wantDates = new Set(localDates(l.fm));
    const haveDates = new Set(parseDates(item.fields['Reported Dates']));
    const lost = [...wantDates].filter(d => !haveDates.has(d));
    if (lost.length) fidelity.push(`${l.slug}: lost reported_date(s) ${lost.join(', ')}`);

    const wantLife = statusToLifecycle(String(l.fm.status ?? ''));
    if (String(item.fields['Lifecycle'] ?? '') !== wantLife) fidelity.push(`${l.slug}: Lifecycle '${item.fields['Lifecycle']}' ≠ '${wantLife}'`);

    if (l.fm.scope_decision && String(item.fields['Scope Decision'] ?? '') !== String(l.fm.scope_decision)) {
      fidelity.push(`${l.slug}: Scope Decision not preserved`);
    }
    if (item.issue && !item.issue.body.trim()) fidelity.push(`${l.slug}: empty GH body`);
  }
  checks.push({
    name: 'field-fidelity',
    passed: fidelity.length === 0,
    detail: `demand + all reported_dates + lifecycle + scope preserved across ${locals.length} issues`,
    failures: fidelity,
  });

  // ── 3. Ranking parity (Bar B — order, not exact scores) ────────────────────
  const covered = locals.filter(l => (boardBySlug.get(l.slug) ?? []).length === 1);
  const localRank = rank(covered.map(l => ({ id: l.slug, demand: localDemand(l.fm) })));
  const ghRank = rank(covered.map(l => {
    const item = boardBySlug.get(l.slug)![0];
    return { id: l.slug, demand: Number(item.fields['Demand'] ?? 0) };
  }));
  const firstDiff = localRank.findIndex((s, i) => s !== ghRank[i]);
  checks.push({
    name: 'ranking-parity',
    passed: firstDiff === -1,
    detail: `demand ranking of ${covered.length} covered issues`,
    failures: firstDiff === -1 ? [] : [`ranking diverges at #${firstDiff + 1}: local '${localRank[firstDiff]}' vs GH '${ghRank[firstDiff]}'`],
  });

  // ── 4. Board placement / column set ────────────────────────────────────────
  const noColumn: string[] = [];
  for (const l of locals) {
    const item = (boardBySlug.get(l.slug) ?? [])[0];
    if (item && !String(item.fields['Lifecycle'] ?? '').trim()) noColumn.push(l.slug);
  }
  checks.push({
    name: 'board-placement',
    passed: noColumn.length === 0,
    detail: `every counterpart on the board with a Lifecycle column`,
    failures: noColumn.map(s => `${s}: on board but no Lifecycle column`),
  });

  // ── 5. Link resolution ─────────────────────────────────────────────────────
  if (docs && migrationMap) {
    const localSlugs = new Set(locals.map(l => l.slug));
    const unresolved: string[] = [];
    const re = /(?:\[\[)?issues\/([a-z0-9][a-z0-9-]*)(?:\.md)?(?:\|[^\]]*)?(?:\]\])?/gi;
    for (const d of docs) {
      let m: RegExpExecArray | null;
      re.lastIndex = 0;
      while ((m = re.exec(d.content)) !== null) {
        const slug = m[1];
        // A reference to a migrated local issue must be resolvable via the map.
        if (localSlugs.has(slug) && !migrationMap[slug]) unresolved.push(`${d.path} → issues/${slug} (not in migration map)`);
      }
    }
    checks.push({
      name: 'link-resolution',
      passed: unresolved.length === 0,
      detail: `governance-doc references to migrated issues resolve to GH`,
      failures: unresolved,
    });
  } else {
    checks.push({ name: 'link-resolution', passed: true, detail: 'skipped (no docs/migration map supplied)', failures: [] });
  }

  const passed = checks.every(c => c.passed);
  const failCount = checks.filter(c => !c.passed).length;
  return {
    passed,
    checks,
    summary: passed
      ? `PARITY OK — all ${checks.length} checks passed; safe to cut over.`
      : `PARITY FAILED — ${failCount}/${checks.length} checks failed; cutover BLOCKED.`,
  };
}
