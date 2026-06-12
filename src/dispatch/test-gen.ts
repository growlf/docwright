import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

function getRepoRoot(): string {
  return process.env.DOCWRIGHT_ROOT
    ? path.resolve(process.env.DOCWRIGHT_ROOT)
    : process.cwd();
}

function getAuditDir(): string {
  return path.join(getRepoRoot(), '.docwright');
}

function logAudit(event: string, details: string): void {
  try {
    const dir = getAuditDir();
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const entry = {
      ts: new Date().toISOString(),
      host: process.env.HOSTNAME || 'unknown',
      event,
      user: process.env.OPCODE_USER_NAME || process.env.USER || 'agent',
      details,
    };
    fs.appendFileSync(path.join(dir, 'audit.jsonl'), JSON.stringify(entry) + '\n', 'utf-8');
  } catch {
    // Ignore audit failures
  }
}

export interface TestGenResult {
  dispatched: boolean;
  changedFiles: string[];
  message: string;
}

export function getChangedFiles(): string[] {
  try {
    const output = execSync('git diff --name-only HEAD', {
      cwd: getRepoRoot(),
      encoding: 'utf-8',
      timeout: 5000,
    });
    return output.split('\n').map(s => s.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

export function dispatchTestGen(
  planName: string,
  stepMatch: string,
  stepAction: string,
): TestGenResult {
  const changedFiles = getChangedFiles();
  const hasChanges = changedFiles.length > 0;

  if (!hasChanges) {
    const msg = `No uncommitted changes detected for step '${stepMatch}'. Tests not generated.`;
    logAudit('TEST_GEN_SKIP', `plan/${planName}: ${msg}`);
    return { dispatched: false, changedFiles: [], message: msg };
  }

  const fileList = changedFiles.join(', ');
  const prompt = [
    `Step completed: "${stepMatch}"`,
    `Action: ${stepAction.slice(0, 200)}`,
    `Changed files: ${fileList}`,
    ``,
    `Generate or update tests for the changed files above.`,
    `Consider: unit tests, integration tests, edge cases.`,
    `If the change is purely visual or structural (CSS, config),`,
    `note that no test changes are needed.`,
  ].join('\n');

  logAudit('TEST_GEN_DISPATCH', [
    `plan/${planName}`,
    `step: ${stepMatch.slice(0, 60)}`,
    `files: ${fileList}`,
    `prompt_length: ${prompt.length}`,
  ].join(' | '));

  return {
    dispatched: true,
    changedFiles,
    message: [
      `🧪 Test generation dispatched for step '${stepMatch}'.`,
      `Changed files: ${fileList}`,
      `Note: Full code-agent dispatch requires the split-agent-governance orchestrator.`,
      `The dispatch context has been logged to the audit trail.`,
    ].join('\n'),
  };
}
