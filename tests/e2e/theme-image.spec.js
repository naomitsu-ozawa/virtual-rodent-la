import { test, expect } from '@playwright/test';
import { dicomFolder } from '../helpers/dicom-folder.js';

// Colour themes (build 450): the image itself does not change with the theme, the background around it does.
// Same check as tools/theme-image-check.mjs (which runs offline): the pixels of the 2D slice canvases are identical in
// all six themes, the 2D background is light in the light themes and dark in the dark ones, and the 3D background is dark in all of them.
const IDS = ['light-standard', 'light-paper', 'light-gray', 'dark-standard', 'dark-reading', 'dark-gray'];

test('the image pixels do not change with the theme; the 2D background follows the theme, the 3D one stays dark', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/');
  await page.locator('#folder-input').setInputFiles(dicomFolder());
  await page.locator('.series-card').first().click();
  await expect(page.locator('.ready-badge').first()).toContainText(/ready/i, { timeout: 60_000 });
  const sample = () => page.evaluate(() => {
    const canvases = [...document.querySelectorAll('.mpr-canvas')].map(c => {
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let h = 0, nz = 0;
      for (let i = 0; i < d.length; i++) { h = (h * 31 + d[i]) >>> 0; if (d[i]) nz++; }
      return { w: c.width, h: c.height, hash: h, nz };
    });
    const lum = el => { const m = getComputedStyle(el).backgroundColor.match(/\d+/g).map(Number); return (m[0] * 299 + m[1] * 587 + m[2] * 114) / 1000; };
    return { canvases, bg2d: lum(document.querySelector('.mpr-canvas')), bg3d: lum(document.querySelector('.view-card-3d')) };
  });
  // the MPR draws in steps: wait until the pixels are the same twice in a row (up to 20 s) before taking the reference
  let prev = null, stable = false;
  for (let i = 0; i < 40 && !stable; i++) {
    await page.waitForTimeout(500);
    const now = JSON.stringify((await sample()).canvases);
    stable = now === prev && !now.includes('"nz":0'); prev = now;
  }
  expect(stable, 'the 2D canvases settle').toBe(true);
  let base = null;
  for (const id of IDS) {
    await page.selectOption('#theme-quick', id);
    await expect(page.locator('html')).toHaveAttribute('data-theme', id);
    const s = await sample();
    if (!base) { base = s.canvases; expect(base.length).toBeGreaterThan(0); expect(base.every(c => c.nz > 0)).toBe(true); }
    expect(s.canvases, id).toEqual(base);
    expect(s.bg3d, id).toBeLessThan(60); // the 3D background is dark in every theme
    if (id.startsWith('light')) expect(s.bg2d, id).toBeGreaterThan(150); else expect(s.bg2d, id).toBeLessThan(60);
  }
});
