/**
 * chat-sessions.test.ts — e2e tests for document-scoped chat sessions
 * and the aiSpecialist() bridge method.
 *
 * Run against a live DocWright dev server (OpenCode must be running):
 *   npx tsx test/webui/chat-sessions.test.ts
 *
 * Tests skip gracefully when OpenCode is unreachable.
 */

import { chromium } from 'playwright';

const BASE = process.env.DOCWRIGHT_TEST_URL ?? 'http://localhost:5173';
const LS_KEY = 'dw-chat-sessions';

const results: { name: string; passed: boolean; detail?: string }[] = [];
function pass(name: string) { results.push({ name, passed: true }); console.log(`  ✓ ${name}`); }
function fail(name: string, detail: string) { results.push({ name, passed: false, detail }); console.log(`  ✗ ${name}: ${detail}`); }
function skip(name: string, reason: string) { console.log(`  ⊘ ${name} — skipped: ${reason}`); }

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx    = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page   = await ctx.newPage();

  // Check if the dev server is reachable at all
  try {
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 10000 });
  } catch {
    console.log('Dev server not reachable — skipping all chat session tests');
    await browser.close();
    process.exit(0);
  }

  // Check if OpenCode is reachable
  const ocReachable = await page.evaluate(async () => {
    try {
      const r = await fetch('http://localhost:4096/global/health');
      return r.ok;
    } catch { return false; }
  });

  // ── /api/ai-specialist endpoint ───────────────────────────────────────────
  console.log('\n── /api/ai-specialist ──');
  const roleRes = await page.request.get(`${BASE}/api/ai-specialist`);
  if (!roleRes.ok()) {
    fail('GET /api/ai-specialist', `HTTP ${roleRes.status()}`);
  } else {
    const roles = await roleRes.json() as Array<{ id: string; description: string }>;
    if (roles.length >= 4) pass('GET /api/ai-specialist returns 4 roles');
    else fail('GET /api/ai-specialist role count', `expected ≥4, got ${roles.length}`);

    const hasAll = ['doc-reviewer','doc-improver','plan-executor','doc-assistant']
      .every(id => roles.some(r => r.id === id));
    if (hasAll) pass('All 4 expected roles present');
    else fail('Role IDs', `missing one or more: ${roles.map(r => r.id).join(', ')}`);
  }

  // ── Bridge aiRoles array ──────────────────────────────────────────────────
  console.log('\n── bridge.aiRoles ──');
  await page.goto(`${BASE}/status`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(1000);
  const aiRoles = await page.evaluate(() => (window as any).__docwright?.bridge?.aiRoles);
  if (Array.isArray(aiRoles) && aiRoles.length >= 4) pass('bridge.aiRoles is an array with ≥4 entries');
  else fail('bridge.aiRoles', `got: ${JSON.stringify(aiRoles)}`);

  // ── aiSpecialist() bridge method ──────────────────────────────────────────
  console.log('\n── bridge.aiSpecialist() ──');
  if (!ocReachable) {
    skip('bridge.aiSpecialist returns text', 'OpenCode not running');
  } else {
    const result = await page.evaluate(async () => {
      try {
        const bridge = (window as any).__docwright?.bridge;
        if (!bridge?.aiSpecialist) return { error: 'aiSpecialist not on bridge' };
        const text = await bridge.aiSpecialist('doc-reviewer', 'Review this: "Step 1: Do the thing."');
        return { text };
      } catch (e: any) { return { error: e?.message ?? String(e) }; }
    });
    if ((result as any).text && (result as any).text.length > 10) {
      pass('bridge.aiSpecialist("doc-reviewer") returns non-empty text');
    } else {
      fail('bridge.aiSpecialist', (result as any).error ?? 'empty response');
    }
  }

  // ── Document-scoped session map — stale recovery ──────────────────────────
  console.log('\n── Session stale recovery ──');
  if (!ocReachable) {
    skip('Stale session recovery', 'OpenCode not running');
  } else {
    // Inject a bad session ID into localStorage and navigate to a doc
    await page.evaluate((lsKey) => {
      const map = { 'plans/unify-ai-via-opencode.md': { sessionId: 'ses_INVALID_STALE_ID', lastUsed: Date.now() } };
      localStorage.setItem(lsKey, JSON.stringify(map));
    }, LS_KEY);

    // Navigate to the plan — chat panel will try to reconnect and should recover
    await page.goto(`${BASE}/plans/unify-ai-via-opencode`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(1500);

    // Open chat panel (click the ⚡ Chat button if it exists)
    const chatBtn = page.locator('button:has-text("Chat"), button[title*="Chat"]').first();
    if (await chatBtn.isVisible()) {
      await chatBtn.click();
      await page.waitForTimeout(2000);
    }

    // Check that localStorage no longer has the stale ID
    const mapAfter = await page.evaluate((lsKey) => {
      try { return JSON.parse(localStorage.getItem(lsKey) ?? '{}'); } catch { return {}; }
    }, LS_KEY);

    const entry = mapAfter['plans/unify-ai-via-opencode.md'];
    if (!entry || entry.sessionId !== 'ses_INVALID_STALE_ID') {
      pass('Stale session cleared from localStorage after recovery');
    } else {
      fail('Stale session recovery', 'INVALID_STALE_ID still present in map — may not have triggered');
    }
  }

  // ── Document-scoped sessions — two docs get different IDs ──────────────────
  console.log('\n── Document-scoped sessions ──');
  if (!ocReachable) {
    skip('Two documents get different session IDs', 'OpenCode not running');
  } else {
    // Clear the map
    await page.evaluate((lsKey) => localStorage.removeItem(lsKey), LS_KEY);

    // Open chat on doc A
    await page.goto(`${BASE}/plans/unify-ai-via-opencode`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(1000);
    const chatBtnA = page.locator('button:has-text("Chat"), button[title*="Chat"]').first();
    if (await chatBtnA.isVisible()) { await chatBtnA.click(); await page.waitForTimeout(2000); }

    const mapA = await page.evaluate((lsKey) => {
      try { return JSON.parse(localStorage.getItem(lsKey) ?? '{}'); } catch { return {}; }
    }, LS_KEY);
    const sessionA = mapA['plans/unify-ai-via-opencode.md']?.sessionId;

    // Navigate to doc B
    await page.goto(`${BASE}/plans/chat-architecture-document-scoped-sessions`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000); // $effect triggers session switch

    const mapB = await page.evaluate((lsKey) => {
      try { return JSON.parse(localStorage.getItem(lsKey) ?? '{}'); } catch { return {}; }
    }, LS_KEY);
    const sessionB = mapB['plans/chat-architecture-document-scoped-sessions.md']?.sessionId;

    if (sessionA && sessionB && sessionA !== sessionB) {
      pass('Two different documents get different session IDs');
    } else if (!sessionA || !sessionB) {
      fail('Document session IDs', `A: ${sessionA ?? 'none'}, B: ${sessionB ?? 'none'}`);
    } else {
      fail('Document session IDs', 'both docs got the same session ID');
    }
  }

  await browser.close();

  // ── Summary ───────────────────────────────────────────────────────────────
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed);
  console.log(`\nChat sessions: ${passed} passed, ${failed.length} failed`);
  if (failed.length > 0) {
    for (const f of failed) console.log(`  ✗ ${f.name}: ${f.detail}`);
    process.exit(1);
  }
})();
