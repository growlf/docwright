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

export function readFile(relPath: string): string {
  if (!REPO_ROOT) throw new Error('REPO_ROOT not set');
  const fullPath = path.resolve(REPO_ROOT, relPath);
  if (!fullPath.startsWith(REPO_ROOT)) throw new Error(`Access denied: ${relPath}`);
  return fs.readFileSync(fullPath, 'utf8');
}

export function writeFile(relPath: string, content: string): void {
  if (!REPO_ROOT) throw new Error('REPO_ROOT not set');
  const fullPath = path.resolve(REPO_ROOT, relPath);
  if (!fullPath.startsWith(REPO_ROOT)) throw new Error(`Access denied: ${relPath}`);
  
  // ensure dir exists
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  
  fs.writeFileSync(fullPath, content, 'utf8');
}

export function moveFile(relSrc: string, relDest: string): void {
  if (!REPO_ROOT) throw new Error('REPO_ROOT not set');
  const srcFull = path.resolve(REPO_ROOT, relSrc);
  const destFull = path.resolve(REPO_ROOT, relDest);
  
  if (!srcFull.startsWith(REPO_ROOT)) throw new Error(`Access denied: ${relSrc}`);
  if (!destFull.startsWith(REPO_ROOT)) throw new Error(`Access denied: ${relDest}`);

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
