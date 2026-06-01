/**
 * Dispatch module tests — run OUTSIDE the VS Code extension host.
 *
 * This test suite deliberately runs without the VS Code runtime.
 * If any test here fails because of a missing 'vscode' module,
 * that means a prohibited import crept into src/dispatch/.
 * Fix the import — do not add vscode to the test environment.
 */
import assert from 'assert';

describe('Dispatch module', () => {
  it('loads without any vscode dependency', async () => {
    // Dynamic import — if this throws "Cannot find module 'vscode'",
    // there is a prohibited import in src/dispatch/index.ts or its deps.
    const dispatch = await import('../../src/dispatch/index');
    assert.ok(dispatch, 'dispatch module should load');
  });

  it('exports DISPATCH_VERSION', async () => {
    const { DISPATCH_VERSION } = await import('../../src/dispatch/index');
    assert.ok(typeof DISPATCH_VERSION === 'string', 'should export version string');
    assert.ok(DISPATCH_VERSION.length > 0, 'version should not be empty');
  });
});
