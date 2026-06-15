import fs from 'node:fs';
import path from 'node:path';
import { json } from '@sveltejs/kit';
import { stripFrontmatter } from '../../../../../dispatch/frontmatter';

const REPO_ROOT = process.env.DOCWRIGHT_ROOT
  ? path.resolve(process.env.DOCWRIGHT_ROOT)
  : path.resolve(process.cwd(), '../..');

const AI_TIMEOUT = 180_000;
const OLLA_BASE = process.env.OLLA_BASE || 'http://localhost:11434/v1';
const OLLA_MODEL = process.env.OLLA_MODEL || 'llama3.1:8b';

interface StepRow {
  number: string;
  action: string;
  details: string;
}

function extractSteps(raw: string): StepRow[] {
  const lines = raw.split('\n');
  const stepRows: StepRow[] = [];
  let inTable = false;
  let headerPassed = false;
  for (const line of lines) {
    if (line.startsWith('## Implementation Steps')) { inTable = true; continue; }
    if (!inTable) continue;
    if (!line.startsWith('|')) { if (line.trim()) inTable = false; continue; }
    if (!headerPassed) { headerPassed = true; continue; }
    if (line.includes('---')) continue;
    const cols = line.split('|').map(c => c.trim());
    const dataCols = cols.slice(1, -1);
    if (dataCols.length >= 3) {
      stepRows.push({ number: dataCols[0], action: dataCols[1], details: dataCols[2] });
    }
  }
  return stepRows;
}

function replaceStepAction(body: string, stepNum: string, newAction: string): string {
  const lines = body.split('\n');
  let inTable = false;
  let headerPassed = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('## Implementation Steps')) { inTable = true; continue; }
    if (!inTable) continue;
    if (!line.startsWith('|')) { if (line.trim()) inTable = false; continue; }
    if (!headerPassed) { headerPassed = true; continue; }
    if (line.includes('---')) continue;
    const rawCols = line.split('|').map(c => c.trim());
    const dataCols = rawCols.slice(1, -1);
    if (dataCols.length >= 3 && dataCols[0] === stepNum) {
      const cells = [];
      let current = '';
      let inCell = false;
      for (const ch of line) {
        if (ch === '|') {
          cells.push(current);
          current = '';
          inCell = !inCell;
        } else {
          current += ch;
        }
      }
      cells.push(current);
      // cells[0] = empty before first |, cells[1] = step#, cells[2] = action, cells[3] = details, cells[4] = status, cells[5] = empty after last |
      if (cells.length >= 4) {
        cells[2] = ` ${newAction} `;
        lines[i] = cells.join('|');
      }
      break;
    }
  }
  return lines.join('\n');
}

function extractSection(raw: string, sectionName: string): string {
  const re = new RegExp(`## ${sectionName}\\n([\\s\\S]*?)(?:\\n## |\\n---|$)`);
  const match = raw.match(re);
  return match ? match[1].trim() : '';
}

function replaceSectionBody(body: string, sectionName: string, newBody: string): string {
  const re = new RegExp(`(## ${sectionName})\\n[\\s\\S]*?(?=\\n## |\\n---|$)`);
  return body.replace(re, (match, header) => header + '\n' + newBody);
}

async function callOlla(prompt: string, retries = 1): Promise<string> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${OLLA_BASE}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: OLLA_MODEL,
          messages: [{ role: 'user', content: prompt }],
          stream: false,
          max_tokens: 4000,
        }),
        signal: AbortSignal.timeout(AI_TIMEOUT),
      });
      if (!res.ok && res.status === 502 && attempt < retries) {
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }
      if (!res.ok) throw new Error(`Olla: ${res.status}`);
      const data = await res.json();
      return data?.choices?.[0]?.message?.content?.trim() || '';
    } catch (e: any) {
      if (e?.name === 'AbortError' && attempt < retries) {
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }
      throw e;
    }
  }
  throw new Error('Olla: all retries exhausted');
}

