/**
 * audit.ts — Governance Audit Log
 *
 * No VS Code deps — runs in any Node context.
 * Writes structured NDJSON entries to audit/lifecycle.jsonl and provides
 * query/filter functionality.
 *
 * Schema per entry:
 * {
 *   ts: string;              // ISO 8601 timestamp
 *   doc_path: string;        // Relative path to the document
 *   transition_from: string; // Previous lifecycle status
 *   transition_to: string;   // New lifecycle status
 *   actor: string;           // Who performed the transition
 *   actor_type: 'human' | 'ai';
 *   gate_id?: string;        // Gate that was evaluated (if applicable)
 *   gate_status?: string;    // approved | waived | pending
 *   git_commit?: string;     // Git commit hash (set after commit)
 * }
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

// ── Types ──────────────────────────────────────────────────────────────────

export interface AuditEntry {
  ts: string;
  doc_path: string;
  transition_from: string;
  transition_to: string;
  actor: string;
  actor_type: 'human' | 'ai';
  gate_id?: string;
  gate_status?: string;
  git_commit?: string;
}

export interface AuditFilter {
  doc_path?: string;
  actor?: string;
  actor_type?: 'human' | 'ai';
  date_from?: string;
  date_to?: string;
  transition_from?: string;
  transition_to?: string;
  gate_id?: string;
  gate_status?: string;
  limit?: number;
  offset?: number;
}

// ── Path resolution ────────────────────────────────────────────────────────

// Resolve repo root lazily (__dirname not available in ESM/Vite SSR)
function getRepoRoot(): string {
  return process.env.DOCWRIGHT_ROOT
    ? path.resolve(process.env.DOCWRIGHT_ROOT)
    : process.cwd();
}

function getAuditDir(repoRoot?: string): string {
  return path.join(repoRoot ?? getRepoRoot(), 'audit');
}

function getAuditFile(repoRoot?: string): string {
  return path.join(getAuditDir(repoRoot), 'lifecycle.jsonl');
}

// ── Git helper ─────────────────────────────────────────────────────────────

function getGitCommit(repoRoot?: string): string {
  try {
    return execSync('git rev-parse --short HEAD', { cwd: repoRoot ?? getRepoRoot(), encoding: 'utf-8' }).trim();
  } catch {
    return '';
  }
}

// ── Writer ─────────────────────────────────────────────────────────────────

/**
 * Append an audit entry to audit/lifecycle.jsonl.
 * Auto-fills ts and git_commit if not provided.
 *
 * `repoRoot` MUST be passed by callers that operate on a specific vault (e.g.
 * executeTransition) so the audit write lands in the same tree as the document
 * write. When omitted, it falls back to DOCWRIGHT_ROOT/cwd — which in a test
 * without an isolated root would pollute the real repo. Threading the root is
 * the fix for that test-isolation leak (see issues/bug-tests-pollute-real-audit-log).
 */
export function writeAuditEntry(
  entry: Omit<AuditEntry, 'ts' | 'git_commit'> & { ts?: string; git_commit?: string },
  repoRoot?: string,
): void {
  const auditDir = getAuditDir(repoRoot);
  const auditFile = getAuditFile(repoRoot);
  if (!fs.existsSync(auditDir)) fs.mkdirSync(auditDir, { recursive: true });

  const full: AuditEntry = {
    ts: entry.ts ?? new Date().toISOString(),
    doc_path: entry.doc_path,
    transition_from: entry.transition_from,
    transition_to: entry.transition_to,
    actor: entry.actor,
    actor_type: entry.actor_type,
    gate_id: entry.gate_id,
    gate_status: entry.gate_status,
    git_commit: entry.git_commit ?? getGitCommit(repoRoot),
  };

  fs.appendFileSync(auditFile, JSON.stringify(full) + '\n', 'utf-8');
}

/**
 * Convenience: write an audit entry for a status transition.
 */
export function logTransition(
  docPath: string,
  fromStatus: string,
  toStatus: string,
  actor: string,
  actorType: 'human' | 'ai' = 'human',
  gateInfo?: { gate_id: string; gate_status: string },
  repoRoot?: string,
): void {
  writeAuditEntry({
    doc_path: docPath,
    transition_from: fromStatus,
    transition_to: toStatus,
    actor,
    actor_type: actorType,
    gate_id: gateInfo?.gate_id,
    gate_status: gateInfo?.gate_status,
  }, repoRoot);
}

// ── Reader / Query ─────────────────────────────────────────────────────────

/**
 * Read all entries from the audit log.
 */
export function readAllEntries(): AuditEntry[] {
  const auditFile = getAuditFile();
  if (!fs.existsSync(auditFile)) return [];
  const raw = fs.readFileSync(auditFile, 'utf-8');
  const entries: AuditEntry[] = [];
  for (const line of raw.split('\n').filter(Boolean)) {
    try {
      entries.push(JSON.parse(line));
    } catch {
      // Skip malformed lines
    }
  }
  return entries;
}

/**
 * Query audit entries with filters.
 * All filters are ANDed together. Returns paginated results sorted by ts descending.
 */
export function queryAudit(filter: AuditFilter = {}): { entries: AuditEntry[]; total: number } {
  let entries = readAllEntries();

  if (filter.doc_path) {
    entries = entries.filter(e => e.doc_path.includes(filter.doc_path!));
  }
  if (filter.actor) {
    entries = entries.filter(e => e.actor.includes(filter.actor!));
  }
  if (filter.actor_type) {
    entries = entries.filter(e => e.actor_type === filter.actor_type);
  }
  if (filter.date_from) {
    const from = new Date(filter.date_from).getTime();
    entries = entries.filter(e => new Date(e.ts).getTime() >= from);
  }
  if (filter.date_to) {
    const to = new Date(filter.date_to).getTime();
    entries = entries.filter(e => new Date(e.ts).getTime() <= to);
  }
  if (filter.transition_from) {
    entries = entries.filter(e => e.transition_from === filter.transition_from);
  }
  if (filter.transition_to) {
    entries = entries.filter(e => e.transition_to === filter.transition_to);
  }
  if (filter.gate_id) {
    entries = entries.filter(e => e.gate_id === filter.gate_id);
  }
  if (filter.gate_status) {
    entries = entries.filter(e => e.gate_status === filter.gate_status);
  }

  // Sort by ts descending (newest first)
  entries.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());

  const total = entries.length;

  // Pagination
  const offset = filter.offset ?? 0;
  const limit = filter.limit ?? 50;
  entries = entries.slice(offset, offset + limit);

  return { entries, total };
}
