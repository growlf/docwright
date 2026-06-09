import fs from 'node:fs';
import path from 'node:path';
import { execSync, execFileSync } from 'node:child_process';

export interface VerifyConfig {
  repoRoot: string;
  timeout: number;
  planName: string;
}

export interface VerifyResult {
  passed: boolean;
  category: 'code' | 'config' | 'doc' | 'test' | 'manual' | 'unknown';
  details: string;
}

const MANUAL_VERIFY_LOG = '.docwright/executor-verify-log.md';

/** Walk up from cwd to find node_modules/.bin/tsc */
function findTsc(cwd: string): string {
  let dir = cwd;
  while (dir !== path.parse(dir).root) {
    const candidate = path.join(dir, 'node_modules', '.bin', 'tsc');
    if (fs.existsSync(candidate)) return candidate;
    if (fs.existsSync(candidate + '.cmd')) return candidate + '.cmd';
    dir = path.dirname(dir);
  }
  return 'npx tsc';
}

function detectCategory(action: string, details: string): VerifyResult['category'] {
  const a = action.toLowerCase();
  const d = details.toLowerCase();

  if (
    a.startsWith('test') ||
    a.includes('tests') ||
    a.includes('test coverage') ||
    /^add.*test/.test(a) ||
    /^write.*test/.test(a)
  ) {
    return 'test';
  }
  if (
    a.includes('config') || a.includes('configure') ||
    a.includes('json') || a.includes('yaml') || a.includes('yml') ||
    d.includes('.json') || d.includes('.yaml') || d.includes('.yml')
  ) {
    return 'config';
  }
  if (
    a.includes('doc') || a.includes('document') || a.includes('readme') ||
    d.includes('.md') || a.includes(' write ') || a.includes('document')
  ) {
    return 'doc';
  }
  if (
    a.includes('create') || a.includes('implement') ||
    a.includes('add ') || a.includes('build') || a.includes('write ')
  ) {
    return 'code';
  }
  return 'unknown';
}

/** Extract expected filename references from action/details text */
function extractFilenames(action: string, details: string): string[] {
  const combined = `${action} ${details}`;
  const fileRefs: string[] = [];
  const patterns = [
    /src\/[\w./-]+\.\w+/g,
    /test\/[\w./-]+\.\w+/g,
    /docs\/[\w./-]+\.md/g,
    /scripts\/[\w./-]+\.\w+/g,
  ];
  for (const pat of patterns) {
    const matches = combined.matchAll(pat);
    for (const m of matches) fileRefs.push(m[0]);
  }
  return [...new Set(fileRefs)];
}

async function verifyCodeStep(action: string, details: string, config: VerifyConfig): Promise<VerifyResult> {
  const filenames = extractFilenames(action, details);

  if (filenames.length > 0) {
    const missing = filenames.filter(f => !fs.existsSync(path.join(config.repoRoot, f)));
    if (missing.length > 0) {
      return {
        passed: false,
        category: 'code',
        details: `Expected files not found: ${missing.join(', ')}`,
      };
    }
  }

  const tscPath = findTsc(config.repoRoot);
  try {
    execFileSync(tscPath, ['--noEmit'], {
      cwd: config.repoRoot,
      timeout: config.timeout,
      stdio: 'pipe',
    });
    return { passed: true, category: 'code', details: 'TypeScript type-check passed' };
  } catch (err: any) {
    const stderr = err.stderr?.toString() || err.stdout?.toString() || err.message;
    return { passed: false, category: 'code', details: `TypeScript check failed: ${stderr.slice(0, 500)}` };
  }
}

async function verifyConfigStep(action: string, details: string, config: VerifyConfig): Promise<VerifyResult> {
  const filenames = extractFilenames(action, details);
  const pattern = /([\w./-]+\.(json|yaml|yml))/g;
  const combined = `${action} ${details}`;
  const configFiles: string[] = [];
  const m = combined.matchAll(pattern);
  for (const match of m) configFiles.push(match[1]);

  // Also check the filenames from extractFilenames that end in json/yaml/yml
  for (const f of filenames) {
    if (/\.(json|yaml|yml)$/.test(f) && !configFiles.includes(f)) configFiles.push(f);
  }

  if (configFiles.length === 0) {
    // Try common config files
    for (const candidate of ['package.json', 'tsconfig.json', '.env.example']) {
      if (fs.existsSync(path.join(config.repoRoot, candidate))) configFiles.push(candidate);
    }
  }

  const errors: string[] = [];
  for (const cfg of configFiles) {
    const fp = path.join(config.repoRoot, cfg);
    if (!fs.existsSync(fp)) {
      errors.push(`${cfg} not found`);
      continue;
    }
    try {
      const ext = path.extname(cfg).toLowerCase();
      const raw = fs.readFileSync(fp, 'utf-8');
      if (ext === '.json') JSON.parse(raw);
    } catch (e: any) {
      errors.push(`${cfg}: ${e.message}`);
    }
  }

  if (errors.length > 0) {
    return { passed: false, category: 'config', details: errors.join('; ') };
  }
  return { passed: true, category: 'config', details: 'Config files valid' };
}

