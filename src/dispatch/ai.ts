import * as fs from 'node:fs';
import * as path from 'node:path';
import { stripFrontmatter, getFrontmatterTitle } from './frontmatter';
export { stripFrontmatter, getFrontmatterTitle } from './frontmatter';

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

export interface ComplexityResult {
  complexity: string;
  confidence: number;
  reasoning: string;
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
  /** Phase 3 — AI-powered complexity estimation */
  estimateComplexity(body: string, frontmatter: Record<string, any>): Promise<ComplexityResult>;
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

  async estimateComplexity(body: string, frontmatter: Record<string, any>): Promise<ComplexityResult> {
    const bodyLower = body.toLowerCase();
    const highKeywords = [
      'refactor', 'rewrite', 'unified', 'architecture', 'migration',
      'dispatch module', 'all profiles', 'all templates', 'all bundled',
      'new module', 'phase gate', 'acl', 'multi-vault', 'infrastructure',
      'overhaul', 'rebuild', 'replace entire', 'full system',
    ];
    const lowKeywords = [
      'tooltip', 'add field', 'hide ', 'filter ', 'quick fix', 'one-line',
      'single line', 'small ', 'minor ', 'typo', 'label', 'placeholder',
      'rename ', 'css ', 'colour', 'color ', 'icon ',
    ];

    const words = body.split(/\s+/).filter(Boolean).length;
    const tableRows = (body.match(/^\|/gm) ?? []).length;
    const headings = (body.match(/^#{1,3} /gm) ?? []).length;
    const deps = frontmatter.depends_on ? (Array.isArray(frontmatter.depends_on) ? frontmatter.depends_on.length : 1) : 0;

    const highHits = highKeywords.filter(k => bodyLower.includes(k));
    const lowHits = lowKeywords.filter(k => bodyLower.includes(k));

    const isDeferred = frontmatter.status === 'deferred' || bodyLower.includes('deferred: true');

    let score = 0;
    if (tableRows >= 10) score += 2;
    else if (tableRows >= 5) score += 1;
    else if (tableRows <= 2) score -= 1;
    if (deps >= 3) score += 2;
    else if (deps >= 1) score += 1;
    if (words >= 600) score += 1;
    if (words <= 150) score -= 1;
    if (headings >= 8) score += 1;
    score += highHits.length * 2;
    score -= lowHits.length;
    if (isDeferred) score -= 1;

    let complexity: string;
    let reasoning: string;

    if (score >= 3) {
      complexity = 'high';
      const factors: string[] = [];
      if (tableRows >= 5) factors.push(`${tableRows} implementation steps`);
      if (deps >= 1) factors.push(`${deps} dependenc${deps === 1 ? 'y' : 'ies'}`);
      if (highHits.length) factors.push(`keywords: ${highHits.slice(0, 2).join(', ')}`);
      if (words >= 600) factors.push(`${words} words`);
      reasoning = 'High: ' + (factors.join('; ') || 'broad scope');
    } else if (score <= 0) {
      complexity = 'low';
      const factors: string[] = [];
      if (tableRows <= 2) factors.push('few implementation steps');
      if (deps === 0) factors.push('no dependencies');
      if (lowHits.length) factors.push(`keywords: ${lowHits.slice(0, 2).join(', ')}`);
      if (words <= 150) factors.push('short proposal');
      reasoning = 'Low: ' + (factors.join('; ') || 'narrow scope');
    } else {
      complexity = 'medium';
      reasoning = `Medium: score ${score} (${tableRows} steps, ${deps} deps, ${words} words)`;
    }

    return { complexity, confidence: 0.6, reasoning };
  }
}

// ── OpenCodeEngine (real LLM) ──────────────────────────────────────────────────

export class OpenCodeEngine implements AIEngine {
  constructor(private url: string, private vaultRoot?: string) {}

  /** Create a session and send one prompt, return extracted text. */
  private async callSession(prompt: string): Promise<string> {
    let dir = this.vaultRoot ?? process.env.DOCWRIGHT_ROOT ?? process.cwd();
    if (dir.endsWith('webui') || dir.includes('webui/')) {
      dir = path.resolve(dir, '../..');
    }
    const q = `directory=${encodeURIComponent(dir)}`;
    const sessRes = await fetch(`${this.url}/session?${q}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    if (!sessRes.ok) throw new Error(`Session create failed: ${sessRes.status}`);
    const sess = await sessRes.json() as Record<string, unknown>;
    const sessionId = (sess?.id ?? sess?.sessionID) as string | undefined;
    if (!sessionId) throw new Error('No session ID in response');

    const msgRes = await fetch(`${this.url}/session/${sessionId}/message?${q}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parts: [{ type: 'text', text: prompt }] }),
    });
    if (!msgRes.ok) throw new Error(`Message failed: ${msgRes.status}`);
    const data = await msgRes.json() as Record<string, unknown>;
    const parts = (data?.parts ?? []) as Array<{ type: string; text?: string }>;
    return parts.filter(p => p.type === 'text').map(p => p.text ?? '').join('');
  }

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
      const text = await this.callSession(prompt);
      const match = text.match(/\[[\s\S]*\]/);
      if (!match) throw new Error('No JSON array in response');
      const scored = JSON.parse(match[0]) as Array<{ path: string; score: number }>;
      return scored.map(s => {
        const raw = fs.readFileSync(path.join(vaultRoot, s.path), 'utf-8');
        return { path: s.path, title: getFrontmatterTitle(raw), score: s.score, sections: parseSections(stripFrontmatter(raw)) };
      }).sort((a, b) => b.score - a.score);
    } catch {
      return new KeywordEngine().findSimilar(targetPath, candidates, vaultRoot);
    }
  }

  async fillProposal(fm: Record<string, any>, body: string): Promise<string> {
    const title = fm.title || '(untitled)';
    const tags  = Array.isArray(fm.tags) ? fm.tags.join(', ') : String(fm.tags || '');
    const prompt =
      `You are a governance document assistant. Improve the following proposal body.\n` +
      `Rules:\n` +
      `- Flesh out sparse sections (Problem, Proposed Solution, Out of Scope)\n` +
      `- Keep the author's intent unchanged — do not reverse decisions already made\n` +
      `- Add missing sections only when clearly needed\n` +
      `- Do NOT modify the YAML frontmatter\n` +
      `- Return ONLY the improved markdown body with no preamble or commentary\n\n` +
      `FRONTMATTER CONTEXT:\ntitle: ${title}\ntags: ${tags}\n\n` +
      `CURRENT BODY:\n${body}`;
    try {
      return await this.callSession(prompt);
    } catch {
      return new KeywordEngine().fillProposal(fm, body);
    }
  }

  async critiqueDocument(content: string): Promise<string> {
    const prompt =
      `You are a governance document reviewer. Critique the following document.\n` +
      `Identify: missing sections, weak reasoning, unstated assumptions, ` +
      `security or governance concerns, and concrete improvement suggestions.\n` +
      `Return a structured critique in plain markdown. Be specific and actionable.\n\n` +
      `DOCUMENT:\n${content.slice(0, 4000)}`;
    try {
      return await this.callSession(prompt);
    } catch {
      return new KeywordEngine().critiqueDocument(content);
    }
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
      const text = await this.callSession(prompt);
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

  async estimateComplexity(body: string, frontmatter: Record<string, any>): Promise<ComplexityResult> {
    const title = frontmatter.title || '(untitled)';
    const tags = Array.isArray(frontmatter.tags) ? frontmatter.tags.join(', ') : String(frontmatter.tags || '');
    const deps = Array.isArray(frontmatter.depends_on) ? frontmatter.depends_on.join(', ') : '';
    const bodyExcerpt = body.slice(0, 3000);

    const prompt =
      `You are a complexity estimation engine for a governance document system.\n\n` +
      `Given a proposal's frontmatter and body, evaluate:\n` +
      `1. Scope — how many distinct work items or modules are affected\n` +
      `2. Risk — how risky changes are (reversibility, dependency cascades)\n` +
      `3. Dependencies — how many external systems or other proposals are involved\n` +
      `4. Implementation scale — rough lines/screens/steps estimate\n\n` +
      `Return ONLY valid JSON:\n` +
      `{"complexity":"low|medium|high","confidence":0.0-1.0,"reasoning":"2-3 sentence explanation"}\n\n` +
      `Valid complexity values: low, medium, high.\n` +
      `Low = narrow scope, few dependencies, low risk, quick to implement.\n` +
      `Medium = moderate scope with some dependencies or risk.\n` +
      `High = broad scope, many dependencies, high risk, significant implementation effort.\n\n` +
      `--- FRONTMATTER ---\n` +
      `title: ${title}\ntags: ${tags}\ndepends_on: ${deps}\n\n` +
      `--- BODY ---\n` +
      `${bodyExcerpt}\n\n` +
      `Respond with ONLY valid JSON:`;

    try {
      const text = await this.callSession(prompt);
      const match = text.match(/\{[\s\S]*"complexity"[\s\S]*\}/);
      if (!match) throw new Error('No JSON in response');
      return JSON.parse(match[0]) as ComplexityResult;
    } catch {
      return new KeywordEngine().estimateComplexity(body, frontmatter);
    }
  }
}

