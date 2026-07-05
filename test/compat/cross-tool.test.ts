import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { strict as assert } from 'assert';
import { describe, it } from 'mocha';
import { spawnSync } from 'child_process';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SKILLS_DIR = path.join(REPO_ROOT, '.opencode', 'skills');
const CLAUDE_MD = path.join(REPO_ROOT, 'CLAUDE.md');
const TABLE_START = '<!-- skills-table-start -->';
const TABLE_END = '<!-- skills-table-end -->';

function parseFrontmatter(content: string): Record<string, string> {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const result: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim();
    const val = line.slice(colon + 1).trim().replace(/^["']|["']$/g, '');
    if (key && val) result[key] = val;
  }
  return result;
}

function getSkillDirs(): string[] {
  return fs.readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter(e => e.isDirectory())
    .map(e => e.name);
}

function getClaudeMdTable(): string {
  const content = fs.readFileSync(CLAUDE_MD, 'utf-8');
  const start = content.indexOf(TABLE_START);
  const end = content.indexOf(TABLE_END);
  if (start === -1 || end === -1) return '';
  return content.slice(start, end + TABLE_END.length);
}

describe('Cross-tool compatibility', () => {

  describe('Skill format', () => {
    it('every skill directory contains a SKILL.md', () => {
      const dirs = getSkillDirs();
      assert.ok(dirs.length > 0, 'No skill directories found');
      for (const dir of dirs) {
        const skillFile = path.join(SKILLS_DIR, dir, 'SKILL.md');
        assert.ok(fs.existsSync(skillFile), `Missing SKILL.md in .opencode/skills/${dir}/`);
      }
    });

    it('every SKILL.md has required frontmatter: name and description', () => {
      for (const dir of getSkillDirs()) {
        const skillFile = path.join(SKILLS_DIR, dir, 'SKILL.md');
        const content = fs.readFileSync(skillFile, 'utf-8');
        const fm = parseFrontmatter(content);
        assert.ok(fm.name, `.opencode/skills/${dir}/SKILL.md is missing "name:" in frontmatter`);
        assert.ok(fm.description, `.opencode/skills/${dir}/SKILL.md is missing "description:" in frontmatter`);
      }
    });

    it('every SKILL.md name matches its directory name', () => {
      for (const dir of getSkillDirs()) {
        const skillFile = path.join(SKILLS_DIR, dir, 'SKILL.md');
        const content = fs.readFileSync(skillFile, 'utf-8');
        const fm = parseFrontmatter(content);
        assert.equal(
          fm.name, dir,
          `.opencode/skills/${dir}/SKILL.md: frontmatter name="${fm.name}" does not match directory "${dir}"`
        );
      }
    });
  });

  describe('CLAUDE.md skills table', () => {
    it('CLAUDE.md contains auto-generated skills table markers', () => {
      const content = fs.readFileSync(CLAUDE_MD, 'utf-8');
      assert.ok(
        content.includes(TABLE_START),
        'CLAUDE.md is missing <!-- skills-table-start --> marker. Run: npm run sync:skills'
      );
      assert.ok(
        content.includes(TABLE_END),
        'CLAUDE.md is missing <!-- skills-table-end --> marker. Run: npm run sync:skills'
      );
    });

    it('every skill in .opencode/skills/ appears in the CLAUDE.md table', () => {
      const table = getClaudeMdTable();
      assert.ok(table, 'CLAUDE.md skills table not found');
      for (const dir of getSkillDirs()) {
        assert.ok(
          table.includes(`\`${dir}\``),
          `Skill "${dir}" is missing from CLAUDE.md skills table. Run: npm run sync:skills`
        );
      }
    });

    it('CLAUDE.md table has no entries for skills that no longer exist', () => {
      const table = getClaudeMdTable();
      const dirs = new Set(getSkillDirs());
      // Extract skill names from table rows: | `skill-name` | ...
      const rows = table.match(/\| `([^`]+)` \|/g) || [];
      for (const row of rows) {
        const match = row.match(/\| `([^`]+)` \|/);
        if (!match) continue;
        const name = match[1];
        assert.ok(
          dirs.has(name),
          `CLAUDE.md table references skill "${name}" but .opencode/skills/${name}/ does not exist. Run: npm run sync:skills`
        );
      }
    });

    it('every SKILL.md path link in the table points to an existing file', () => {
      const table = getClaudeMdTable();
      const links = table.match(/\(\.opencode\/skills\/[^)]+\)/g) || [];
      for (const link of links) {
        const relPath = link.slice(1, -1);
        const absPath = path.join(REPO_ROOT, relPath);
        assert.ok(
          fs.existsSync(absPath),
          `CLAUDE.md table links to ${relPath} but the file does not exist`
        );
      }
    });
  });

  describe('Agent role contract', () => {
    it('docs/specs/agent-roles.md exists', () => {
      const agentRoles = path.join(REPO_ROOT, 'docs', 'specs', 'agent-roles.md');
      assert.ok(fs.existsSync(agentRoles), 'docs/specs/agent-roles.md is missing');
    });

    it('agent-roles.md defines orchestrator, code, and reviewer roles', () => {
      const agentRoles = path.join(REPO_ROOT, 'docs', 'specs', 'agent-roles.md');
      if (!fs.existsSync(agentRoles)) return;
      const content = fs.readFileSync(agentRoles, 'utf-8');
      assert.ok(content.includes('orchestrator'), 'agent-roles.md does not define the "orchestrator" role');
      assert.ok(content.includes('`code`'), 'agent-roles.md does not define the "code" role');
      assert.ok(content.includes('reviewer'), 'agent-roles.md does not define the "reviewer" role');
    });
  });

  describe('Skill format spec', () => {
    it('docs/specs/skill-format.md exists', () => {
      const specFile = path.join(REPO_ROOT, 'docs', 'specs', 'skill-format.md');
      assert.ok(fs.existsSync(specFile), 'docs/specs/skill-format.md is missing');
    });
  });

  describe('Source-repo gitignore safety', () => {
    // In adopted vaults the skill bridge dirs are managed copies and get
    // gitignored by adopt-vault.ts. In THIS repo they are canonical source —
    // if they ever match an ignore rule, new skills silently never reach git
    // (this happened: docwright-issue-workflow was dropped for a week).
    // git check-ignore works on hypothetical paths, so probes need not exist.
    const probes = [
      '.opencode/skills/__probe__/SKILL.md',
      '.claude/skills/__probe__.md',
      '.opencode/agents/__probe__.md',
      '.gemini/settings.json',
    ];

    for (const probe of probes) {
      it(`${probe.split('/').slice(0, 2).join('/')} is not gitignored`, () => {
        const res = spawnSync('git', ['check-ignore', '--no-index', probe], {
          cwd: REPO_ROOT, encoding: 'utf-8',
        });
        assert.notEqual(
          res.status, 0,
          `"${probe}" is gitignored (matched: ${res.stdout.trim()}). ` +
          'Canonical skill/agent dirs must stay tracked in the DocWright source repo.'
        );
      });
    }
  });

});
