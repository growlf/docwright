import { readFile, writeFile } from './paths';
import { parseFrontmatter, setFrontmatterField } from './frontmatter';
import { splitTableRow, countSteps } from '../../dispatch/completion-gate';

// Completion-gate logic is surface-agnostic and lives in the dispatch module
// (src/dispatch/completion-gate.ts) so the Web UI enforces the identical gate
// (#172). Re-exported here so MCP tools and tests keep a single import path.
export {
  splitTableRow,
  countSteps,
  hasPendingSteps,
  checkCompletionGate,
  uncheckedTestingPlanBoxes,
} from '../../dispatch/completion-gate';

export function updateStepCounts(text: string): string {
  const { total, completed } = countSteps(text);
  text = setFrontmatterField(text, 'total_steps', total);
  text = setFrontmatterField(text, 'completed_steps', completed);
  return text;
}

export function replaceStepStatus(text: string, stepMatch: string, newStatus: string): { text: string; found: boolean } {
  const lines = text.split('\n');
  let inSection = false;
  let found = false;
  let statusColIdx = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (/^##\s/.test(line)) {
      inSection = /^##\s+Implementation Steps\b/i.test(line);
      statusColIdx = -1;
      continue;
    }

    if (!inSection || !line.startsWith('|')) continue;

    // Skip separator rows
    if (/^\|[\s|:-]+\|$/.test(line)) continue;

    const parts = splitTableRow(line);
    const cells = parts.slice(1, parts.length - 1).map(c => c.trim());

    // Detect header row to record statusColIdx
    if (statusColIdx < 0) {
      const idx = cells.findIndex(c => /^status$/i.test(c));
      if (idx >= 0) {
        // Header row — record Status column, never a match target
        statusColIdx = idx;
        continue;
      }
      // No header found — if this is a data row and matches, use last-column fallback
      const firstNum = parseInt(cells[0], 10);
      if (firstNum > 0 && line.includes(stepMatch)) {
        const stripped = line.trimEnd();
        const lastPipe = stripped.lastIndexOf('|', stripped.length - 2);
        if (lastPipe >= 0) {
          lines[i] = stripped.slice(0, lastPipe + 1) + ' ' + newStatus + ' |';
          found = true;
          break;
        }
      }
      continue;
    }

    if (!line.includes(stepMatch)) continue;

    // Guard: first numeric cell must be > 0 (skip accidental header matches)
    const firstNumeric = parseInt(cells[0], 10);
    if (!(firstNumeric > 0)) continue;

    // Replace the cell at statusColIdx in the raw parts array.
    // parts[0] = '' (before first |), so parts[statusColIdx + 1] is the status cell.
    const rawParts = splitTableRow(line);
    rawParts[statusColIdx + 1] = ` ${newStatus} `;
    lines[i] = rawParts.join('|');
    found = true;
    break;
  }
  return { text: lines.join('\n'), found };
}

const TESTING_PLAN_PLACEHOLDERS = new Set([
  '_testing plan tbd_',
  '_add test plan during implementation._',
  '{{value:testing}}',
]);

export function hasTestingPlan(content: string): boolean {
  const match = content.match(/^##\s+Testing Plan\s*\n([\s\S]*?)(?=\n##\s|\n*$)/m);
  if (!match) return false;
  const section = match[1].trim();
  return section !== '' && !TESTING_PLAN_PLACEHOLDERS.has(section.toLowerCase());
}

/**
 * Returns true if the Implementation Steps table has no step with a non-empty Action cell.
 * A plan scaffold with only `| 1 | | | ⏳ Pending |` rows is considered placeholder.
 */
export function hasPlaceholderSteps(text: string): boolean {
  const lines = text.split('\n');
  let inSection = false;
  let dataRowCount = 0;
  let filledCount = 0;
  let actionColIdx = -1;
  let headerFound = false;

  for (const line of lines) {
    if (/^##\s/.test(line)) {
      inSection = /^##\s+Implementation Steps\b/i.test(line);
      actionColIdx = -1;
      headerFound = false;
      continue;
    }
    if (!inSection || !line.startsWith('|')) continue;
    if (/^\|[\s|:-]+\|$/.test(line)) continue;

    const parts = splitTableRow(line);
    const cells = parts.slice(1, parts.length - 1).map(c => c.trim());

    if (!headerFound) {
      const aIdx = cells.findIndex(c => /^action$/i.test(c));
      if (aIdx >= 0) {
        actionColIdx = aIdx;
        headerFound = true;
        continue;
      }
      // Headerless table — treat cells[1] as Action (legacy 4-col)
      const firstNum = parseInt(cells[0], 10);
      if (firstNum > 0) {
        dataRowCount++;
        const action = cells[1] ?? '';
        if (action !== '' && action !== '-' && action !== '—') filledCount++;
      }
      continue;
    }

    const firstNum = parseInt(cells[0], 10);
    if (!(firstNum > 0)) continue;
    dataRowCount++;
    const action = actionColIdx >= 0 ? (cells[actionColIdx] ?? '') : (cells[1] ?? '');
    if (action !== '' && action !== '-' && action !== '—') filledCount++;
  }

  return dataRowCount === 0 || filledCount === 0;
}

export function updateParentDeliverable(text: string, safeName: string): string {
  const fm = parseFrontmatter(text);
  const parentPlan = fm['parent_plan'];
  const parentDeliverable = fm['parent_deliverable'];

  if (!parentPlan || !parentDeliverable) return '';

  try {
    const pSafe = String(parentPlan).endsWith('.md') ? String(parentPlan) : `${parentPlan}.md`;
    let parentText = readFile(`plans/${pSafe}`);

    const lines = parentText.split('\n');
    let inSection = false;
    let found = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/^##\s/.test(line)) {
        inSection = /^##\s+Deliverables\b/i.test(line);
        continue;
      }
      if (!inSection || !line.startsWith('|')) continue;

      const parts = splitTableRow(line);
      if (parts.length > 2 && parts[1].trim() === String(parentDeliverable).trim()) {
        const lastIdx = parts.length - 2;
        parts[lastIdx] = ' ✅ Done ';
        lines[i] = parts.join('|');
        found = true;
        break;
      }
    }

    if (found) {
      parentText = lines.join('\n');
      writeFile(`plans/${pSafe}`, parentText);
      return `\nParent deliverable #${parentDeliverable} in ${pSafe} marked ✅ Done.`;
    }
  } catch (err: any) {
    return `\nWARN: Could not update parent deliverable: ${err.message}`;
  }
  return '';
}
