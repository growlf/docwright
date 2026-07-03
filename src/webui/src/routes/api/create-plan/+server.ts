import fs from 'node:fs';
import path from 'node:path';
import { json } from '@sveltejs/kit';
import { parseFrontmatter, setFrontmatterField } from '../../../../../dispatch/frontmatter';
import { syncTestCriteria } from '../../../../../dispatch/test-criteria';
import { generatePlanSections, assemblePlan } from '../approve-proposal/plan-generator';

const REPO_ROOT = (() => {
  if (process.env.DOCWRIGHT_ROOT) return process.env.DOCWRIGHT_ROOT;
  return path.resolve(process.cwd(), '../..');
})();

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^\w]+/g, '-').replace(/^-+|-+$/g, '') || 'plan';
}

function readFrontmatter(filePath: string): Record<string, any> | null {
  if (!fs.existsSync(filePath)) return null;
  return parseFrontmatter(fs.readFileSync(filePath, 'utf-8'));
}

function resolvePath(p: string): string {
  return p.endsWith('.md') ? p : p + '.md';
}

function findProposalPath(cand: string): string | null {
  const rel = cand.endsWith('.md') ? cand : cand + '.md';
  if (rel.startsWith('proposals/')) {
    const p = path.join(REPO_ROOT, rel);
    if (fs.existsSync(p)) return rel;
    if (rel.startsWith('proposals/approved/')) {
      const alt = rel.replace('proposals/approved/', 'proposals/');
      if (fs.existsSync(path.join(REPO_ROOT, alt))) return alt;
    } else {
      const alt = rel.replace('proposals/', 'proposals/approved/');
      if (fs.existsSync(path.join(REPO_ROOT, alt))) return alt;
    }
    return null;
  }
  const p1 = `proposals/approved/${path.basename(rel)}`;
  if (fs.existsSync(path.join(REPO_ROOT, p1))) return p1;
  const p2 = `proposals/${path.basename(rel)}`;
  if (fs.existsSync(path.join(REPO_ROOT, p2))) return p2;
  return null;
}

function readFileBody(filePath: string): string {
  const resolved = path.join(REPO_ROOT, resolvePath(filePath));
  if (!fs.existsSync(resolved)) return '';
  const raw = fs.readFileSync(resolved, 'utf-8');
  const m = raw.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
  return m ? m[1].trim() : '';
}

