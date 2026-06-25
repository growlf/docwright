import fs from 'node:fs';
import path from 'node:path';

export interface PluginManifest {
  apiVersion: string;
  name: string;
  displayName: string;
  version: string;
  description: string;
  icon: string;
  author?: string;
  serverEntrypoint: string;
  clientEntrypoint: string;
  clientStylesheet: string;
}

export interface LoadedPlugin {
  manifest: PluginManifest;
  dir: string;
}

function vaultRoot(): string {
  return process.env.DOCWRIGHT_VAULT_ROOT ?? process.cwd();
}

const DEFAULTS = {
  serverEntrypoint: 'server.js',
  clientEntrypoint: 'client/bundle.js',
  clientStylesheet: 'client/style.css',
} as const;

export function scanPlugins(): LoadedPlugin[] {
  const pluginsDir = path.join(vaultRoot(), 'plugins');
  if (!fs.existsSync(pluginsDir)) return [];

  const loaded: LoadedPlugin[] = [];
  for (const entry of fs.readdirSync(pluginsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const manifestPath = path.join(pluginsDir, entry.name, 'plugin.json');
    if (!fs.existsSync(manifestPath)) continue;
    try {
      const raw = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as Partial<PluginManifest>;
      if (!raw.apiVersion || !raw.name || !raw.displayName) {
        console.warn(`[plugins] Skipping ${entry.name}: missing required fields (apiVersion, name, displayName)`);
        continue;
      }
      const manifest: PluginManifest = { ...DEFAULTS, ...raw } as PluginManifest;
      loaded.push({ manifest, dir: path.join(pluginsDir, entry.name) });
    } catch (e) {
      console.warn(`[plugins] Failed to parse ${manifestPath}:`, e);
    }
  }
  return loaded;
}

export function findPlugin(name: string): LoadedPlugin | undefined {
  return scanPlugins().find(p => p.manifest.name === name);
}

export function pluginStaticFile(plugin: LoadedPlugin, subpath: string): string | null {
  const resolved = path.resolve(plugin.dir, subpath);
  // Path traversal guard
  if (!resolved.startsWith(plugin.dir + path.sep) && resolved !== plugin.dir) return null;
  if (!fs.existsSync(resolved) || fs.statSync(resolved).isDirectory()) return null;
  return resolved;
}
