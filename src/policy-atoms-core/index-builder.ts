/**
 * policy-atoms-core — Index builder.
 * Scans a policies/ directory and produces the synopsis index YAML structure.
 * ISOLATION INVARIANT: import only from node: builtins and src/policy-atoms-core/.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  AtomFrontmatter,
  SynopsisEntry,
  SynopsisIndex,
  SYNOPSIS_TOKEN_HARD,
  SYNOPSIS_TOKEN_SOFT,
  validateAtomFrontmatter,
} from './schema.js';
import { parseScopeExpr } from './scope.js';

// Rough token estimator: ~4 chars per token (conservative for YAML)
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function synopsisIndexTokens(index: SynopsisIndex): number {
  // Estimate the token cost of serialising the index as YAML for AI consumption
  let chars = `generated: ${index.generated}\ndocwright_version: ${index.docwright_version}\natoms:\n`;
  for (const a of index.atoms) {
    chars += `  - id: ${a.id}\n    kind: ${a.kind}\n    scope: [${a.scope.join(', ')}]\n    synopsis: "${a.synopsis}"\n    version: ${a.version}\n    ai_category: ${a.ai_category}\n`;
  }
  return estimateTokens(chars);
}

export interface BuildIndexOptions {
  policiesDir: string;
  docwrightVersion?: string;
}

export interface BuildIndexResult {
  index: SynopsisIndex;
  errors: Array<{ file: string; error: string }>;
  warnings: Array<{ message: string }>;
}

/**
 * Parse a YAML-style atom frontmatter from a string.
 * Minimal parser — handles the flat key: value format used in atom.yaml.
 * Does not support nested objects or multi-line values.
 */
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
      // Check for array value on next lines
      const arr: string[] = [];
      i++;
      while (i < lines.length && lines[i].match(/^\s+-\s+/)) {
        arr.push(lines[i].replace(/^\s+-\s+/, '').trim().replace(/^['"]|['"]$/g, ''));
        i++;
      }
      result[key] = arr;
      continue;
    }

    // Inline array: [a, b, c]
    if (rest.startsWith('[')) {
      const inner = rest.replace(/^\[|\]$/g, '');
      result[key] = inner.split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
    } else if (rest === 'true') {
      result[key] = true;
    } else if (rest === 'false') {
      result[key] = false;
    } else if (/^\d+$/.test(rest)) {
      result[key] = parseInt(rest, 10);
    } else {
      result[key] = rest.replace(/^['"]|['"]$/g, '');
    }
    i++;
  }
  return result;
}

export function buildIndex(opts: BuildIndexOptions): BuildIndexResult {
  const { policiesDir, docwrightVersion = '0.0.0' } = opts;
  const errors: BuildIndexResult['errors'] = [];
  const warnings: BuildIndexResult['warnings'] = [];
  const entries: SynopsisEntry[] = [];

  if (!fs.existsSync(policiesDir)) {
    return {
      index: {
        generated: new Date().toISOString(),
        docwright_version: docwrightVersion,
        token_count: 0,
        token_limit: SYNOPSIS_TOKEN_HARD,
        atoms: [],
      },
      errors: [{ file: policiesDir, error: 'policies directory does not exist' }],
      warnings,
    };
  }

  const atomDirs = fs.readdirSync(policiesDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .sort();

  for (const dir of atomDirs) {
    const atomFile = path.join(policiesDir, dir, 'atom.yaml');
    if (!fs.existsSync(atomFile)) {
      errors.push({ file: path.join(dir, 'atom.yaml'), error: 'atom.yaml not found' });
      continue;
    }

    let raw: Record<string, unknown>;
    try {
      raw = parseAtomYaml(fs.readFileSync(atomFile, 'utf8'));
    } catch (e: unknown) {
      errors.push({ file: atomFile, error: `parse error: ${e}` });
      continue;
    }

    const { valid, errors: valErrors } = validateAtomFrontmatter(raw);
    if (!valid) {
      errors.push({ file: atomFile, error: valErrors.map(e => `${e.field}: ${e.message}`).join('; ') });
      continue;
    }

    const fm = raw as unknown as AtomFrontmatter;

    // Validate scope expressions
    for (const s of fm.scope) {
      if (!parseScopeExpr(s)) {
        errors.push({ file: atomFile, error: `invalid scope expression: ${s}` });
      }
    }

    entries.push({
      id: fm.id,
      kind: fm.kind,
      scope: fm.scope,
      synopsis: fm.synopsis,
      version: fm.version,
      ai_category: fm.ai_category,
    });
  }

  const index: SynopsisIndex = {
    generated: new Date().toISOString(),
    docwright_version: docwrightVersion,
    token_count: 0,
    token_limit: SYNOPSIS_TOKEN_HARD,
    atoms: entries,
  };

  index.token_count = synopsisIndexTokens(index);

  if (index.token_count > SYNOPSIS_TOKEN_HARD) {
    errors.push({ file: 'synopsis-index', error: `token count ${index.token_count} exceeds hard limit ${SYNOPSIS_TOKEN_HARD}` });
  } else if (index.token_count > SYNOPSIS_TOKEN_SOFT) {
    warnings.push({ message: `synopsis index at ${index.token_count} tokens — approaching hard limit of ${SYNOPSIS_TOKEN_HARD}` });
  }

  return { index, errors, warnings };
}
