#!/usr/bin/env tsx
import * as fs from 'node:fs';
import * as path from 'node:path';

interface MigrationSection {
  version: string;
  body: string;
  raw: string;
}

function usage() {
  console.log(`Usage: npm run vault:migrate -- --vault /path/to/vault --to v1 [--from v0]

Migrates a DocWright vault's configuration schema version.
Reads MIGRATION.md and applies pending migration steps.

Options:
  --vault         Path to the vault root (required)
  --to            Target schema version (required)
  --from          Starting version (default: reads from .docwright/config.json)
  --help          Show this help
`);
}

function parseArgs() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) { usage(); process.exit(0); }

  let vault = '';
  let to = '';
  let from: string | null = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--vault') vault = path.resolve(args[++i]);
    else if (args[i] === '--to') to = args[++i];
    else if (args[i] === '--from') from = args[++i];
    else { console.error(`Unknown option: ${args[i]}`); usage(); process.exit(1); }
  }

  if (!vault) { console.error('Error: --vault is required'); usage(); process.exit(1); }
  if (!to) { console.error('Error: --to is required'); usage(); process.exit(1); }

  return { vault, to, from };
}

function readConfig(vault: string): { schema_version: string | null } {
  const configPath = path.join(vault, '.docwright', 'config.json');
  if (!fs.existsSync(configPath)) {
    return { schema_version: null };
  }
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch {
    console.error(`Warning: could not parse ${configPath}, treating as unversioned`);
    return { schema_version: null };
  }
}

function writeConfig(vault: string, version: string) {
  const configDir = path.join(vault, '.docwright');
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  const configPath = path.join(configDir, 'config.json');
  const existing = fs.existsSync(configPath)
    ? JSON.parse(fs.readFileSync(configPath, 'utf8'))
    : {};
  existing.schema_version = version;
  fs.writeFileSync(configPath, JSON.stringify(existing, null, 2) + '\n', 'utf8');
}

function findMigrationDoc(vault: string): string | null {
  const vaultMigPath = path.join(vault, 'MIGRATION.md');
  if (fs.existsSync(vaultMigPath)) return vaultMigPath;
  const rootMigPath = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'MIGRATION.md');
  if (fs.existsSync(rootMigPath)) return rootMigPath;
  return null;
}

function parseMigrationSections(content: string): MigrationSection[] {
  const sections: MigrationSection[] = [];
  const headingRegex = /^##\s+v(\S+)\s+\(BREAKING\)\s*$/gm;
  let match: RegExpExecArray | null;

  while ((match = headingRegex.exec(content)) !== null) {
    const version = match[1];
    const sectionStart = match.index;
    const nextMatch = headingRegex.exec(content);
    const sectionEnd = nextMatch ? nextMatch.index : content.length;
    headingRegex.lastIndex = nextMatch ? nextMatch.index : content.length;

    const raw = content.slice(sectionStart, sectionEnd).trim();
    const body = content.slice(match.index + match[0].length, sectionEnd).trim();
    sections.push({ version, body, raw });
  }

  return sections;
}

function compareVersions(a: string, b: string): number {
  const aNum = parseInt(a.replace(/^v/, ''), 10);
  const bNum = parseInt(b.replace(/^v/, ''), 10);
  if (isNaN(aNum) || isNaN(bNum)) return a.localeCompare(b);
  return aNum - bNum;
}

function main() {
  const { vault, to, from } = parseArgs();

  if (!fs.existsSync(vault)) {
    console.error(`Error: vault path "${vault}" does not exist`);
    process.exit(1);
  }

  const currentVersion = from ?? readConfig(vault).schema_version;
  const migPath = findMigrationDoc(vault);

  if (!migPath) {
    console.error('Error: no MIGRATION.md found in vault or DocWright root');
    process.exit(1);
  }

  const content = fs.readFileSync(migPath, 'utf8');
  const sections = parseMigrationSections(content);

  if (sections.length === 0) {
    console.log('No migration sections found in MIGRATION.md — nothing to do.');
    process.exit(0);
  }

  if (currentVersion === to) {
    console.log(`Already at version ${to} — nothing to do.`);
    process.exit(0);
  }

  const applySections = sections.filter(s => {
    const cv = currentVersion ?? '0';
    return compareVersions(s.version, cv) > 0 && compareVersions(s.version, to) <= 0;
  }).sort((a, b) => compareVersions(a.version, b.version));

  if (applySections.length === 0) {
    console.log(`No migration steps needed (current: ${currentVersion ?? 'none'}, target: ${to}).`);
    writeConfig(vault, to);
    console.log(`  ✓ .docwright/config.json schema_version → ${to}`);
    process.exit(0);
  }

  console.log(`Migrating vault at ${vault}`);
  console.log(`  From: ${currentVersion ?? 'unversioned'}`);
  console.log(`  To:   ${to}`);
  console.log('');

  for (const section of applySections) {
    console.log(`  Applying v${section.version}...`);

    const changes = section.body.match(/^- (.+)$/gm);
    if (changes) {
      for (const change of changes) {
        const desc = change.replace(/^- /, '');
        console.log(`    ${desc}`);
      }
    }

    const runMatch = section.body.match(/`npm run vault:migrate[^`]+`/);
    if (runMatch) {
      console.log(`    ↳ This migration has its own sub-commands.`);
    }
  }

  writeConfig(vault, to);
  console.log(`\n  ✓ .docwright/config.json schema_version → ${to}`);
  console.log(`\n✅ Migration to ${to} complete.`);
  console.log('Vault content (proposals, plans, docs) was NOT modified.');
}

main();
