import * as fs from 'node:fs';
import * as path from 'node:path';

export interface Section {
  heading: string;
  content: string;
}

export interface SimilarityResult {
  path: string;
  title: string;
  score: number;
  sections: Section[];
}

export interface GatePreReviewResult {
  summary: string;
  concerns: string[];
  incomplete_items: string[];
  readiness: 'ready' | 'needs-work' | 'blocked';
}

export interface AIEngine {
  findSimilar(targetPath: string, candidates: string[], vaultRoot: string): Promise<SimilarityResult[]>;
  fillProposal(fm: Record<string, any>, body: string): Promise<string>;
  critiqueDocument(content: string): Promise<string>;
  /** Phase 3 — AI pre-review for lifecycle gates */
  gatePreReview(
    gateId: string,
    gateDescription: string,
    docTitle: string,
    docBody: string,
    scopeDocs: Array<{ path: string; title: string; excerpt: string }>,
    aiPrompt?: string,
  ): Promise<GatePreReviewResult>;
}

// ── Shared helpers ──────────────────────────────────────────────────────────────

const STOP = new Set([
  'the','a','an','and','or','but','in','on','at','to','for','of','with',
  'is','are','was','were','be','been','have','has','had','do','does','did',
  'will','would','could','should','may','might','this','that','we','i','it',
  'not','by','as','from','when','if','can','its','they','plan','proposal',
  'proposals','plans','document',
]);

export function tokenize(text: string): Set<string> {
  return new Set(
    text.toLowerCase()
      .replace(/```[\s\S]*?```/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3 && !STOP.has(w))
  );
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const w of a) if (b.has(w)) n++;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : n / union;
}

