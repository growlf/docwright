/**
 * policy-atoms-core — Pass-2 resolver.
 * Loads full atom context (prose + optional check function) for a given
 * list of atom IDs. Only called after the router has filtered to relevant atoms.
 * ISOLATION INVARIANT: import only from node: builtins and src/policy-atoms-core/.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Atom, AtomFrontmatter, CheckFunction, AiCategory } from './schema.js';

export interface ResolverOptions {
  policiesDir: string;
}

export interface ResolveResult {
  atoms: Atom[];
  errors: Array<{ atomId: string; error: string }>;
}

// ---------------------------------------------------------------------------
// Pluggable hooks (Step 5 stubs)
// ---------------------------------------------------------------------------

/**
 * org_source_hook — Returns an org-level override for the atom if one exists.
 * Stub: always returns null. Real implementation supplied by org-bundle tier.
 */
export type OrgSourceHook = (atomId: string) => Promise<Partial<AtomFrontmatter> | null>;

/**
 * judgment_dispatch_hook — Dispatches a judgment atom evaluation to the
 * appropriate model based on ai_category. Stub: returns null (falls back
 * to caller's default model). Signature is frozen per Design Decision Q5.
 *
 * @param ai_category  The atom's ai_category value
 * @param payload      The rendered judgment prompt
 * @returns            Model response string, or null to use default model
 */
export type JudgmentDispatchHook = (
  ai_category: AiCategory,
  payload: string,
) => Promise<string | null>;

export const nullOrgSourceHook: OrgSourceHook = async () => null;
export const nullJudgmentDispatchHook: JudgmentDispatchHook = async () => null;

// ---------------------------------------------------------------------------
// Resolver
// ---------------------------------------------------------------------------

/**
 * Parse the yaml frontmatter from an atom.yaml file.
 * Minimal parser matching the index-builder's parser.
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

export async function resolve(
  atomIds: string[],
  opts: ResolverOptions,
  hooks: { orgSource?: OrgSourceHook; judgmentDispatch?: JudgmentDispatchHook } = {},
): Promise<ResolveResult> {
  const { policiesDir } = opts;
  const { orgSource = nullOrgSourceHook } = hooks;
  const atoms: Atom[] = [];
  const errors: ResolveResult['errors'] = [];

  for (const id of atomIds) {
    const atomDir = path.join(policiesDir, id);
    const atomFile = path.join(atomDir, 'atom.yaml');

    if (!fs.existsSync(atomFile)) {
      errors.push({ atomId: id, error: `atom.yaml not found at ${atomFile}` });
      continue;
    }

    let fm: AtomFrontmatter;
    try {
      const raw = parseAtomYaml(fs.readFileSync(atomFile, 'utf8'));
      fm = raw as unknown as AtomFrontmatter;
    } catch (e: unknown) {
      errors.push({ atomId: id, error: `parse error: ${e}` });
      continue;
    }

    // Apply org-source override if hook provides one
    const override = await orgSource(id);
    if (override) {
      fm = { ...fm, ...override };
    }

    // Load context prose
    let context: string | undefined;
    const contextFile = path.join(atomDir, 'context.md');
    if (fs.existsSync(contextFile)) {
      context = fs.readFileSync(contextFile, 'utf8');
    }

    // Load check function for deterministic atoms
    let check: CheckFunction | undefined;
    const checkFile = path.join(atomDir, 'check.ts');
    const checkFileJs = path.join(atomDir, 'check.js');
    const checkTarget = fs.existsSync(checkFileJs) ? checkFileJs : undefined;
    if (fm.kind === 'deterministic' && checkTarget) {
      try {
        const mod = await import(checkTarget);
        check = mod.check ?? mod.default;
      } catch (e: unknown) {
        errors.push({ atomId: id, error: `failed to load check: ${e}` });
      }
    }

    atoms.push({ frontmatter: fm, context, check });
  }

  return { atoms, errors };
}
