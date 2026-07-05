import { getRepoRoot } from '../lib/paths';
import { getHumanIdentity } from '../lib/identity';
import { getMode } from '../lib/mode';
import * as path from 'node:path';
import * as fs from 'node:fs';
import {
  FRICTION_LOG_PATH,
  FRICTION_CATEGORIES,
  FRICTION_SEVERITIES,
  appendFrictionEntry,
} from '../../dispatch/friction';

function sanitize(input: string, maxLength: number): string {
  return input
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

export function logFriction(
  description: string,
  category: string = 'ux-friction',
  severity: string = 'medium',
): string {
  if (getMode() !== 'vault') {
    return 'ERROR: log_friction is only available in vault mode (--mode=vault).';
  }

  const sanitizedDesc = sanitize(description, 1000);
  if (!sanitizedDesc) {
    return 'ERROR: description is required and must be non-empty after sanitization.';
  }
  const sanitizedCategory = (FRICTION_CATEGORIES as readonly string[]).includes(category)
    ? category
    : 'ux-friction';
  const sanitizedSeverity = (FRICTION_SEVERITIES as readonly string[]).includes(severity)
    ? severity
    : 'medium';

  const root = getRepoRoot();
  if (!root) return 'ERROR: repo root not set.';
  const logPath = path.join(root, FRICTION_LOG_PATH);

  const existing = fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf8') : null;
  const updated = appendFrictionEntry(existing, {
    date: new Date().toISOString().slice(0, 10),
    category: sanitizedCategory,
    severity: sanitizedSeverity,
    description: `${sanitizedDesc} (${getHumanIdentity()})`,
  });
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.writeFileSync(logPath, updated, 'utf8');

  return [
    `✅ Friction logged to ${FRICTION_LOG_PATH} (${sanitizedCategory}, ${sanitizedSeverity}).`,
    'Review cadence is weekly — untriaged entries older than 7 days surface as a badge on the status page.',
    'If this deserves an upstream report, use contribute_upstream (upstream mode) and record the issue URL in the Upstream Issue column.',
  ].join('\n');
}
