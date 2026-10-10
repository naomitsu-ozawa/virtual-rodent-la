import { test, expect } from '@playwright/test';
import { dicomFolder } from '../helpers/dicom-folder.js';

// build 536: the 3D analysis overlay is pointer-events:none so the 3D view rotates under it; the HU histogram
// chart must take the pointer itself, or dragging a range line rotates the 3D view instead (build 534/535 bug).
test('HU histogram: dragging a range line moves the segment slider, not the 3D view', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await page.locator('#folder-input').setInputFiles(dicomFolder());
  await page.locator('#series-list .series-card').first().click({ timeout: 30_000 });
  await expect(page.locator('.ready-badge').first()).toContainText(/ready/i, { timeout: 60_000 });
  await page.evaluate(() => {
    const sel = document.getElementById('segment-add-select'), btn = document.getElementById('segment-add-button');
    sel.value = 'soft'; sel.dispatchEvent(new Event('change')); btn.click();
  });
  await page.locator('#seg-hist-toggle').click();
  const canvas = page.locator('.seg-hist-canvas');
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox(), y = box.y + 60;
  // the chart itself is what the pointer hits (not the 3D renderer canvas behind the overlay)
  expect(await page.evaluate(([x, yy]) => document.elementFromPoint(x, yy)?.classList.contains('seg-hist-canvas'), [box.x + box.width / 2, y])).toBe(true);
  const minSlider = page.locator('[data-seg-min="soft"]');
  await expect.poll(async () => (await canvas.evaluate(c => c.width)) > 0).toBe(true);
  const before = Number(await minSlider.inputValue());
  // find the min line with real mouse moves (the cursor turns ew-resize over a line)
  let grab = null;
  for (let x = box.x + 30; x < box.x + box.width && grab == null; x += 2) {
    await page.mouse.move(x, y);
    if (await canvas.evaluate(c => c.style.cursor) === 'ew-resize') grab = x;
  }
  expect(grab, 'a range line under the pointer').not.toBeNull();
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(grab + i * 4, y);
  await page.mouse.up();
  await expect.poll(async () => Number(await minSlider.inputValue())).toBeGreaterThan(before);
  expect(errors).toEqual([]);
});

// build 540: the histogram card also lives in the analysis dock; in 2D-only it is reachable from the toolbar and never covers a slice view.
test('HU histogram in 2D-only mode: toolbar button opens it in the dock, chart takes the pointer, dock resizes', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await page.locator('#folder-input').setInputFiles(dicomFolder());
  await page.locator('#series-list .series-card').first().click({ timeout: 30_000 });
  await expect(page.locator('.ready-badge').first()).toContainText(/ready/i, { timeout: 60_000 });
  await page.evaluate(() => {
    const sel = document.getElementById('segment-add-select'), btn = document.getElementById('segment-add-button');
    sel.value = 'soft'; sel.dispatchEvent(new Event('change')); btn.click();
  });
  await page.locator('[data-ipad-view-mode="2d"]').click();
  await page.locator('[data-dock-tool="hist"]').click();
  const dock = page.locator('#analysis-dock');
  await expect(dock).toBeVisible();
  const canvas = dock.locator('.seg-hist-canvas');
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  expect(await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.classList.contains('seg-hist-canvas'), [box.x + box.width / 2, box.y + 60])).toBe(true);
  const d = await dock.boundingBox(), a = await page.locator('#sub-view-slots').boundingBox();
  expect(!(d.x + d.width <= a.x + 1 || a.x + a.width <= d.x + 1 || d.y + d.height <= a.y + 1 || a.y + a.height <= d.y + 1)).toBe(false);
  // drag the free edge: the dock grows and the size is remembered for this mode
  const place = await dock.getAttribute('data-place'), grip = await dock.locator('.analysis-dock-grip').boundingBox();
  const gx = grip.x + (place === 'side' ? 3 : grip.width / 2), gy = grip.y + (place === 'side' ? grip.height / 2 : 3);
  await page.mouse.move(gx, gy);
  await page.mouse.down(); await page.mouse.move(place === 'side' ? gx - 60 : gx, place === 'side' ? gy : gy - 60, { steps: 6 }); await page.mouse.up();
  const d2 = await dock.boundingBox();
  expect(place === 'side' ? d2.width : d2.height).toBeGreaterThan((place === 'side' ? d.width : d.height) + 20);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('vrl-analysis-dock-v1'))['2d'].open)).toBe(true);
  expect(errors).toEqual([]);
});
