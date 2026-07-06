import * as fs from 'node:fs';
import { writeFile } from './paths';
import { getHumanIdentity } from './identity';

interface Deliverable {
  title: string;
  description?: string;
  acceptance_criteria?: string[];
}

function slugify(text: string): string {
  return text.toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 50);
}

function generateIssueFilename(deliverable: Deliverable, existingIssues: Set<string>): string {
  const base = slugify(deliverable.title);
  let candidate = `collaboration-${base}`;
  let counter = 1;

  while (existingIssues.has(`${candidate}.md`)) {
    candidate = `collaboration-${base}-${counter}`;
    counter++;
  }

  return `${candidate}.md`;
}

function buildIssueFrontmatter(
  deliverable: Deliverable,
  planFilename: string,
  planPath: string,
  identity: string,
  today: string,
): string {
  const lines: string[] = [
    '---',
    `title: ${deliverable.title}`,
    'status: new',
    'author: NetYeti',
    'author-role: contributor',
    `created: ${today}`,
    `created_by: ${identity}`,
    'category: feature',
    'priority: high',
    'complexity: M',
    'estimated_effort: M',
    `plan: ${planFilename}`,
    `cross_link: ${planPath}`,
    'github_issue: null',
    'channel: dev',
    'tags:',
    '  - collaboration',
    '---',
  ];
  return lines.join('\n');
}

function buildIssueBody(deliverable: Deliverable): string {
  const title = deliverable.title;
  let body = `# ${title}\n\n`;

  if (deliverable.description) {
    body += `## Description\n\n${deliverable.description}\n\n`;
  }

  if (deliverable.acceptance_criteria && deliverable.acceptance_criteria.length > 0) {
    body += `## Acceptance Criteria\n\n`;
    for (const criterion of deliverable.acceptance_criteria) {
      body += `- [ ] ${criterion}\n`;
    }
    body += '\n';
  }

  return body;
}

export function generateIssuesFromDeliverables(
  planFilename: string,
  planPath: string,
  deliverables: Deliverable[],
): string[] {
  if (!deliverables || deliverables.length === 0) {
    return [];
  }

  const identity = getHumanIdentity();
  const today = new Date().toISOString().split('T')[0];

  // Get existing issue filenames to avoid collisions
  let existingIssues = new Set<string>();
  try {
    const issueDir = 'issues';
    const dirContent = require('node:fs').readdirSync(issueDir);
    existingIssues = new Set(dirContent);
  } catch {
    // Directory might not exist or be readable; continue with empty set
  }

  const generatedPaths: string[] = [];

  for (const deliverable of deliverables) {
    if (!deliverable.title) continue; // Skip deliverables without title

    const issueFilename = generateIssueFilename(deliverable, existingIssues);
    const issuePath = `issues/${issueFilename}`;

    const frontmatter = buildIssueFrontmatter(deliverable, planFilename, planPath, identity, today);
    const body = buildIssueBody(deliverable);
    const content = `${frontmatter}\n\n${body}`;

    writeFile(issuePath, content);
    generatedPaths.push(issuePath);
    existingIssues.add(issueFilename);
  }

  return generatedPaths;
}
