import { readFile, writeFile } from './paths';
import { parseFrontmatter, setFrontmatterField, extractFrontmatterField } from './frontmatter';

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

    const parts = line.split('|');
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

export function updateStepCounts(text: string): string {
  const { total, completed } = countSteps(text);
  text = setFrontmatterField(text, 'total_steps', total);
  text = setFrontmatterField(text, 'completed_steps', completed);
  return text;
}

export function hasPendingSteps(text: string): boolean {
  const { total, completed } = countSteps(text);
  return total > completed;
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

    const parts = line.split('|');
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
    const rawParts = line.split('|');
    rawParts[statusColIdx + 1] = ` ${newStatus} `;
    lines[i] = rawParts.join('|');
    found = true;
    break;
  }
  return { text: lines.join('\n'), found };
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

  return null;
}

export function hasTestingPlan(content: string): boolean {
  const match = content.match(/^##\s+Testing Plan\s*\n([\s\S]*?)(?=\n##\s|\n*$)/m);
  if (!match) return false;
  const section = match[1].trim();
  return section !== '' &&
         section !== '_Add test plan during implementation._' &&
         section !== '{{VALUE:testing}}';
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

      const parts = line.split('|');
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
