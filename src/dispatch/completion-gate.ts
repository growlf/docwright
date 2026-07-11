/**
 * Completion gate — surface-agnostic plan-completion enforcement (#172).
 *
 * Single source of truth for "may this plan be completed?" shared by the MCP
 * server (update_plan_status / write_plan / transition_to_completed) and the
 * Web UI (/api/lifecycle/transition-completed). Both surfaces MUST refuse the
 * same plan text with the same message; the parity test in
 * test/integration/gate-parity.test.ts asserts this.
 *
 * Pure text functions only — no filesystem, no MCP, no VS Code deps.
 */
import { extractFrontmatterField } from './frontmatter';

/**
 * Split a markdown table row on unescaped pipes only — `\|` inside a cell is
 * literal content, not a column boundary. Cells keep their `\|` text, so
 * rejoining the parts with '|' reproduces the original line.
 */
export function splitTableRow(line: string): string[] {
  // A pipe is NOT a cell boundary when backslash-escaped (`\\|`) OR inside an
  // inline code span (`` `…|…` ``) — e.g. a Details cell documenting
  // `category: bug|feature`. Splitting on those raw pipes desynced the column
  // count and corrupted rows (update_step replacing the wrong cell / duplicating
  // the Status cell). Contract preserved: `| a | b |` -> ['', ' a ', ' b ', ''],
  // and `parts.join('|')` reproduces the original line.
  const cells: string[] = [];
  let cur = '';
  let inCode = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '\\' && line[i + 1] === '|') { cur += '\\|'; i++; continue; }
    if (ch === '`') { inCode = !inCode; cur += ch; continue; }
    if (ch === '|' && !inCode) { cells.push(cur); cur = ''; continue; }
    cur += ch;
  }
  cells.push(cur);
  return cells;
}

/**
 * Escape pipe characters in user-supplied cell text so a literal `|` does not
 * become a column boundary when composing a table row. Idempotent: an already
 * escaped `\|` stays a single `\|` (not double-escaped). The write-side
 * counterpart to splitTableRow — together they round-trip literal pipes.
 */
export function escapeTableCell(s: string): string {
  return s.replace(/\\?\|/g, '\\|');
}

/**
 * Parse the `## Implementation Steps` table into {number, action, details}
 * rows via the shared splitTableRow, so a Details cell containing a literal
 * pipe (e.g. an inline code span `category: bug|feature`) does not desync the
 * columns. Shared helper — the Web UI plan-review surface uses this instead of
 * a naive line.split('|').
 */
export function extractPlanSteps(
  raw: string,
): Array<{ number: string; action: string; details: string }> {
  const lines = raw.split('\n');
  const rows: Array<{ number: string; action: string; details: string }> = [];
  let inTable = false;
  let headerPassed = false;
  for (const line of lines) {
    if (line.startsWith('## Implementation Steps')) { inTable = true; continue; }
    if (!inTable) continue;
    if (!line.startsWith('|')) { if (line.trim()) inTable = false; continue; }
    if (!headerPassed) { headerPassed = true; continue; }
    if (line.includes('---')) continue;
    const cols = splitTableRow(line).map(c => c.trim());
    const dataCols = cols.slice(1, -1);
    if (dataCols.length >= 3) {
      rows.push({ number: dataCols[0], action: dataCols[1], details: dataCols[2] });
    }
  }
  return rows;
}

export function countSteps(text: string): { total: number; completed: number } {
  const lines = text.split('\n');
  let inSection = false;
  let total = 0;
  let completed = 0;
  let statusColIdx = -1;

  for (const line of lines) {
    if (/^##\s/.test(line)) {
      inSection = /^##\s+Implementation Steps\b/i.test(line);
      statusColIdx = -1;
      continue;
    }
    if (!inSection || !line.startsWith('|')) continue;

    // Skip separator rows (| --- | or | :--- | etc.)
    if (/^\|[\s|:-]+\|$/.test(line)) continue;

    const parts = splitTableRow(line);
    // parts[0] is empty (before first |), parts[parts.length-1] is empty (after last |)
    const cells = parts.slice(1, parts.length - 1).map(c => c.trim());

    if (statusColIdx < 0) {
      // Try to find the Status column from this row's header
      const idx = cells.findIndex(c => /^status$/i.test(c));
      if (idx >= 0) {
        // This is a header row — record Status position, don't count it
        statusColIdx = idx;
        continue;
      }
      // No 'Status' cell found — if first cell is a positive integer this is a
      // headerless data row; fall back to last-column (legacy 4-column behaviour)
      const firstNum = parseInt(cells[0], 10);
      if (firstNum > 0) {
        const lastCell = cells[cells.length - 1] ?? '';
        total++;
        if (lastCell.includes('✅')) completed++;
      }
      continue;
    }

    // Header has been found — guard: first cell must be a positive integer
    const firstNumeric = parseInt(cells[0], 10);
    if (!(firstNumeric > 0)) continue;

    const statusCell = cells[statusColIdx] ?? '';
    total++;
    if (statusCell.includes('✅')) {
      completed++;
    }
  }
  return { total, completed };
}

