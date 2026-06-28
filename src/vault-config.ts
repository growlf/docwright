/**
 * Vault configuration reader.
 * Reads .docwright/config.json from a vault root and resolves well-known paths.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

interface VaultDotConfig {
  schema_version?: string;
  adopt_version?: string;
  adopt_date?: string;
  adopt_mode?: string;
  atoms_dir?: string;
}

function readVaultDotConfig(vaultRoot: string): VaultDotConfig {
  const configPath = path.join(vaultRoot, '.docwright', 'config.json');
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8')) as VaultDotConfig;
  } catch {
    return {};
  }
}

/**
 * Resolve the directory where policy atoms live for a given vault.
 * Reads atoms_dir from .docwright/config.json; defaults to 'policies'
 * for backwards compatibility with vaults that predate this field.
 */
export function resolveAtomsDir(vaultRoot: string): string {
  const config = readVaultDotConfig(vaultRoot);
  return path.resolve(vaultRoot, config.atoms_dir ?? 'policies');
}
