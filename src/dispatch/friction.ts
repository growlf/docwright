/**
 * Friction log engine — parse, append, and age-check entries in docs/friction-log.md.
 *
 * The friction log is a markdown table. Two layouts exist in the wild:
 *   legacy (4-col): | Date | Category | Description | Upstream Issue |
 *   current (5-col): | Date | Category | Severity | Description | Upstream Issue |
 * Appends match the layout of the file they land in; new files scaffold 5-col.
 *
 * Review cadence: entries are expected to be triaged weekly. An entry is "aged"
 * once it is older than the cadence and still has no Upstream Issue reference.
 */

export const FRICTION_LOG_PATH = 'docs/friction-log.md';

export const FRICTION_CATEGORIES = [
  'bug',
  'feature-request',
  'ux-friction',
  'docs-gap',
  'missing-abstraction',
] as const;

export const FRICTION_SEVERITIES = ['low', 'medium', 'high'] as const;

/** Default review cadence, in days (weekly). */
export const FRICTION_REVIEW_CADENCE_DAYS = 7;

export interface FrictionEntry {
  date: string;
  category: string;
  severity: string;
  description: string;
  upstreamIssue: string;
}

const HEADER_5 = '| Date | Category | Severity | Description | Upstream Issue |';
const SEP_5 = '|------|----------|----------|-------------|----------------|';

export function scaffoldFrictionLog(): string {
  return [
    '# Friction Log',
    '',
    'Track UX friction, bugs, and feature requests encountered while using DocWright.',
    '',
    `**Review cadence: weekly.** Triage every entry within ${FRICTION_REVIEW_CADENCE_DAYS} days —`,
    'link it to an upstream issue (see `contribute_upstream`), fix it, or strike it.',
    'Aged, untriaged entries surface as a notification badge on the vault status page.',
    '',
    '## Format',
    '',
    HEADER_5,
    SEP_5,
    '',
    '---',
    `Categories: ${FRICTION_CATEGORIES.join(' | ')}`,
    `Severities: ${FRICTION_SEVERITIES.join(' | ')}`,
  ].join('\n');
}

function splitRow(line: string): string[] {
  // Split on unescaped pipes; trim outer empties from leading/trailing |
  const cells = line.split(/(?<!\\)\|/).map((c) => c.replace(/\\\|/g, '|').trim());
  return cells.slice(1, -1);
}

function isSeparatorRow(cells: string[]): boolean {
  return cells.length > 0 && cells.every((c) => /^:?-{2,}:?$/.test(c) || c === '');
}

interface TableShape {
  /** Index of the header line in the raw file's line array, or -1 if none. */
  headerLine: number;
  /** Index of the last row of the table (header, separator, or data row). */
  lastRowLine: number;
  hasSeverity: boolean;
}

function findTable(lines: string[]): TableShape | null {
  for (let i = 0; i < lines.length - 1; i++) {
    if (!lines[i].trim().startsWith('|')) continue;
    const header = splitRow(lines[i]);
    if (!header.some((c) => /^date$/i.test(c))) continue;
    const next = lines[i + 1] ? splitRow(lines[i + 1]) : [];
    if (!isSeparatorRow(next)) continue;
    let last = i + 1;
    for (let j = i + 2; j < lines.length; j++) {
      if (lines[j].trim().startsWith('|')) last = j;
      else break;
    }
    return {
      headerLine: i,
      lastRowLine: last,
      hasSeverity: header.some((c) => /^severity$/i.test(c)),
    };
  }
  return null;
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();
}

/** Parse all entries out of a friction-log file. Blank template rows are skipped. */
export function parseFrictionLog(raw: string): FrictionEntry[] {
  const lines = raw.split('\n');
  const table = findTable(lines);
  if (!table) return [];
  const entries: FrictionEntry[] = [];
  for (let i = table.headerLine + 2; i <= table.lastRowLine; i++) {
    const cells = splitRow(lines[i]);
    if (cells.every((c) => c === '')) continue;
    const [date, category, third, fourth, fifth] = cells;
    const entry: FrictionEntry = table.hasSeverity
      ? {
          date: date ?? '',
          category: category ?? '',
          severity: third ?? '',
          description: fourth ?? '',
          upstreamIssue: fifth ?? '',
        }
      : {
          date: date ?? '',
          category: category ?? '',
          severity: '',
          description: third ?? '',
          upstreamIssue: fourth ?? '',
        };
    if (!entry.date && !entry.description) continue;
    entries.push(entry);
  }
  return entries;
}

/**
 * Append an entry to friction-log content, preserving the file's column layout.
 * Pass null/empty raw to scaffold a fresh 5-column log around the entry.
 */
export function appendFrictionEntry(
  raw: string | null,
  entry: Omit<FrictionEntry, 'upstreamIssue'> & { upstreamIssue?: string },
): string {
  const base = raw && raw.trim() ? raw : scaffoldFrictionLog();
  const lines = base.split('\n');
  const table = findTable(lines);
  if (!table) {
    // No recognizable table — append a fresh one rather than guessing.
    return (
      base.replace(/\n*$/, '\n\n') +
      [HEADER_5, SEP_5, rowFor(entry, true)].join('\n') +
      '\n'
    );
  }
  lines.splice(table.lastRowLine + 1, 0, rowFor(entry, table.hasSeverity));
  return lines.join('\n');
}

function rowFor(
  entry: Omit<FrictionEntry, 'upstreamIssue'> & { upstreamIssue?: string },
  hasSeverity: boolean,
): string {
  const upstream = entry.upstreamIssue ?? '';
  const desc = hasSeverity
    ? entry.description
    : entry.severity ? `[${entry.severity}] ${entry.description}` : entry.description;
  const cells = hasSeverity
    ? [entry.date, entry.category, entry.severity, desc, upstream]
    : [entry.date, entry.category, desc, upstream];
  return `| ${cells.map((c) => escapeCell(String(c))).join(' | ')} |`;
}

/**
 * Entries older than the review cadence with no upstream issue reference.
 * Entries with unparseable dates are never considered aged.
 */
export function agedFrictionEntries(
  entries: FrictionEntry[],
  now: Date,
  cadenceDays: number = FRICTION_REVIEW_CADENCE_DAYS,
): FrictionEntry[] {
  const cutoff = now.getTime() - cadenceDays * 24 * 60 * 60 * 1000;
  return entries.filter((e) => {
    if (e.upstreamIssue && e.upstreamIssue.trim() !== '') return false;
    const t = Date.parse(e.date);
    if (Number.isNaN(t)) return false;
    return t < cutoff;
  });
}
