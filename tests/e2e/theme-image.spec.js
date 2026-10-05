import { test, expect } from '@playwright/test';
import { dicomFolder } from '../helpers/dicom-folder.js';

// Colour themes (build 450): the image itself does not change with the theme, the background around it does.
// Same check as tools/theme-image-check.mjs (which runs offline): the pixels of the 2D slice canvases are identical in
// all six themes, and the CSS backgrounds around them are light in the light themes and dark in the dark ones.
const IDS = ['light-standard', 'light-paper', 'light-gray', 'dark-standard', 'dark-reading', 'dark-gray'];

test('the image pixels do not change with the theme; the backgrounds around it follow it', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/');
  await page.locator('#folder-input').setInputFiles(dicomFolder());
  await page.locator('.series-card').first().click();
  await expect(page.locator('.ready-badge').first()).toContainText(/ready/i, { timeout: 60_000 });
  await page.waitForTimeout(2000);
  const sample = () => page.evaluate(() => {
    const canvases = [...document.querySelectorAll('.mpr-canvas')].map(c => {
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let h = 0, nz = 0;
      for (let i = 0; i < d.length; i++) { h = (h * 31 + d[i]) >>> 0; if (d[i]) nz++; }
      return { w: c.width, h: c.height, hash: h, nz };
    });
    const lum = el => { const m = getComputedStyle(el).backgroundColor.match(/\d+/g).map(Number); return (m[0] * 299 + m[1] * 587 + m[2] * 114) / 1000; };
    return { canvases, bg2d: lum(document.querySelector('.mpr-canvas')), bg3d: lum(document.querySelector('.viewport-card')) };
  });
  let base = null;
  for (const id of IDS) {
    await page.selectOption('#theme-quick', id);
    await expect(page.locator('html')).toHaveAttribute('data-theme', id);
    const s = await sample();
    if (!base) { base = s.canvases; expect(base.length).toBeGreaterThan(0); expect(base.every(c => c.nz > 0)).toBe(true); }
    expect(s.canvases, id).toEqual(base);
    if (id.startsWith('light')) { expect(s.bg2d, id).toBeGreaterThan(150); expect(s.bg3d, id).toBeGreaterThan(150); }
    else { expect(s.bg2d, id).toBeLessThan(60); expect(s.bg3d, id).toBeLessThan(60); }
  }
});
