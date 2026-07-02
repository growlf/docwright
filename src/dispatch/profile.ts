import * as fs from 'node:fs';
import * as path from 'node:path';

export interface RelationshipEngineProfileConfig {
  auto_detect_on_create: boolean;
  auto_detect_on_update: boolean;
  auto_detect_on_approval: boolean;
  similarity_threshold: number;
  show_plan_button: boolean;
}

export interface ProfileConfig {
  docwrightProfileVersion: string;
  name: string;
  displayName: string;
  description: string;
  principles?: string[];
  proposalCategories?: string[];
  effortSizes?: Record<string, string>;
  sidebarExcludePatterns?: string[];
  hiddenDirectories?: string[];
  version: string;
  documentTypes: string[];
  states: Record<string, string[]>;
  requiredFrontmatter: string[];
  optionalFrontmatter: string[];
  features: Record<string, boolean>;
  relationshipEngine?: RelationshipEngineProfileConfig;
}

const DEFAULT_PROFILE: ProfileConfig = {
  docwrightProfileVersion: '1',
  name: 'org-operations',
  displayName: 'Org Operations',
  description: 'Organizational operating system. Policy as the foundation of all work.',
  principles: ['Security first', 'Policy driven', 'Test verified at every stage'],
  proposalCategories: ['UI', 'UX', 'ENGINE', 'DATA'],
  sidebarExcludePatterns: ['AGENTS.md', 'CHANGELOG.md', 'CONTRIBUTING.md', 'LICENSE', 'NOTICE.md', 'SECURITY.md'],
  hiddenDirectories: ['proposals/approved', 'plans/completed'],
  version: '0.1.0',
  documentTypes: ['inbox', 'issue', 'proposal', 'plan', 'policy', 'decision', 'work-item'],
  states: {
    policy:    ['draft', 'active', 'superseded', 'archived'],
    proposal:  ['inbox', 'triaged', 'evaluated', 'accepted', 'rejected'],
    plan:      ['draft', 'active', 'completed', 'canceled'],
    issue:     ['inbox', 'triaged', 'resolved', 'declined'],
    decision:  ['draft', 'final'],
    'work-item': ['backlog', 'active', 'done', 'canceled'],
    inbox:     ['new', 'triaged'],
  },
  requiredFrontmatter: ['type', 'status', 'created', 'author', 'author-role'],
  optionalFrontmatter: ['parent', 'policy-area', 'tags', 'origin', 'ai-last-action',
    'category', 'complexity', 'estimated_effort', 'depends_on', 'due_date', 'subsumed_by'],
  features: { wikilinks: true, graph: true, naming: true, llmWiki: false },
};

export class MergeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MergeError';
  }
}

export function loadProfile(vaultRoot: string): ProfileConfig | null {
  const profilePath = path.join(vaultRoot, 'profile.json');
  try {
    return JSON.parse(fs.readFileSync(profilePath, 'utf-8')) as ProfileConfig;
  } catch { return null; }
}

function getRepoRoot(): string {
  // Try DOCWRIGHT_ROOT env var first
  if (process.env.DOCWRIGHT_ROOT) return process.env.DOCWRIGHT_ROOT;
  // Try __dirname (available in both CJS and tsx/cjs)
  const dir = typeof __dirname !== 'undefined' ? __dirname : '';
  if (dir && fs.existsSync(path.join(dir, '../../src/profiles'))) {
    return path.resolve(dir, '../..');
  }
  // Fallback to cwd
  const cwd = process.cwd();
  if (cwd.endsWith('webui') || cwd.includes('webui/')) {
    return path.resolve(cwd, '../..');
  }
  return cwd;
}

function loadBundledProfile(): ProfileConfig {
  const repoRoot = getRepoRoot();
  const bundledPath = path.join(repoRoot, 'src/profiles/org-operations/profile.json');
  try {
    return JSON.parse(fs.readFileSync(bundledPath, 'utf-8')) as ProfileConfig;
  } catch {
    return DEFAULT_PROFILE;
  }
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Merge a vault-root profile override onto a bundled profile.
 *
 * Merge rules:
 * - Scalar: vault value replaces bundled
 * - Object: deep-merge (vault keys supplement, never remove bundled keys)
 * - Array with `+` prefix string: append vault items to bundled
 * - Array without prefix: replace bundled entirely
 *
 * Validation:
 * - `+` prefix on non-array bundled field -> MergeError
 * - Type mismatch (scalar vs object) -> MergeError
 * - Unknown fields -> warning logged, no error (forward-compatible)
 */
export function mergeProfiles(
  bundled: ProfileConfig,
  vaultOverride: Partial<ProfileConfig>,
): ProfileConfig {
  const warnings: string[] = [];

  function mergeValue(key: string, bundledVal: unknown, vaultVal: unknown): unknown {
    // Unknown field in vault (not in bundled) — warn, pass through
    if (!(key in bundled)) {
      warnings.push(`Unknown field '${key}' in vault override — passed through`);
      return vaultVal;
    }

    // Scalar (or null/undefined) — replace
    if (!isObject(bundledVal) && !Array.isArray(bundledVal)) {
      if (isObject(vaultVal) || Array.isArray(vaultVal)) {
        throw new MergeError(`Field '${key}': vault value is ${typeof vaultVal} but bundled value is ${typeof bundledVal}`);
      }
      return vaultVal;
    }

    // Object — deep merge
    if (isObject(bundledVal)) {
      if (!isObject(vaultVal)) {
        throw new MergeError(`Field '${key}': vault value is ${typeof vaultVal} but bundled value is object`);
      }
      const merged: Record<string, unknown> = { ...bundledVal };
      for (const [vk, vv] of Object.entries(vaultVal)) {
        merged[vk] = mergeValue(vk, bundledVal[vk], vv);
      }
      return merged;
    }

    // Array
    if (Array.isArray(bundledVal)) {
      // Vault value must be array too
      if (!Array.isArray(vaultVal)) {
        throw new MergeError(`Field '${key}': vault value is ${typeof vaultVal} but bundled value is array`);
      }

      // Check for append prefix on first element
      if (vaultVal.length > 0 && typeof vaultVal[0] === 'string' && (vaultVal[0] as string).startsWith('+')) {
        // Strip the '+' marker from the first element, keep rest as-is
        const firstItem = (vaultVal[0] as string).slice(1);
        const appendItems = [firstItem, ...vaultVal.slice(1)];
        return [...bundledVal, ...appendItems];
      }

      return vaultVal;
    }

    return vaultVal;
  }

  const merged: Record<string, unknown> = { ...bundled as unknown as Record<string, unknown> };
  for (const [key, vaultVal] of Object.entries(vaultOverride)) {
    if (vaultVal === undefined || vaultVal === null) continue;
    const bundledVal = (bundled as unknown as Record<string, unknown>)[key];
    const mergedVal = mergeValue(key, bundledVal, vaultVal);
    if (mergedVal !== undefined) {
      (merged as Record<string, unknown>)[key] = mergedVal;
    }
  }

  if (warnings.length > 0) {
    for (const w of warnings) {
      console.warn(`[profile-merge] ${w}`);
    }
  }

  return merged as unknown as ProfileConfig;
}

export function getActiveProfile(vaultRoot: string): ProfileConfig {
  const bundled = loadBundledProfile();
  const vaultOverride = loadProfile(vaultRoot);
  if (!vaultOverride) return bundled;
  return mergeProfiles(bundled, vaultOverride);
}
