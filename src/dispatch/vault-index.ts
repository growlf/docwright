import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseFrontmatter } from './frontmatter';

export interface VaultEntry {
  path: string;
  fm: Record<string, any>;
  mtime: number;
}

export type VaultIndex = Record<string, VaultEntry>;

const INDEX_FILE = '.docwright/index.json';

const SCAN_DIRS = [
  'proposals', 'proposals/approved',
  'plans', 'plans/completed',
  'docs', 'docs/SOPs',
  'policies', 'policies/core',
];

export { parseFrontmatter } from './frontmatter';

export function buildIndex(vaultRoot: string): VaultIndex {
  const index: VaultIndex = {};
  for (const dir of SCAN_DIRS) {
    const full = path.join(vaultRoot, dir);
    if (!fs.existsSync(full)) continue;
    for (const name of fs.readdirSync(full)) {
      if (!name.endsWith('.md')) continue;
      const abs = path.join(full, name);
      const rel = path.relative(vaultRoot, abs).replace(/\\/g, '/');
      try {
        const stat = fs.statSync(abs);
        const raw  = fs.readFileSync(abs, 'utf-8');
        index[rel] = { path: rel, fm: parseFrontmatter(raw), mtime: stat.mtimeMs };
      } catch { /* skip unreadable */ }
    }
  }
  return index;
}

export function readIndex(vaultRoot: string): VaultIndex {
  try {
    return JSON.parse(fs.readFileSync(path.join(vaultRoot, INDEX_FILE), 'utf-8'));
  } catch { return buildIndex(vaultRoot); }
}

export function writeIndex(vaultRoot: string, index: VaultIndex): void {
  const p = path.join(vaultRoot, INDEX_FILE);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(index, null, 2));
}

export function rebuildIfStale(vaultRoot: string): VaultIndex {
  const existing = readIndex(vaultRoot);

  // Check for changed or deleted files
  for (const [rel, entry] of Object.entries(existing)) {
    try {
      const stat = fs.statSync(path.join(vaultRoot, rel));
      if (stat.mtimeMs > entry.mtime) {
        const fresh = buildIndex(vaultRoot);
        writeIndex(vaultRoot, fresh);
        return fresh;
      }
    } catch {
      const fresh = buildIndex(vaultRoot);
      writeIndex(vaultRoot, fresh);
      return fresh;
    }
  }

  // Check for new files (quick count check)
  const fresh = buildIndex(vaultRoot);
  if (Object.keys(fresh).length !== Object.keys(existing).length) {
    writeIndex(vaultRoot, fresh);
    return fresh;
  }
  return existing;
}
