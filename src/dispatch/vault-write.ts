/**
 * Canonical vault write layer — all document mutations go through here.
 *
 * Three operations:
 *   setDocumentField  — update a single frontmatter field and save
 *   moveDocument      — move file, update _path:, cascade wikilinks + cross-refs
 *   renameDocument    — rename within same directory (calls moveDocument)
 *
 * Every operation appends to .docwright/write-audit.jsonl.
 * moveDocument rolls back on failure — no partial state is left on disk.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { setFrontmatterField, parseFrontmatter } from './frontmatter';
import { buildIndex } from './vault-index';
import type { VaultIndex } from './vault-index';
import { updateWikilinks } from './wikilinks';

const AUDIT_LOG = '.docwright/write-audit.jsonl';

// Frontmatter fields that may reference other document paths
const CROSS_REF_FIELDS = [
  'related_to', 'depends_on', 'blocks', 'absorbs',
  'consumed_by', 'proposal_source', 'subsumed_by',
];

// ── Audit logging ─────────────────────────────────────────────────────────────

interface AuditEntry {
  ts: string;
  op: string;
  actor: string;
  src?: string;
  dest?: string;
  field?: string;
  value?: unknown;
  updated?: string[];
  success: boolean;
  error?: string;
}

function appendAudit(vaultRoot: string, entry: AuditEntry): void {
  const logPath = path.join(vaultRoot, AUDIT_LOG);
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.appendFileSync(logPath, JSON.stringify(entry) + '\n');
}

// ── Cross-reference update ────────────────────────────────────────────────────

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Replace all occurrences of srcPath with destPath in a file's frontmatter.
 * Handles scalar values, inline arrays, and block lists.
 */
function rewriteCrossRefs(raw: string, srcPath: string, destPath: string): string {
  const fmMatch = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) return raw;
  // Match srcPath (with or without .md) in any YAML value position
  const stems = [srcPath, srcPath.replace(/\.md$/, '')];
  let fm = fmMatch[1];
  for (const stem of stems) {
    fm = fm.replace(new RegExp(escapeRegex(stem), 'g'), destPath);
  }
  if (fm === fmMatch[1]) return raw;
  return raw.slice(0, fmMatch.index) +
    `---\n${fm}\n---` +
    raw.slice(fmMatch.index! + fmMatch[0].length);
}

