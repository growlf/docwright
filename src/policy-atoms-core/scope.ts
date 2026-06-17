/**
 * policy-atoms-core — Scope expression grammar and matcher.
 *
 * GRAMMAR (frozen — changes require a plan revision):
 *
 *   scope-expr   ::= segment ('.' segment)*
 *   segment      ::= literal | wildcard
 *   literal      ::= [a-z][a-z0-9-]+
 *   wildcard     ::= '*'
 *
 * Built-in scope literals (canonical set for DocWright):
 *   git-commit          A git commit operation
 *   proposal            Any proposal lifecycle operation
 *   proposal.creating   Proposal being first authored
 *   proposal.approving  Proposal transitioning to approved
 *   plan                Any plan lifecycle operation
 *   plan.creating       Plan being first authored
 *   plan.approved       Plan transitioning to approved/in-progress
 *   plan.completing     Plan transitioning to completed
 *   plan.reviewing      Plan undergoing gate review
 *   doc                 Generic document in docs/
 *   research            Research document in research/
 *   session             Session start/end operations
 *
 * Scope inheritance (wildcard matching):
 *   'plan'    matches: plan, plan.approved, plan.completing, plan.*
 *   'plan.*'  matches: plan.approved, plan.completing, plan.reviewing (not bare 'plan')
 *   '*'       matches everything
 *
 * ISOLATION INVARIANT: import only from node: builtins and src/policy-atoms-core/.
 */

export const CANONICAL_SCOPES = [
  'git-commit',
  'proposal',
  'proposal.creating',
  'proposal.approving',
  'plan',
  'plan.creating',
  'plan.approved',
  'plan.completing',
  'plan.reviewing',
  'doc',
  'research',
  'session',
] as const;

export type CanonicalScope = typeof CANONICAL_SCOPES[number];

/**
 * Parse a scope expression into segments.
 * Returns null if the expression is syntactically invalid.
 */
export function parseScopeExpr(expr: string): string[] | null {
  if (!expr || typeof expr !== 'string') return null;
  const segments = expr.split('.');
  for (const seg of segments) {
    if (!/^([a-z][a-z0-9-]*|\*)$/.test(seg)) return null;
  }
  return segments;
}

/**
 * Returns true if an atom with the given `atomScope` expression should fire
 * when the action context is `actionScope`.
 *
 * Rules:
 * - '*' in atom scope matches any action scope
 * - 'plan' in atom scope matches 'plan', 'plan.approved', 'plan.completing', etc.
 * - 'plan.*' in atom scope matches 'plan.approved', 'plan.completing' but NOT bare 'plan'
 * - Exact match always fires
 */
export function scopeMatches(atomScope: string, actionScope: string): boolean {
  if (atomScope === '*' || atomScope === actionScope) return true;

  const atomParts = parseScopeExpr(atomScope);
  const actionParts = parseScopeExpr(actionScope);
  if (!atomParts || !actionParts) return false;

  // atom has fewer or equal segments than action → prefix match (inheritance)
  // e.g. atom='plan' matches action='plan.approved'
  if (atomParts.length <= actionParts.length) {
    for (let i = 0; i < atomParts.length; i++) {
      const aSeg = atomParts[i];
      const bSeg = actionParts[i];
      if (aSeg !== '*' && aSeg !== bSeg) return false;
    }
    return true;
  }

  // atom has more segments → wildcard tail match
  // e.g. atom='plan.*' matches action='plan.approved' (last atom segment is *)
  if (atomParts[atomParts.length - 1] === '*') {
    const atomPrefix = atomParts.slice(0, -1);
    if (actionParts.length < atomPrefix.length) return false;
    for (let i = 0; i < atomPrefix.length; i++) {
      if (atomPrefix[i] !== '*' && atomPrefix[i] !== actionParts[i]) return false;
    }
    return actionParts.length >= atomParts.length;
  }

  return false;
}

/**
 * Returns true if ANY scope expression in `atomScopes` matches `actionScope`.
 */
export function anyScopeMatches(atomScopes: string[], actionScope: string): boolean {
  return atomScopes.some(s => scopeMatches(s, actionScope));
}
