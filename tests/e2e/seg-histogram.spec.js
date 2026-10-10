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
