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

const UNTESTABLE_PATTERNS = [
  /\.(css|scss|less|sass)$/,
  /\.(md|mdx)$/,
  /\.(json|jsonc|yaml|yml|toml)$/,
  /\.(svg|png|jpg|jpeg|gif|ico)$/,
  /\.(config|conf|ini|cfg)$/,
  /\.(env|env\.example)$/,
  /\.gitignore$/,
  /\/Dockerfile$/,
  /\.dockerignore$/,
  /\/\.github\//,
  /\/templates\//,
];

export interface TestGenResult {
  dispatched: boolean;
  changedFiles: string[];
  untestable: boolean;
  gateNote: string;
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

function classifyChanges(files: string[]): { untestable: boolean; reason: string } {
  const testable = files.filter(f => !UNTESTABLE_PATTERNS.some(p => p.test(f)));
  const untestable = files.filter(f => UNTESTABLE_PATTERNS.some(p => p.test(f)));

  if (testable.length === 0 && untestable.length > 0) {
    return {
      untestable: true,
      reason: `Changed files are untestable types: ${untestable.join(', ')}`,
    };
  }
  if (testable.length > 0 && untestable.length > 0) {
    return {
      untestable: false,
      reason: `Mixed changes: testable (${testable.join(', ')}) + untestable (${untestable.join(', ')})`,
    };
  }
  return { untestable: false, reason: '' };
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
    return { dispatched: false, changedFiles: [], untestable: false, gateNote: '', message: msg };
  }

  const classification = classifyChanges(changedFiles);
  const fileList = changedFiles.join(', ');

  if (classification.untestable) {
    logAudit('TEST_GEN_UNTESTABLE', [
      `plan/${planName}`,
      `step: ${stepMatch.slice(0, 60)}`,
      `reason: ${classification.reason}`,
    ].join(' | '));
    return {
      dispatched: true,
      changedFiles,
      untestable: true,
      gateNote: classification.reason,
      message: `⏸ No test generation needed: ${classification.reason}`,
    };
  }

  const prompt = [
    `Step completed: "${stepMatch}"`,
    `Action: ${stepAction.slice(0, 200)}`,
    `Changed files: ${fileList}`,
    ``,
    `Generate or update tests for the changed files above.`,
    `Consider: unit tests, integration tests, edge cases.`,
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
    untestable: false,
    gateNote: '',
    message: [
      `🧪 Test generation dispatched for step '${stepMatch}'.`,
      `Changed files: ${fileList}`,
      `Note: Full code-agent dispatch requires the split-agent-governance orchestrator.`,
      `The dispatch context has been logged to the audit trail.`,
    ].join('\n'),
  };
}
