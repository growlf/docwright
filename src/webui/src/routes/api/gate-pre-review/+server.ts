import fs from 'node:fs';
import path from 'node:path';
import { json } from '@sveltejs/kit';
import { getGateDefinition, getScheduleGatesForDocument, getGatesForTransition } from '../../../../../dispatch/gates';
import { getAIEngine } from '../../../../../dispatch/ai';
import { parseFrontmatter, getFrontmatterTitle, stripFrontmatter } from '../../../../../dispatch/frontmatter';

const REPO_ROOT = process.env.DOCWRIGHT_ROOT
  ? path.resolve(process.env.DOCWRIGHT_ROOT)
  : path.resolve(process.cwd(), '../..');

function readFrontmatter(filePath: string): Record<string, any> | null {
  if (!fs.existsSync(filePath)) return null;
  return parseFrontmatter(fs.readFileSync(filePath, 'utf-8'));
}

export async function GET({ url }) {
  const docPath = url.searchParams.get('doc_path');
  const gateId = url.searchParams.get('gate_id');

  if (!docPath || !gateId) {
    return json({ error: 'doc_path and gate_id required' }, { status: 400 });
  }

  const resolved = path.join(REPO_ROOT, docPath);
  if (!resolved.startsWith(REPO_ROOT)) return json({ error: 'invalid path' }, { status: 403 });
  if (!fs.existsSync(resolved)) return json({ error: 'doc not found' }, { status: 404 });

  // Read profile gates
  const profilePath = path.join(REPO_ROOT, 'src', 'profiles', 'org-operations', 'profile.json');
  if (!fs.existsSync(profilePath)) return json({ error: 'profile not found' }, { status: 500 });

  const profile = JSON.parse(fs.readFileSync(profilePath, 'utf-8'));
  const gates = getGateDefinition(profile);
  const gate = gates.find((g: any) => g.id === gateId);
  if (!gate) return json({ error: `gate "${gateId}" not found` }, { status: 404 });

  // Read the document
  const raw = fs.readFileSync(resolved, 'utf-8');
  const fm = readFrontmatter(resolved) ?? {};
  const docBody = stripFrontmatter(raw);
  const title = fm.title || path.basename(docPath, '.md');

  // Collect scope documents (related docs, dependencies)
  const relatedPaths: string[] = [];
  for (const field of ['related_to', 'depends_on', 'blocks']) {
    const links = Array.isArray(fm[field]) ? fm[field] : fm[field] ? [fm[field]] : [];
    for (const link of links) {
      if (link && !relatedPaths.includes(link)) relatedPaths.push(link);
    }
  }

  const scopeDocs: Array<{ path: string; title: string; excerpt: string }> = [];
  for (const rel of relatedPaths.slice(0, 5)) {
    const relResolved = path.join(REPO_ROOT, rel.endsWith('.md') ? rel : rel + '.md');
    if (fs.existsSync(relResolved)) {
      const relRaw = fs.readFileSync(relResolved, 'utf-8');
      scopeDocs.push({
        path: rel,
        title: getFrontmatterTitle(relRaw) || path.basename(rel, '.md'),
        excerpt: stripFrontmatter(relRaw).slice(0, 600),
      });
    }
  }

  // Run AI pre-review
  const engine = getAIEngine(REPO_ROOT);
  const result = await engine.gatePreReview(
    gate.id,
    gate.description || '',
    title,
    docBody,
    scopeDocs,
    gate.ai_pre_review_prompt,
  );

  return json({
    doc_path: docPath,
    gate_id: gateId,
    result,
  });
}