function parseProposalSections(body: string): Record<string, string> {
  const sections: Record<string, string> = {};
  const lines = body.split('\n');
  let currentName = '';
  let currentLines: string[] = [];
  for (const line of lines) {
    const m = line.match(/^##\s+(.+)/);
    if (m) {
      if (currentName) sections[currentName.toLowerCase()] = currentLines.join('\n').trim();
      currentName = m[1].trim();
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }
  if (currentName) sections[currentName.toLowerCase()] = currentLines.join('\n').trim();
  return sections;
}

function detectCurrentPhase(repoRoot: string): string {
  const plansDir = path.join(repoRoot, 'plans');
  if (!fs.existsSync(plansDir)) return '';
  try {
    const files = fs.readdirSync(plansDir).filter(f => /^phase-\d.*\.md$/.test(f));
    let best: number | null = null;
    for (const f of files) {
      const fm = readFrontmatter(path.join(plansDir, f));
      if (!fm) continue;
      const status = String(fm.status ?? '');
      if (!['approved', 'in-progress'].includes(status)) continue;
      const n = parseInt(String(fm.phase ?? '0'), 10);
      if (n > 0 && (best === null || n < best)) best = n;
    }
    return best !== null ? String(best) : '';
  } catch { return ''; }
}

function walkDeps(candidates: string[], repoRoot: string): string[] {
  const seen = new Set<string>();
  const queue = [...candidates];
  while (queue.length > 0) {
    const c = queue.shift()!;
    if (seen.has(c)) continue;
    seen.add(c);
    const resolved = findProposalPath(c);
    if (!resolved) continue;
    const resolvedFull = path.join(repoRoot, resolved);
    const fm = readFrontmatter(resolvedFull);
    if (!fm) continue;
    for (const field of ['depends_on']) {
      const links = Array.isArray(fm[field]) ? fm[field] : (fm[field] ? [fm[field]] : []);
      for (const link of links) {
        if (link && !seen.has(link)) queue.push(link);
      }
    }
  }
  return [...seen];
}

export async function POST({ request }) {
  const { title, candidates } = await request.json();
  if (!title || !candidates || !Array.isArray(candidates)) {
    return json({ error: 'missing title or candidates' }, { status: 400 });
  }

  const sourceProposal = candidates[0] || '';
  const resolvedProposal = sourceProposal ? findProposalPath(sourceProposal) : null;
  let proposalFm: Record<string, any> = {};
  if (resolvedProposal) {
    const fullPropPath = path.join(REPO_ROOT, resolvedProposal);
    proposalFm = readFrontmatter(fullPropPath) || {};
    if (proposalFm.consumed_by) {
      return json({ error: 'plan already exists', path: proposalFm.consumed_by }, { status: 409 });
    }
  }

  let planSlug = '';
  if (sourceProposal) {
    planSlug = path.basename(sourceProposal, '.md');
  } else {
    planSlug = slugify(title);
  }
  planSlug = planSlug.replace(/^plan-/, '');
  const planPath = `plans/${planSlug}.md`;
  const resolved = path.join(REPO_ROOT, planPath);
  if (!resolved.startsWith(REPO_ROOT)) return json({ error: 'invalid path' }, { status: 403 });
  if (fs.existsSync(resolved)) {
    return json({ error: 'plan already exists', path: planPath }, { status: 409 });
  }

  // Walk dependency chains to discover transitive candidates
  const allCandidates = walkDeps(candidates, REPO_ROOT);

  // Filter out already-planned proposals and missing files
  const validCandidates: string[] = [];
  const alreadyPlanned: string[] = [];
  for (const cand of allCandidates) {
    const candResolved = findProposalPath(cand);
    if (!candResolved) continue;
    const fm = readFrontmatter(path.join(REPO_ROOT, candResolved));
    if (!fm) continue;
    if (fm.consumed_by) {
      alreadyPlanned.push(cand);
      continue;
    }
    validCandidates.push(cand);
  }

  const now = new Date().toISOString().slice(0, 10);
  const currentPhase = detectCurrentPhase(REPO_ROOT);

  // Parse the first candidate proposal's body to extract sections
  const proposalBody = resolvedProposal ? readFileBody(resolvedProposal) : '';
  const proposalSections = proposalBody ? parseProposalSections(proposalBody) : {};

  // sequential atomic generator calls if opencodeUrl is available
  const opencodeUrl = process.env.OPENCODE_URL;
  let atomicSections: { steps: string; testingPlan: string; rollback: string; riskAssessment: string } | null = null;
  if (opencodeUrl && proposalBody) {
    let planModel: string | undefined;
    try {
      const ocJson = path.join(REPO_ROOT, 'opencode.json');
      if (fs.existsSync(ocJson)) {
        planModel = JSON.parse(fs.readFileSync(ocJson, 'utf-8')).model;
      }
    } catch (_e) { /* use server default */ }

    atomicSections = await generatePlanSections(proposalBody, opencodeUrl, REPO_ROOT, planModel);
  }

  let stepsBody = '';
  if (atomicSections) {
    stepsBody = atomicSections.steps;
  } else if (proposalSections['implementation steps']) {
    stepsBody = proposalSections['implementation steps'];
  } else if (proposalSections['proposed solution']) {
    const items: string[] = [];
    for (const line of proposalSections['proposed solution'].split('\n')) {
      const li = line.match(/^\s*\d+\.\s+(.+)/);
      if (li) items.push(li[1].trim());
    }
    if (items.length > 0) {
      stepsBody = items.map((item, i) => `| ${i + 1} | ${item} | | ⏳ Pending |`).join('\n');
    }
  } else if (proposalSections['proposed approach']) {
    const items: string[] = [];
    for (const line of proposalSections['proposed approach'].split('\n')) {
      const li = line.match(/^\s*\d+\.\s+(.+)/);
      if (li) items.push(li[1].trim());
    }
    if (items.length > 0) {
      stepsBody = items.map((item, i) => `| ${i + 1} | ${item} | | ⏳ Pending |`).join('\n');
    }
  }
  if (!stepsBody) {
    stepsBody = '| Step | Action | Details | Status |\n|------|--------|---------|--------|\n| 1 | | | ⏳ Pending |';
  }

  const testingBody = atomicSections?.testingPlan
    ?? (proposalSections['testing plan'] || proposalSections['testing'] || '_Testing plan TBD_');
  const rollbackBody = atomicSections?.rollback
    ?? (proposalSections['rollback procedures'] || proposalSections['rollback'] || '_Rollback procedures TBD_');
  const riskBody = atomicSections?.riskAssessment
    ?? (proposalSections['risk assessment'] || proposalSections['risks'] || '_Risk assessment TBD_');

  const cleanTitle = title.replace(/^Plan:\s*/i, '');
  const overviewBody = validCandidates.length > 1
    ? `This plan bundles: ${validCandidates.map(c => `[[${c.replace(/\.md$/, '')}]]`).join(', ')}`
    : (proposalSections['summary'] || '');

  const planContent = assemblePlan({
    title: cleanTitle,
    author: proposalFm.author || 'NetYeti',
    created: now,
    tags: Array.isArray(proposalFm.tags) ? proposalFm.tags : (proposalFm.tags ? [proposalFm.tags] : ['planning']),
    priority: proposalFm.priority || 'medium',
    proposalSource: resolvedProposal || sourceProposal,
    assigned: proposalFm.assigned_to || 'NetYeti',
    summary: overviewBody,
    steps: stepsBody,
    testingPlan: testingBody,
    rollback: rollbackBody,
    riskAssessment: riskBody,
    phase: currentPhase || undefined,
    related_to: validCandidates.filter(c => c !== sourceProposal),
  });

  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, planContent, 'utf-8');

  // Sync test criteria into the plan — always ensures the Testing Plan section exists
  {
    const planRaw = fs.readFileSync(resolved, 'utf-8');
    const synced = syncTestCriteria(planRaw, cleanTitle);
    fs.writeFileSync(resolved, synced, 'utf-8');
  }

  // Set consumed_by on each valid candidate (skip already-planned)
  for (const cand of validCandidates) {
    const candResolved = findProposalPath(cand);
    if (!candResolved) continue;
    const candResolvedFull = path.join(REPO_ROOT, candResolved);
    const raw = fs.readFileSync(candResolvedFull, 'utf-8');
    const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
    if (!match) continue;
    let fm = match[1];
    const body = match[2] || '';
    if (fm.includes('consumed_by:')) {
      fm = fm.replace(/^consumed_by:.*$/m, `consumed_by: ${planPath}`);
    } else {
      fm += `\nconsumed_by: ${planPath}`;
    }
    fs.writeFileSync(candResolvedFull, `---\n${fm}\n---\n${body}`);
  }

  return json({
    ok: true,
    path: planPath,
    bundled: validCandidates,
    skipped: alreadyPlanned,
  });
}
