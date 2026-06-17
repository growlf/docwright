/**
 * policy-atoms-core — Pass-2 resolver.
 * Loads full atom context (prose + optional check function) for a given
 * list of atom IDs. Only called after the router has filtered to relevant atoms.
 * ISOLATION INVARIANT: import only from node: builtins and src/policy-atoms-core/.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Atom, AtomFrontmatter, CheckFunction, AiCategory } from './schema.js';
import { parseAtomYaml } from './parse-yaml.js';

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

    // Load check function for deterministic atoms.
    // Only check.js is loaded — Node's import() cannot resolve raw .ts files.
    // The sync-checker validates that check.ts (source) exists; the build step
    // compiles it to check.js before the resolver runs. During development,
    // compile with: npx tsx --build or esbuild policies/<id>/check.ts.
    let check: CheckFunction | undefined;
    const checkFileJs = path.join(atomDir, 'check.js');
    if (fm.kind === 'deterministic' && fs.existsSync(checkFileJs)) {
      try {
        const mod = await import(checkFileJs);
        check = mod.check ?? mod.default;
      } catch (e: unknown) {
        errors.push({ atomId: id, error: `failed to load check.js for ${id}: ${e}` });
      }
    }

    atoms.push({ frontmatter: fm, context, check });
  }

  return { atoms, errors };
}
