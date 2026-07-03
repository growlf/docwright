import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { json } from '@sveltejs/kit';

const REPO = process.env.DOCWRIGHT_ROOT ?? resolve(process.cwd(), '../..');

function git(cmd: string): string {
  try {
    return execSync(`git ${cmd}`, { cwd: REPO, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trimEnd();
  } catch { return ''; }
}

function gitLines(cmd: string): string[] {
  return git(cmd).split('\n').filter(Boolean);
}

export function GET() {
  const branch  = git('rev-parse --abbrev-ref HEAD') || 'unknown';
  const remote  = git(`config branch.${branch}.remote`) || 'origin';
  const remote_branch = `${remote}/${branch}`;

  // Fetch is intentionally skipped — we show local state only (fast, no network)
  const ahead  = parseInt(git(`rev-list --count ${remote_branch}..HEAD`) || '0', 10);
  const behind = parseInt(git(`rev-list --count HEAD..${remote_branch}`) || '0', 10);

  // Status: X Y filename — X=index, Y=worktree
  const statusRaw = gitLines('status --porcelain');
  const modified:  string[] = [];
  const staged:    string[] = [];
  const untracked: string[] = [];
  const statuses:  Record<string, { x: string; y: string }> = {};

  for (const line of statusRaw) {
    const x = line[0], y = line[1], f = line.slice(3);
    statuses[f] = { x, y };
    if (x === '?' && y === '?') { untracked.push(f); continue; }
    if (x !== ' ' && x !== '?') staged.push(f);
    if (y !== ' ' && y !== '?') modified.push(f);
  }

  const latestTag = git('describe --tags --abbrev=0 2>/dev/null') || '';

  // Get recent 5 commits: sha & subject
  const commitsRaw = gitLines('log -n 5 --pretty=format:"%h %s"');
  const commits = commitsRaw.map(line => {
    const space = line.indexOf(' ');
    if (space === -1) return { sha: line, message: '' };
    return {
      sha: line.slice(0, space),
      message: line.slice(space + 1)
    };
  });

  return json({ branch, ahead, behind, modified, staged, untracked, latestTag, commits, statuses });
}
