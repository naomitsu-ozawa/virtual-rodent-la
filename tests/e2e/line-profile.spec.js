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

// build 540: the result lives in the analysis dock. 2D-only: no auto-switch to split; the dock is a strip that never covers a slice view.
test('line profile in 2D-only mode: result appears in the dock below the slices, the view mode is unchanged', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await page.locator('#folder-input').setInputFiles(dicomFolder());
  await page.locator('#series-list .series-card').first().click({ timeout: 30_000 });
  await expect(page.locator('.ready-badge').first()).toContainText(/ready/i, { timeout: 60_000 });
  await page.locator('[data-ipad-view-mode="2d"]').click();
  await page.locator('[data-ipad-mpr="axial"]').click();
  await page.locator('[data-dock-tool="line"]').click(); // the toolbar button: the 3D card's own button is hidden in 2D-only
  await expect(page.locator('.app-shell')).toHaveClass(/ipad-mode-2d/); // no auto-switch to split
  const dock = page.locator('#analysis-dock');
  await expect(dock).toBeVisible();
  await expect(dock).toHaveAttribute('data-mode', '2d');
  const axial = page.locator('#axial-canvas'), b = await axial.boundingBox();
  await page.mouse.move(b.x + b.width * 0.3, b.y + b.height * 0.5);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(b.x + b.width * (0.3 + 0.05 * i), b.y + b.height * 0.5);
  await page.mouse.up();
  const plot = dock.locator('#line-profile-result .lp-plot');
  await expect(plot).toBeVisible();
  await expect.poll(async () => Number(await plot.getAttribute('data-n')), { timeout: 30_000 }).toBeGreaterThan(2);
  // never covers a view: the dock and the slice canvas do not overlap
  const d = await dock.boundingBox(), a = await axial.boundingBox();
  const overlap = !(d.x + d.width <= a.x + 1 || a.x + a.width <= d.x + 1 || d.y + d.height <= a.y + 1 || a.y + a.height <= d.y + 1);
  expect(overlap).toBe(false);
  // the plot takes the pointer itself
  const pb = await plot.boundingBox(), x = pb.x + pb.width * 0.5, y = pb.y + pb.height / 2;
  expect(await page.evaluate(([px, py]) => document.elementFromPoint(px, py)?.classList.contains('lp-plot'), [x, y])).toBe(true);
  // collapse: only the header stays; the choice is remembered for this mode
  await dock.locator('[data-dock-act="collapse"]').click();
  await expect(dock.locator('.analysis-dock-body')).toBeHidden();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('vrl-analysis-dock-v1'))['2d'].open)).toBe(false);
  await dock.locator('[data-dock-act="collapse"]').click();
  await expect(dock.locator('.analysis-dock-body')).toBeVisible();
  expect(errors).toEqual([]);
});

// split: the dock is a grid track under the 2D column (or full width), never an overlay on the 3D card
test('line profile in split mode: dock outside both views; placement button switches to full width', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await page.locator('#folder-input').setInputFiles(dicomFolder());
  await page.locator('#series-list .series-card').first().click({ timeout: 30_000 });
  await expect(page.locator('.ready-badge').first()).toContainText(/ready/i, { timeout: 60_000 });
  await page.locator('[data-ipad-view-mode="split"]').click();
  await page.locator('[data-dock-tool="line"]').click();
  const dock = page.locator('#analysis-dock');
  await expect(dock).toBeVisible();
  const grid = page.locator('#viewer-grid');
  await expect(grid).toHaveAttribute('data-dock', 'split-under2d');
  const overlaps = async sel => {
    const d = await dock.boundingBox(), o = await page.locator(sel).boundingBox();
    return !(d.x + d.width <= o.x + 1 || o.x + o.width <= d.x + 1 || d.y + d.height <= o.y + 1 || o.y + o.height <= d.y + 1);
  };
  expect(await overlaps('#main-view-slot')).toBe(false);
  expect(await overlaps('#sub-view-slots')).toBe(false);
  await dock.locator('[data-dock-act="place"]').click();
  await expect(grid).toHaveAttribute('data-dock', 'split-full');
  expect(await overlaps('#main-view-slot')).toBe(false);
  expect(await overlaps('#sub-view-slots')).toBe(false);
  // 3D only: back to an overlay on the 3D card, with the pin option
  await page.locator('[data-ipad-view-mode="3d"]').click();
  await expect(dock).toHaveAttribute('data-place', 'overlay');
  await expect(grid).not.toHaveAttribute('data-dock', /.+/);
  await dock.locator('[data-dock-act="place"]').click();
  await expect(grid).toHaveAttribute('data-dock', '3d-below');
  expect(errors).toEqual([]);
});
