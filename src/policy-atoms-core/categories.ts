/**
 * policy-atoms-core — Category registry loader.
 * Loads categories.yaml as additive display metadata over the TypeScript
 * AiCategory union type. The TypeScript type is the canonical contract.
 * ISOLATION INVARIANT: import only from node: builtins and src/policy-atoms-core/.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseAtomYaml } from './parse-yaml.js';

export interface CategoryEntry {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'deprecated';
  min_model: string | null;
  routing_notes: string;
}

export interface CategoryRegistry {
  categories: CategoryEntry[];
}

const REGISTRY_PATH = path.resolve(
  new URL(import.meta.url).pathname,
  '../categories.yaml',
);

let _cache: CategoryRegistry | null = null;

/**
 * Load the category registry from categories.yaml.
 * Returns null if the file does not exist (not required — TypeScript type is the contract).
 * Caches the result for the process lifetime.
 */
export function loadCategoryRegistry(): CategoryRegistry | null {
  if (_cache) return _cache;
  if (!fs.existsSync(REGISTRY_PATH)) return null;
  try {
    const raw = fs.readFileSync(REGISTRY_PATH, 'utf8');
    // Parse the top-level structure
    const lines = raw.split('\n');
    const entries: CategoryEntry[] = [];
    let current: Partial<CategoryEntry> | null = null;

    for (const line of lines) {
      if (line.trim().startsWith('- id:')) {
        if (current?.id) entries.push(current as CategoryEntry);
        current = { id: line.replace(/^.*- id:\s*/, '').replace(/^['"]|['"]$/g, '').trim() };
      } else if (current && line.includes(':')) {
        const colonIdx = line.indexOf(':');
        const key = line.slice(0, colonIdx).trim();
        const val = line.slice(colonIdx + 1).trim().replace(/^['"]|['"]$/g, '');
        if (key === 'name') current.name = val;
        else if (key === 'description') current.description = val;
        else if (key === 'status') current.status = val as 'active' | 'deprecated';
        else if (key === 'min_model') current.min_model = val === 'null' ? null : val;
        else if (key === 'routing_notes') current.routing_notes = val;
      }
    }
    if (current?.id) entries.push(current as CategoryEntry);
    _cache = { categories: entries };
    return _cache;
  } catch {
    return null;
  }
}

/**
 * Check if a given ai_category ID is valid and non-deprecated in the registry.
 * Returns null if the registry is not available (TypeScript type is still the contract).
 */
export function validateCategoryId(id: string): { valid: boolean; deprecated: boolean } | null {
  const registry = loadCategoryRegistry();
  if (!registry) return null;
  const entry = registry.categories.find(c => c.id === id);
  if (!entry) return { valid: false, deprecated: false };
  return { valid: true, deprecated: entry.status === 'deprecated' };
}
