import * as fs from 'node:fs';
import * as path from 'node:path';

export interface ReleaseReadiness {
  milestone: string;
  channel: 'dev' | 'beta' | 'stable';
  blockers: {
    count: number;
    items: Array<{ path: string; title: string; priority: string; status: string }>;
  };
  majors: {
    count: number;
    items: Array<{ path: string; title: string; priority: string; status: string; demandCount: number }>;
  };
  dogfoodWindow: {
    requiredDays: number;
    actualDays: number;
    passed: boolean;
    startDate: string;
  };
  burndown: {
    resolved: number;
    open: number;
    passed: boolean;
  };
  ready: boolean;
}

// Helper to parse simple frontmatter
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

function readDir(repoRoot: string, relDir: string): Array<{ path: string; fm: Record<string, any> }> {
  const results: Array<{ path: string; fm: Record<string, any> }> = [];
  const dir = path.join(repoRoot, relDir);
  if (!fs.existsSync(dir)) return results;
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith('.md') || name === 'README.md') continue;
    const full = path.join(dir, name);
    try {
      const raw = fs.readFileSync(full, 'utf-8');
      results.push({ path: path.relative(repoRoot, full), fm: parseFm(raw) });
    } catch { /* skip */ }
  }
  return results;
}

export function getReleaseReadiness(repoRoot: string, milestone: string): ReleaseReadiness {
  const plans = [
    ...readDir(repoRoot, 'plans'),
    ...readDir(repoRoot, 'plans/completed'),
  ];
  const issues = readDir(repoRoot, 'issues');

  // Filter items for the specified milestone
  const milestoneItems = [
    ...plans.map(p => ({ ...p, itemType: 'plan' })),
    ...issues.map(i => ({ ...i, itemType: 'issue' })),
  ].filter(item => {
    const m = String(item.fm.milestone ?? '').trim();
    return m.toLowerCase() === milestone.toLowerCase();
  });

  // Identify base plan/document for the channel metadata
  const basePlan = milestoneItems.find(item => item.fm.channel !== undefined) || 
                   milestoneItems.find(item => item.itemType === 'plan');
  const channel: 'dev' | 'beta' | 'stable' = (basePlan?.fm.channel as any) || 'dev';

  // Metrics extraction
  const blockers: ReleaseReadiness['blockers']['items'] = [];
  const majors: ReleaseReadiness['majors']['items'] = [];

  let resolved = 0;
  let open = 0;
  let earliestDate = new Date();

  for (const item of milestoneItems) {
    const status = String(item.fm.status ?? '').trim().toLowerCase();
    const isCompleted = ['completed', 'resolved', 'wont-fix', 'canceled'].includes(status);
    const priority = String(item.fm.priority ?? '').trim().toLowerCase();
    const demandCount = parseInt(String(item.fm.demand_count ?? '1'), 10);
    const title = String(item.fm.title ?? item.path.replace(/^.*\//, '').replace(/\.md$/, ''));

    if (isCompleted) {
      resolved++;
    } else {
      open++;
      if (item.itemType === 'issue' && (priority === 'high' || priority === 'critical')) {
        blockers.push({ path: item.path, title, priority, status });
      } else if (item.itemType === 'issue' && demandCount >= 5) {
        majors.push({ path: item.path, title, priority, status, demandCount });
      }
    }

    // Trace start/created date
    const createdStr = String(item.fm.created ?? '');
    if (createdStr) {
      const d = new Date(createdStr);
      if (!isNaN(d.getTime()) && d < earliestDate) {
        earliestDate = d;
      }
    }
  }

  // Dogfood window calculation
  const requiredDays = 7;
  const actualDays = Math.max(0, Math.floor((Date.now() - earliestDate.getTime()) / (1000 * 60 * 60 * 24)));
  const dogfoodPassed = actualDays >= requiredDays;

  // Burn-down trend verification (resolved >= open, or all resolved)
  const burndownPassed = resolved >= open || open === 0;

  // Readiness flag
  const ready = blockers.length === 0 && majors.length === 0 && dogfoodPassed && burndownPassed;

  return {
    milestone,
    channel,
    blockers: { count: blockers.length, items: blockers },
    majors: { count: majors.length, items: majors },
    dogfoodWindow: {
      requiredDays,
      actualDays,
      passed: dogfoodPassed,
      startDate: earliestDate.toISOString().slice(0, 10),
    },
    burndown: {
      resolved,
      open,
      passed: burndownPassed,
    },
    ready,
  };
}
