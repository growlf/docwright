import * as fs from 'node:fs';
import * as path from 'node:path';
import { tokenize, jaccard, stripFrontmatter, getFrontmatterTitle } from './ai';

// ── Types ───────────────────────────────────────────────────────────────────────

export type RelationshipType =
  | 'depends_on'
  | 'blocks'
  | 'merge_candidate'
  | 'supersedes'
  | 'related_to'
  | 'informed-by'
  | 'parallel';

export interface SignalScores {
  jaccard: number;
  tag_overlap: number;
  phase_match: number;
  same_author: number;
  same_assigned: number;
  explicit_related: number;
  wikilink_cooccurrence: number;
}

export interface RelationshipResult {
  source: string;
  target: string;
  type: RelationshipType;
  confidence: number;
  signals: SignalScores;
  targetTitle: string;
}

export interface RelationshipMap {
  generated: string;
  relationships: RelationshipResult[];
}

export interface RelationshipEngineConfig {
  auto_detect_on_create: boolean;
  auto_detect_on_update: boolean;
  auto_detect_on_approval: boolean;
  similarity_threshold: number;
  show_plan_button: boolean;
}

export const DEFAULT_ENGINE_CONFIG: RelationshipEngineConfig = {
  auto_detect_on_create: true,
  auto_detect_on_update: true,
  auto_detect_on_approval: true,
  similarity_threshold: 0.35,
  show_plan_button: true,
};

// ── Signal weights (sums to 1.0) ───────────────────────────────────────────────

const WEIGHTS = {
  jaccard: 0.30,
  tag_overlap: 0.20,
  phase_match: 0.15,
  same_author: 0.10,
  same_assigned: 0.10,
  explicit_related: 0.10,
  wikilink_cooccurrence: 0.05,
};

// ── Frontmatter parsing ────────────────────────────────────────────────────────

