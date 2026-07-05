import fs from 'node:fs';
import path from 'node:path';
import { json } from '@sveltejs/kit';
import { load as yamlLoad } from 'js-yaml';
import { parseFrontmatter } from '../../../../../dispatch/frontmatter';

const REPO_ROOT = (() => {
  if (process.env.DOCWRIGHT_ROOT) return process.env.DOCWRIGHT_ROOT;
  return path.resolve(process.cwd(), '../..');
})();

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

  // Collect all file.inFolder() paths declared in top-level filters (recursive).
  function extractInFolderPaths(node: any): string[] {
    if (!node) return [];
    if (typeof node === 'string') {
      const m = node.match(/file\.inFolder\("([^"]+)"\)/);
      return m ? [m[1]] : [];
    }
    if (typeof node === 'object') {
      return [...(node.and ?? []), ...(node.or ?? [])].flatMap(extractInFolderPaths);
    }
    return [];
  }
  const folderPaths = [...new Set(extractInFolderPaths(config.filters))];

  // Read .md files: from declared inFolder paths (cross-folder base), or same
  // directory as the .base file (legacy single-folder base).
  const scanFolders = folderPaths.length > 0
    ? folderPaths
        .map(fp => path.resolve(REPO_ROOT, fp))
        .filter(abs => abs.startsWith(REPO_ROOT) && fs.existsSync(abs))
    : [path.dirname(resolved)];

  const notes: any[] = [];
  for (const scanDir of scanFolders) {
    try {
      for (const name of fs.readdirSync(scanDir)) {
        if (!name.endsWith('.md')) continue;
        const notePath = path.join(scanDir, name);
        const content = fs.readFileSync(notePath, 'utf-8');
        const fm = parseFrontmatter(content);
        const relPath = path.relative(REPO_ROOT, notePath).replace(/\\/g, '/');
        notes.push({ path: relPath, filename: name.replace(/\.md$/, ''), frontmatter: fm });
      }
    } catch { /* ignore unreadable entries */ }
  }

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
