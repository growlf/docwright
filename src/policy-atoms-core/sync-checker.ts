/**
 * policy-atoms-core — Sync-checker.
 * Validates atom structural correctness and canonical-source direction.
 *
 * For DETERMINISTIC atoms: code is canonical. Checks:
 *   - atom.yaml is valid
 *   - context.md exists (describes what the code does)
 *   - check.ts or check.js exists (the code check)
 *   - synopsis is present and within length budget
 *
 * For JUDGMENT atoms: context prose is canonical. Checks:
 *   - atom.yaml is valid
 *   - context.md exists with required sections (Rule, Rationale, Examples, Scope)
 *   - NO check.ts present (judgment atoms have no code check)
 *   - synopsis accurately summarises (structural check only — semantics is human review)
 *
 * Also enforces synopsis index token budget across all atoms.
 * ISOLATION INVARIANT: import only from node: builtins and src/policy-atoms-core/.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { validateAtomFrontmatter, SYNOPSIS_TOKEN_HARD, SYNOPSIS_TOKEN_SOFT } from './schema.js';
import { buildIndex } from './index-builder.js';

export interface SyncCheckIssue {
  atomId: string;
  severity: 'error' | 'warning';
  message: string;
}

export interface SyncCheckResult {
  valid: boolean;
  issues: SyncCheckIssue[];
  tokenCount: number;
}

const REQUIRED_JUDGMENT_SECTIONS = ['## Rule', '## Rationale', '## Examples', '## Scope'];

function parseAtomYaml(content: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = content.split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line || line.startsWith('#')) { i++; continue; }
    const colonIdx = line.indexOf(':');
    if (colonIdx < 0) { i++; continue; }
    const key = line.slice(0, colonIdx).trim();
    const rest = line.slice(colonIdx + 1).trim();
    if (rest === '') {
      const arr: string[] = [];
      i++;
      while (i < lines.length && lines[i].match(/^\s+-\s+/)) {
        arr.push(lines[i].replace(/^\s+-\s+/, '').trim().replace(/^['"]|['"]$/g, ''));
        i++;
      }
      result[key] = arr;
      continue;
    }
    if (rest.startsWith('[')) {
      const inner = rest.replace(/^\[|\]$/g, '');
      result[key] = inner.split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
    } else if (rest === 'true') { result[key] = true;
    } else if (rest === 'false') { result[key] = false;
    } else if (/^\d+$/.test(rest)) { result[key] = parseInt(rest, 10);
    } else { result[key] = rest.replace(/^['"]|['"]$/g, ''); }
    i++;
  }
  return result;
}

export function syncCheck(policiesDir: string): SyncCheckResult {
  const issues: SyncCheckIssue[] = [];

  if (!fs.existsSync(policiesDir)) {
    return { valid: false, issues: [{ atomId: '_global', severity: 'error', message: `policies dir not found: ${policiesDir}` }], tokenCount: 0 };
  }

  const atomDirs = fs.readdirSync(policiesDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .sort();

  for (const dir of atomDirs) {
    const atomId = dir;
    const atomDir = path.join(policiesDir, dir);
    const atomFile = path.join(atomDir, 'atom.yaml');
    const contextFile = path.join(atomDir, 'context.md');
    const checkFileTs = path.join(atomDir, 'check.ts');
    const checkFileJs = path.join(atomDir, 'check.js');
    const hasCheck = fs.existsSync(checkFileTs) || fs.existsSync(checkFileJs);

    // atom.yaml must exist and be valid
    if (!fs.existsSync(atomFile)) {
      issues.push({ atomId, severity: 'error', message: 'atom.yaml not found' });
      continue;
    }

    let raw: Record<string, unknown>;
    try { raw = parseAtomYaml(fs.readFileSync(atomFile, 'utf8')); }
    catch (e) { issues.push({ atomId, severity: 'error', message: `atom.yaml parse error: ${e}` }); continue; }

    const { valid, errors: valErrors } = validateAtomFrontmatter(raw);
    if (!valid) {
      for (const e of valErrors)
        issues.push({ atomId, severity: 'error', message: `${e.field}: ${e.message}` });
      continue;
    }

    const kind = raw.kind as string;

    if (kind === 'deterministic') {
      // Code is canonical — check.ts/js must exist
      if (!hasCheck)
        issues.push({ atomId, severity: 'error', message: 'deterministic atom missing check.ts (code is canonical)' });
      // context.md should exist to describe the code
      if (!fs.existsSync(contextFile))
        issues.push({ atomId, severity: 'warning', message: 'deterministic atom missing context.md (should describe what the code checks)' });
    } else {
      // judgment — context prose is canonical
      if (!fs.existsSync(contextFile))
        issues.push({ atomId, severity: 'error', message: 'judgment atom missing context.md (prose is canonical)' });
      else {
        const ctx = fs.readFileSync(contextFile, 'utf8');
        for (const section of REQUIRED_JUDGMENT_SECTIONS) {
          if (!ctx.includes(section))
            issues.push({ atomId, severity: 'error', message: `context.md missing required section: ${section}` });
        }
      }
      // check.ts must NOT exist for judgment atoms
      if (hasCheck)
        issues.push({ atomId, severity: 'error', message: 'judgment atom must not have check.ts (no code check — prose is canonical)' });
    }
  }

  // Check synopsis index token budget
  const { index, errors: buildErrors } = buildIndex({ policiesDir });
  for (const e of buildErrors)
    issues.push({ atomId: e.file, severity: 'error', message: e.error });

  if (index.token_count > SYNOPSIS_TOKEN_HARD)
    issues.push({ atomId: '_index', severity: 'error', message: `synopsis index ${index.token_count} tokens exceeds hard limit ${SYNOPSIS_TOKEN_HARD}` });
  else if (index.token_count > SYNOPSIS_TOKEN_SOFT)
    issues.push({ atomId: '_index', severity: 'warning', message: `synopsis index at ${index.token_count} tokens (soft warning at ${SYNOPSIS_TOKEN_SOFT})` });

  const errors = issues.filter(i => i.severity === 'error');
  return { valid: errors.length === 0, issues, tokenCount: index.token_count };
}
