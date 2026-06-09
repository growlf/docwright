import { readFile, writeFile } from './paths';
import { parseFrontmatter } from './frontmatter';

export function hasPendingSteps(text: string): boolean {
  const lines = text.split('\n');
  let inSection = false;

  for (const line of lines) {
    if (/^##\s/.test(line)) {
      inSection = /^##\s+Implementation Steps\b/i.test(line);
      continue;
    }
    if (/^###\s/.test(line)) {
      inSection = /✅/.test(line);
      continue;
    }
    if (!inSection) continue;
    
    // table row
    if (line.startsWith('|') && line.includes('⏳')) {
      return true;
    }
  }
  return false;
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
