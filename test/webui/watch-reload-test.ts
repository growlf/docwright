import { chromium } from 'playwright';
import * as fs from 'node:fs';

const BASE = 'http://localhost:5173';
const PLAN = '/home/netyeti/Projects/DocWright/plans/multiuser-auth-concurrent-sessions.md';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Navigate to the plan page
  await page.goto(`${BASE}/plans/multiuser-auth-concurrent-sessions`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(1500);

  // Confirm initial content
  const before = await page.content();
  const hadSteps = before.includes('Foundation') || before.includes('session middleware');
  console.log('Page loaded. Has real steps initially:', hadSteps);

  // Append a marker to the plan file to trigger a change
  const original = fs.readFileSync(PLAN, 'utf8');
  const marked = original + '\n<!-- watch-test -->';
  fs.writeFileSync(PLAN, marked, 'utf8');
  console.log('File written. Waiting for SSE reload...');

  // Wait up to 3s for the page to reload its content
  await page.waitForTimeout(3000);

  const after = await page.content();
  const reloaded = after.includes('watch-test');
  console.log('Page reloaded with new content:', reloaded);

  // Restore the file
  fs.writeFileSync(PLAN, original, 'utf8');
  await browser.close();

  if (!reloaded) {
    console.log('BUG: file change did not trigger page reload');
    process.exit(1);
  }
  console.log('PASS: SSE watch triggers page reload correctly');
})();
