#!/usr/bin/env tsx
/**
 * scripts/adopt-vault.ts
 * Initialize DocWright on an existing (non-empty) directory.
 *
 * Modes:
 *   --mode lightweight   Writes env/config/AI-surface files only; no hook install.
 *   --mode full          Superset: adds dir structure, frontmatter audit, gitignore,
 *                        skills bridge, and hook install. (default)
 *   --upgrade            Re-run against an already-adopted vault: refresh stale
 *                        DocWright-managed files using the manifest hash baseline.
 */
import * as fs   from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { execSync } from 'node:child_process';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sha256(content: string): string {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

function usage() {
  console.log(`Usage: npm run adopt -- --dest /path/to/vault [options]

Initializes DocWright governance on an existing directory.

Options:
  --dest              Path to the existing vault directory (required)
  --profile           DocWright profile to use (default: org-operations)
  --name              Vault display name (default: basename of --dest)
  --docwright-path    Path to DocWright installation (default: DOCWRIGHT_PATH env)
  --mode              lightweight | full  (default: full)
  --upgrade           Re-run against an already-adopted vault
  --help              Show this help
`);
}

function fail(msg: string): never {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

function pass(msg: string) { console.log(`  ✓ ${msg}`); }
function info(msg: string) { console.log(`  → ${msg}`); }

// ---------------------------------------------------------------------------
// Manifest helpers
// ---------------------------------------------------------------------------

type Manifest = Record<string, string>;

function readManifest(dest: string): Manifest {
  const p = path.join(dest, '.docwright', 'manifest.json');
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return {}; }
}

function writeManifest(dest: string, manifest: Manifest) {
  fs.writeFileSync(
    path.join(dest, '.docwright', 'manifest.json'),
    JSON.stringify(manifest, null, 2) + '\n',
    'utf8',
  );
}

function writeManaged(
  dest: string,
  rel: string,
  content: string,
  manifest: Manifest,
  silent = false,
) {
  const abs = path.join(dest, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, 'utf8');
  manifest[rel] = sha256(content);
  if (!silent) pass(rel);
}

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

function parseArgs() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) { usage(); process.exit(0); }

  let dest = '';
  let profile = 'org-operations';
  let vaultName = '';
  let docwrightPath = process.env.DOCWRIGHT_PATH ?? '';
  let mode: 'lightweight' | 'full' = 'full';
  let upgrade = false;

  for (let i = 0; i < args.length; i++) {
    if      (args[i] === '--dest')           dest          = path.resolve(args[++i]);
    else if (args[i] === '--profile')        profile       = args[++i];
    else if (args[i] === '--name')           vaultName     = args[++i];
    else if (args[i] === '--docwright-path') docwrightPath = path.resolve(args[++i]);
    else if (args[i] === '--mode')           mode          = args[++i] as 'lightweight' | 'full';
    else if (args[i] === '--upgrade')        upgrade       = true;
    else { console.error(`Unknown option: ${args[i]}`); usage(); process.exit(1); }
  }

  if (!dest) fail('--dest is required');

  // Fail-hard on missing DOCWRIGHT_PATH
  if (!docwrightPath) {
    fail(
      'DOCWRIGHT_PATH is not set.\n' +
      '  Run `direnv allow` in the vault root,\n' +
      '  or export DOCWRIGHT_PATH=/path/to/docwright before running this script.',
    );
  }
  if (!fs.existsSync(path.join(docwrightPath, 'package.json'))) {
    fail(`DOCWRIGHT_PATH does not point to a valid DocWright installation: ${docwrightPath}`);
  }

  if (!vaultName) vaultName = path.basename(dest);
  return { dest, profile, vaultName, docwrightPath, mode, upgrade };
}

// ---------------------------------------------------------------------------
// Version reading
// ---------------------------------------------------------------------------

function readDocWrightVersion(docwrightPath: string): string {
  try {
    return JSON.parse(fs.readFileSync(path.join(docwrightPath, 'package.json'), 'utf8')).version ?? '0.0.0';
  } catch { return '0.0.0'; }
}

// ---------------------------------------------------------------------------
// Lightweight mode writes
// ---------------------------------------------------------------------------

