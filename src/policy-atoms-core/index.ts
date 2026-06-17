/**
 * policy-atoms-core — Public API.
 *
 * ISOLATION INVARIANT: this package must have zero imports from outside
 * src/policy-atoms-core/. The CI isolation check enforces this.
 */
export * from './schema.js';
export * from './scope.js';
export * from './index-builder.js';
export * from './router.js';
export * from './resolver.js';
export * from './sync-checker.js';
export * from './checks/index.js';
