import { writeFile, getRepoRoot } from './paths';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';

export function logTransition(event: string, details: string): void {
  try {
    const root = getRepoRoot();
    if (!root) return;

    const dir = path.join(root, '.docwright');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    // Try to get user from env or fallback
    const user = process.env.OPCODE_USER_NAME || process.env.USER || 'NetYeti';

    const entry = {
      ts: new Date().toISOString(),
      host: process.env.HOSTNAME || os.hostname(),
      event,
      user,
      details
    };

    fs.appendFileSync(
      path.join(dir, 'audit.jsonl'),
      JSON.stringify(entry) + '\n',
      'utf8'
    );
  } catch {
    // Ignore audit log failures
  }
}
