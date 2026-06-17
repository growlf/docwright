/**
 * policy-atoms-core — Pass-1 router.
 * Given an action scope, returns the subset of atom IDs from the synopsis
 * index whose scope expressions match. No full atom contexts are loaded.
 * ISOLATION INVARIANT: import only from node: builtins and src/policy-atoms-core/.
 */
import { SynopsisIndex, SynopsisEntry, AtomKind } from './schema.js';
import { anyScopeMatches } from './scope.js';

export interface RouterOptions {
  /** Filter by atom kind if provided. */
  kind?: AtomKind;
}

export interface RouterResult {
  /** Atom IDs whose scope matches the action scope. */
  atomIds: string[];
  /** The matched synopsis entries (for inspection/logging). */
  matched: SynopsisEntry[];
}

/**
 * Pass-1 route: given an action scope string, return IDs of all atoms
 * whose scope expressions match.
 *
 * @param index     The synopsis index (cheap — always in context)
 * @param actionScope  e.g. 'plan.approved', 'git-commit', 'proposal'
 * @param opts      Optional filters
 */
export function route(
  index: SynopsisIndex,
  actionScope: string,
  opts: RouterOptions = {},
): RouterResult {
  const matched = index.atoms.filter(atom => {
    if (opts.kind && atom.kind !== opts.kind) return false;
    return anyScopeMatches(atom.scope, actionScope);
  });

  return {
    atomIds: matched.map(a => a.id),
    matched,
  };
}
