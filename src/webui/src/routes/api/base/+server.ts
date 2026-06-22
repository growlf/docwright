import fs from 'node:fs';
import path from 'node:path';
import { json } from '@sveltejs/kit';
import { load as yamlLoad } from 'js-yaml';

const REPO_ROOT = (() => {
  if (process.env.DOCWRIGHT_ROOT) return process.env.DOCWRIGHT_ROOT;
  return path.resolve(process.cwd(), '../..');
})();

// Simple flat frontmatter parser — handles the key:value and array blocks
// that appear in device notes (mirrors the logic in [...path]/+page.svelte).
function parseFrontmatter(raw: string): Record<string, any> {
  const match = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const result: Record<string, any> = {};
  const lines = match[1].split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim() || line.trim().startsWith('#')) { i++; continue; }
    const colon = line.indexOf(':');
    if (colon <= 0) { i++; continue; }
    const key = line.slice(0, colon).trim();
    const rest = line.slice(colon + 1).trim();
    if (rest === '' || rest === '[]') {
      i++;
      if (rest === '[]') { result[key] = []; continue; }
      if (i < lines.length && /^\s+-\s/.test(lines[i])) {
        const arr: string[] = [];
        while (i < lines.length && /^\s+-\s/.test(lines[i])) {
          arr.push(lines[i].replace(/^\s+-\s*/, '').trim()); i++;
        }
        result[key] = arr;
      } else {
        result[key] = '';
      }
      continue;
    }
    let val: any = rest;
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    else if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
    else if (val === 'true') val = true;
    else if (val === 'false') val = false;
    else if (val === 'null' || val === '~') val = null;
    else { const n = Number(val); if (!isNaN(n) && val !== '') val = n; }
    result[key] = val;
    i++;
  }
  return result;
}

export function GET({ url }) {
  const filePath = url.searchParams.get('path');
  if (!filePath) return json({ error: 'missing path' }, { status: 400 });

  const resolved = path.resolve(REPO_ROOT, filePath);
  if (!resolved.startsWith(REPO_ROOT)) return json({ error: 'invalid path' }, { status: 403 });
  if (!fs.existsSync(resolved)) return json({ error: 'not found' }, { status: 404 });

  // Parse the .base file as YAML using js-yaml v4
  const baseContent = fs.readFileSync(resolved, 'utf-8');
  let config: any = {};
  try {
    config = yamlLoad(baseContent) ?? {};
  } catch {
    return json({ error: 'failed to parse .base file' }, { status: 500 });
  }

  // Read all .md files in the same folder and extract frontmatter
  const folder = path.dirname(resolved);
  const notes: any[] = [];
  try {
    for (const name of fs.readdirSync(folder)) {
      if (!name.endsWith('.md')) continue;
      const notePath = path.join(folder, name);
      const content = fs.readFileSync(notePath, 'utf-8');
      const fm = parseFrontmatter(content);
      const relPath = path.relative(REPO_ROOT, notePath).replace(/\\/g, '/');
      notes.push({ path: relPath, filename: name.replace(/\.md$/, ''), frontmatter: fm });
    }
  } catch { /* ignore unreadable entries */ }

  // Default sort by IP, then filename
  notes.sort((a, b) => {
    const ipNum = (ip: string) => (ip || '').split('.').reduce(
      (acc: number, oct: string) => acc * 256 + (parseInt(oct) || 0), 0
    );
    const diff = ipNum(a.frontmatter.ip) - ipNum(b.frontmatter.ip);
    return diff !== 0 ? diff : a.filename.localeCompare(b.filename);
  });

  return json({ views: config.views ?? [], docwright: config.docwright ?? null, notes });
}
