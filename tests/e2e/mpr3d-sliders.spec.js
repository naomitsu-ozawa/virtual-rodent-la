import { test, expect } from '@playwright/test';
import { dicomFolder } from '../helpers/dicom-folder.js';

// Planes shown inside the 3D view get their own slice sliders (the 2D cards
// and their sliders are hidden in 3D-only layouts). They drive the real plane
// sliders and follow them.
test('3D plane slice sliders appear with the plane and drive the 2D slice', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await page.locator('#folder-input').setInputFiles(dicomFolder());
  await page.locator('#series-list .series-card').first().click({ timeout: 30_000 });
  await expect(page.locator('.ready-badge').first()).toContainText(/ready/i, { timeout: 60_000 });

  const proxy = page.locator('#mpr3d-slider-axial');
  await expect(proxy).toBeHidden();
  await page.locator('[data-3d-overlay="axial"]').click();
  await expect(proxy).toBeVisible();
  await expect(page.locator('#mpr3d-slider-coronal')).toBeHidden();
  await expect(proxy).toHaveAttribute('max', await page.locator('#axial-slider').getAttribute('max'));

  // moving the 3D slider moves the real axial slice
  await proxy.evaluate(el => { el.value = '3'; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); });
  await expect(page.locator('#axial-slider')).toHaveValue('3');
  await expect(page.locator('#axial-label')).toHaveText('4');
  // and follows the real slider
  await page.locator('#axial-slider').evaluate(el => { el.value = '7'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await expect(proxy).toHaveValue('7');

  await page.locator('[data-3d-overlay="axial"]').click(); // hide the plane again
  await expect(proxy).toBeHidden();
  expect(errors).toEqual([]);
});