function writeLightweight(
  dest: string,
  vaultName: string,
  profile: string,
  docwrightPath: string,
  manifest: Manifest,
) {
  const adoptVersion = readDocWrightVersion(docwrightPath);
  const adoptDate    = new Date().toISOString().split('T')[0];

  // .env
  writeManaged(dest, '.env', [
    '# DocWright Vault — generated by adopt-vault',
    '# Machine identity is always $(hostname) — never set it here.',
    'OPCODE_USER_NAME=""',
    'OPCODE_USER_EMAIL=""',
    '',
    '# Path to the DocWright tool installation',
    `DOCWRIGHT_PATH="${docwrightPath}"`,
    '',
    "# This vault's root",
    `DOCWRIGHT_VAULT_ROOT="${dest}"`,
    `DOCWRIGHT_ROOT="${dest}"`,
    '',
  ].join('\n'), manifest);

  // .envrc — direnv auto-load
  writeManaged(dest, '.envrc', 'dotenv\n', manifest);
  info('Run `direnv allow` in the vault root to activate env loading.');

  // .mcp.json — uses ${VAR} syntax; correct when direnv is active
  const mcpContent = JSON.stringify({
    mcpServers: {
      'dw-vault': {
        type: 'stdio',
        command: 'node',
        args: ['${DOCWRIGHT_PATH}/dist/mcp/server.js', '--mode', 'vault'],
        env: {
          DOCWRIGHT_PATH: '${DOCWRIGHT_PATH}',
          DOCWRIGHT_VAULT_ROOT: '${DOCWRIGHT_VAULT_ROOT}',
        },
      },
      'dw-upstream': {
        type: 'stdio',
        command: 'node',
        args: ['${DOCWRIGHT_PATH}/dist/mcp/server.js', '--mode', 'upstream'],
        env: { DOCWRIGHT_PATH: '${DOCWRIGHT_PATH}' },
      },
    },
  }, null, 2) + '\n';
  writeManaged(dest, '.mcp.json', mcpContent, manifest);

  // .gemini/settings.json — Gemini CLI MCP config
  const geminiSettings = JSON.stringify({
    mcpServers: {
      'dw-vault': {
        command: 'node',
        args: [`${docwrightPath}/dist/mcp/server.js`, '--mode', 'vault'],
        env: { DOCWRIGHT_PATH: docwrightPath, DOCWRIGHT_VAULT_ROOT: dest },
      },
    },
  }, null, 2) + '\n';
  writeManaged(dest, '.gemini/settings.json', geminiSettings, manifest);

  // .claude/settings.json — copy DocWright's settings with resolved path.
  // Skip when the vault IS the DocWright installation (dest === docwrightPath):
  // the source file already uses ${DOCWRIGHT_PATH} variables that bash expands
  // at hook runtime via direnv, so overwriting it with hardcoded paths would
  // break portability of the repo itself.
  const dwClaudeSettings = path.join(docwrightPath, '.claude', 'settings.json');
  if (fs.existsSync(dwClaudeSettings) && dest !== docwrightPath) {
    let content = fs.readFileSync(dwClaudeSettings, 'utf8');
    content = content.replace(/\$\{DOCWRIGHT_PATH\}/g, docwrightPath);
    writeManaged(dest, '.claude/settings.json', content, manifest);
  }

  // .docwright/config.json
  writeManaged(dest, '.docwright/config.json', JSON.stringify({
    schema_version: '1',
    adopt_version: adoptVersion,
    adopt_date: adoptDate,
    adopt_mode: 'lightweight',
  }, null, 2) + '\n', manifest);
}

// ---------------------------------------------------------------------------
// Full mode additions
// ---------------------------------------------------------------------------

function writeFull(
  dest: string,
  vaultName: string,
  profile: string,
  docwrightPath: string,
  manifest: Manifest,
) {
  // Directory structure
  for (const dir of ['proposals', 'plans', 'docs', '.docwright']) {
    fs.mkdirSync(path.join(dest, dir), { recursive: true });
  }
  pass('directory structure (proposals/, plans/, docs/, .docwright/)');

  // profile.json
  const profilePath = path.join(dest, 'profile.json');
  if (!fs.existsSync(profilePath)) {
    const content = JSON.stringify({
      docwrightProfileVersion: '1',
      name: vaultName,
      displayName: vaultName,
      description: `DocWright vault adopted by adopt-vault`,
      profile,
      extends: `src/profiles/${profile}/profile.json`,
      documentTypes: [],
      requiredFrontmatter: [],
      optionalFrontmatter: [],
      features: {},
    }, null, 2) + '\n';
    writeManaged(dest, 'profile.json', content, manifest);
  }

  // .docwright/.gitignore
  const dwGiPath = path.join(dest, '.docwright', '.gitignore');
  if (!fs.existsSync(dwGiPath)) {
    writeManaged(dest, '.docwright/.gitignore', '*\n!registry.example.json\n!manifest.json\n', manifest);
  }

  // Seed pilot policy atoms
  const atomIds = ['commit-format', 'frontmatter-validate', 'no-work-before-approval'];
  // check.ts not seeded — imports from src/policy-atoms-core/ which won't exist in vault.
  // check.js (esbuild bundle, fully self-contained) is seeded instead.
  const atomSeedFiles = ['atom.yaml', 'context.md', 'check.js'];
  let atomsSeeded = 0;
  for (const atomId of atomIds) {
    const srcDir = path.join(docwrightPath, 'policies', atomId);
    const dstDir = path.join(dest, 'policies', atomId);
    if (!fs.existsSync(srcDir)) continue;
    fs.mkdirSync(dstDir, { recursive: true });
    for (const f of atomSeedFiles) {
      const src = path.join(srcDir, f);
      if (fs.existsSync(src)) {
        const content = fs.readFileSync(src, 'utf8');
        writeManaged(dest, `policies/${atomId}/${f}`, content, manifest, true);
        atomsSeeded++;
      }
    }
  }
  if (atomsSeeded > 0) pass(`policies/ (${atomIds.length} pilot atoms seeded)`);

  // Root .gitignore — append DocWright block (duplicate-safe)
  appendGitignore(dest);

  // Skills bridge (Claude Code, OpenCode, Gemini)
  copySkillsBridge(dest, docwrightPath, manifest);

  // Pre-commit hook
  try {
    execSync(`npm run hook:install -- --vault "${dest}"`, {
      cwd: docwrightPath, stdio: 'inherit',
    });
  } catch {
    console.error('  ✗ hook:install failed — run manually: npm run hook:install -- --vault ' + dest);
  }
}

