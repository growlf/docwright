/**
 * Dispatch module tests — run OUTSIDE the VS Code extension host.
 *
 * This test suite deliberately runs without the VS Code runtime.
 * If any test here fails because of a missing 'vscode' module,
 * that means a prohibited import crept into src/dispatch/.
 * Fix the import — do not add vscode to the test environment.
 */
import assert from 'assert';
// Static import — if this fails with "Cannot find module 'vscode'",
// a prohibited import crept into src/dispatch/index.ts or its deps.
// Fix the import — do not add vscode to the test environment.
import * as dispatch from '../../src/dispatch/index';
import { DISPATCH_VERSION } from '../../src/dispatch/index';

describe('Dispatch module', () => {
  it('loads without any vscode dependency', () => {
    assert.ok(dispatch, 'dispatch module should load');
  });

  it('exports DISPATCH_VERSION', () => {
    assert.ok(typeof DISPATCH_VERSION === 'string', 'should export version string');
    assert.ok(DISPATCH_VERSION.length > 0, 'version should not be empty');
  });
});
