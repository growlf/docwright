#!/usr/bin/env tsx
/**
 * CI isolation check for policy-atoms-core.
 * Fails if any file in src/policy-atoms-core/ imports from outside the package.
 *
 * Allowed imports:
 *   - node:* builtins
 *   - other files in src/policy-atoms-core/
 *
 * Forbidden:
 *   - Any import from src/dispatch/, src/webui/, src/executor/, or any other
 *     DocWright module outside the package directory.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

const PACKAGE_DIR = path.resolve(process.cwd(), 'src/policy-atoms-core');
const IMPORT_RE = /(?:^|\n)\s*(?:import|export)\s+.*?\s+from\s+['"]([^'"]+)['"]/g;

let violations = 0;

function checkFile(filePath: string) {
  const content = fs.readFileSync(filePath, 'utf8');
  let match: RegExpExecArray | null;
  IMPORT_RE.lastIndex = 0;
  while ((match = IMPORT_RE.exec(content)) !== null) {
    const spec = match[1];
    // Allow node: builtins
    if (spec.startsWith('node:')) continue;
    // Allow relative imports that stay within the package
    if (spec.startsWith('./') || spec.startsWith('../')) {
      const resolved = path.resolve(path.dirname(filePath), spec);
      if (!resolved.startsWith(PACKAGE_DIR)) {
        console.error(`✗ VIOLATION in ${path.relative(process.cwd(), filePath)}`);
        console.error(`  Import '${spec}' resolves outside policy-atoms-core`);
        console.error(`  Resolved: ${resolved}`);
        violations++;
      }
      continue;
    }
    // Any absolute or package import is forbidden
    console.error(`✗ VIOLATION in ${path.relative(process.cwd(), filePath)}`);
    console.error(`  Non-relative, non-node import: '${spec}'`);
    violations++;
  }
}

function scanDir(dir: string) {
  if (!fs.existsSync(dir)) {
    console.error(`✗ Package directory not found: ${dir}`);
    process.exit(1);
  }
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) scanDir(full);
    else if (entry.name.endsWith('.ts')) checkFile(full);
  }
}

console.log('Checking policy-atoms-core isolation...');
scanDir(PACKAGE_DIR);

if (violations === 0) {
  console.log('✓ policy-atoms-core is fully isolated — zero external imports');
  process.exit(0);
} else {
  console.error(`\n✗ ${violations} isolation violation(s) found`);
  process.exit(1);
}