function updateCrossRefs(
  vaultRoot: string,
  srcPath: string,
  destPath: string,
  index: VaultIndex,
): string[] {
  const updated: string[] = [];
  for (const rel of Object.keys(index)) {
    const abs = path.join(vaultRoot, rel);
    try {
      const raw = fs.readFileSync(abs, 'utf-8');
      // Quick pre-check: does this file reference srcPath at all?
      if (!raw.includes(srcPath) && !raw.includes(srcPath.replace(/\.md$/, ''))) continue;
      const fm = parseFrontmatter(raw);
      const hasCrossRef = CROSS_REF_FIELDS.some(f => {
        const v = fm[f];
        if (!v) return false;
        const s = Array.isArray(v) ? v.join(' ') : String(v);
        return s.includes(srcPath) || s.includes(srcPath.replace(/\.md$/, ''));
      });
      if (!hasCrossRef) continue;
      const rewritten = rewriteCrossRefs(raw, srcPath, destPath);
      if (rewritten !== raw) {
        fs.writeFileSync(abs, rewritten);
        updated.push(rel);
      }
    } catch { /* skip */ }
  }
  return updated;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Update a single frontmatter field in a document and save to disk.
 * actor: 'human' | 'ai' — stamps ai-last-action: when actor is 'ai'.
 */
export function setDocumentField(
  vaultRoot: string,
  docPath: string,
  field: string,
  value: unknown,
  actor: 'human' | 'ai' = 'human',
): void {
  const abs = path.resolve(vaultRoot, docPath);
  if (!abs.startsWith(vaultRoot)) throw new Error('path escapes vault');
  let raw = fs.readFileSync(abs, 'utf-8');
  raw = setFrontmatterField(raw, field, value as any);
  if (actor === 'ai') {
    raw = setFrontmatterField(raw, 'ai-last-action', `set:${field}`);
  }
  fs.writeFileSync(abs, raw);
  appendAudit(vaultRoot, {
    ts: new Date().toISOString(), op: 'setField', actor,
    src: docPath, field, value: String(value), success: true,
  });
}

export interface MoveResult {
  updatedWikilinks: string[];
  updatedCrossRefs: string[];
}

/**
 * Move a document from srcPath to destPath within the vault.
 *
 * Steps:
 *   1. Validate paths
 *   2. Snapshot files that will be changed (for rollback)
 *   3. Move file via fs.renameSync (or git mv if in git)
 *   4. Update _path: in moved file
 *   5. Cascade wikilink references in other files
 *   6. Update cross-reference frontmatter fields in other files
 *   7. Append audit log entry
 *
 * On failure after the file has moved, all changes are rolled back.
 */
export function moveDocument(
  vaultRoot: string,
  srcPath: string,
  destPath: string,
  actor = 'human',
): MoveResult {
  const absFrom = path.resolve(vaultRoot, srcPath);
  const absTo   = path.resolve(vaultRoot, destPath);

  if (!absFrom.startsWith(vaultRoot)) throw new Error('srcPath escapes vault');
  if (!absTo.startsWith(vaultRoot))   throw new Error('destPath escapes vault');
  if (!fs.existsSync(absFrom))        throw new Error(`source not found: ${srcPath}`);
  if (fs.existsSync(absTo))           throw new Error(`destination exists: ${destPath}`);

  const index = buildIndex(vaultRoot);
  let fileMoved = false;
  let updatedWikilinks: string[] = [];
  let updatedCrossRefs: string[] = [];

  // Snapshot files that updateWikilinks + updateCrossRefs will touch (for rollback)
  const snapshot = new Map<string, string>();
  const wlAffected = Object.keys(index).filter(rel => {
    if (rel === srcPath) return false;
    try {
      const raw = fs.readFileSync(path.join(vaultRoot, rel), 'utf-8');
      const stem = path.basename(srcPath, '.md');
      return raw.includes(`[[${stem}`) || raw.includes(srcPath);
    } catch { return false; }
  });
  for (const rel of wlAffected) {
    try { snapshot.set(rel, fs.readFileSync(path.join(vaultRoot, rel), 'utf-8')); } catch {}
  }

  function rollback(reason: string): never {
    if (fileMoved) {
      try { fs.renameSync(absTo, absFrom); } catch {}
    }
    for (const [rel, orig] of snapshot) {
      try { fs.writeFileSync(path.join(vaultRoot, rel), orig); } catch {}
    }
    appendAudit(vaultRoot, {
      ts: new Date().toISOString(), op: 'moveDocument', actor,
      src: srcPath, dest: destPath, success: false, error: reason,
    });
    throw new Error(`moveDocument rolled back: ${reason}`);
  }

  try {
    // Step 3: move file
    fs.mkdirSync(path.dirname(absTo), { recursive: true });
    fs.renameSync(absFrom, absTo);
    fileMoved = true;

    // Step 4: update _path: in moved file
    try {
      let moved = fs.readFileSync(absTo, 'utf-8');
      moved = setFrontmatterField(moved, '_path', destPath.replace(/\.md$/, ''));
      fs.writeFileSync(absTo, moved);
    } catch (e: any) {
      rollback(`_path update failed: ${e.message}`);
    }

    // Update index to reflect new location before wikilink + cross-ref scans
    if (index[srcPath]) {
      index[destPath] = { ...index[srcPath], path: destPath };
      delete index[srcPath];
    }

    // Step 5: cascade wikilinks
    try {
      updatedWikilinks = updateWikilinks(vaultRoot, srcPath, destPath, index);
    } catch (e: any) {
      rollback(`wikilink cascade failed: ${e.message}`);
    }

    // Step 6: update cross-ref frontmatter fields
    try {
      updatedCrossRefs = updateCrossRefs(vaultRoot, srcPath, destPath, index);
    } catch (e: any) {
      rollback(`cross-ref update failed: ${e.message}`);
    }
  } catch (e: any) {
    if (!fileMoved) {
      appendAudit(vaultRoot, {
        ts: new Date().toISOString(), op: 'moveDocument', actor,
        src: srcPath, dest: destPath, success: false, error: e.message,
      });
    }
    throw e;
  }

  // Step 7: audit log
  appendAudit(vaultRoot, {
    ts: new Date().toISOString(), op: 'moveDocument', actor,
    src: srcPath, dest: destPath,
    updated: [...updatedWikilinks, ...updatedCrossRefs],
    success: true,
  });

  return { updatedWikilinks, updatedCrossRefs };
}

/**
 * Rename a document within its current directory.
 * Calls moveDocument with the same parent directory.
 */
export function renameDocument(
  vaultRoot: string,
  docPath: string,
  newName: string,
  actor = 'human',
): MoveResult {
  const destPath = path.posix.join(path.posix.dirname(docPath), newName);
  return moveDocument(vaultRoot, docPath, destPath, actor);
}