export async function POST({ request }) {
  const { path: filePath, steps: stepReviews, sections: sectionReviews, overview } = await request.json();
  if (!filePath) return json({ error: 'missing path' }, { status: 400 });

  const resolved = path.resolve(REPO_ROOT, filePath);
  if (!resolved.startsWith(REPO_ROOT)) return json({ error: 'invalid path' }, { status: 403 });
  if (!fs.existsSync(resolved)) return json({ error: 'not found' }, { status: 404 });

  const original = fs.readFileSync(resolved, 'utf-8');
  const body = stripFrontmatter(original);

  try {
    let improvedBody = body;
    const steps = extractSteps(body);
    const hadStepReviews = stepReviews && Object.keys(stepReviews).length > 0;
    const hadSectionReviews = sectionReviews && Object.keys(sectionReviews).length > 0;

    // Warmup: first AI call is slow; do it upfront
    if (hadStepReviews || hadSectionReviews) {
      try {
        await callOlla('Reply with just "ok"', 0);
      } catch {}
    }

    // Improve each step that has review feedback
    if (hadStepReviews) {
      for (const step of steps) {
        const reviewText = stepReviews[step.number];
        if (!reviewText || reviewText.startsWith('Error:')) continue;
        const prompt =
          `Suggest a concrete improvement for this plan step action text (1-2 sentences). ` +
          `Return ONLY the new action text — no preamble, no numbering, no markdown.\n\n` +
          `Current action: ${step.action}\n` +
          `Review feedback: ${reviewText}`;
        try {
          const raw = await callOlla(prompt);
          const improvedAction = raw.replace(/\n+/g, ' ').trim();
          if (improvedAction && improvedAction.length > 5) {
            improvedBody = replaceStepAction(improvedBody, step.number, improvedAction);
          }
        } catch {}
      }
    }

    // Improve each section that has review feedback
    if (hadSectionReviews) {
      const sectionNameMap: Record<string, string> = {
        testing: 'Testing Plan',
        risk: 'Risk Assessment',
        rollback: 'Rollback Procedures',
      };
      for (const [secKey, reviewText] of Object.entries(sectionReviews)) {
        if (reviewText.startsWith('Error:')) continue;
        const sectionName = sectionNameMap[secKey] || secKey.charAt(0).toUpperCase() + secKey.slice(1);
        const currentBody = extractSection(improvedBody, sectionName);
        if (!currentBody) continue;
        const prompt =
          `Suggest a concrete improvement for this plan section (2-4 sentences). ` +
          `Return ONLY the improved section content — no preamble, no heading.\n\n` +
          `Section: ${sectionName}\n` +
          `Current content: ${currentBody.slice(0, 800)}\n` +
          `Review feedback: ${reviewText}`;
        try {
          const improvedSection = await callOlla(prompt);
          if (improvedSection && improvedSection.length > 10) {
            improvedBody = replaceSectionBody(improvedBody, sectionName, improvedSection);
          }
        } catch {}
      }
    }

    let generatedSteps = false;

    // Phase 3: If no steps exist and we have a holistic overview, generate an initial steps table
    if (extractSteps(improvedBody).length === 0 && overview) {
      generatedSteps = true;
      const generatePrompt =
        `Based on the following plan description and review analysis, generate a markdown table of implementation steps.\n` +
        `Return ONLY the table rows (no header row, no separator). Each row: | step_number | **bold action** | details | ⏳ Pending |\n` +
        `Generate 3-6 concrete steps. Be specific and actionable.\n\n` +
        `PLAN BODY:\n${body.slice(0, 2000)}\n\n` +
        `REVIEW ANALYSIS:\n${overview.slice(0, 2000)}`;
      try {
        const raw = await callOlla(generatePrompt);
        const tableLines = raw.split('\n').filter(l => l.trim().startsWith('|')).map(l => l.trim());
        if (tableLines.length > 0) {
          const tableHeader = '| Step | Action | Details | Status |\n|------|--------|---------|--------|\n';
          const generatedTable = '\n\n## Implementation Steps\n\n' + tableHeader + tableLines.join('\n') + '\n';
          // Insert before the first ## heading after the initial content, or at end
          const firstSection = improvedBody.search(/\n(?=## )/);
          if (firstSection >= 0) {
            improvedBody = improvedBody.slice(0, firstSection) + generatedTable + '\n' + improvedBody.slice(firstSection);
          } else {
            improvedBody += generatedTable;
          }
        }
      } catch {}
    }

    // Phase 4: Holistic structural review — checks for missing steps, duplicates, approach gaps
    if (hadStepReviews || hadSectionReviews || overview) {
      const stepsAfter = extractSteps(improvedBody);
      const stepList = stepsAfter.map(s => `- Step ${s.number}: ${s.action.slice(0, 120)}`).join('\n');
      const testingContent = extractSection(improvedBody, 'Testing Plan');
      const riskContent = extractSection(improvedBody, 'Risk Assessment');
      const rollbackContent = extractSection(improvedBody, 'Rollback Procedures');
      const overviewSnippet = overview ? overview.slice(0, 1500) : '';
      const structuralPrompt =
        `Review this governance plan holistically. Focus on what is MISSING or can be IMPROVED at the approach level — NOT individual step wording.\n\n` +
        `Analyze for:\n` +
        `1. **Missing steps** — what critical implementation steps are absent?\n` +
        `2. **Duplicate or overlapping steps** — which steps cover the same ground?\n` +
        `3. **Approach gaps** — is the overall strategy sound? Missing preconditions? Unclear completion criteria?\n` +
        `4. **Step ordering** — should any steps happen earlier or later?\n\n` +
        `Return your analysis as structured bullet-point notes under each heading. ` +
        `Be specific and actionable. Do NOT return a rewritten plan. Do NOT use code fences.\n\n` +
        `PLAN STEPS:\n${stepList}\n\n` +
        `TESTING PLAN:\n${testingContent.slice(0, 500) || '(empty)'}\n\n` +
        `RISK ASSESSMENT:\n${riskContent.slice(0, 500) || '(empty)'}\n\n` +
        `ROLLBACK PROCEDURES:\n${rollbackContent.slice(0, 500) || '(empty)'}\n` +
        (overviewSnippet ? `\nOVERALL ASSESSMENT FROM REVIEW:\n${overviewSnippet}\n` : '');
      try {
        const structuralNotes = await callOlla(structuralPrompt);
        if (structuralNotes && structuralNotes.length > 20) {
          improvedBody += `\n\n## Structural Review\n\n${structuralNotes}\n`;
        }
      } catch {}
    }

    // Append overall assessment as a section if present (deterministic, no AI)
    if (overview) {
      improvedBody += `\n\n## AI Review Findings\n\n### Overall Assessment\n\n${overview}\n`;
    }

    if (improvedBody === body) {
      return json({ error: 'No improvements were generated — AI returned empty or unchanged content', original: body });
    }

    return json({ improved: improvedBody, original: body, generatedSteps });
  } catch (err: any) {
    return json({ error: err?.message ?? String(err), original: body });
  }
}
