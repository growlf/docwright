/**
 * ai-gateway.test.ts — smoke tests for the OpenCode-unified AI routes.
 *
 * Run against a live DocWright dev server:
 *   npm run test:ai-gateway
 *
 * Requires OPENCODE_URL to be reachable and OpenCode to have a model selected.
 */

const BASE = process.env.DOCWRIGHT_TEST_URL ?? 'http://localhost:5173';

interface TestResult { name: string; passed: boolean; detail?: string }
const results: TestResult[] = [];

function pass(name: string) { results.push({ name, passed: true }); console.log(`  ✓ ${name}`); }
function fail(name: string, detail: string) { results.push({ name, passed: false, detail }); console.log(`  ✗ ${name}: ${detail}`); }

// ── /api/config ──────────────────────────────────────────────────────────────
console.log('\n── /api/config ──');
const cfgRes = await fetch(`${BASE}/api/config`);
if (!cfgRes.ok) {
  fail('/api/config', `HTTP ${cfgRes.status}`);
} else {
  const cfg = await cfgRes.json() as { vaultRoot?: string; aiGateway?: { url?: string; defaultModel?: string | null } };
  if (cfg.vaultRoot) pass('/api/config returns vaultRoot');
  else fail('/api/config vaultRoot', 'missing or empty');

  if (cfg.aiGateway?.url) pass('/api/config returns aiGateway.url');
  else fail('/api/config aiGateway.url', 'missing');

  // defaultModel can be null (unset) — that's valid
  if ('defaultModel' in (cfg.aiGateway ?? {})) pass('/api/config aiGateway.defaultModel present (may be null)');
  else fail('/api/config aiGateway.defaultModel', 'key missing');
}

// ── /api/synthesize ──────────────────────────────────────────────────────────
console.log('\n── /api/synthesize ──');
const synthRes = await fetch(`${BASE}/api/synthesize`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    responses: [
      { label: 'A', text: 'Option A is simpler.' },
      { label: 'B', text: 'Option B is more scalable.' },
    ],
  }),
});
if (!synthRes.ok) {
  fail('/api/synthesize', `HTTP ${synthRes.status}`);
} else {
  const data = await synthRes.json() as { synthesis?: string; error?: string };
  if (data.synthesis && data.synthesis.length > 10) pass('/api/synthesize returns synthesis text');
  else if (data.error) fail('/api/synthesize', `AI error: ${data.error}`);
  else fail('/api/synthesize', 'empty synthesis');
}

// ── /api/plan-review ─────────────────────────────────────────────────────────
// Use a real plan that exists in the vault
console.log('\n── /api/plan-review ──');
const planRes = await fetch(`${BASE}/api/plan-review`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ path: 'plans/unify-ai-via-opencode.md' }),
});
if (!planRes.ok) {
  fail('/api/plan-review', `HTTP ${planRes.status}`);
} else {
  // SSE stream — collect events
  const text = await planRes.text();
  const hasDone = text.includes('event: done');
  const hasContent = text.includes('event: step-review') || text.includes('event: overview');
  if (hasDone && hasContent) pass('/api/plan-review streams step-review/overview events and closes');
  else if (hasDone) fail('/api/plan-review', 'done fired but no step-review or overview events');
  else fail('/api/plan-review', 'stream did not close with done event');
}

// ── /api/apply-review (no-op — empty reviews) ────────────────────────────────
console.log('\n── /api/apply-review (empty reviews) ──');
const applyRes = await fetch(`${BASE}/api/apply-review`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    path: 'plans/unify-ai-via-opencode.md',
    steps: {},
    sections: {},
    overview: '',
  }),
});
if (!applyRes.ok) {
  fail('/api/apply-review (empty)', `HTTP ${applyRes.status}`);
} else {
  const data = await applyRes.json() as { error?: string; improved?: string };
  // With empty reviews, it should return an error or the original body unchanged
  if (data.error || data.improved !== undefined) pass('/api/apply-review handles empty reviews gracefully');
  else fail('/api/apply-review (empty)', `unexpected response: ${JSON.stringify(data)}`);
}

// ── Summary ──────────────────────────────────────────────────────────────────
const passed = results.filter(r => r.passed).length;
const failed = results.filter(r => !r.passed);
console.log(`\nAI gateway: ${passed} passed, ${failed.length} failed`);
if (failed.length > 0) {
  for (const f of failed) console.log(`  ✗ ${f.name}: ${f.detail}`);
  process.exit(1);
}
