import fs from 'node:fs';
import path from 'node:path';
import { json } from '@sveltejs/kit';
import { setDocumentField } from '../../../../../../dispatch/vault-write';

const REPO_ROOT = process.env.DOCWRIGHT_ROOT
  ? path.resolve(process.env.DOCWRIGHT_ROOT)
  : path.resolve(process.cwd(), '../..');

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

function readDir(dir: string): Array<{ path: string; fm: Record<string, any> }> {
  const results: Array<{ path: string; fm: Record<string, any> }> = [];
  if (!fs.existsSync(dir)) return results;
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith('.md') || name === 'README.md') continue;
    const full = path.join(dir, name);
    try {
      const raw = fs.readFileSync(full, 'utf-8');
      results.push({ path: path.relative(REPO_ROOT, full), fm: parseFm(raw) });
    } catch { /* skip */ }
  }
  return results;
}

export async function POST({ request }) {
  const { milestone, channel } = await request.json();
  if (!milestone || !channel) {
    return json({ error: 'missing milestone or channel' }, { status: 400 });
  }

  if (!['dev', 'beta', 'stable'].includes(channel)) {
    return json({ error: 'invalid channel value' }, { status: 400 });
  }

  // Find the plans for the milestone
  const plans = [
    ...readDir(path.join(REPO_ROOT, 'plans')),
    ...readDir(path.join(REPO_ROOT, 'plans/completed')),
  ];

  const milestonePlans = plans.filter(p => {
    const m = String(p.fm.milestone ?? '').trim();
    return m.toLowerCase() === milestone.toLowerCase();
  });

  if (milestonePlans.length === 0) {
    return json({ error: `no plans found for milestone '${milestone}'` }, { status: 404 });
  }

  // Update channel on all plans for this milestone
  for (const p of milestonePlans) {
    setDocumentField(REPO_ROOT, p.path, 'channel', channel, 'human');
  }

  return json({ ok: true });
}
