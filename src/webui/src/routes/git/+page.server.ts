import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

const REPO = process.env.DOCWRIGHT_ROOT ?? resolve(process.cwd(), '../..');

function git(cmd: string): string {
  try {
    return execSync(`git ${cmd}`, { cwd: REPO, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

export function load() {
  const branch = git('rev-parse --abbrev-ref HEAD') || 'unknown';
  const remote = git(`config branch.${branch}.remote`) || 'origin';
  const remote_branch = `${remote}/${branch}`;

  const ahead = parseInt(git(`rev-list --count ${remote_branch}..HEAD`) || '0', 10);
  const behind = parseInt(git(`rev-list --count HEAD..${remote_branch}`) || '0', 10);

  // Get last 30 commits: hash | author | date | subject
  const logFormat = '%h|%an|%ad|%s';
  const logRaw = git(`log -n 30 --pretty=format:"${logFormat}" --date=relative`);
  const commits = logRaw.split('\n').filter(Boolean).map(line => {
    const [hash, author, date, subject] = line.split('|');
    return { hash: hash || '', author: author || '', date: date || '', subject: subject || '' };
  });

  const latestTag = git('describe --tags --abbrev=0 2>/dev/null') || '';

  return {
    branch,
    remote,
    ahead,
    behind,
    commits,
    latestTag,
  };
}
