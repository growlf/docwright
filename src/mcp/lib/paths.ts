import * as fs from 'node:fs';
import * as path from 'node:path';

// Store REPO_ROOT for all I/O
let REPO_ROOT = '';

export function setRepoRoot(root: string) {
  REPO_ROOT = root;
}

export function getRepoRoot() {
  return REPO_ROOT;
}

/**
 * Resolve a caller-supplied relative path against REPO_ROOT and assert it stays
 * INSIDE the vault. Returns the absolute path, or throws `Access denied`.
 *
 * Containment is checked with `path.relative` — NOT `startsWith` — because a
 * prefix check admits sibling directories that share the root's name
 * (e.g. root `/x/DocWright` would admit `/x/DocWright-evil/...`). A path is
 * contained iff its path relative to the root does not climb out (`..`) and is
 * not absolute (the latter guards the Windows different-drive case). The empty
 * relative path (the root itself) is contained.
 */
function resolveSafe(relPath: string): string {
  if (!REPO_ROOT) throw new Error('REPO_ROOT not set');
  const root = path.resolve(REPO_ROOT);
  const fullPath = path.resolve(root, relPath);
  const rel = path.relative(root, fullPath);
  if (rel === '..' || rel.startsWith('..' + path.sep) || path.isAbsolute(rel)) {
    throw new Error(`Access denied: ${relPath}`);
  }
  return fullPath;
}

export function readFile(relPath: string): string {
  const fullPath = resolveSafe(relPath);
  return fs.readFileSync(fullPath, 'utf8');
}

export function writeFile(relPath: string, content: string): void {
  const fullPath = resolveSafe(relPath);

  // ensure dir exists
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  fs.writeFileSync(fullPath, content, 'utf8');
}

export function fileExists(relPath: string): boolean {
  const fullPath = resolveSafe(relPath);
  return fs.existsSync(fullPath);
}

export function getMtime(relPath: string): number {
  const fullPath = resolveSafe(relPath);
  return fs.statSync(fullPath).mtimeMs / 1000;
}

export function globFiles(relDir: string, pattern: string = '*.md'): string[] {
  const fullDir = resolveSafe(relDir);
  if (!fs.existsSync(fullDir)) return [];

  const regex = new RegExp('^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$');
  return fs.readdirSync(fullDir)
    .filter(f => regex.test(f))
    .map(f => path.join(relDir, f));
}

export function moveFile(relSrc: string, relDest: string): void {
  const srcFull = resolveSafe(relSrc);
  const destFull = resolveSafe(relDest);

  // Need to ensure dest dir exists
  const destDir = path.dirname(destFull);
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

  // Update _path frontmatter if moving .md
  let content = fs.readFileSync(srcFull, 'utf8');
  if (content.includes('_path:')) {
    content = content.replace(/^_path:\s*.*$/m, `_path: ${relDest}`);
    fs.writeFileSync(srcFull, content, 'utf8');
  }

  // use fs.renameSync
  fs.renameSync(srcFull, destFull);
}
