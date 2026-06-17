/**
 * policy-atoms-core — Atom schema types and JSON Schema validator.
 *
 * ISOLATION INVARIANT: this file must import ONLY from node: builtins and
 * other files inside src/policy-atoms-core/. The CI isolation check enforces
 * this. Do not import from src/dispatch/, src/webui/, or any DocWright module.
 */

// ---------------------------------------------------------------------------
// Core types
// ---------------------------------------------------------------------------

export type AtomKind = 'deterministic' | 'judgment';

export type AiCategory =
  | 'none'           // deterministic code check — zero LLM cost
  | 'classification' // fast yes/no or pick-from-list; cheap local model
  | 'generation'     // structured prose writing — proposals, plans, templates
  | 'reasoning'      // critique, judgment, logical inference, adequacy evaluation
  | 'coding'         // code generation, review, debugging — routes to code-specialist model
  | 'agentic';       // multi-step orchestration, tool use, executor coordination

/**
 * Frontmatter of an atom.yaml file.
 * For deterministic atoms: code check is canonical; synopsis + context describe it.
 * For judgment atoms: context prose is canonical; synopsis accurately summarises it.
 */
export interface AtomFrontmatter {
  id: string;
  kind: AtomKind;
  scope: string[];          // scope expressions — see scope.ts for grammar
  synopsis: string;         // 1–2 sentences; must fit synopsis token budget
  version: number;          // increment when rule meaning changes (invalidates cache)
  ai_category: AiCategory;
  distributable?: boolean;  // whether this atom ships to adopted vaults (default: false)
  tags?: string[];
  related?: string[];       // other atom IDs this atom cross-references
}

/**
 * A fully loaded atom (frontmatter + optional context prose + check function).
 */
export interface Atom {
  frontmatter: AtomFrontmatter;
  /** Full context prose (Markdown). Present for all atoms; required for judgment. */
  context?: string;
  /** Executable check function. Present for deterministic atoms. */
  check?: CheckFunction;
}

// ---------------------------------------------------------------------------
// Check function types
// ---------------------------------------------------------------------------

export interface CheckContext {
  filePath: string;
  frontmatter: Record<string, unknown>;
  content: string;
  vaultRoot: string;
}

export interface CheckResult {
  pass: boolean;
  message: string;
  atom_id: string;
}

export type CheckFunction = (ctx: CheckContext) => CheckResult | Promise<CheckResult>;

// ---------------------------------------------------------------------------
// Org-bundle override type
// ---------------------------------------------------------------------------

/**
 * Fields an org-source hook is allowed to override on an atom.
 * Intentionally limited — orgs cannot change an atom's id, kind, or ai_category,
 * only its enforcement parameters (scope, synopsis, version, distributable, tags).
 * This prevents an org bundle from silently reclassifying a deterministic check
 * as judgment (or vice versa), which would change its enforcement semantics.
 */
export interface AtomOverride {
  scope?: string[];
  synopsis?: string;
  version?: number;
  distributable?: boolean;
  tags?: string[];
  related?: string[];
}

// ---------------------------------------------------------------------------
// Synopsis index types
// ---------------------------------------------------------------------------

export interface SynopsisEntry {
  id: string;
  kind: AtomKind;
  scope: string[];
  synopsis: string;
  version: number;
  ai_category: AiCategory;
}

export interface SynopsisIndex {
  generated: string;
  docwright_version: string;
  token_count: number;
  /** Hard limit enforced by sync-checker. Soft warning at SYNOPSIS_TOKEN_SOFT. */
  token_limit: number;
  atoms: SynopsisEntry[];
}

export const SYNOPSIS_TOKEN_HARD = 1500;
export const SYNOPSIS_TOKEN_SOFT = 1200;

// ---------------------------------------------------------------------------
// JSON Schema for atom.yaml validation
// ---------------------------------------------------------------------------

