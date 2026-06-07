/**
 * POST /api/improve — AI proposal improvement + critique.
 *
 * Reads the proposal from disk, runs fillProposal() and critiqueDocument()
 * in parallel via the dispatch AIEngine, and returns the results.
 * Gracefully falls back to KeywordEngine stubs when OPENCODE_URL is unset.
 */
import fs from 'node:fs';
import path from 'node:path';
import { json } from '@sveltejs/kit';
import { getAIEngine, stripFrontmatter } from '../../../../../dispatch/ai';

const REPO_ROOT = process.env.DOCWRIGHT_ROOT
  ? path.resolve(process.env.DOCWRIGHT_ROOT)
  : path.resolve(process.cwd(), '../..');

function parseFrontmatter(raw: string): Record<string, any> {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) return {};
  const fm: Record<string, any> = {};
  const lines = m[1].split('\n');
  for (let i = 0; i < lines.length; i++) {
    const keyEmpty = lines[i].match(/^(\w+):\s*$/);
    if (keyEmpty) {
      const arr: string[] = [];
      while (i + 1 < lines.length && /^\s+-/.test(lines[i + 1])) {
        i++;
        arr.push(lines[i].replace(/^\s+-\s*/, '').trim().replace(/^["']|["']$/g, ''));
      }
      fm[keyEmpty[1]] = arr.length > 0 ? arr : '';
      continue;
    }
    const kv = lines[i].match(/^(\w+):\s*(.+)/);
    if (kv) {
      let val: any = kv[2].trim();
      if (val.startsWith('[') && val.endsWith(']'))
        val = val.slice(1, -1).split(',').map((s: string) => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
      else if (val === 'true') val = true;
      else if (val === 'false') val = false;
      else val = val.replace(/^["']|["']$/g, '');
      fm[kv[1]] = val;
    }
  }
  return fm;
}

export async function POST({ request }) {
  const { path: filePath } = await request.json();
  if (!filePath) return json({ error: 'missing path' }, { status: 400 });

  const resolved = path.resolve(REPO_ROOT, filePath);
  if (!resolved.startsWith(REPO_ROOT)) return json({ error: 'invalid path' }, { status: 403 });
  if (!fs.existsSync(resolved)) return json({ error: 'not found' }, { status: 404 });

  const original = fs.readFileSync(resolved, 'utf-8');
  const fm = parseFrontmatter(original);
  const body = stripFrontmatter(original);

  const engine = getAIEngine(REPO_ROOT);
  const [improved, critique] = await Promise.all([
    engine.fillProposal(fm, body),
    engine.critiqueDocument(original),
  ]);

  return json({ original: body, improved, critique });
}