async function verifyDocStep(action: string, details: string, config: VerifyConfig): Promise<VerifyResult> {
  const filenames = extractFilenames(action, details);

  if (filenames.length === 0) {
    // No explicit files mentioned — look for docs/ directory changes
    const docsDir = path.join(config.repoRoot, 'docs');
    if (fs.existsSync(docsDir)) {
      return { passed: true, category: 'doc', details: 'docs/ directory exists' };
    }
    return { passed: false, category: 'doc', details: 'No doc files referenced and docs/ not found' };
  }

  const missing = filenames.filter(f => !fs.existsSync(path.join(config.repoRoot, f)));
  const empty = filenames.filter(f => {
    const fp = path.join(config.repoRoot, f);
    return fs.existsSync(fp) && fs.statSync(fp).size === 0;
  });

  if (missing.length > 0) {
    return { passed: false, category: 'doc', details: `Missing doc files: ${missing.join(', ')}` };
  }
  if (empty.length > 0) {
    return { passed: false, category: 'doc', details: `Empty doc files: ${empty.join(', ')}` };
  }
  return { passed: true, category: 'doc', details: 'Doc files exist and non-empty' };
}

async function verifyTestStep(action: string, details: string, config: VerifyConfig): Promise<VerifyResult> {
  // Determine test scope from action/details
  const scopePattern = /test[\s:-]+([\w./-]+)/i;
  const scopeMatch = action.match(scopePattern) || details.match(scopePattern);
  let testCmd = 'npm test';
  if (scopeMatch) {
    const scope = scopeMatch[1].trim();
    const scopeScripts: Record<string, string> = {
      dispatch: 'npm run test:dispatch',
      executor: 'npm run test:executor',
      plan: 'npm run test:dispatch',
      parser: 'npm run test:dispatch',
      compat: 'npm run test:compat',
    };
    testCmd = scopeScripts[scope] || 'npm test';
  }

  try {
    execSync(testCmd, {
      cwd: config.repoRoot,
      timeout: config.timeout,
      stdio: 'pipe',
      shell: true,
    });
    return { passed: true, category: 'test', details: `${testCmd} passed` };
  } catch (err: any) {
    const stderr = err.stderr?.toString() || err.stdout?.toString() || err.message;
    return { passed: false, category: 'test', details: `${testCmd} failed: ${stderr.slice(0, 500)}` };
  }
}

function appendVerifyLog(planName: string, stepNumber: number, result: VerifyResult): void {
  const logPath = path.join(process.cwd(), MANUAL_VERIFY_LOG);
  const entry = [
    `## ${new Date().toISOString()} — ${planName} Step ${stepNumber}`,
    `- **Category**: ${result.category}`,
    `- **Passed**: ${result.passed}`,
    `- **Details**: ${result.details}`,
    '',
  ].join('\n');
  fs.appendFileSync(logPath, entry, 'utf-8');
}

export async function verify(
  action: string,
  details: string,
  stepNumber: number,
  config: VerifyConfig,
): Promise<VerifyResult> {
  const category = detectCategory(action, details);

  let result: VerifyResult;

  switch (category) {
    case 'code':
      result = await verifyCodeStep(action, details, config);
      break;
    case 'config':
      result = await verifyConfigStep(action, details, config);
      break;
    case 'doc':
      result = await verifyDocStep(action, details, config);
      break;
    case 'test':
      result = await verifyTestStep(action, details, config);
      break;
    case 'manual':
    case 'unknown':
    default:
      result = { passed: true, category, details: 'No automatic verification method — manual check required' };
      break;
  }

  if (!result.passed) {
    appendVerifyLog(config.planName, stepNumber, result);
  }

  return result;
}
