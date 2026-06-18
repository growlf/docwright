import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { parseFrontmatter, stripFrontmatter } from './frontmatter';

// ── Types ─────────────────────────────────────────────────────────────────────

export type EdgeType =
  | 'wikilink'
  | 'depends_on'
  | 'related_to'
  | 'blocks'
  | 'absorbs'
  | 'consumed_by'
  | 'proposal_source'
  | 'subsumed_by';

export interface VaultEdge {
  source: string;
  target: string;
  type: EdgeType;
}

export interface VaultEntry {
  path: string;
  fm: Record<string, any>;
  mtime: number;
  contentHash: string;
  edges: VaultEdge[];
}

export type VaultIndex = Record<string, VaultEntry>;

export interface DocumentFilter {
  docType?: string | string[];
  status?: string | string[];
  phase?: string | number;
  tags?: string | string[];
  author?: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const INDEX_FILE = '.docwright/index.json';

const SCAN_DIRS = [
  'proposals', 'proposals/approved',
  'plans', 'plans/completed',
  'docs', 'docs/SOPs',
  'policies', 'policies/core',
  'research',
];

// Frontmatter fields that carry path references — extracted as typed edges
const FM_EDGE_FIELDS: EdgeType[] = [
  'depends_on', 'related_to', 'blocks', 'absorbs',
  'consumed_by', 'proposal_source', 'subsumed_by',
];

// ── Helpers ───────────────────────────────────────────────────────────────────

export { parseFrontmatter } from './frontmatter';

function sha256(s: string): string {
  return crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);
}

const WIKILINK_RE = /\[\[([^\]|#]+)(?:[|#][^\]]*)?]]/g;

function extractWikilinkEdges(source: string, body: string): VaultEdge[] {
  const edges: VaultEdge[] = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  WIKILINK_RE.lastIndex = 0;
  while ((m = WIKILINK_RE.exec(body)) !== null) {
    const stem = m[1].trim();
    if (!stem || seen.has(stem)) continue;
    seen.add(stem);
    edges.push({ source, target: stem, type: 'wikilink' });
  }
  return edges;
}

function extractFmEdges(source: string, fm: Record<string, any>): VaultEdge[] {
  const edges: VaultEdge[] = [];
  for (const field of FM_EDGE_FIELDS) {
    const val = fm[field];
    if (!val) continue;
    const refs: string[] = Array.isArray(val) ? val.map(String) : [String(val)];
    for (const ref of refs) {
      const t = ref.trim();
      if (t) edges.push({ source, target: t, type: field });
    }
  }
  return edges;
}

/** Infer document type from its path. */
export function inferDocType(relPath: string): string {
  if (relPath.startsWith('proposals/')) return 'proposal';
  if (relPath.startsWith('plans/'))     return 'plan';
  if (relPath.startsWith('docs/'))      return 'doc';
  if (relPath.startsWith('policies/'))  return 'policy';
  if (relPath.startsWith('research/'))  return 'research';
  return 'unknown';
}

// ── Index Build ───────────────────────────────────────────────────────────────

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
        const fm   = parseFrontmatter(raw);
        const body = stripFrontmatter(raw);
        const edges = [
          ...extractWikilinkEdges(rel, body),
          ...extractFmEdges(rel, fm),
        ];
        index[rel] = {
          path: rel,
          fm,
          mtime: stat.mtimeMs,
          contentHash: sha256(raw),
          edges,
        };
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

  // Check for changed or deleted files — compare mtime AND contentHash
  for (const [rel, entry] of Object.entries(existing)) {
    const abs = path.join(vaultRoot, rel);
    try {
      const stat = fs.statSync(abs);
      if (stat.mtimeMs > entry.mtime) {
        const fresh = buildIndex(vaultRoot);
        writeIndex(vaultRoot, fresh);
        return fresh;
      }
      // Same mtime but hash changed (sub-second write on some filesystems)
      if (entry.contentHash) {
        const raw = fs.readFileSync(abs, 'utf-8');
        if (sha256(raw) !== entry.contentHash) {
          const fresh = buildIndex(vaultRoot);
          writeIndex(vaultRoot, fresh);
          return fresh;
        }
      }
    } catch {
      const fresh = buildIndex(vaultRoot);
      writeIndex(vaultRoot, fresh);
      return fresh;
    }
  }

  // Check for new files
  const fresh = buildIndex(vaultRoot);
  if (Object.keys(fresh).length !== Object.keys(existing).length) {
    writeIndex(vaultRoot, fresh);
    return fresh;
  }
  return existing;
}

// ── Query API ─────────────────────────────────────────────────────────────────

/** Look up a document by exact relative path or by basename slug. */
export function getDocument(index: VaultIndex, pathOrSlug: string): VaultEntry | null {
  if (index[pathOrSlug]) return index[pathOrSlug];
  const slug = pathOrSlug.replace(/\.md$/, '');
  for (const entry of Object.values(index)) {
    const base = path.basename(entry.path, '.md');
    if (base === slug) return entry;
  }
  return null;
}

/** Return all edges where source === docPath. */
export function getDocumentEdges(index: VaultIndex, docPath: string): VaultEdge[] {
  return index[docPath]?.edges ?? [];
}

/** Return all documents that have an edge pointing to targetPath (or its slug). */
export function getBacklinksFor(index: VaultIndex, targetPath: string): VaultEntry[] {
  const targetSlug = path.basename(targetPath, '.md');
  const results: VaultEntry[] = [];
  for (const entry of Object.values(index)) {
    const links = entry.edges.some(
      e => e.target === targetPath ||
           e.target === targetPath.replace(/\.md$/, '') ||
           e.target === targetSlug,
    );
    if (links) results.push(entry);
  }
  return results;
}

function matchesFilter(entry: VaultEntry, filter: DocumentFilter): boolean {
  const { fm, path: p } = entry;

  if (filter.docType !== undefined) {
    const inferred = inferDocType(p);
    const fmType = fm.docType ?? fm.type ?? inferred;
    const allowed = Array.isArray(filter.docType) ? filter.docType : [filter.docType];
    if (!allowed.includes(fmType) && !allowed.includes(inferred)) return false;
  }

  if (filter.status !== undefined) {
    const allowed = Array.isArray(filter.status) ? filter.status : [filter.status];
    // Proposals use approved:true/false rather than status
    const docStatus = fm.status ?? (fm.approved === true ? 'approved' : fm.approved === false ? 'draft' : undefined);
    if (!docStatus || !allowed.includes(docStatus)) return false;
  }

  if (filter.phase !== undefined) {
    if (String(fm.phase) !== String(filter.phase)) return false;
  }

  if (filter.tags !== undefined) {
    const required = Array.isArray(filter.tags) ? filter.tags : [filter.tags];
    const docTags: string[] = Array.isArray(fm.tags) ? fm.tags.map(String)
      : typeof fm.tags === 'string' ? fm.tags.split(',').map((t: string) => t.trim())
      : [];
    if (!required.every(t => docTags.includes(t))) return false;
  }

  if (filter.author !== undefined) {
    if (fm.author !== filter.author) return false;
  }

  return true;
}

/** Filter the index by type, status, phase, tags, or author. */
export function queryDocuments(index: VaultIndex, filter: DocumentFilter): VaultEntry[] {
  return Object.values(index).filter(e => matchesFilter(e, filter));
}

/** Return all edges in the entire index. */
export function getAllEdges(index: VaultIndex): VaultEdge[] {
  return Object.values(index).flatMap(e => e.edges);
}