export function parseSections(body: string): Section[] {
  const sections: Section[] = [];
  const lines = body.split('\n');
  let cur: { heading: string; lines: string[] } | null = null;
  for (const line of lines) {
    const m = line.match(/^#{1,3}\s+(.+)/);
    if (m) {
      if (cur?.lines.join('').trim())
        sections.push({ heading: cur.heading, content: cur.lines.join('\n').trim() });
      cur = { heading: m[1], lines: [] };
    } else cur?.lines.push(line);
  }
  if (cur?.lines.join('').trim())
    sections.push({ heading: cur.heading, content: cur.lines.join('\n').trim() });
  return sections;
}

export function stripFrontmatter(raw: string): string {
  return raw.replace(/^---\n[\s\S]*?\n---\n/, '');
}

export function getFrontmatterTitle(raw: string): string {
  const m = raw.match(/^title:\s*["']?([^\n"']+)/m);
  return m ? m[1].trim() : '';
}

// ── KeywordEngine (Jaccard stub — default) ─────────────────────────────────────

export class KeywordEngine implements AIEngine {
  constructor(private threshold = 0.10) {}

  async findSimilar(targetPath: string, candidates: string[], vaultRoot: string): Promise<SimilarityResult[]> {
    const targetRaw = fs.readFileSync(path.join(vaultRoot, targetPath), 'utf-8');
    const targetWords = tokenize(getFrontmatterTitle(targetRaw) + ' ' + stripFrontmatter(targetRaw));

    return candidates
      .filter(c => c !== targetPath)
      .map(c => {
        try {
          const raw   = fs.readFileSync(path.join(vaultRoot, c), 'utf-8');
          const words = tokenize(getFrontmatterTitle(raw) + ' ' + stripFrontmatter(raw));
          return {
            path: c,
            title: getFrontmatterTitle(raw) || path.basename(c, '.md'),
            score: jaccard(targetWords, words),
            sections: parseSections(stripFrontmatter(raw)),
          };
        } catch { return null; }
      })
      .filter((r): r is SimilarityResult => r !== null && r.score >= this.threshold)
      .sort((a, b) => b.score - a.score);
  }

  async fillProposal(_fm: Record<string, any>, body: string): Promise<string> {
    return body + '\n\n*(AI fill-in unavailable — OpenCode not configured)*';
  }

  async critiqueDocument(_content: string): Promise<string> {
    return '*(Critique unavailable — OpenCode not configured)*';
  }

  async gatePreReview(
    _gateId: string,
    _gateDescription: string,
    _docTitle: string,
    docBody: string,
    _scopeDocs: Array<{ path: string; title: string; excerpt: string }>,
    _aiPrompt?: string,
  ): Promise<GatePreReviewResult> {
    // Keyword fallback: count implementation steps and check for incomplete items
    const pendingSteps = (docBody.match(/⏳/g) ?? []).length;
    const completedSteps = (docBody.match(/✅/g) ?? []).length;
    const concerns: string[] = [];
    if (pendingSteps > 0) concerns.push(`${pendingSteps} step(s) still pending`);
    return {
      summary: `Pre-review: ${completedSteps} steps done, ${pendingSteps} pending.`,
      concerns,
      incomplete_items: pendingSteps > 0 ? ['Pending implementation steps'] : [],
      readiness: pendingSteps === 0 ? 'ready' : 'needs-work',
    };
  }
}

// ── OpenCodeEngine (real LLM) ──────────────────────────────────────────────────

export class OpenCodeEngine implements AIEngine {
  constructor(private url: string) {}

  async findSimilar(targetPath: string, candidates: string[], vaultRoot: string): Promise<SimilarityResult[]> {
    const targetRaw = fs.readFileSync(path.join(vaultRoot, targetPath), 'utf-8');
    const body = stripFrontmatter(targetRaw).slice(0, 1200);

    const list = candidates
      .filter(c => c !== targetPath)
      .map(c => {
        try {
          const raw = fs.readFileSync(path.join(vaultRoot, c), 'utf-8');
          return { path: c, title: getFrontmatterTitle(raw), excerpt: stripFrontmatter(raw).slice(0, 600) };
        } catch { return null; }
      })
      .filter(Boolean) as Array<{ path: string; title: string; excerpt: string }>;

    const prompt =
      `You are a document similarity engine for a governance system.\n\n` +
      `Rate each candidate for semantic overlap with the target. ` +
      `Return ONLY a valid JSON array:\n[{"path":"...","score":0.0-1.0},...]\n` +
      `Score 0 = no overlap, 1 = identical topic. Include only score > 0.1.\n\n` +
      `TARGET:\n${body}\n\nCANDIDATES:\n` +
      list.map(c => `PATH:${c.path}\nTITLE:${c.title}\n${c.excerpt}`).join('\n---\n');

    try {
      const res = await fetch(`${this.url}/api/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const match = text.match(/\[[\s\S]*\]/);
      if (!match) throw new Error('No JSON array in response');
      const scored = JSON.parse(match[0]) as Array<{ path: string; score: number }>;
      return scored.map(s => {
        const raw = fs.readFileSync(path.join(vaultRoot, s.path), 'utf-8');
        return { path: s.path, title: getFrontmatterTitle(raw), score: s.score, sections: parseSections(stripFrontmatter(raw)) };
      }).sort((a, b) => b.score - a.score);
    } catch {
      // Graceful fallback to keyword engine
      return new KeywordEngine().findSimilar(targetPath, candidates, vaultRoot);
    }
  }

  async fillProposal(_fm: Record<string, any>, body: string): Promise<string> {
    // TODO: implement via OpenCode session API
    return body;
  }

  async critiqueDocument(content: string): Promise<string> {
    // TODO: implement via OpenCode session API
    return content;
  }

  async gatePreReview(
    gateId: string,
    gateDescription: string,
    docTitle: string,
    docBody: string,
    scopeDocs: Array<{ path: string; title: string; excerpt: string }>,
    aiPrompt?: string,
  ): Promise<GatePreReviewResult> {
    const defaultPrompt = `You are a gate review assistant for a governance system.
Gate "${gateId}": ${gateDescription}
Document: "${docTitle}"

Read the document body and any related scope documents below, then produce a readiness assessment.

Respond in valid JSON:
{
  "summary": "Brief readiness summary (2-3 sentences)",
  "concerns": ["Specific concern 1", "Specific concern 2"],
  "incomplete_items": ["Item 1 not ready", "Item 2 not ready"],
  "readiness": "ready | needs-work | blocked"
}`;

    const prompt = `${aiPrompt || defaultPrompt}

--- DOCUMENT BODY ---
${docBody.slice(0, 3000)}

--- SCOPE DOCUMENTS ---
${scopeDocs.map(d => `[${d.path}] ${d.title}\n${d.excerpt.slice(0, 500)}`).join('\n\n')}

--- END ---
Respond with ONLY valid JSON:`;

    try {
      const res = await fetch(`${this.url}/api/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const match = text.match(/\{[\s\S]*"readiness"[\s\S]*\}/);
      if (!match) throw new Error('No JSON in response');
      return JSON.parse(match[0]) as GatePreReviewResult;
    } catch {
      // Fallback to keyword engine logic
      const pendingSteps = (docBody.match(/⏳/g) ?? []).length;
      return {
        summary: `Pre-review (LLM unavailable): ${pendingSteps > 0 ? `${pendingSteps} steps still pending` : 'No obvious blockers found'}.`,
        concerns: pendingSteps > 0 ? ['Pending implementation steps'] : [],
        incomplete_items: pendingSteps > 0 ? ['Implementation steps not completed'] : [],
        readiness: pendingSteps === 0 ? 'ready' : 'needs-work',
      };
    }
  }
}

// ── Factory ────────────────────────────────────────────────────────────────────

export function getAIEngine(_vaultRoot: string): AIEngine {
  const url = process.env.OPENCODE_URL;
  if (url) return new OpenCodeEngine(url);
  return new KeywordEngine();
}