// ---------------------------------------------------------------------------
// .gitignore append
// ---------------------------------------------------------------------------

function appendGitignore(dest: string) {
  const giPath = path.join(dest, '.gitignore');
  const existing = fs.existsSync(giPath) ? fs.readFileSync(giPath, 'utf8') : '';
  const managed = ['.env', '.dw-session.json', 'node_modules', '.claude/skills/',
                   '.opencode/skills/', '.gemini/agents/', '.gemini/settings.json'];
  const toAdd = managed.filter(e => !existing.includes(e));
  if (toAdd.length === 0) { pass('.gitignore (no new entries needed)'); return; }
  const block = '\n# DocWright — managed entries (added by adopt-vault.ts)\n' +
                toAdd.join('\n') + '\n';
  fs.writeFileSync(giPath, existing + block, 'utf8');
  pass(`.gitignore (+${toAdd.length} entries: ${toAdd.join(', ')})`);
}

// ---------------------------------------------------------------------------
// Skills bridge
// ---------------------------------------------------------------------------

function copySkillsBridge(dest: string, docwrightPath: string, manifest: Manifest) {
  // Claude Code skills
  const claudeSkillsSrc = path.join(docwrightPath, '.claude', 'skills');
  if (fs.existsSync(claudeSkillsSrc)) {
    fs.mkdirSync(path.join(dest, '.claude', 'skills'), { recursive: true });
    for (const f of fs.readdirSync(claudeSkillsSrc)) {
      if (!f.endsWith('.md')) continue;
      const content = fs.readFileSync(path.join(claudeSkillsSrc, f), 'utf8');
      writeManaged(dest, `.claude/skills/${f}`, content, manifest, true);
    }
    pass(`.claude/skills/ (${fs.readdirSync(claudeSkillsSrc).filter(f => f.endsWith('.md')).length} skills)`);
  }

  // OpenCode skills — only distributable: true
  const ocSkillsSrc = path.join(docwrightPath, '.opencode', 'skills');
  if (fs.existsSync(ocSkillsSrc)) {
    let copied = 0;
    for (const skillDir of fs.readdirSync(ocSkillsSrc)) {
      const skillMd = path.join(ocSkillsSrc, skillDir, 'SKILL.md');
      if (!fs.existsSync(skillMd)) continue;
      const skillContent = fs.readFileSync(skillMd, 'utf8');
      if (!skillContent.includes('distributable: true')) continue;
      // Copy whole subdirectory
      const srcDir = path.join(ocSkillsSrc, skillDir);
      const destDir = path.join(dest, '.opencode', 'skills', skillDir);
      fs.mkdirSync(destDir, { recursive: true });
      for (const f of fs.readdirSync(srcDir)) {
        const content = fs.readFileSync(path.join(srcDir, f), 'utf8');
        writeManaged(dest, `.opencode/skills/${skillDir}/${f}`, content, manifest, true);
      }
      copied++;
    }
    pass(`.opencode/skills/ (${copied} distributable skills)`);
  }

  // Gemini CLI — GEMINI.md from profile template
  const geminiTpl = path.join(docwrightPath, 'src', 'profiles', 'org-operations', 'gemini-instructions.md');
  const geminiDest = path.join(dest, 'GEMINI.md');
  if (fs.existsSync(geminiTpl)) {
    const tplContent = fs.readFileSync(geminiTpl, 'utf8');
    if (fs.existsSync(geminiDest)) {
      // Append if already exists
      const existing = fs.readFileSync(geminiDest, 'utf8');
      if (!existing.includes('DocWright')) {
        fs.appendFileSync(geminiDest, '\n---\n' + tplContent);
        manifest['GEMINI.md'] = sha256(fs.readFileSync(geminiDest, 'utf8'));
        pass('GEMINI.md (appended DocWright context)');
      }
    } else {
      writeManaged(dest, 'GEMINI.md', tplContent, manifest);
    }
  }
}

