# ui-test-before-submit

**Auto-enforced rule for UI stability.**

Before marking any plan ready-for-review after UI changes:

1. `npm run typecheck` passes
2. `npm run test:webui` passes (or relevant test suite)
3. Visual check completed — browser renders without errors, affected components work

Overlay errors, missing elements, or unhandled console exceptions are blockers.
Do not proceed past a UI change without confirming it renders.

See `policies/core/ui-test-before-submit.md` for full rationale.
