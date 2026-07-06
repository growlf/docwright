import fs from 'node:fs';
import path from 'node:path';
import { json } from '@sveltejs/kit';
import { parseFrontmatter } from '../../../../../dispatch/frontmatter';
import { moveDocument, setDocumentField } from '../../../../../dispatch/vault-write';
import { buildIndex } from '../../../../../policy-atoms-core/index-builder';
import { route } from '../../../../../policy-atoms-core/router';
import { resolve } from '../../../../../policy-atoms-core/resolver';
import { parseAtomYaml } from '../../../../../policy-atoms-core/parse-yaml';
import { generatePlanSections, assemblePlan } from './plan-generator';
import { requireAuth } from '$lib/server/auth.js';
import { commitPaths } from '$lib/server/git-commit.js';

const REPO_ROOT = process.env.DOCWRIGHT_ROOT
  ? path.resolve(process.env.DOCWRIGHT_ROOT)
  : path.resolve(process.cwd(), '../..');

const POLICIES_DIR = path.join(REPO_ROOT, 'policies');

// Cache the synopsis index — rebuilt once per server process
let _indexCache: ReturnType<typeof buildIndex>['index'] | null = null;
function getIndex() {
  if (!_indexCache) _indexCache = buildIndex({ policiesDir: POLICIES_DIR }).index;
  return _indexCache;
}

const AUDIT_LOG = path.join(REPO_ROOT, '.docwright', 'audit.jsonl');

function logAudit(action: string, detail: string) {
  const dir = path.dirname(AUDIT_LOG);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const entry = JSON.stringify({
    ts: new Date().toISOString(),
    event: action,
    detail,
    host: '',
  });
  fs.appendFileSync(AUDIT_LOG, entry + '\n');
}

