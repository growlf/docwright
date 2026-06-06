import fs from 'node:fs';
import path from 'node:path';
import { json } from '@sveltejs/kit';
import { getGateDefinition, retroactiveAudit } from '../../../../../dispatch/gates';

const REPO_ROOT = process.env.DOCWRIGHT_ROOT
  ? path.resolve(process.env.DOCWRIGHT_ROOT)
  : path.resolve(process.cwd(), '../..');

function readDir(dir: string): Array<{ path: string; fm: Record<string, any> }> {
  const results: Array<{ path: string; fm: Record<string, any> }> = [];
  if (!fs.existsSync(dir)) return results;
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith('.md')) continue;
    const full = path.join(dir, name);
    try {
      const raw = fs.readFileSync(full, 'utf-8');
      const match = raw.match(/^---\n([\s\S]*?)\n---/);
      const fm: Record<string, any> = {};
      if (match) {
        for (const line of match[1].split('\n')) {
          const ci = line.indexOf(':');
          if (ci <= 0) continue;
          const key = line.slice(0, ci).trim();
          let val: any = line.slice(ci + 1).trim();
          if (val.startsWith('[') && val.endsWith(']')) {
            val = val.slice(1, -1).split(',').map((s: string) => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
          } else if (val === 'true') 'true';
          else if (val === 'false') val = false;
          else if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
          fm[key] = val;
        }
      }
      results.push({ path: path.relative(REPO_ROOT, full), fm });
    } catch { /* skip */ }
  }
  return results;
}

export async function GET({ url }) {
  const profilePath = path.join(REPO_ROOT, 'src', 'profiles', 'org-operations', 'profile.json');
  if (!fs.existsSync(profilePath)) return json({ error: 'profile not found' }, { status: 500 });

  const profile = JSON.parse(fs.readFileSync(profilePath, 'utf-8'));
  const gates = getGateDefinition(profile);
  if (gates.length === 0) return json({ findings: [], fixes: [] });

  const fix = url.searchParams.get('fix') === 'true';

  const docs = [
    ...readDir(path.join(REPO_ROOT, 'plans')),
    ...readDir(path.join(REPO_ROOT, 'plans', 'completed')),
    ...readDir(path.join(REPO_ROOT, 'proposals', 'approved')),
    ...readDir(path.join(REPO_ROOT, 'proposals')),
  ];

  const result = retroactiveAudit(gates, docs, fix);

  // If --fix, apply the changes to files
  if (fix && result.fixes.length > 0) {
    for (const f of result.fixes) {
      const resolved = path.join(REPO_ROOT, f.path);
      if (!fs.existsSync(resolved)) continue;
      const raw = fs.readFileSync(resolved, 'utf-8');
      const match = raw.match(/^---\n([\s\S]*?)\n---(\n?[\s\S]*)$/);
      if (!match) continue;

      // Rebuild frontmatter from fixed object
      const newFm = Object.entries(f.frontmatter)
        .filter(([k]) => !k.startsWith('_'))
        .map(([k, v]) => {
          if (Array.isArray(v)) return `${k}:\n${v.map((i: string) => `  - ${i}`).join('\n')}`;
          if (typeof v === 'boolean') return `${k}: ${v}`;
          return `${k}: ${v}`;
        })
        .join('\n');

      const body = match[2] || '';
      fs.writeFileSync(resolved, `---\n${newFm}\n---${body}`, 'utf-8');
    }
  }

  return json({
    findings: result.findings,
    fixed_count: fix ? result.fixes.length : 0,
  });
}
