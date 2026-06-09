import assert from 'assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { verify } from '../../src/executor/verify';

describe('verify', () => {
  let tmpDir: string;
  const projectRoot = path.resolve(__dirname, '../..');

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dw-verify-'));
    // Create a minimal tsconfig so tsc --noEmit works
    fs.writeFileSync(path.join(tmpDir, 'tsconfig.json'), JSON.stringify({ compilerOptions: { strict: true, target: 'ES2020', module: 'commonjs' }, include: ['src'] }));
    // Create a minimal package.json
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'test', scripts: { test: 'node -e "process.exit(0)"' } }));
    // Symlink node_modules so tsc is available to the verify function
    const projectNodeModules = path.join(projectRoot, 'node_modules');
    if (fs.existsSync(projectNodeModules)) {
      fs.symlinkSync(projectNodeModules, path.join(tmpDir, 'node_modules'));
    }
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('code steps', () => {
    it('passes when expected files exist and tsc passes', async () => {
      fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'src', 'foo.ts'), 'export const x = 42;\n');
      const result = await verify('create src/foo.ts', 'Implement the foo module', 1, {
        repoRoot: tmpDir,
        timeout: 10000,
        planName: 'test-plan',
      });
      assert.strictEqual(result.passed, true);
      assert.strictEqual(result.category, 'code');
    });

    it('fails when expected files are missing', async () => {
      const result = await verify('create src/missing.ts', 'Implement the missing module', 1, {
        repoRoot: tmpDir,
        timeout: 10000,
        planName: 'test-plan',
      });
      assert.strictEqual(result.passed, false);
      assert.strictEqual(result.category, 'code');
      assert.ok(result.details.includes('missing.ts'));
    });

    it('fails when tsc check fails', async () => {
      fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'src', 'bad.ts'), 'const x: number = "string";\n');

      const result = await verify('create src/bad.ts', 'Add a type error', 1, {
        repoRoot: tmpDir,
        timeout: 10000,
        planName: 'test-plan',
      });
      assert.strictEqual(result.passed, false);
      assert.strictEqual(result.category, 'code');
    });
  });

  describe('config steps', () => {
    it('passes when JSON config files are valid', async () => {
      fs.writeFileSync(path.join(tmpDir, 'config.json'), '{"key": "value"}\n');
      const result = await verify('configure config.json', 'Set up config', 1, {
        repoRoot: tmpDir,
        timeout: 10000,
        planName: 'test-plan',
      });
      assert.strictEqual(result.passed, true);
      assert.strictEqual(result.category, 'config');
    });

    it('fails when JSON config has parse errors', async () => {
      fs.writeFileSync(path.join(tmpDir, 'config.json'), '{invalid json}\n');
      const result = await verify('configure config.json', 'Set up config', 1, {
        repoRoot: tmpDir,
        timeout: 10000,
        planName: 'test-plan',
      });
      assert.strictEqual(result.passed, false);
      assert.strictEqual(result.category, 'config');
      assert.ok(result.details.includes('config.json'));
    });

    it('fails when referenced config file does not exist', async () => {
      const result = await verify('configure missing.yaml', 'Set up missing config', 1, {
        repoRoot: tmpDir,
        timeout: 10000,
        planName: 'test-plan',
      });
      assert.strictEqual(result.passed, false);
      assert.strictEqual(result.category, 'config');
    });
  });

  describe('doc steps', () => {
    it('passes when doc files exist and are non-empty', async () => {
      fs.mkdirSync(path.join(tmpDir, 'docs'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'docs', 'readme.md'), '# Documentation\n');
      const result = await verify('write docs/readme.md', 'Document the feature', 1, {
        repoRoot: tmpDir,
        timeout: 10000,
        planName: 'test-plan',
      });
      assert.strictEqual(result.passed, true);
      assert.strictEqual(result.category, 'doc');
    });

    it('fails when doc files are missing', async () => {
      const result = await verify('write docs/missing.md', 'Document the missing file', 1, {
        repoRoot: tmpDir,
        timeout: 10000,
        planName: 'test-plan',
      });
      assert.strictEqual(result.passed, false);
      assert.strictEqual(result.category, 'doc');
    });
  });

  describe('test steps', () => {
    it('passes when npm test exits 0', async () => {
      const result = await verify('add test coverage', 'Write unit tests for the module', 1, {
        repoRoot: tmpDir,
        timeout: 10000,
        planName: 'test-plan',
      });
      assert.strictEqual(result.passed, true);
      assert.strictEqual(result.category, 'test');
    });
  });

  describe('unknown steps', () => {
    it('passes automatically for unknown categories (manual check needed)', async () => {
      const result = await verify('review the design', 'Check the architecture doc', 1, {
        repoRoot: tmpDir,
        timeout: 10000,
        planName: 'test-plan',
      });
      assert.strictEqual(result.passed, true);
      assert.strictEqual(result.category, 'unknown');
      assert.ok(result.details.includes('manual'));
    });
  });
});
