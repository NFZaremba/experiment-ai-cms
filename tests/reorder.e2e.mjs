import { chromium } from 'file:///Users/nickzaremba/Documents/certainly/iwbi/onewell-standard-frontend/node_modules/playwright/index.mjs';
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
let pub = null;
await page.route('**/api/studio/preview**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ preview: null }) }));
await page.route('**/api/studio/publish', r => { pub = r.request().postDataJSON(); r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ prNumber: 1, prUrl: 'x', previewUrl: 'x', headSha: 'a' }) }); });

await page.goto('http://localhost:3002/studio', { waitUntil: 'domcontentloaded' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(900);
await page.selectOption('#studio-page-switcher', 'about');
const ready = async () => page.evaluate(() => { try { const w = document.querySelector('iframe').contentWindow; return w.location.pathname === '/about' && w.document.querySelectorAll('button[aria-label^="Drag to reorder"]').length >= 2; } catch { return false; } });
let ok = false; for (let i = 0; i < 60; i++) { if (await ready()) { ok = true; break; } await page.waitForTimeout(400); }
if (!ok) throw new Error('iframe/about handles not ready');

// scroll the team section into view inside the iframe, then read handle coords
const coords = await page.evaluate(() => {
  const ifr = document.querySelector('iframe');
  const d = ifr.contentWindow.document;
  const handles = [...d.querySelectorAll('button[aria-label^="Drag to reorder"]')]
    .filter(h => h.getAttribute('aria-label').includes('Rachel') || h.getAttribute('aria-label').includes('Prateek'));
  // ensure we have the first two TEAM handles (members)
  const teamHandles = [...d.querySelectorAll('button[aria-label^="Drag to reorder"]')];
  const h1 = d.querySelector('button[aria-label="Drag to reorder Rachel Hodgdon"]');
  const h2 = d.querySelector('button[aria-label="Drag to reorder Prateek Khanna"]');
  h1.scrollIntoView({ block: 'center' });
  const ir = ifr.getBoundingClientRect();
  const r1 = h1.getBoundingClientRect();
  const r2 = h2.getBoundingClientRect();
  return {
    count: teamHandles.length,
    ir: { left: ir.left, top: ir.top },
    h1: { x: ir.left + r1.left + r1.width / 2, y: ir.top + r1.top + r1.height / 2 },
    h2: { x: ir.left + r2.left + r2.width / 2, y: ir.top + r2.top + r2.height / 2 },
  };
});
console.log('handles found:', coords.count, '| h1:', coords.h1, '| h2:', coords.h2);

const firstMemberName = () => page.evaluate(() => document.querySelector('iframe').contentWindow.document.querySelector('[data-content-path^="team.members."][data-content-path$=".name"]').textContent.trim());
const before = await firstMemberName();

// real pointer drag: down on h1, move past activation distance, to h2, drop
await page.mouse.move(coords.h1.x, coords.h1.y);
await page.mouse.down();
await page.mouse.move(coords.h1.x + 8, coords.h1.y + 8, { steps: 5 });
await page.mouse.move(coords.h2.x, coords.h2.y, { steps: 15 });
await page.mouse.move(coords.h2.x + 2, coords.h2.y, { steps: 3 });
await page.waitForTimeout(200);
await page.mouse.up();
await page.waitForTimeout(700);
const afterFirst = await firstMemberName();

// publish, capture payload
await page.locator('header button', { hasText: /^Publish$/ }).dispatchEvent('click');
await page.waitForTimeout(900);

console.log('first member before:', JSON.stringify(before));
console.log('first member after drag:', JSON.stringify(afterFirst));
console.log('changed:', before !== afterFirst);
console.log('publish page:', pub?.page);
const teamOrder = pub?.edits?.['team.members'];
console.log('order edit present + is array:', Array.isArray(teamOrder), JSON.stringify(teamOrder));
console.log('pageerrors:', JSON.stringify(errs));
await browser.close();
