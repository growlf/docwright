import * as fs from 'node:fs';
import * as path from 'node:path';

import { buildRoadplan } from '../src/dispatch/roadplan';

const ROOT = process.env.DOCWRIGHT_ROOT || path.resolve(__dirname, '..');

// Helper to parse frontmatter (handles string, boolean, list/arrays)
function parseFm(raw: string): Record<string, any> {
  const match = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const result: Record<string, any> = {};
  const lines = match[1].split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim() || line.startsWith('#')) { i++; continue; }
    const colonIdx = line.indexOf(':');
    if (colonIdx <= 0) { i++; continue; }
    const key = line.slice(0, colonIdx).trim();
    const rest = line.slice(colonIdx + 1).trim();
    if (rest === '' || rest === '[]') {
      i++;
      const arr: string[] = [];
      if (rest !== '[]') {
        while (i < lines.length && /^\s+-\s/.test(lines[i])) {
          arr.push(lines[i].replace(/^\s+-\s*/, '').trim());
          i++;
        }
      }
      result[key] = arr;
      continue;
    }
    let val: any = rest.replace(/^["']|["']$/g, '');
    if (val === 'true') val = true;
    else if (val === 'false') val = false;
    result[key] = val;
    i++;
  }
  return result;
}

function scanDir(dirName: string): Array<{ path: string; fm: Record<string, any>; type: 'plan' | 'issue' }> {
  const results: Array<{ path: string; fm: Record<string, any>; type: 'plan' | 'issue' }> = [];
  const fullDir = path.join(ROOT, dirName);
  if (!fs.existsSync(fullDir)) return results;
  
  const files = fs.readdirSync(fullDir);
  for (const file of files) {
    if (!file.endsWith('.md')) continue;
    if (file === 'README.md') continue;
    
    // For plans, exclude Completed/Canceled plans and phase overview plans like phase-*.md
    if (dirName === 'plans' && /^phase-/.test(file)) continue;
    
    const filePath = path.join(fullDir, file);
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const fm = parseFm(raw);
      results.push({
        path: `${dirName}/${file}`,
        fm,
        type: dirName === 'plans' ? 'plan' : 'issue'
      });
    } catch { /* skip */ }
  }
  return results;
}

function main() {
  // Read open plans (approved or in-progress)
  const plans = scanDir('plans').filter(({ fm }) => ['approved', 'in-progress'].includes(String(fm.status ?? '')));
  
  // Read open issues (not resolved or wont-fix)
  const issues = scanDir('issues').filter(({ fm }) => !['resolved', 'wont-fix'].includes(String(fm.status ?? 'open')));
  
  // Prepare items
  const mappedPlans = plans.map(p => ({
    path: p.path,
    title: String(p.fm.title || p.path.replace(/^.*\//, '').replace(/\.md$/, '')),
    priority: String(p.fm.priority ?? ''),
    phase: p.fm.phase !== undefined && p.fm.phase !== '' ? String(p.fm.phase) : '',
    status: String(p.fm.status ?? ''),
    assigned_to: String(p.fm.assigned_to ?? ''),
    milestone: String(p.fm.milestone ?? '')
  }));

  const mappedIssues = issues.map(i => ({
    path: i.path,
    title: String(i.fm.title || i.path.replace(/^.*\//, '').replace(/\.md$/, '')),
    priority: String(i.fm.priority ?? ''),
    phase: i.fm.phase !== undefined && i.fm.phase !== '' ? String(i.fm.phase) : '',
    status: String(i.fm.status ?? ''),
    assigned_to: String(i.fm.assigned_to ?? ''),
    milestone: String(i.fm.milestone ?? '')
  }));

  const roadplan = buildRoadplan(mappedPlans, mappedIssues);

  // Generate markdown tables
  let md = '';

  const renderTable = (title: string, name: string, items: any[]) => {
    let sectionMd = `### ${title} Milestone (${name})\n\n`;
    if (items.length === 0) {
      sectionMd += '_No items assigned to this milestone_\n\n';
    } else {
      sectionMd += '| Type | Title | Phase | Priority | Status | Assigned |\n';
      sectionMd += '| :--- | :--- | :--- | :--- | :--- | :--- |\n';
      for (const item of items) {
        const itemTypeStr = item.itemType === 'plan' ? '✨ Plan' : '🐛 Issue';
        const phaseStr = item.phase ? `Phase ${item.phase}` : '—';
        sectionMd += `| ${itemTypeStr} | [[${item.path}\\|${item.title}]] | ${phaseStr} | ${item.priority || '—'} | ${item.status || 'open'} | ${item.assigned_to || '—'} |\n`;
      }
      sectionMd += '\n';
    }
    return sectionMd;
  };

  md += renderTable('🎯 Current', roadplan.current.name, roadplan.current.items);
  md += renderTable('🚀 Next', roadplan.next.name, roadplan.next.items);
  md += renderTable('🗺 Future Pool', roadplan.future.name, roadplan.future.items);

  // Read roadmap.md and replace
  const roadmapPath = path.join(ROOT, 'docs', 'roadmap.md');
  if (!fs.existsSync(roadmapPath)) {
    console.error(`roadmap.md not found at ${roadmapPath}`);
    process.exit(1);
  }

  let content = fs.readFileSync(roadmapPath, 'utf-8');
  const startMarker = '<!-- START_ROADPLAN -->';
  const endMarker = '<!-- END_ROADPLAN -->';

  const startIndex = content.indexOf(startMarker);
  const endIndex = content.indexOf(endMarker);

  if (startIndex === -1 || endIndex === -1 || startIndex >= endIndex) {
    console.error('Placeholder markers not found or invalid in docs/roadmap.md');
    process.exit(1);
  }

  const before = content.slice(0, startIndex + startMarker.length);
  const after = content.slice(endIndex);

  const updatedContent = `${before}\n\n${md}${after}`;
  fs.writeFileSync(roadmapPath, updatedContent, 'utf-8');
  console.log('Successfully updated docs/roadmap.md with derived roadplan.');
}

main();
