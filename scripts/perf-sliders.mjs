// Compare slider responsiveness between two builds served side by side.
//   node scripts/perf-sliders.mjs http://localhost:4173/ http://localhost:4174/
// Loads the public demo in each, then for every visible range input measures
// (a) synchronous cost of an 'input' event + two animation frames and
// (b) a 30-step mouse drag across the slider. Prints a comparison table.
import { chromium } from '@playwright/test';

const urls = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });

async function measure(url) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(url);
  await page.locator('#demo-button').click();
  await page.locator('.ready-badge').first().waitFor({ state: 'attached', timeout: 240_000 });
  await page.waitForFunction(() => /ready/i.test(document.querySelector('.ready-badge')?.textContent || ''), null, { timeout: 240_000 });
  await page.waitForTimeout(1500);
  const ids = await page.$$eval('input[type=range]', els => els.filter(e => e.id && !e.disabled && e.offsetParent).map(e => e.id));
  const out = {};
  for (const id of ids) {
    const dispatchMs = await page.evaluate(async id => {
      const el = document.getElementById(id), min = +el.min || 0, max = +el.max || 100, raf = () => new Promise(r => requestAnimationFrame(() => r()));
      const t0 = performance.now();
      for (let i = 0; i < 10; i++) {
        el.value = String(i % 2 ? min + (max - min) * 0.6 : min + (max - min) * 0.4);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        await raf(); await raf();
      }
      return (performance.now() - t0) / 10;
    }, id);
    const box = await page.locator('#' + id).boundingBox();
    let dragMs = null;
    if (box && box.width > 20) {
      const y = box.y + box.height / 2, t0 = Date.now();
      await page.mouse.move(box.x + box.width * 0.3, y); await page.mouse.down();
      for (let i = 1; i <= 30; i++) await page.mouse.move(box.x + box.width * (0.3 + 0.4 * i / 30), y);
      await page.mouse.up();
      await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
      dragMs = (Date.now() - t0) / 30;
    }
    out[id] = { dispatchMs, dragMs };
  }
  // 3D path: add a bone segment, rebuild 3D, then time surface-smoothing changes
  // until the 3D state returns to "current".
  const threeD = {};
  try {
    await page.selectOption('#segment-add-select', 'bone').catch(() => {});
    await page.locator('#segment-add-button').click({ timeout: 5000 }).catch(() => {});
    const waitCurrent = async (ms) => page.waitForFunction(() => document.querySelector('#filter-3d-state')?.classList.contains('is-current') && !document.querySelector('#three-busy:not(.is-hidden)'), null, { timeout: ms });
    const t0 = Date.now();
    if (await page.locator('#filter-rebuild-3d').isEnabled().catch(() => false)) await page.locator('#filter-rebuild-3d').click();
    await page.waitForTimeout(300); await waitCurrent(240_000);
    threeD.rebuildMs = Date.now() - t0;
    await page.evaluate(() => { const c = document.querySelector('#surface-smooth-enabled'); if (c && !c.checked) { c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); } });
    const times = [];
    for (const v of [2, 5, 3]) {
      const s0 = Date.now();
      await page.evaluate(v => { const el = document.querySelector('#surface-smooth-strength'); el.value = String(v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }, v);
      await page.waitForTimeout(200);
      if (await page.locator('#filter-rebuild-3d').isEnabled().catch(() => false) && await page.locator('#filter-3d-state.is-stale').count()) await page.locator('#filter-rebuild-3d').click();
      await waitCurrent(240_000);
      times.push(Date.now() - s0);
    }
    threeD.smoothMs = times;
    threeD.state = await page.locator('#filter-3d-state').textContent();
  } catch (e) { threeD.error = String(e.message || e).slice(0, 200); }
  const footer = await page.locator('#footer').textContent();
  const gpu = await page.locator('#gpu-status').textContent();
  await page.close();
  return { out, errors, footer, gpu, threeD };
}

const results = [];
for (const u of urls) results.push(await measure(u));
await browser.close();
const ids = [...new Set(results.flatMap(r => Object.keys(r.out)))];
const lines = [`builds: ${urls.join(' vs ')}`];
results.forEach((r, i) => lines.push(`[${i}] gpu="${r.gpu?.trim().slice(0, 90)}" errors=${r.errors.length} 3D=${JSON.stringify(r.threeD)}`));
const rows = ids.map(id => {
  const a = results[0].out[id] || {}, b = results[1]?.out[id] || {};
  return { id, a, b, ratio: (b.dispatchMs || 0) / Math.max(0.5, a.dispatchMs || 0), dragRatio: (b.dragMs || 0) / Math.max(0.5, a.dragMs || 0) };
}).sort((x, y) => Math.max(y.ratio, y.dragRatio) - Math.max(x.ratio, x.dragRatio));
for (const r of rows) lines.push(`${r.id}: input ${r.a.dispatchMs?.toFixed(1)} -> ${r.b.dispatchMs?.toFixed(1)} ms (x${r.ratio.toFixed(2)}) | drag ${r.a.dragMs?.toFixed(1) ?? '-'} -> ${r.b.dragMs?.toFixed(1) ?? '-'} ms/step (x${r.dragRatio.toFixed(2)})`);
console.log(lines.join('\n'));
