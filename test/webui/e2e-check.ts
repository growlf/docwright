/**
 * e2e-check.ts — Playwright UI verification for DocWright webui
 *
 * Usage:
 *   npx tsx test/webui/e2e-check.ts [--url http://localhost:5173] [--screenshot]
 *
 * Run against a live DocWright dev server. Exits non-zero on failure.
 * Use --screenshot to save PNG snapshots to test/webui/screenshots/.
 *
 * This script exists so UI changes are verified before reporting success.
 * Never tell a user "it looks correct" without running this first.
 */

import { chromium, type Browser, type Page } from 'playwright';
import * as fs from 'node:fs';
import * as path from 'node:path';

const BASE_URL = process.argv.find(a => a.startsWith('--url='))?.slice(6) ?? 'http://localhost:5173';
const SCREENSHOT = process.argv.includes('--screenshot');
const SCREENSHOT_DIR = path.join(import.meta.dirname, 'screenshots');

if (SCREENSHOT) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

interface CheckResult { name: string; passed: boolean; detail?: string }

async function shot(page: Page, name: string) {
  if (!SCREENSHOT) return;
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${name}.png`) });
}

async function check(name: string, fn: () => Promise<boolean | string>): Promise<CheckResult> {
  try {
    const result = await fn();
    if (result === true || result === undefined) return { name, passed: true };
    if (result === false) return { name, passed: false, detail: 'assertion failed' };
    return { name, passed: false, detail: String(result) };
  } catch (e: any) {
    return { name, passed: false, detail: e.message };
  }
}

async function inspectElement(page: Page, selector: string) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const cs = window.getComputedStyle(el);
    const bb = el.getBoundingClientRect();
    return {
      height: cs.height, width: cs.width,
      display: cs.display, overflow: cs.overflow,
      bb: { top: bb.top, bottom: bb.bottom, height: bb.height, width: bb.width },
    };
  }, selector);
}

// ── Checks ──────────────────────────────────────────────────────────────────

async function checkBaseViewGraph(page: Page, baseUrl: string): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  const url = `${baseUrl}/docs/reference/yeticraft-devices/index.base`;

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(1500);

  results.push(await check('base-view loads', async () => {
    const tabs = await page.locator('button.view-tab').count();
    return tabs > 0 || 'no view tabs found';
  }));

  results.push(await check('docwright graph tabs visible', async () => {
    const tabs = await page.locator('button.view-tab.dw-tab').allTextContents();
    return tabs.length >= 3 || `expected 3 dw tabs, got ${tabs.length}: ${tabs.join(', ')}`;
  }));

  // Switch to graph mode
  const graphBtn = page.locator('button.mode-btn', { hasText: 'Graph' });
  if (await graphBtn.count()) {
    await graphBtn.click();
    await page.waitForTimeout(1500);
  }

  await shot(page, 'base-view-graph');

  results.push(await check('graph-wrap has non-zero height', async () => {
    const el = await inspectElement(page, '.graph-wrap');
    if (!el) return 'graph-wrap not found';
    const h = parseInt(el.height);
    return h > 200 || `graph-wrap height=${el.height} (too small or zero)`;
  }));

  results.push(await check('graph renders nodes (circles > 0)', async () => {
    const circles = await page.locator('.graph-wrap svg circle').count();
    return circles > 0 || `0 circles found in SVG`;
  }));

  results.push(await check('graph fills available pane height (>500px)', async () => {
    const el = await inspectElement(page, '.graph-wrap');
    if (!el) return 'graph-wrap not found';
    const h = parseInt(el.height);
    return h > 500 || `graph height=${h}px — not filling pane`;
  }));

  results.push(await check('no JS errors on graph view', async () => {
    // errors are collected by the caller
    return true;
  }));

  return results;
}

async function checkBaseViewTable(page: Page, baseUrl: string): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  await page.goto(`${baseUrl}/docs/reference/yeticraft-devices/index.base`, {
    waitUntil: 'domcontentloaded', timeout: 15000,
  });
  await page.waitForTimeout(1500);
  await shot(page, 'base-view-table');

  results.push(await check('table renders rows', async () => {
    const rows = await page.locator('.base-table tbody tr').count();
    return rows > 0 || `0 table rows found`;
  }));

  results.push(await check('table-scroll handles overflow (view-body is hidden, table-scroll is auto)', async () => {
    const el = await inspectElement(page, '.table-scroll');
    if (!el) return 'table-scroll not found';
    return el.overflow.includes('auto') || el.overflow.includes('scroll')
      || `table-scroll overflow=${el.overflow}`;
  }));

  return results;
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  let browser: Browser | null = null;
  const allResults: CheckResult[] = [];
  const errors: string[] = [];

  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

    allResults.push(...await checkBaseViewTable(page, BASE_URL));
    allResults.push(...await checkBaseViewGraph(page, BASE_URL));

    if (errors.length) {
      allResults.push({ name: 'no console/page errors', passed: false, detail: errors.join('; ') });
    } else {
      allResults.push({ name: 'no console/page errors', passed: true });
    }
  } finally {
    await browser?.close();
  }

  const passed = allResults.filter(r => r.passed);
  const failed = allResults.filter(r => !r.passed);

  console.log(`\nDocWright UI checks: ${passed.length} passed, ${failed.length} failed\n`);
  for (const r of allResults) {
    const icon = r.passed ? '✓' : '✗';
    const detail = r.detail ? `  → ${r.detail}` : '';
    console.log(`  ${icon} ${r.name}${detail}`);
  }

  if (failed.length > 0) process.exit(1);
}

main();