export function hasPendingSteps(text: string): boolean {
  const { total, completed } = countSteps(text);
  return total > completed;
}

export function checkCompletionGate(text: string, planName: string): string | null {
  // Fix 2: enforce tests_human_reviewed in addition to tests_defined
  const testsDefined = extractFrontmatterField(text, 'tests_defined');
  if (String(testsDefined) !== 'true') {
    return `ERROR: Plan '${planName}' has tests_defined=${testsDefined}. A human reviewer must set tests_defined: true after confirming test coverage is adequate before the plan can be completed.`;
  }

  // Absent field is treated the same as false — requires human review before completing.
  // All plan templates include tests_human_reviewed: false explicitly; absent means
  // a pre-template plan that still needs review. Set to true in frontmatter after review.
  const testsReviewed = extractFrontmatterField(text, 'tests_human_reviewed');
  if (String(testsReviewed) !== 'true') {
    const current = testsReviewed === null ? 'missing' : `=${testsReviewed}`;
    return `ERROR: Plan '${planName}' has tests_human_reviewed ${current}. A human must review and certify the test plan before the plan can be completed. Set tests_human_reviewed: true in the frontmatter after review.`;
  }

  const lines = text.split('\n');
  let inGate = false;
  let gateFound = false;
  let unchecked = 0;

  for (const line of lines) {
    // Fix 1: recognize both '## Phase Gate' (legacy) and '### Gate Criteria' (current template)
    if (line.startsWith('#')) {
      if (inGate) break;
      inGate = line.includes('Phase Gate') || line.includes('Gate Criteria');
      if (inGate) gateFound = true;
    } else if (inGate && line.includes('- [ ]')) {
      unchecked++;
    }
  }

  if (!gateFound) {
    return `ERROR: Plan '${planName}' has no Gate Criteria section. All plans must have a '### Gate Criteria' (or '## Phase Gate') section that is fully signed off before completion.`;
  }

  if (unchecked > 0) {
    return `ERROR: Plan '${planName}' has ${unchecked} unchecked gate item${unchecked === 1 ? '' : 's'}. All Gate Criteria items must be checked [x] before the plan can be completed.`;
  }

  // The whole Testing Plan section must be verified, not just Gate Criteria —
  // Step Verification / Integration boxes left [ ] mean the tests were written
  // but never confirmed against the criteria.
  const openBoxes = uncheckedTestingPlanBoxes(text);
  if (openBoxes.length > 0) {
    return `ERROR: Plan '${planName}' has ${openBoxes.length} unchecked Testing Plan item${openBoxes.length === 1 ? '' : 's'}:\n${openBoxes.map((b) => `  ${b}`).join('\n')}\nVerify each (check it [x] with evidence) or record why it does not apply before completing.`;
  }

  // Tests must have actually RUN, not merely exist. verify_plan_tests records
  // the evidence; a plan with no recorded green run cannot complete.
  const lastResult = extractFrontmatterField(text, 'tests_last_result');
  if (String(lastResult) !== 'pass') {
    const state = lastResult == null ? 'no recorded test run' : `tests_last_result=${lastResult}`;
    return `ERROR: Plan '${planName}' has ${state}. Run the verify_plan_tests MCP tool (records tests_last_run/result/commit on the plan) and get a green run before completing.`;
  }

  return null;
}

/**
 * Unchecked `- [ ]` items anywhere in the `## Testing Plan` section.
 * Returns the trimmed line text of each open box (first 100 chars).
 */
export function uncheckedTestingPlanBoxes(text: string): string[] {
  const out: string[] = [];
  let inSection = false;
  for (const line of text.split('\n')) {
    // `## ` headers bound the section; `###` subsections stay inside it
    if (/^##\s/.test(line)) {
      inSection = /^##\s+Testing Plan\b/.test(line);
      continue;
    }
    if (inSection && /^\s*-\s\[ \]/.test(line)) out.push(line.trim().slice(0, 100));
  }
  return out;
}