function parseFrontmatter(raw: string): Record<string, any> {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) return {};
  const fm: Record<string, any> = {};
  const lines = m[1].split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Key with no inline value — may be a block sequence (- item lines)
    const keyEmpty = line.match(/^(\w+):\s*$/);
    if (keyEmpty) {
      const arr: string[] = [];
      while (i + 1 < lines.length && /^\s+-/.test(lines[i + 1])) {
        i++;
        arr.push(lines[i].replace(/^\s+-\s*/, '').trim().replace(/^["']|["']$/g, ''));
      }
      fm[keyEmpty[1]] = arr.length > 0 ? arr : '';
      continue;
    }
    const kv = line.match(/^(\w+):\s*(.+)/);
    if (kv) {
      let val: any = kv[2].trim();
      if (val.startsWith('[') && val.endsWith(']')) {
        val = val.slice(1, -1).split(',').map((s: string) => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
      } else if (val === 'true') val = true;
      else if (val === 'false') val = false;
      else val = val.replace(/^["']|["']$/g, '');
      fm[kv[1]] = val;
    }
  }
  return fm;
}

function getFrontmatterList(raw: string, field: string): string[] {
  const fm = parseFrontmatter(raw);
  const val = fm[field];
  if (Array.isArray(val)) return val.map(String);
  if (typeof val === 'string') return [val];
  return [];
}

function getFrontmatterString(raw: string, field: string): string {
  const fm = parseFrontmatter(raw);
  const val = fm[field];
  return typeof val === 'string' ? val : '';
}

// ── Wikilink extraction ────────────────────────────────────────────────────────

function extractWikilinks(body: string): Set<string> {
  const links = new Set<string>();
  const re = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    links.add(m[1].trim());
  }
  return links;
}

// ── Multi-signal classification ────────────────────────────────────────────────

export function classifyRelationship(
  confidence: number,
  signals: SignalScores,
  targetFrontmatter: Record<string, any>,
  candidatePath?: string,
): RelationshipType {
  // Research documents inform proposals/plans — always classify as informed-by
  if (candidatePath?.startsWith('research/')) return 'informed-by';

  if (signals.explicit_related >= 0.9) return 'related_to';

  if (confidence >= 0.7) {
    if (signals.tag_overlap >= 0.8 && signals.jaccard >= 0.3) return 'merge_candidate';
    if (signals.jaccard >= 0.5) return 'merge_candidate';
  }

  if (confidence >= 0.5) {
    if (signals.phase_match >= 0.5) return 'related_to';
    if (signals.same_assigned >= 0.5) return 'related_to';
  }

  if (confidence >= 0.3) return 'related_to';

  return 'parallel';
}

// ── Core engine ────────────────────────────────────────────────────────────────

export function computeSignals(
  targetRaw: string,
  candidateRaw: string,
  targetPath?: string,
  candidatePath?: string,
): SignalScores {
  const targetBody = stripFrontmatter(targetRaw);
  const candidateBody = stripFrontmatter(candidateRaw);

  const targetFm = parseFrontmatter(targetRaw);
  const candidateFm = parseFrontmatter(candidateRaw);

  const targetTokens = tokenize(getFrontmatterTitle(targetRaw) + ' ' + targetBody);
  const candidateTokens = tokenize(getFrontmatterTitle(candidateRaw) + ' ' + candidateBody);

  const jaccardScore = jaccard(targetTokens, candidateTokens);

  const targetTags = new Set(getFrontmatterList(targetRaw, 'tags'));
  const candidateTags = new Set(getFrontmatterList(candidateRaw, 'tags'));
  const tagOverlap = targetTags.size && candidateTags.size
    ? [...targetTags].filter(t => candidateTags.has(t)).length / Math.max(targetTags.size, candidateTags.size)
    : 0;

  const targetPhase = getFrontmatterString(targetRaw, 'phase');
  const candidatePhase = getFrontmatterString(candidateRaw, 'phase');
  const phaseMatch = targetPhase && candidatePhase && targetPhase === candidatePhase ? 1 : 0;

  const targetAuthor = getFrontmatterString(targetRaw, 'author');
  const candidateAuthor = getFrontmatterString(candidateRaw, 'author');
  const sameAuthor = targetAuthor && candidateAuthor && targetAuthor === candidateAuthor ? 1 : 0;

  const targetAssigned = getFrontmatterList(targetRaw, 'assigned_to');
  const candidateAssigned = getFrontmatterList(candidateRaw, 'assigned_to');
  const sameAssigned = targetAssigned.some(a => candidateAssigned.includes(a)) ? 1 : 0;

  const targetRelated = [
    ...getFrontmatterList(targetRaw, 'related_to'),
    ...getFrontmatterList(targetRaw, 'depends_on'),
    ...getFrontmatterList(targetRaw, 'absorbs'),
  ];
  const candidateRelated = [
    ...getFrontmatterList(candidateRaw, 'related_to'),
    ...getFrontmatterList(candidateRaw, 'depends_on'),
    ...getFrontmatterList(candidateRaw, 'absorbs'),
  ];
  const matchesPath = (list: string[], p?: string) => p ? list.some(ref => ref === p || ref.includes(p) || p.includes(ref)) : false;
  const explicitRelated = matchesPath(targetRelated, candidatePath) || matchesPath(candidateRelated, targetPath) ? 1 : 0;

  const targetLinks = extractWikilinks(targetBody);
  const candidateLinks = extractWikilinks(candidateBody);
  const wikilinkOverlap = targetLinks.size && candidateLinks.size
    ? [...targetLinks].filter(l => candidateLinks.has(l)).length / Math.max(targetLinks.size, candidateLinks.size)
    : 0;

  return {
    jaccard: jaccardScore,
    tag_overlap: tagOverlap,
    phase_match: phaseMatch,
    same_author: sameAuthor,
    same_assigned: sameAssigned,
    explicit_related: explicitRelated,
    wikilink_cooccurrence: wikilinkOverlap,
  };
}

export function computeConfidence(signals: SignalScores): number {
  return (
    signals.jaccard * WEIGHTS.jaccard +
    signals.tag_overlap * WEIGHTS.tag_overlap +
    signals.phase_match * WEIGHTS.phase_match +
    signals.same_author * WEIGHTS.same_author +
    signals.same_assigned * WEIGHTS.same_assigned +
    signals.explicit_related * WEIGHTS.explicit_related +
    signals.wikilink_cooccurrence * WEIGHTS.wikilink_cooccurrence
  );
}

export function scanProposal(
  targetPath: string,
  candidates: string[],
  vaultRoot: string,
  threshold = 0.3,
): RelationshipResult[] {
  const targetRaw = fs.readFileSync(path.join(vaultRoot, targetPath), 'utf-8');
  const results: RelationshipResult[] = [];

  for (const c of candidates) {
    if (c === targetPath) continue;
    try {
      const candidateRaw = fs.readFileSync(path.join(vaultRoot, c), 'utf-8');
      const signals = computeSignals(targetRaw, candidateRaw, targetPath, c);
      const confidence = computeConfidence(signals);
      if (confidence < threshold) continue;

      const candidateFm = parseFrontmatter(candidateRaw);
      const type = classifyRelationship(confidence, signals, candidateFm, c);

      results.push({
        source: targetPath,
        target: c,
        type,
        confidence,
        signals,
        targetTitle: getFrontmatterTitle(candidateRaw) || path.basename(c, '.md'),
      });
    } catch {
      continue;
    }
  }

  return results.sort((a, b) => b.confidence - a.confidence);
}

// ── Relationship map I/O ──────────────────────────────────────────────────────

export function getMapPath(vaultRoot: string): string {
  return path.join(vaultRoot, '.docwright', 'proposal-relationships.json');
}

export function loadRelationshipMap(vaultRoot: string): RelationshipMap {
  const p = getMapPath(vaultRoot);
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch {
    return { generated: '', relationships: [] };
  }
}

export function saveRelationshipMap(vaultRoot: string, map: RelationshipMap): void {
  const p = getMapPath(vaultRoot);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  map.generated = new Date().toISOString();
  fs.writeFileSync(p, JSON.stringify(map, null, 2));
}

// ── Incremental rebuild ────────────────────────────────────────────────────────

export function rebuildRelationships(vaultRoot: string, threshold = 0.3): RelationshipMap {
  const allDocs = collectProposalDocs(vaultRoot);
  const relationships: RelationshipResult[] = [];

  for (const target of allDocs) {
    const results = scanProposal(target, allDocs, vaultRoot, threshold);
    relationships.push(...results);
  }

  const map: RelationshipMap = { generated: '', relationships };
  saveRelationshipMap(vaultRoot, map);
  return map;
}

function collectProposalDocs(vaultRoot: string): string[] {
  const dirs = ['proposals/', 'proposals/approved/', 'plans/'];
  const docs: string[] = [];
  for (const dir of dirs) {
    const full = path.join(vaultRoot, dir);
    try {
      for (const f of fs.readdirSync(full)) {
        if (f.endsWith('.md')) docs.push(dir + f);
      }
    } catch { continue; }
  }
  return docs;
}