// ── OllamaEngine (OpenAI-compatible — remote NVIDIA primary) ──────────────────

export class OllamaEngine implements AIEngine {
  private baseUrl: string;
  private model: string;

  constructor(baseUrl: string, model: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.model = model;
  }

  private async chat(prompt: string): Promise<string> {
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) throw new Error(`Ollama request failed: ${res.status}`);
    const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
    return data?.choices?.[0]?.message?.content ?? '';
  }

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
      const text = await this.chat(prompt);
      const match = text.match(/\[[\s\S]*\]/);
      if (!match) throw new Error('No JSON array in response');
      const scored = JSON.parse(match[0]) as Array<{ path: string; score: number }>;
      return scored.map(s => {
        const raw = fs.readFileSync(path.join(vaultRoot, s.path), 'utf-8');
        return { path: s.path, title: getFrontmatterTitle(raw), score: s.score, sections: parseSections(stripFrontmatter(raw)) };
      }).sort((a, b) => b.score - a.score);
    } catch {
      return new KeywordEngine().findSimilar(targetPath, candidates, vaultRoot);
    }
  }

  async fillProposal(fm: Record<string, any>, body: string): Promise<string> {
    const title = fm.title || '(untitled)';
    const tags  = Array.isArray(fm.tags) ? fm.tags.join(', ') : String(fm.tags || '');
    const prompt =
      `You are a governance document assistant. Improve the following proposal body.\n` +
      `Rules:\n` +
      `- Flesh out sparse sections (Problem, Proposed Solution, Out of Scope)\n` +
      `- Keep the author's intent unchanged — do not reverse decisions already made\n` +
      `- Add missing sections only when clearly needed\n` +
      `- Do NOT modify the YAML frontmatter\n` +
      `- Return ONLY the improved markdown body with no preamble or commentary\n\n` +
      `FRONTMATTER CONTEXT:\ntitle: ${title}\ntags: ${tags}\n\n` +
      `CURRENT BODY:\n${body}`;
    try {
      return await this.chat(prompt);
    } catch {
      return new KeywordEngine().fillProposal(fm, body);
    }
  }

  async critiqueDocument(content: string): Promise<string> {
    const prompt =
      `You are a governance document reviewer. Critique the following document.\n` +
      `Identify: missing sections, weak reasoning, unstated assumptions, ` +
      `security or governance concerns, and concrete improvement suggestions.\n` +
      `Return a structured critique in plain markdown. Be specific and actionable.\n\n` +
      `DOCUMENT:\n${content.slice(0, 4000)}`;
    try {
      return await this.chat(prompt);
    } catch {
      return new KeywordEngine().critiqueDocument(content);
    }
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
      const text = await this.chat(prompt);
      const match = text.match(/\{[\s\S]*"readiness"[\s\S]*\}/);
      if (!match) throw new Error('No JSON in response');
      return JSON.parse(match[0]) as GatePreReviewResult;
    } catch {
      const pendingSteps = (docBody.match(/⏳/g) ?? []).length;
      return {
        summary: `Pre-review (LLM unavailable): ${pendingSteps > 0 ? `${pendingSteps} steps still pending` : 'No obvious blockers found'}.`,
        concerns: pendingSteps > 0 ? ['Pending implementation steps'] : [],
        incomplete_items: pendingSteps > 0 ? ['Implementation steps not completed'] : [],
        readiness: pendingSteps === 0 ? 'ready' : 'needs-work',
      };
    }
  }

  async estimateComplexity(body: string, frontmatter: Record<string, any>): Promise<ComplexityResult> {
    const title = frontmatter.title || '(untitled)';
    const tags = Array.isArray(frontmatter.tags) ? frontmatter.tags.join(', ') : String(frontmatter.tags || '');
    const deps = Array.isArray(frontmatter.depends_on) ? frontmatter.depends_on.join(', ') : '';

    const prompt =
      `You are a complexity estimation engine for a governance document system.\n\n` +
      `Given a proposal's frontmatter and body, evaluate:\n` +
      `1. Scope — how many distinct work items or modules are affected\n` +
      `2. Risk — how risky changes are (reversibility, dependency cascades)\n` +
      `3. Dependencies — how many external systems or other proposals are involved\n` +
      `4. Implementation scale — rough lines/screens/steps estimate\n\n` +
      `Return ONLY valid JSON:\n` +
      `{"complexity":"low|medium|high","confidence":0.0-1.0,"reasoning":"2-3 sentence explanation"}\n\n` +
      `--- FRONTMATTER ---\n` +
      `title: ${title}\ntags: ${tags}\ndepends_on: ${deps}\n\n` +
      `--- BODY ---\n` +
      `${body.slice(0, 3000)}\n\n` +
      `Respond with ONLY valid JSON:`;

    try {
      const text = await this.chat(prompt);
      const match = text.match(/\{[\s\S]*"complexity"[\s\S]*\}/);
      if (!match) throw new Error('No JSON in response');
      return JSON.parse(match[0]) as ComplexityResult;
    } catch {
      return new KeywordEngine().estimateComplexity(body, frontmatter);
    }
  }
}

// ── Factory ────────────────────────────────────────────────────────────────────

export function getAIEngine(vaultRoot: string): AIEngine {
  const ollaBase  = process.env.OLLA_BASE;
  const ollaModel = process.env.OLLA_MODEL;
  if (ollaBase && ollaModel) return new OllamaEngine(ollaBase, ollaModel);

  const opencodeUrl = process.env.OPENCODE_URL;
  if (opencodeUrl) return new OpenCodeEngine(opencodeUrl, vaultRoot);

  return new KeywordEngine();
}
