/**
 * MCP atom routing coexistence shim — Step 3.
 *
 * When DOCWRIGHT_ATOM_ROUTING=1 is set, MCP mutation tools run atom checks
 * ALONGSIDE existing enforcement. Both paths execute; divergences are logged
 * but do NOT block the operation. Old paths are retired only after:
 *   (a) atom equivalence tests pass
 *   (b) the flag has been enabled in CI for at least one full run
 *
 * See docs/policy-atom-scope-routing.md for the tool→scope map.
 */
import * as path from 'node:path';
import * as fs from 'node:fs';
import { buildIndex } from '../../policy-atoms-core/index-builder';
import { route } from '../../policy-atoms-core/router';
import { resolve } from '../../policy-atoms-core/resolver';
import { extractFrontmatterField } from '../lib/frontmatter';
import { logTransition } from '../lib/audit';

const POLICIES_DIR = path.resolve(process.env.DOCWRIGHT_PATH ?? process.cwd(), 'policies');

// Cache the synopsis index for the process lifetime (rebuilt on first call)
let _indexCache: ReturnType<typeof buildIndex>['index'] | null = null;

function getIndex() {
  if (!_indexCache) {
    const { index } = buildIndex({ policiesDir: POLICIES_DIR });
    _indexCache = index;
  }
  return _indexCache;
}

/**
 * Run atom checks for a governance mutation alongside the existing enforcement.
 * Only active when DOCWRIGHT_ATOM_ROUTING=1.
 * Logs divergences; never blocks.
 *
 * @param filePath    Relative path of the file being mutated (e.g. 'plans/my-plan.md')
 * @param content     Full file content after the mutation
 * @param actionScope Scope string for routing (e.g. 'plan', 'plan.approved')
 */
export async function atomRoutingCheck(
  filePath: string,
  content: string,
  actionScope: string,
): Promise<void> {
  if (process.env.DOCWRIGHT_ATOM_ROUTING !== '1') return;

  try {
    const index = getIndex();
    const { atomIds } = route(index, actionScope, { kind: 'deterministic' });
    if (atomIds.length === 0) return;

    const { atoms, errors: resolveErrors } = await resolve(atomIds, { policiesDir: POLICIES_DIR });
    if (resolveErrors.length) {
      logTransition('ATOM_ROUTING_ERROR', `resolve errors: ${resolveErrors.map(e => e.error).join('; ')}`);
    }

    // Parse frontmatter from content for check context
    const fm: Record<string, unknown> = {};
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (fmMatch) {
      for (const line of fmMatch[1].split('\n')) {
        const colonIdx = line.indexOf(':');
        if (colonIdx < 0) continue;
        const key = line.slice(0, colonIdx).trim();
        const val = line.slice(colonIdx + 1).trim().replace(/^['"]|['"]$/g, '');
        fm[key] = val;
      }
    }

    const vaultRoot = process.env.DOCWRIGHT_VAULT_ROOT ?? process.env.DOCWRIGHT_ROOT ?? process.cwd();
    const checkCtx = { filePath, frontmatter: fm, content, vaultRoot };

    for (const atom of atoms) {
      if (!atom.check) continue;
      try {
        const result = await atom.check(checkCtx);
        if (!result.pass) {
          // Log divergence — atom flagged something the old path didn't block
          logTransition(
            'ATOM_ROUTING_DIVERGENCE',
            `[${atom.frontmatter.id}] scope=${actionScope} file=${filePath}: ${result.message}`,
          );
        }
      } catch (e) {
        logTransition('ATOM_ROUTING_ERROR', `[${atom.frontmatter.id}]: ${e}`);
      }
    }
  } catch (e) {
    // Never let atom routing errors surface to the caller — old path is authoritative
    logTransition('ATOM_ROUTING_ERROR', `atomRoutingCheck failed: ${e}`);
  }
}
