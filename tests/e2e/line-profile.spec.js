import { test, expect } from '@playwright/test';
import { dicomFolder } from '../helpers/dicom-folder.js';

// build 537: the line profile tool. Two points on the Axial view -> HU plot + histogram + stats in the 3D analysis overlay.
// The overlay is pointer-events:none, so the plot must be what the pointer hits (not the 3D renderer behind it).
test('line profile: draw a line on the axial view, plot + stats appear, hovering shows HU', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await page.locator('#folder-input').setInputFiles(dicomFolder());
  await page.locator('#series-list .series-card').first().click({ timeout: 30_000 });
  await expect(page.locator('.ready-badge').first()).toContainText(/ready/i, { timeout: 60_000 });
  // the result is shown in the 3D card, the line is drawn on a 2D plane: the split view has both
  await page.locator('[data-ipad-view-mode="split"]').click();
  await page.locator('[data-ipad-mpr="axial"]').click();
  await page.locator('#line-profile-toggle').click();
  const axial = page.locator('#axial-canvas');
  await expect(axial).toBeVisible();
  const b = await axial.boundingBox();
  await page.mouse.move(b.x + b.width * 0.3, b.y + b.height * 0.5);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(b.x + b.width * (0.3 + 0.05 * i), b.y + b.height * 0.5);
  await page.mouse.up();
  const plot = page.locator('#line-profile-result .lp-plot');
  await expect(plot).toBeVisible();
  await expect.poll(async () => Number(await plot.getAttribute('data-n')), { timeout: 30_000 }).toBeGreaterThan(2);
  await expect(page.locator('#line-profile-result .seg-hist-table td').first()).toContainText('mm');
  const pb = await plot.boundingBox(), x = pb.x + pb.width * 0.6, y = pb.y + pb.height / 2;
  expect(await page.evaluate(([px, py]) => document.elementFromPoint(px, py)?.classList.contains('lp-plot'), [x, y])).toBe(true);
  await page.mouse.move(x, y);
  await expect.poll(async () => (await plot.getAttribute('data-hover')) || '').toMatch(/^[\d.]+\|-?[\d.]+$/);
  // build 538: the Filtered / Raw toggle is clickable (pointer-events:auto inside the analysis overlay) and shared by the panels
  const raw = page.locator('#line-profile-result .hu-mode-toggle [data-hu-mode="raw"]');
  await raw.click();
  await expect(raw).toHaveClass(/is-active/);
  await expect(page.locator('#line-profile-result .hu-mode-toggle [data-hu-mode="filtered"]')).not.toHaveClass(/is-active/);
  await expect.poll(async () => Number(await plot.getAttribute('data-n')), { timeout: 30_000 }).toBeGreaterThan(2);
  await page.locator('#line-profile-result .hu-mode-toggle [data-hu-mode="filtered"]').click();
  expect(errors).toEqual([]);
});
