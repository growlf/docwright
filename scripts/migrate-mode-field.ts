#!/usr/bin/env tsx
/**
 * scripts/migrate-mode-field.ts
 * Migrate plan frontmatter: automated: off|guided|full → mode: mentor|guided|autonomous
 *
 * Mapping:
 *   automated: off    → mode: mentor
 *   automated: guided → mode: guided
 *   automated: full   → mode: autonomous
 *   automated: false  → mode: mentor   (invalid legacy value, treated as off)
 *   (any other value) → mode: mentor   (safe fallback)
 *
 * Usage:
 *   npm run migrate:mode-field              # dry-run (shows changes, writes nothing)
 *   npm run migrate:mode-field -- --fix     # apply changes
 *   npm run migrate:mode-field -- --dir plans/completed  # specific directory
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

const VALUE_MAP: Record<string, string> = {
  off:    'mentor',
  guided: 'guided',
  full:   'autonomous',
  false:  'mentor',   // invalid legacy value
};

function usage() {
  console.log('Usage: npm run migrate:mode-field [-- --fix] [-- --dir <path>]');
  console.log('       Default: dry-run. Pass --fix to apply changes.');
}

function parseArgs() {
  const args = process.argv.slice(2);
  const fix  = args.includes('--fix');
  const dirs: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dir') dirs.push(path.resolve(args[++i]));
    if (args[i] === '--help') { usage(); process.exit(0); }
  }
  if (!dirs.length) {
    dirs.push(
      path.resolve(process.cwd(), 'plans'),
      path.resolve(process.cwd(), 'plans', 'completed'),
    );
  }
  return { fix, dirs };
}

function findPlanFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.md'))
    .map(f => path.join(dir, f));
}

function migrateFile(filePath: string, fix: boolean): { changed: boolean; from: string; to: string } | null {
  const content = fs.readFileSync(filePath, 'utf8');
  const match   = content.match(/^(---\n[\s\S]*?\n---)/);
  if (!match) return null;

  const fm = match[1];
  const autoMatch = fm.match(/^automated:\s*(.+)$/m);
  if (!autoMatch) return null;

  const oldVal  = autoMatch[1].trim().replace(/^['"]|['"]$/g, '');
  const newVal  = VALUE_MAP[oldVal] ?? 'mentor';
  const newFm   = fm
    .replace(/^automated:.*$/m, `mode: ${newVal}`)
    .replace(/\nscenario_synthesis: >\n/, '\nscenario_synthesis: >\n');  // preserve block scalar

  if (newFm === fm) return null;  // no change (shouldn't happen but guard)

  if (fix) {
    fs.writeFileSync(filePath, content.replace(fm, newFm), 'utf8');
  }

  return { changed: true, from: `automated: ${oldVal}`, to: `mode: ${newVal}` };
}

function main() {
  const { fix, dirs } = parseArgs();

  if (!fix) {
    console.log('DRY RUN — pass --fix to apply. Showing planned changes:\n');
  } else {
    console.log('APPLYING CHANGES:\n');
  }

  let total = 0, changed = 0;
  const summary: Record<string, number> = {};

  for (const dir of dirs) {
    for (const file of findPlanFiles(dir)) {
      total++;
      const result = migrateFile(file, fix);
      if (result) {
        changed++;
        const rel = path.relative(process.cwd(), file);
        console.log(`  ${fix ? '✓' : '→'} ${rel}: ${result.from} → ${result.to}`);
        summary[result.to] = (summary[result.to] ?? 0) + 1;
      }
    }
  }

  console.log(`\n${fix ? 'Updated' : 'Would update'} ${changed}/${total} plan files.`);
  if (Object.keys(summary).length) {
    for (const [val, count] of Object.entries(summary).sort()) {
      console.log(`  mode: ${val} × ${count}`);
    }
  }
  if (!fix && changed > 0) {
    console.log('\nRun with --fix to apply.');
  }
}

main();
