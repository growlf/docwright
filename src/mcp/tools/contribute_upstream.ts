import { getRepoRoot } from '../lib/paths';
import { getHumanIdentity } from '../lib/identity';
import { getMode } from '../lib/mode';
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import * as fs from 'node:fs';

const VALID_CATEGORIES = ['bug', 'feature-request', 'ux-friction', 'docs-gap', 'suggestion'];

function sanitize(input: string, maxLength: number): string {
  return input
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function getDocWrightVersion(): string {
  try {
    const root = getRepoRoot();
    if (!root) return '0.0.0';
    const pkgPath = path.join(root, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    return pkg.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

function getRepoSlug(): string {
  try {
    const root = getRepoRoot();
    if (!root) return 'growlf/docwright';
    const result = spawnSync('git', ['remote', 'get-url', 'origin'], {
      cwd: root,
      encoding: 'utf8',
    });
    if (result.status !== 0) return 'growlf/docwright';
    const url = result.stdout.trim();
    const sshMatch = url.match(/^git@[^:]+:(.+?)(?:\.git)?$/);
    if (sshMatch) return sshMatch[1];
    const httpsMatch = url.match(/^https?:\/\/[^/]+\/(.+?)(?:\.git)?$/);
    if (httpsMatch) return httpsMatch[1];
    return 'growlf/docwright';
  } catch {
    return 'growlf/docwright';
  }
}

function logContribution(entry: Record<string, string>): void {
  try {
    const root = getRepoRoot();
    if (!root) return;
    const logPath = path.join(root, '.docwright', 'contributions.log');
    const dir = path.dirname(logPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(logPath, JSON.stringify(entry) + '\n', 'utf8');
  } catch {
    // silently fail
  }
}

function buildPrefillUrl(
  repoSlug: string,
  title: string,
  body: string,
  category: string,
): string {
  const params = new URLSearchParams({
    title,
    body,
    labels: [category, 'contribution-pipeline'].join(','),
  });
  return `https://github.com/${repoSlug}/issues/new?${params.toString()}`;
}

export async function contributeUpstream(
  title: string,
  description: string,
  category: string = 'bug',
): Promise<string> {
  if (getMode() !== 'upstream') {
    return 'ERROR: contribute_upstream is only available in upstream mode (--mode=upstream).';
  }

  if (process.env.DOCWRIGHT_CONTRIB_APPROVED !== '1') {
    return 'ERROR: DOCWRIGHT_CONTRIB_APPROVED is not set to "1". This gate must be set by a human.';
  }

  const sanitizedTitle = sanitize(title, 200);
  if (!sanitizedTitle) {
    return 'ERROR: title is required and must be non-empty after sanitization.';
  }

  const sanitizedCategory = VALID_CATEGORIES.includes(category) ? category : 'bug';
  const sanitizedDesc = sanitize(description, 5000) || '(no description provided)';

  const version = getDocWrightVersion();
  const actor = getHumanIdentity();
  const repoSlug = getRepoSlug();

  const body = [
    `**DocWright Version:** ${version}`,
    `**Category:** ${sanitizedCategory}`,
    `**Submitted By:** ${actor}`,
    '',
    sanitizedDesc,
  ].join('\n');

  const githubToken = process.env.DOCWRIGHT_GITHUB_TOKEN;
  let issueUrlOrPrefill: string;

  if (githubToken) {
    try {
      const response = await fetch(
        `https://api.github.com/repos/${repoSlug}/issues`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${githubToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/vnd.github.v3+json',
          },
          body: JSON.stringify({
            title: sanitizedTitle,
            body,
            labels: [sanitizedCategory, 'contribution-pipeline'],
          }),
        },
      );

      if (!response.ok) {
        const errText = await response.text();
        issueUrlOrPrefill = buildPrefillUrl(repoSlug, sanitizedTitle, body, sanitizedCategory);
      } else {
        const data: any = await response.json();
        issueUrlOrPrefill = data.html_url;
      }
    } catch {
      issueUrlOrPrefill = buildPrefillUrl(repoSlug, sanitizedTitle, body, sanitizedCategory);
    }
  } else {
    issueUrlOrPrefill = buildPrefillUrl(repoSlug, sanitizedTitle, body, sanitizedCategory);
  }

  logContribution({
    ts: new Date().toISOString(),
    title: sanitizedTitle,
    category: sanitizedCategory,
    docwright_version: version,
    issue_url_or_prefill: issueUrlOrPrefill,
    actor,
  });

  if (issueUrlOrPrefill.includes('/issues/')) {
    return `✅ GitHub issue created: ${issueUrlOrPrefill}`;
  }
  return `⚠ No GitHub token configured. Open this URL to submit:\n${issueUrlOrPrefill}`;
}
