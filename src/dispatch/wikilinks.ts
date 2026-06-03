import * as fs from 'node:fs';
import * as path from 'node:path';
import { VaultIndex } from './vault-index';

const WIKILINK_RE = /\[\[([^\]]+)\]\]/g;

function parseLink(raw: string): { stem: string; anchor: string; alias: string } {
  const withoutBrackets = raw.replace(/^\[\[|\]\]$/g, '');
  const [pathPart, ...aliasParts] = withoutBrackets.split('|');
  const [stemPart, anchor = ''] = pathPart.split('#');
  return { stem: stemPart.trim(), anchor, alias: aliasParts.join('|') };
}

export function resolveWikilink(
  link: string,
  _fromPath: string,
  index: VaultIndex,
): string | null {
  const { stem } = parseLink(link);
  const candidate = stem.endsWith('.md') ? stem : stem + '.md';

  // Exact match
  if (index[candidate]) return candidate;

  // Search by basename across all index entries
  const baseName = path.basename(candidate);
  for (const key of Object.keys(index)) {
    if (path.basename(key) === baseName) return key;
  }
  return null;
}

export function findBacklinks(targetPath: string, vaultRoot: string, index: VaultIndex): string[] {
  const targetStem = path.basename(targetPath, '.md');
  const results: string[] = [];

  for (const rel of Object.keys(index)) {
    if (rel === targetPath) continue;
    try {
      const raw = fs.readFileSync(path.join(vaultRoot, rel), 'utf-8');
      let m: RegExpExecArray | null;
      WIKILINK_RE.lastIndex = 0;
      while ((m = WIKILINK_RE.exec(raw)) !== null) {
        const { stem } = parseLink(m[0]);
        if (stem === targetStem || stem === targetPath || stem === targetPath.replace(/\.md$/, '')) {
          results.push(rel);
          break;
        }
      }
    } catch { /* skip */ }
  }
  return results;
}

export function updateWikilinks(
  vaultRoot: string,
  oldPath: string,
  newPath: string,
  index: VaultIndex,
): string[] {
  const oldStem = path.basename(oldPath, '.md');
  const newStem = path.basename(newPath, '.md');
  const updated: string[] = [];

  for (const rel of Object.keys(index)) {
    if (rel === oldPath || rel === newPath) continue;
    const abs = path.join(vaultRoot, rel);
    try {
      const raw = fs.readFileSync(abs, 'utf-8');
      const replaced = raw.replace(WIKILINK_RE, (match) => {
        const { stem, anchor, alias } = parseLink(match);
        if (stem !== oldStem) return match;
        const anchorPart = anchor ? `#${anchor}` : '';
        const aliasPart  = alias  ? `|${alias}`  : '';
        return `[[${newStem}${anchorPart}${aliasPart}]]`;
      });
      if (replaced !== raw) {
        fs.writeFileSync(abs, replaced);
        updated.push(rel);
      }
    } catch { /* skip */ }
  }
  return updated;
}
