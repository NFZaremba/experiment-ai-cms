// In-place editor e2e — drives the real page directly (no iframe / frameLocator).
// Covers: pencil auth gate, enter-edit, text edit (live DOM + draft),
// chrome-exclusion (clicking the panel doesn't deselect), drag reorder, and the
// publish payload. Run with the dev server up on :3002.
import { chromium } from 'file:///Users/nickzaremba/Documents/certainly/iwbi/onewell-standard-frontend/node_modules/playwright/index.mjs';

const BASE = 'http://localhost:3002';
const browser = await chromium.launch();
const fails = [];
const check = (name, cond) => { console.log(`${cond ? 'PASS' : 'FAIL'}: ${name}`); if (!cond) fails.push(name); };

async function newPage({ authed }) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => fails.push('pageerror: ' + String(e).slice(0, 160)));
  // Auth gate is server-side; stub /api/studio/me to control the pencil deterministically.
  await ctx.route('**/api/studio/me', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ authed }) }));
  await ctx.route('**/api/studio/preview**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ preview: null }) }));
  return page;
}

// ---- A. Auth gate: anon visitor sees no pencil, no toolbar ----
{
  const page = await newPage({ authed: false });
  await page.goto(`${BASE}/about`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.waitForTimeout(800);
  const pencil = await page.locator('[data-studio-chrome][aria-label="Edit this page"]').count();
  const toolbar = await page.getByText('Content Studio').count();
  check('anon: no pencil on /about', pencil === 0);
  check('anon: no toolbar on /about', toolbar === 0);
  await page.context().close();
}

// ---- B. Published safety: authed but NOT editing → pencil, no toolbar, no handles ----
{
  const page = await newPage({ authed: true });
  await page.goto(`${BASE}/about`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.waitForTimeout(900);
  check('authed: pencil visible on /about', await page.locator('[data-studio-chrome][aria-label="Edit this page"]').count() === 1);
  check('authed (not editing): no toolbar', await page.getByText('Content Studio').count() === 0);
  check('authed (not editing): no drag handles', await page.locator('button[aria-label^="Drag to reorder"]').count() === 0);
  await page.context().close();
}

// ---- C. Edit loop on /about?edit=1 ----
{
  const page = await newPage({ authed: true });
  let pub = null;
  await page.context().route('**/api/studio/publish', r => { pub = r.request().postDataJSON(); r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ prNumber: 1, prUrl: 'x', previewUrl: 'x', headSha: 'a' }) }); });
  await page.goto(`${BASE}/about?edit=1`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });

  // overlay + handles ready
  let ready = false;
  for (let i = 0; i < 60; i++) {
    const t = await page.getByText('Content Studio').count();
    const h = await page.locator('button[aria-label^="Drag to reorder"]').count();
    if (t === 1 && h >= 2) { ready = true; break; }
    await page.waitForTimeout(400);
  }
  check('edit: toolbar + drag handles ready', ready);

  // C1. Text edit — click a heading, panel anchors near click, edit, apply, live DOM + draft.
  const headingSel = '[data-content-path="hero.title"]';
  const hasHeading = await page.locator(headingSel).count() > 0;
  check('edit: hero.title present', hasHeading);
  if (hasHeading) {
    const box = await page.locator(headingSel).first().boundingBox();
    await page.locator(headingSel).first().scrollIntoViewIfNeeded();
    const b2 = await page.locator(headingSel).first().boundingBox();
    await page.mouse.click(b2.x + 12, b2.y + b2.height / 2);
    await page.waitForTimeout(300);
    const panel = page.locator('[data-studio-panel]');
    check('edit: panel opened on text click', await panel.count() === 1);

    // chrome-exclusion: clicking inside the panel must NOT close it.
    const codeChip = panel.locator('code').first();
    await codeChip.click();
    await page.waitForTimeout(150);
    check('chrome-exclusion: panel stays open after clicking inside it', await panel.count() === 1);

    // edit the textarea + apply
    const ta = panel.locator('textarea').first();
    if (await ta.count() === 1) {
      await ta.fill('EDITED HEADING ✦');
      await panel.getByRole('button', { name: 'Apply' }).click();
      await page.waitForTimeout(300);
      const domText = (await page.locator(headingSel).first().textContent())?.trim();
      check('edit: DOM updated to new text', domText === 'EDITED HEADING ✦');
      const draft = await page.evaluate(() => JSON.parse(localStorage.getItem('studio-draft-v2') || '{}')?.state?.pages?.about?.edits?.['hero.title']);
      check('edit: draft recorded for hero.title', draft === 'EDITED HEADING ✦');
    } else {
      check('edit: textarea present in panel', false);
    }
  }

  // C1b. Icon edit — click a solutions icon, pick a different one from the grid.
  const iconSel = '[data-content-path="solutions.items.talent.icon"]';
  if (await page.locator(iconSel).count() > 0) {
    await page.locator(iconSel).first().scrollIntoViewIfNeeded();
    const ib = await page.locator(iconSel).first().boundingBox();
    await page.mouse.click(ib.x + ib.width / 2, ib.y + ib.height / 2);
    await page.waitForTimeout(300);
    const panel = page.locator('[data-studio-panel]');
    check('icon: picker opened', await panel.count() === 1 && await panel.locator('button[aria-label="heart"]').count() === 1);
    await panel.locator('button[aria-label="heart"]').click();
    await panel.getByRole('button', { name: 'Apply' }).click();
    await page.waitForTimeout(300);
    const cur = await page.locator(iconSel).first().getAttribute('data-current');
    check('icon: data-current updated to heart', cur === 'heart');
    const draft = await page.evaluate(() => JSON.parse(localStorage.getItem('studio-draft-v2') || '{}')?.state?.pages?.about?.edits?.['solutions.items.talent.icon']);
    check('icon: draft recorded', draft === 'heart');
  } else {
    check('icon: solutions.items.talent.icon present', false);
  }

  // C1c. Avatar edit — click an initials avatar, set an image URL, <img> appears live.
  const avSel = '[data-content-path="team.members.rachel-hodgdon.image"]';
  if (await page.locator(avSel).count() > 0) {
    await page.locator(avSel).first().scrollIntoViewIfNeeded();
    const ab = await page.locator(avSel).first().boundingBox();
    await page.mouse.click(ab.x + ab.width / 2, ab.y + ab.height / 2);
    await page.waitForTimeout(300);
    const panel = page.locator('[data-studio-panel]');
    const urlInput = panel.locator('input[placeholder^="https://res.cloudinary"]');
    check('avatar: image editor opened', await urlInput.count() === 1);
    const TEST_IMG = 'https://example.com/avatar.jpg';
    await urlInput.fill(TEST_IMG);
    await panel.getByRole('button', { name: 'Apply' }).click();
    await page.waitForTimeout(300);
    const imgSrc = await page.locator(`img${avSel}`).first().getAttribute('src').catch(() => null);
    check('avatar: <img> rendered with new src', imgSrc === TEST_IMG);
    const draft = await page.evaluate(() => JSON.parse(localStorage.getItem('studio-draft-v2') || '{}')?.state?.pages?.about?.edits?.['team.members.rachel-hodgdon.image']);
    check('avatar: draft recorded as image object', draft?.src === 'https://example.com/avatar.jpg');
  } else {
    check('avatar: team.members.rachel-hodgdon.image present', false);
  }

  // C2. Click empty area → panel closes (deselect).
  await page.mouse.click(5, 700);
  await page.waitForTimeout(200);
  check('deselect: clicking empty area closes the panel', await page.locator('[data-studio-panel]').count() === 0);

  // C3. Drag reorder team members (same as before, but no iframe offset).
  const coords = await page.evaluate(() => {
    const h1 = document.querySelector('button[aria-label="Drag to reorder Rachel Hodgdon"]');
    const h2 = document.querySelector('button[aria-label="Drag to reorder Prateek Khanna"]');
    if (!h1 || !h2) return null;
    h1.scrollIntoView({ block: 'center' });
    const r1 = h1.getBoundingClientRect();
    const r2 = h2.getBoundingClientRect();
    return { h1: { x: r1.left + r1.width / 2, y: r1.top + r1.height / 2 }, h2: { x: r2.left + r2.width / 2, y: r2.top + r2.height / 2 } };
  });
  check('drag: team handles found', !!coords);
  if (coords) {
    const firstName = () => page.evaluate(() => document.querySelector('[data-content-path^="team.members."][data-content-path$=".name"]').textContent.trim());
    const before = await firstName();
    await page.mouse.move(coords.h1.x, coords.h1.y);
    await page.mouse.down();
    await page.mouse.move(coords.h1.x + 8, coords.h1.y + 8, { steps: 5 });
    await page.mouse.move(coords.h2.x, coords.h2.y, { steps: 15 });
    await page.mouse.move(coords.h2.x + 2, coords.h2.y, { steps: 3 });
    await page.waitForTimeout(200);
    await page.mouse.up();
    await page.waitForTimeout(700);
    const after = await firstName();
    check('drag: first team member changed after reorder', before !== after);
  }

  // C4. Publish → payload carries the right page + edits/order.
  await page.locator('[data-studio-chrome] button', { hasText: /^Publish$/ }).click();
  await page.waitForTimeout(900);
  check('publish: payload page === about', pub?.page === 'about');
  check('publish: hero.title edit in payload', pub?.edits?.['hero.title'] === 'EDITED HEADING ✦');
  check('publish: team.members order is an array', Array.isArray(pub?.edits?.['team.members']));
  check('publish: solutions icon edit in payload', pub?.edits?.['solutions.items.talent.icon'] === 'heart');
  check('publish: avatar image edit in payload', pub?.edits?.['team.members.rachel-hodgdon.image']?.src === 'https://example.com/avatar.jpg');

  await page.context().close();
}

console.log(fails.length ? `\n${fails.length} FAILURE(S): ${JSON.stringify(fails)}` : '\nALL CHECKS PASSED');
await browser.close();
process.exit(fails.length ? 1 : 0);