export const ATOM_JSON_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'PolicyAtom',
  type: 'object',
  required: ['id', 'kind', 'scope', 'synopsis', 'version', 'ai_category'],
  additionalProperties: false,
  properties: {
    id: {
      type: 'string',
      pattern: '^[a-z][a-z0-9-]*$',
      description: 'Kebab-case unique identifier',
    },
    kind: { type: 'string', enum: ['deterministic', 'judgment'] },
    scope: {
      type: 'array',
      items: { type: 'string', pattern: '^[a-z][a-z0-9-]*(\\.[a-z*][a-z0-9-*]*)*$' },
      minItems: 1,
      description: 'Scope expressions — see scope grammar documentation',
    },
    synopsis: {
      type: 'string',
      minLength: 10,
      maxLength: 400,
      description: '1–2 sentence rule summary for the synopsis index',
    },
    version: { type: 'integer', minimum: 1 },
    ai_category: { type: 'string', enum: ['none', 'classification', 'generation', 'reasoning', 'coding', 'agentic'] },
    distributable: { type: 'boolean' },
    tags: { type: 'array', items: { type: 'string' } },
    related: {
      type: 'array',
      items: { type: 'string', pattern: '^[a-z][a-z0-9-]*$' },
      description: 'IDs of related atoms',
    },
  },
  if: { properties: { kind: { const: 'deterministic' } } },
  then: {
    properties: {
      ai_category: { const: 'none' },
    },
  },
};

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export interface ValidationError {
  field: string;
  message: string;
}

export function validateAtomFrontmatter(data: unknown): { valid: boolean; errors: ValidationError[] } {
  const errors: ValidationError[] = [];
  if (typeof data !== 'object' || data === null) {
    return { valid: false, errors: [{ field: 'root', message: 'must be an object' }] };
  }
  const d = data as Record<string, unknown>;

  // Required fields
  for (const f of ['id', 'kind', 'scope', 'synopsis', 'version', 'ai_category']) {
    if (!(f in d)) errors.push({ field: f, message: 'required' });
  }
  if (errors.length) return { valid: false, errors };

  // id
  if (typeof d.id !== 'string' || !/^[a-z][a-z0-9-]*$/.test(d.id))
    errors.push({ field: 'id', message: 'must be kebab-case string' });

  // kind
  if (!['deterministic', 'judgment'].includes(d.kind as string))
    errors.push({ field: 'kind', message: 'must be deterministic or judgment' });

  // scope
  if (!Array.isArray(d.scope) || d.scope.length === 0)
    errors.push({ field: 'scope', message: 'must be non-empty array' });
  else {
    for (const s of d.scope as unknown[]) {
      if (typeof s !== 'string' || !/^[a-z][a-z0-9-]*(\.[a-z*][a-z0-9-*]*)*$/.test(s))
        errors.push({ field: 'scope', message: `invalid scope expression: ${s}` });
    }
  }

  // synopsis
  if (typeof d.synopsis !== 'string' || d.synopsis.length < 10 || d.synopsis.length > 400)
    errors.push({ field: 'synopsis', message: 'must be 10–400 characters' });

  // version
  if (typeof d.version !== 'number' || !Number.isInteger(d.version) || d.version < 1)
    errors.push({ field: 'version', message: 'must be positive integer' });

  // ai_category
  if (!['none', 'classification', 'generation', 'reasoning', 'coding', 'agentic'].includes(d.ai_category as string))
    errors.push({ field: 'ai_category', message: 'must be none|classification|generation|reasoning|coding|agentic' });

  // deterministic atoms must have ai_category: none
  if (d.kind === 'deterministic' && d.ai_category !== 'none')
    errors.push({ field: 'ai_category', message: 'deterministic atoms must have ai_category: none' });

  // judgment atoms must not have ai_category: none
  if (d.kind === 'judgment' && d.ai_category === 'none')
    errors.push({ field: 'ai_category', message: 'judgment atoms must have ai_category other than none' });

  return { valid: errors.length === 0, errors };
}
