import { readFile, writeFile } from './paths';
import { parseFrontmatter, setFrontmatterField, extractFrontmatterField } from './frontmatter';

export function countSteps(text: string): { total: number; completed: number } {
  const lines = text.split('\n');
  let inSection = false;
  let total = 0;
  let completed = 0;

  for (const line of lines) {
    if (/^##\s/.test(line)) {
      inSection = /^##\s+Implementation Steps\b/i.test(line);
      continue;
    }
    if (!inSection || !line.startsWith('|') || line.startsWith('|---') || line.startsWith('| ---')) continue;
    
    const parts = line.split('|');
    const lastCell = (parts[parts.length - 2] || '').trim();
    
    // Skip header row
    if (lastCell.toLowerCase() === 'status') continue;
    
    total++;
    if (lastCell.includes('✅')) {
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

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^##\s/.test(line)) {
      inSection = /^##\s+Implementation Steps\b/i.test(line);
    } else if (inSection && line.startsWith('|') && line.includes(stepMatch)) {
      const stripped = line.trimEnd();
      if (stripped.endsWith('|')) {
        const inner = stripped.slice(0, -1).trimEnd();
        const lastPipe = inner.lastIndexOf('|');
        if (lastPipe >= 0) {
          lines[i] = inner.slice(0, lastPipe + 1) + ' ' + newStatus + ' |';
          found = true;
          break;
        }
      }
    }
  }
  return { text: lines.join('\n'), found };
}

export function checkCompletionGate(text: string, planName: string): string | null {
  // Fix 2: enforce tests_human_reviewed in addition to tests_defined
  const testsDefined = extractFrontmatterField(text, 'tests_defined');
  if (String(testsDefined) !== 'true') {
    return `ERROR: Plan '${planName}' has tests_defined=${testsDefined}. A human reviewer must set tests_defined: true after confirming test coverage is adequate before the plan can be completed.`;
  }

  const testsReviewed = extractFrontmatterField(text, 'tests_human_reviewed');
  if (String(testsReviewed) !== 'true') {
    return `ERROR: Plan '${planName}' has tests_human_reviewed=false. A human must review and certify the AI-generated test plan before the plan can be completed. Set tests_human_reviewed: true in the frontmatter after review.`;
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
