import fs from 'node:fs';
import path from 'node:path';
import { json } from '@sveltejs/kit';
import { execSync } from 'node:child_process';

const REPO_ROOT = (() => {
  if (process.env.DOCWRIGHT_ROOT) return process.env.DOCWRIGHT_ROOT;
  return path.resolve(process.cwd(), '../..');
})();

export async function POST({ request }) {
  try {
    const { issuePath } = await request.json();
    if (!issuePath) {
      return json({ error: 'issuePath is required' }, { status: 400 });
    }

    const fullPath = path.resolve(REPO_ROOT, issuePath);
    if (!fullPath.startsWith(path.resolve(REPO_ROOT, 'issues'))) {
      return json({ error: 'issuePath must be under issues/' }, { status: 400 });
    }
    if (!fs.existsSync(fullPath)) {
      return json({ error: `File not found: ${issuePath}` }, { status: 404 });
    }

    const content = fs.readFileSync(fullPath, 'utf8');
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n/);
    if (!fmMatch) {
      return json({ error: 'Issue file missing frontmatter' }, { status: 400 });
    }

    const fm = Object.fromEntries(
      fmMatch[1].split('\n')
        .filter((l: string) => l.includes(':'))
        .map((l: string) => {
          const idx = l.indexOf(':');
          const k = l.slice(0, idx).trim();
          const v = l.slice(idx + 1).trim();
          return [k, v];
        })
    );

    if (fm.github_issue) {
      return json({ error: `Already linked to GitHub issue #${fm.github_issue}` }, { status: 409 });
    }

    const body = [
      `**Description:** ${fm.description || '(no description)'}`,
      `**Reporter:** ${fm.reporter || 'unknown'}`,
      `**Priority:** ${fm.priority || 'none'}`,
      `**Demand Count:** ${fm.demand_count || '1'}`,
      `**Source:** DocWright vault (\`${issuePath}\`)`,
      '',
      '---',
      '',
      '_Auto-promoted from DocWright bug heatmap._',
    ].join('\n');

    const labels = ['bug', 'docwright-auto'].join(',');

    let ghOutput: string;
    try {
      ghOutput = execSync(
        `gh issue create --title ${JSON.stringify(fm.title || 'Untitled bug')} --body ${JSON.stringify(body)} --label "${labels}"`,
        { cwd: REPO_ROOT, encoding: 'utf8', timeout: 30000 },
      ).trim();
    } catch (e: any) {
      return json({ error: `GitHub CLI failed: ${e.stderr || e.message}` }, { status: 502 });
    }

    const ghNumMatch = ghOutput.match(/\/(\d+)$/);
    const ghNumber = ghNumMatch ? ghNumMatch[1] : '0';

    const updated = content.replace(/^---\n/, `---\ngithub_issue: ${ghNumber}\n`);
    fs.writeFileSync(fullPath, updated, 'utf8');

    return json({ ok: true, url: ghOutput, number: parseInt(ghNumber, 10) });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'internal server error' }, { status: 500 });
  }
}
