import fs from 'node:fs';
import path from 'node:path';

export interface PluginManifest {
  apiVersion: string;
  name: string;
  displayName: string;
  version: string;
  description: string;
  icon: string;
  defaultRoute: string;
  hasSearch?: boolean;
  author?: string;
  // View Container fields (Step 5)
  type: 'view-container' | 'tool';   // opts into activity bar + sidebar presence
  order: number;                      // activity bar position; external plugins use 100+
  searchable: boolean;                // true → shell renders search input; vc.onSearch() called
  capabilities: string[];             // reserved for future permission gating
  serverEntrypoint: string;
  clientEntrypoint: string;
  clientStylesheet: string;
}

export interface LoadedPlugin {
  manifest: PluginManifest;
  dir: string;
}

export interface ManifestValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

function vaultRoot(): string {
  return process.env.DOCWRIGHT_VAULT_ROOT ?? process.cwd();
}

const DEFAULTS = {
  type: 'view-container' as const,
  order: 100,
  searchable: false,
  hasSearch: false,
  capabilities: [] as string[],
  serverEntrypoint: 'server.js',
  clientEntrypoint: 'client/bundle.js',
  clientStylesheet: 'client/style.css',
};

const REQUIRED_FIELDS = ['apiVersion', 'name', 'displayName', 'version', 'description', 'icon', 'defaultRoute'] as const;
const SUPPORTED_API_VERSIONS = new Set(['1']);
const KNOWN_FIELDS = new Set([
  'apiVersion', 'name', 'displayName', 'version', 'description', 'icon', 'defaultRoute', 'hasSearch',
  'author', 'type', 'order', 'searchable', 'capabilities',
  'serverEntrypoint', 'clientEntrypoint', 'clientStylesheet',
]);

export function validateManifest(raw: Partial<PluginManifest>, dirName: string): ManifestValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const field of REQUIRED_FIELDS) {
    if (!raw[field]) errors.push(`missing required field: "${field}"`);
  }

  if (raw.apiVersion && !SUPPORTED_API_VERSIONS.has(raw.apiVersion)) {
    errors.push(`unsupported apiVersion "${raw.apiVersion}" — supported: ${[...SUPPORTED_API_VERSIONS].join(', ')}`);
  }

  if (raw.name && !/^[a-z][a-z0-9-]*$/.test(raw.name)) {
    errors.push(`name must be kebab-case, got: "${raw.name}"`);
  }

  if (raw.name && raw.name !== dirName) {
    warnings.push(`name "${raw.name}" does not match directory "${dirName}"`);
  }

  for (const key of Object.keys(raw)) {
    if (!KNOWN_FIELDS.has(key)) {
      warnings.push(`unknown field "${key}" — ignored (future apiVersion?)`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function scanPlugins(): LoadedPlugin[] {
  const pluginsDir = path.join(vaultRoot(), 'plugins');
  if (!fs.existsSync(pluginsDir)) return [];

  const loaded: LoadedPlugin[] = [];
  for (const entry of fs.readdirSync(pluginsDir, { withFileTypes: true })) {
    const entryPath = path.join(pluginsDir, entry.name);
    // isDirectory() doesn't follow symlinks; use statSync so symlinked plugin dirs work
    if (!fs.statSync(entryPath).isDirectory()) continue;
    const manifestPath = path.join(pluginsDir, entry.name, 'plugin.json');
    if (!fs.existsSync(manifestPath)) continue;
    try {
      const raw = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as Partial<PluginManifest>;
      const validation = validateManifest(raw, entry.name);

      if (!validation.valid) {
        console.warn(`[plugins] Skipping "${entry.name}": ${validation.errors.join('; ')}`);
        continue;
      }
      for (const w of validation.warnings) {
        console.warn(`[plugins] "${entry.name}": ${w}`);
      }

      const manifest: PluginManifest = { ...DEFAULTS, ...raw } as PluginManifest;
      loaded.push({ manifest, dir: path.join(pluginsDir, entry.name) });
    } catch (e) {
      console.warn(`[plugins] Failed to parse ${manifestPath}:`, e);
    }
  }
  // Sort by order so activity bar position is stable across restarts
  loaded.sort((a, b) => a.manifest.order - b.manifest.order);
  return loaded;
}

export function findPlugin(name: string): LoadedPlugin | undefined {
  return scanPlugins().find(p => p.manifest.name === name);
}

export function pluginStaticFile(plugin: LoadedPlugin, subpath: string): string | null {
  const resolved = path.resolve(plugin.dir, subpath);
  if (!resolved.startsWith(plugin.dir + path.sep) && resolved !== plugin.dir) return null;
  if (!fs.existsSync(resolved) || fs.statSync(resolved).isDirectory()) return null;
  return resolved;
}