export const POST = requireAuth(async ({ request, locals }) => {
  const { path: filePath } = await request.json();
  if (!filePath) return json({ error: 'missing path' }, { status: 400 });

  // Normalize — strip proposals/ prefix if present, ensure .md
  const norm = filePath
    .replace(/^proposals\//, '')
    .replace(/\.md$/, '') + '.md';

  const src = path.resolve(REPO_ROOT, 'proposals', norm);
  if (!src.startsWith(REPO_ROOT)) return json({ error: 'invalid path' }, { status: 403 });
  if (!fs.existsSync(src)) return json({ error: 'proposal not found' }, { status: 404 });

  const raw = fs.readFileSync(src, 'utf-8');
  const fm = parseFrontmatter(raw);

  if (fm.approved !== true) {
    return json({ error: 'proposal must have approved: true' }, { status: 400 });
  }

  const assigned = Array.isArray(fm.assigned_to)
    ? fm.assigned_to.filter(Boolean).join(', ')
    : String(fm.assigned_to || '').trim();

  if (!assigned) {
    return json({ error: 'proposal must have non-empty assigned_to' }, { status: 400 });
  }

  // Check whether proposal already has a plan (#115, #141).
  // If consumed_by points to a missing plan, clear the stale pointer and proceed (self-heal).
  // If consumed_by points to an existing plan, reject duplicate creation.
  if (fm.consumed_by) {
    const consumedPath = path.resolve(REPO_ROOT, fm.consumed_by);
    if (fs.existsSync(consumedPath)) {
      return json({
        ok: true,
        alreadyExists: true,
        planPath: fm.consumed_by,
      });
    }
    // Stale pointer: the plan doesn't exist. Clear it with an audit note and proceed.
    logAudit('STALE_CONSUMED_BY_CLEARED', `proposals/${norm}: consumed_by=${fm.consumed_by} (plan missing) — clearing and proceeding with approval`);
    fm.consumed_by = '';
  }

  // Also check the create-plan slug path for cross-path collisions (#115)
  const createPlanSlug = `plans/plan-${norm}`;
  const createPlanResolved = path.resolve(REPO_ROOT, createPlanSlug);
  if (fs.existsSync(createPlanResolved) && createPlanResolved.startsWith(REPO_ROOT)) {
    return json({
      ok: true,
      alreadyExists: true,
      planPath: createPlanSlug,
    });
  }

  // --- Atom validation at approval time ---
  // Run deterministic atoms scoped to 'proposal.approving' before committing the approval.
  // This is a non-blocking best-effort check — if the policies dir doesn't exist or the
  // atom engine throws, we log and continue (the existing field checks above are the hard gate).
  try {
    const index = getIndex();
    const { atomIds } = route(index, 'proposal.approving', { kind: 'deterministic' });
    if (atomIds.length > 0) {
      const fmForAtom: Record<string, unknown> = {};
      const fmMatch2 = raw.match(/^---\n([\s\S]*?)\n---/);
      if (fmMatch2) Object.assign(fmForAtom, parseAtomYaml(fmMatch2[1]));
      const { atoms } = await resolve(atomIds, { policiesDir: POLICIES_DIR });
      for (const atom of atoms) {
        if (!atom.check) continue;
        const result = await atom.check({
          filePath: `proposals/${norm}`,
          frontmatter: fmForAtom,
          content: raw,
          vaultRoot: REPO_ROOT,
        });
        if (!result.pass) {
          return json({
            error: `Atom validation failed [${atom.frontmatter.id}]: ${result.message}`,
            atom_id: atom.frontmatter.id,
          }, { status: 422 });
        }
      }
    }
  } catch (atomErr) {
    // Atom engine failure is non-fatal — log and continue
    logAudit('ATOM_CHECK_ERROR', `approve-proposal atom check failed: ${atomErr}`);
  }
  // --- End atom validation ---

  const title = fm.title || norm.replace('.md', '');
  const author = fm.author || 'NetYeti';
  const tagList = Array.isArray(fm.tags) ? fm.tags : (fm.tags ? [String(fm.tags)] : []);
  const priority = fm.priority || 'medium';
  const now = new Date().toISOString().slice(0, 10);
  const planSlug = norm;
  const planRel = `plans/${planSlug}`;
  const approvedRel = `proposals/approved/${norm}`;

  // Build plan content from proposal body sections
  function parseSections(body: string): { name: string; content: string }[] {
    const sections: { name: string; content: string }[] = [];
    const lines = body.split('\n');
    let currentName = 'Overview';
    let currentLines: string[] = [];
    for (const line of lines) {
      const m = line.match(/^##\s+(.+)/);
      if (m) {
        if (currentLines.length > 0 || sections.length === 0) {
          sections.push({ name: currentName, content: currentLines.join('\n').trim() });
        }
        currentName = m[1].trim();
        currentLines = [];
      } else {
        currentLines.push(line);
      }
    }
    if (currentLines.length > 0 || sections.length === 0) {
      sections.push({ name: currentName, content: currentLines.join('\n').trim() });
    }
    return sections;
  }

  const bodyMatch = raw.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
  const proposalBody = bodyMatch ? bodyMatch[1].trim() : '';
  const proposalSections = parseSections(proposalBody);

  const KNOWN = ['testing plan', 'risk assessment', 'rollback procedures', 'implementation steps', 'proposed solution', 'proposed approach'];
  const mapped: Record<string, { name: string; content: string }> = {};
  for (const s of proposalSections) {
    if (KNOWN.includes(s.name.toLowerCase())) mapped[s.name.toLowerCase()] = s;
  }
  // Overview is a brief summary + link to the proposal — NOT a dump of the proposal body
  // (see #108). We surface only the proposal's own Summary section, if it has one.
  const summary = proposalSections.find(s => s.name.toLowerCase() === 'summary')?.content ?? '';

  // --- Atomic plan generation (Step 0 of AI Task Category Taxonomy plan) ---
  // Try generating plan sections via sequential OpenCode calls (classification +
  // generation + reasoning). Falls back to the template parser below on failure.
  const opencodeUrl = process.env.OPENCODE_URL;
  let atomicSections: { steps: string; testingPlan: string; rollback: string; riskAssessment: string } | null = null;
  if (opencodeUrl) {
    // Read the configured model from opencode.json so routing is respected
    let planModel: string | undefined;
    try {
      const ocJson = path.join(REPO_ROOT, 'opencode.json');
      if (fs.existsSync(ocJson)) {
        planModel = JSON.parse(fs.readFileSync(ocJson, 'utf-8')).model;
      }
    } catch (_e) { /* use server default */ }

    atomicSections = await generatePlanSections(proposalBody, opencodeUrl, REPO_ROOT, planModel);
  }
  // --- End atomic generation ---

  // Template fallback (used when atomic generation is unavailable or fails)
  let stepsBody = '';
  if (atomicSections) {
    stepsBody = atomicSections.steps;
  } else if (mapped['implementation steps']) {
    stepsBody = mapped['implementation steps'].content;
  } else if (mapped['proposed solution']) {
    const items: string[] = [];
    for (const line of mapped['proposed solution'].content.split('\n')) {
      const li = line.match(/^\s*\d+\.\s+(.+)/);
      if (li) items.push(li[1].trim());
    }
    if (items.length > 0) {
      stepsBody = items.map((item, i) => `| ${i + 1} | ${item} | | ⏳ Pending |`).join('\n');
    }
  } else if (mapped['proposed approach']) {
    const items: string[] = [];
    for (const line of mapped['proposed approach'].content.split('\n')) {
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
    ?? (mapped['testing plan'] ? mapped['testing plan'].content : '_Testing plan TBD_');
  const rollbackBody = atomicSections?.rollback
    ?? (mapped['rollback procedures'] ? mapped['rollback procedures'].content : '_Rollback procedures TBD_');
  const riskBody = atomicSections?.riskAssessment
    ?? (mapped['risk assessment'] ? mapped['risk assessment'].content : '_Risk assessment TBD_');

  const planContent = assemblePlan({
    title, author, created: now, tags: tagList, priority,
    proposalSource: approvedRel, planPath: planRel, assigned, summary,
    steps: stepsBody, testingPlan: testingBody, rollback: rollbackBody, riskAssessment: riskBody,
  });
  const planPath = path.join(REPO_ROOT, planRel);
  if (!fs.existsSync(path.dirname(planPath))) fs.mkdirSync(path.dirname(planPath), { recursive: true });
  fs.writeFileSync(planPath, planContent, 'utf-8');

  // tests_defined stays false — it's a completion gate input, set only by the explicit
  // run-tests flow / toggle, never auto-promoted here (#108, mirrors the /api/write fix #86).

  // Move proposal to proposals/approved/ using canonical vault-write API.
  // This updates _path:, cascades wikilinks, and updates cross-refs atomically.
  moveDocument(REPO_ROOT, `proposals/${norm}`, approvedRel);

  // Set consumed_by to link back to the newly created plan
  setDocumentField(REPO_ROOT, approvedRel, 'consumed_by', planRel);

  logAudit('APPROVED', `proposal/${norm} → proposals/approved/ + plan created`);

  // Persist the lifecycle action so it isn't left as a silent, uncommitted change (#110).
  // The authenticated click is the seal: commit locally, authored as the user, with
  // HUMAN_APPROVED. Never pushes — that stays a separate, explicit action. Non-fatal:
  // the files are already written, so a commit failure is surfaced, not thrown.
  const slug = norm.replace(/\.md$/, '');
  const commit = commitPaths(REPO_ROOT, {
    message: `docs: approve ${slug} (proposal → plan)\n\nHUMAN-APPROVED:${slug}`,
    stagePaths: [`proposals/${norm}`, approvedRel, planRel],
    user: locals.user,
  });

  return json({
    ok: true,
    approvedPath: approvedRel,
    planPath: planRel,
    committed: commit.ok ? commit.sha : null,
    commitError: commit.ok ? null : commit.error,
  });
});
