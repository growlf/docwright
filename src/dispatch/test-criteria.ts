/**
 * Test criteria generator and synchronizer for plan documents.
 *
 * generateTestCriteria — builds a baseline Testing Plan section from plan
 * title and implementation steps. Deterministic; no AI required.
 *
 * syncTestCriteria — ensures a plan's Testing Plan section exists and contains
 * a criterion for every implementation step. Additive only: never removes
 * criteria the human has already written or checked off.
 */

export interface PlanStep {
  number: string;
  action: string;
}

export function extractPlanSteps(planContent: string): PlanStep[] {
  const lines = planContent.split('\n');
  const steps: PlanStep[] = [];
  let inTable = false;
  let headerPassed = false;
  for (const line of lines) {
    if (/^##\s+Implementation Steps/.test(line)) { inTable = true; continue; }
    if (!inTable) continue;
    if (!line.startsWith('|')) { if (line.trim()) inTable = false; continue; }
    if (!headerPassed) { headerPassed = true; continue; }
    if (/^\|[-\s|:]+\|$/.test(line)) continue;
    const cols = line.split('|').slice(1, -1).map(c => c.trim());
    if (cols.length >= 2) {
      const num = cols[0].trim();
      const action = cols[1].replace(/\*\*/g, '').trim();
      if (num && action) steps.push({ number: num, action });
    }
  }
  return steps;
}

export function generateTestCriteria(title: string, steps: PlanStep[]): string {
  const lines: string[] = [];

  lines.push('### Step Verification');
  lines.push('');
  if (steps.length > 0) {
    for (const step of steps) {
      lines.push(`- [ ] Step ${step.number}: ${step.action}`);
    }
  } else {
    lines.push('- [ ] All implementation steps complete and outcomes verified');
  }

  lines.push('');
  lines.push('### Integration & Regression');
  lines.push('');
  lines.push('- [ ] Existing tests pass without modification (`npm test`)');
  lines.push('- [ ] TypeScript compiles cleanly (`npm run typecheck`)');
  lines.push(`- [ ] ${title} functionality works end-to-end`);

  lines.push('');
  lines.push('### Gate Criteria');
  lines.push('');
  lines.push('- [ ] `tests_defined` set to `true` in frontmatter');
  lines.push('- [ ] Human reviewer has verified step outcomes above');
  lines.push('- [ ] No regressions introduced to adjacent workflows');

  return lines.join('\n');
}

/**
 * True when the Implementation Steps table differs between two versions of a
 * plan (step numbers or actions added/removed/reworded). Gate for
 * syncTestCriteria on saves (#148): a save that doesn't touch the step table
 * must never rewrite the Testing Plan.
 */
export function stepsChanged(oldContent: string, newContent: string): boolean {
  const key = (s: PlanStep) => `${s.number}|${s.action}`;
  const a = extractPlanSteps(oldContent).map(key);
  const b = extractPlanSteps(newContent).map(key);
  return a.length !== b.length || a.some((v, i) => v !== b[i]);
}

/**
 * Remove phantom unchecked step criteria from the Testing Plan section (#148
 * sweep): an unchecked `- [ ] Step N: ...` line is a stale duplicate when the
 * same step number also has a checked `- [x] Step N:` line in the section —
 * the unchecked copy was re-injected by an unconditional sync against
 * reworded step text. Returns the cleaned content and the removed lines.
 */
export function removePhantomStepDuplicates(content: string): { content: string; removed: string[] } {
  const removed: string[] = [];
  const lines = content.split('\n');
  const out: string[] = [];
  let inSection = false;

  // First pass: collect step numbers with a checked line in the Testing Plan
  const checkedNums = new Set<string>();
  for (const line of lines) {
    if (/^##\s/.test(line)) { inSection = /^##\s+Testing Plan\b/.test(line); continue; }
    const m = inSection && line.trim().match(/^- \[x\] Step (\d+):/i);
    if (m) checkedNums.add(m[1]);
  }

  inSection = false;
  for (const line of lines) {
    if (/^##\s/.test(line)) inSection = /^##\s+Testing Plan\b/.test(line);
    const m = inSection && line.trim().match(/^- \[ \] Step (\d+):/);
    if (m && checkedNums.has(m[1])) {
      removed.push(line.trim());
      continue;
    }
    out.push(line);
  }
  return { content: out.join('\n'), removed };
}

export function hasTestingPlanSection(content: string): boolean {
  const m = content.match(/^##\s+Testing Plan\s*\n([\s\S]*?)(?=^##\s|\n*$)/m);
  if (!m) return false;
  const section = m[1].trim();
  return section !== '' && section !== '_Add test plan during implementation._';
}

/**
 * Ensures the plan content has a Testing Plan section with criteria for every
 * known implementation step. Inserts the section if missing; adds any missing
 * step criteria if the section already exists (never removes or overwrites).
 */
export function syncTestCriteria(planContent: string, title: string): string {
  const steps = extractPlanSteps(planContent);

  if (!hasTestingPlanSection(planContent)) {
    const generated = `## Testing Plan\n\n${generateTestCriteria(title, steps)}\n`;
    const insertAt = planContent.search(/^## Document History/m);
    if (insertAt >= 0) {
      return planContent.slice(0, insertAt) + generated + '\n' + planContent.slice(insertAt);
    }
    return planContent.trimEnd() + '\n\n' + generated;
  }

  if (steps.length === 0) return planContent;

  return planContent.replace(
    /^(##\s+Testing Plan\s*\n)([\s\S]*?)(?=^##\s|\n*$)/m,
    (match, header, body) => {
      const bodyLines = body.split('\n').map((l: string) => l.trim());
      const existingSet = new Set(bodyLines);
      const missing: string[] = [];

      for (const step of steps) {
        const unchecked = `- [ ] Step ${step.number}: ${step.action}`;
        const checked = `- [x] Step ${step.number}: ${step.action}`;
        const hasRef = bodyLines.some(
          (l: string) =>
            l === unchecked ||
            l === checked ||
            l.startsWith(`- [ ] Step ${step.number}:`) ||
            l.startsWith(`- [x] Step ${step.number}:`),
        );
        if (!hasRef) missing.push(unchecked);
      }

      if (missing.length === 0) return match;

      const stepVerifIdx = body.search(/###\s+Step Verification/);
      if (stepVerifIdx >= 0) {
        const afterHeader = body.indexOf('\n', stepVerifIdx) + 1;
        const nextSection = body.indexOf('\n###', afterHeader);
        const ins = nextSection >= 0 ? nextSection : body.length;
        const newBody =
          body.slice(0, ins) + '\n' + missing.join('\n') + body.slice(ins);
        return header + newBody;
      }

      return header + missing.join('\n') + '\n' + body;
    },
  );
}
