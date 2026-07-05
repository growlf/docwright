#!/usr/bin/env tsx
/**
 * Reads all .opencode/skills/*\/SKILL.md files and regenerates the
 * "## Available skills" table in CLAUDE.md.
 *
 * Run: npm run sync:skills
 * Also runs as part of CI cross-tool compatibility check.
 */

import fs from 'fs';
import path from 'path';
import { parseFrontmatter } from '../src/dispatch/frontmatter';

const REPO_ROOT = path.resolve(__dirname, '..');
const SKILLS_DIR = path.join(REPO_ROOT, '.opencode', 'skills');
const CLAUDE_MD = path.join(REPO_ROOT, 'CLAUDE.md');

const TABLE_START = '<!-- skills-table-start -->';
const TABLE_END = '<!-- skills-table-end -->';

interface SkillMeta {
  name: string;
  description: string;
  dir: string;
}

function loadSkills(): SkillMeta[] {
  const entries = fs.readdirSync(SKILLS_DIR, { withFileTypes: true });
  const skills: SkillMeta[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const skillFile = path.join(SKILLS_DIR, entry.name, 'SKILL.md');
    if (!fs.existsSync(skillFile)) continue;

    const content = fs.readFileSync(skillFile, 'utf-8');
    const fm = parseFrontmatter(content);

    if (!fm.name || !fm.description) {
      console.error(`[sync-claude-skills] SKIP ${entry.name}: missing name or description in frontmatter`);
      continue;
    }
    if (fm.name !== entry.name) {
      console.error(`[sync-claude-skills] WARN ${entry.name}: frontmatter name "${fm.name}" does not match directory name`);
    }

    skills.push({
      name: fm.name,
      description: fm.description,
      dir: entry.name,
    });
  }

  return skills.sort((a, b) => a.name.localeCompare(b.name));
}

function buildTable(skills: SkillMeta[]): string {
  const rows = skills.map(s => {
    const skillPath = `.opencode/skills/${s.dir}/SKILL.md`;
    return `| \`${s.name}\` | ${s.description} | [\`${skillPath}\`](${skillPath}) |`;
  });

  return [
    TABLE_START,
    '',
    'DocWright ships workflow skills under `.opencode/skills/`. Each directory',
    'contains a `SKILL.md` with detection heuristics and step-by-step instructions.',
    'When a task matches a skill\'s triggers, read its `SKILL.md` and follow the process.',
    '',
    '> **Auto-generated** by `scripts/sync-claude-skills.ts`. Do not edit manually.',
    '> Run `npm run sync:skills` after adding, removing, or renaming a skill.',
    '',
    '| Skill | Description | SKILL.md |',
    '|-------|-------------|----------|',
    ...rows,
    '',
    TABLE_END,
  ].join('\n');
}

function updateClaudeMd(newTable: string): boolean {
  const content = fs.readFileSync(CLAUDE_MD, 'utf-8');

  if (content.includes(TABLE_START) && content.includes(TABLE_END)) {
    const updated = content.replace(
      new RegExp(`${TABLE_START}[\\s\\S]*?${TABLE_END}`),
      newTable
    );
    if (updated === content) return false;
    fs.writeFileSync(CLAUDE_MD, updated, 'utf-8');
    return true;
  }

  // No markers yet — replace the old static section
  const sectionHeader = '## Available skills';
  const nextSection = /\n## /;
  const start = content.indexOf(sectionHeader);
  if (start === -1) {
    console.error('[sync-claude-skills] ERROR: Could not find "## Available skills" in CLAUDE.md');
    process.exit(1);
  }

  const afterHeader = content.indexOf('\n', start) + 1;
  const rest = content.slice(afterHeader);
  const nextIdx = rest.search(nextSection);
  const end = nextIdx === -1 ? content.length : afterHeader + nextIdx;

  const updated = content.slice(0, start) +
    `${sectionHeader}\n\n${newTable}\n` +
    content.slice(end);

  fs.writeFileSync(CLAUDE_MD, updated, 'utf-8');
  return true;
}

function main() {
  const skills = loadSkills();
  if (skills.length === 0) {
    console.error('[sync-claude-skills] No skills found in', SKILLS_DIR);
    process.exit(1);
  }

  const table = buildTable(skills);
  const changed = updateClaudeMd(table);

  if (changed) {
    console.log(`[sync-claude-skills] Updated CLAUDE.md with ${skills.length} skills:`);
    skills.forEach(s => console.log(`  - ${s.name}: ${s.description}`));
  } else {
    console.log(`[sync-claude-skills] CLAUDE.md is already up to date (${skills.length} skills).`);
  }
}

main();
