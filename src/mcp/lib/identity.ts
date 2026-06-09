import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';
import { getRepoRoot } from './paths';

/**
 * Resolve human identity from .env -> git config -> fallback.
 */
export function getHumanIdentity(): string {
  const root = getRepoRoot();
  if (root) {
    const envPath = path.join(root, '.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      const match = content.match(/^OPCODE_USER_NAME=(.*)$/m);
      if (match) {
        const name = match[1].trim().replace(/^["']|["']$/g, '');
        if (name && name !== 'Your Full Name') return name;
      }
    }
  }

  try {
    const name = execSync('git config user.name', { encoding: 'utf8' }).trim();
    if (name) return name;
  } catch {
    // ignore
  }

  return 'NetYeti';
}