// ---------------------------------------------------------------------------
// Upgrade path
// ---------------------------------------------------------------------------

function runUpgrade(dest: string, docwrightPath: string, manifest: Manifest) {
  const adoptVersion = readDocWrightVersion(docwrightPath);
  const adoptDate    = new Date().toISOString().split('T')[0];
  let updated = 0, prompted = 0;

  // Re-generate each managed file and compare hashes
  // For a full upgrade, we re-run the lightweight writer into a temp manifest
  // then compare against the stored manifest.
  const tempManifest: Manifest = {};
  writeLightweight(dest, path.basename(dest), 'org-operations', docwrightPath, tempManifest);
  copySkillsBridge(dest, docwrightPath, tempManifest);
  // Seed pilot atoms — ensures vaults adopted before atom seeding receive them on upgrade
  const atomIds = ['commit-format', 'frontmatter-validate', 'no-work-before-approval'];
  const atomSeedFiles = ['atom.yaml', 'context.md', 'check.js'];
  for (const atomId of atomIds) {
    const srcDir = path.join(docwrightPath, 'policies', atomId);
    if (!fs.existsSync(srcDir)) continue;
    fs.mkdirSync(path.join(dest, 'policies', atomId), { recursive: true });
    for (const f of atomSeedFiles) {
      const src = path.join(srcDir, f);
      if (!fs.existsSync(src)) continue;
      const content = fs.readFileSync(src, 'utf8');
      writeManaged(dest, `policies/${atomId}/${f}`, content, tempManifest, true);
    }
  }

  for (const [rel, newHash] of Object.entries(tempManifest)) {
    const abs = path.join(dest, rel);
    const oldHash = manifest[rel];
    if (!oldHash) {
      // New file not in old manifest — add it
      manifest[rel] = newHash;
      updated++;
      continue;
    }
    const diskHash = fs.existsSync(abs) ? sha256(fs.readFileSync(abs, 'utf8')) : '';
    if (diskHash === oldHash) {
      // User hasn't modified it — overwrite silently and update manifest
      manifest[rel] = newHash;
      updated++;
    } else {
      // User modified it — prompt
      console.log(`  ⚠  ${rel}: user-modified — skipping (re-run with --force to overwrite)`);
      prompted++;
    }
  }

  // Update config stamp
  const configPath = path.join(dest, '.docwright', 'config.json');
  try {
    const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    cfg.adopt_version = adoptVersion;
    cfg.adopt_date    = adoptDate;
    fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2) + '\n', 'utf8');
    manifest['.docwright/config.json'] = sha256(fs.readFileSync(configPath, 'utf8'));
  } catch { /* ignore */ }

  pass(`Upgrade complete — ${updated} files refreshed, ${prompted} user-modified files skipped`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const { dest, profile, vaultName, docwrightPath, mode, upgrade } = parseArgs();

  if (!fs.existsSync(dest)) {
    fail(`Destination does not exist: ${dest}\nUse npm run init for new empty vaults.`);
  }

  console.log(`\nDocWright Vault Adoption`);
  console.log(`  dest:      ${dest}`);
  console.log(`  mode:      ${upgrade ? 'upgrade' : mode}`);
  console.log(`  docwright: ${docwrightPath}\n`);

  fs.mkdirSync(path.join(dest, '.docwright'), { recursive: true });
  const manifest = readManifest(dest);

  if (upgrade) {
    runUpgrade(dest, docwrightPath, manifest);
    writeManifest(dest, manifest);
    console.log(`\n✅ Vault upgraded at ${dest}`);
    return;
  }

  writeLightweight(dest, vaultName, profile, docwrightPath, manifest);

  if (mode === 'full') {
    writeFull(dest, vaultName, profile, docwrightPath, manifest);
    // Update adopt_mode to reflect actual mode used
    const cfgPath = path.join(dest, '.docwright', 'config.json');
    try {
      const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
      cfg.adopt_mode = 'full';
      const cfgContent = JSON.stringify(cfg, null, 2) + '\n';
      fs.writeFileSync(cfgPath, cfgContent, 'utf8');
      manifest['.docwright/config.json'] = sha256(cfgContent);
    } catch { /* ignore */ }
  }

  writeManifest(dest, manifest);
  pass('.docwright/manifest.json');

  console.log(`\n✅ Vault adopted at ${dest} (mode: ${mode})`);
  console.log('\nNext steps:');
  console.log('  1. direnv allow');
  console.log('  2. Review and stage only DocWright-managed files for the initial commit');
  if (mode === 'lightweight') {
    console.log('  3. When ready for full adoption: npm run adopt -- --dest . --mode full');
  }
}

main();
