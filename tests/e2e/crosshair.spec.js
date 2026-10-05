import { test, expect } from '@playwright/test';
import { dicomFolder, syntheticDataset } from '../helpers/dicom-folder.js';
import { twoSeriesFolder, huA } from '../helpers/two-series-folder.js';

// Linked crosshair (build 458), on the tiny synthetic CT (16x16x12, spacing 0.1 x 0.1 x 0.2 mm): no GPU, no demo data.
// HU of voxel (i,j,k) = ((j*16 + i + k) % 7) * 200 - 1024, e.g. (3,5,4) -> -424.
const { columns, rows, slices } = syntheticDataset;

test.beforeEach(async ({ page }, testInfo) => {
  testInfo.pageErrors = [];
  page.on('pageerror', err => testInfo.pageErrors.push(err.message));
});
test.afterEach(async ({}, testInfo) => {
  expect(testInfo.pageErrors, 'uncaught page errors').toEqual([]);
});

async function openSeries(page, folder, card = null) {
  await page.goto('/');
  await page.locator('#folder-input').setInputFiles(folder);
  const cards = page.locator('.series-card');
  await cards.first().waitFor({ state: 'attached', timeout: 60_000 });
  await (card ? cards.filter({ hasText: card }) : cards.first()).click();
  await expect(page.locator('.ready-badge').first()).toContainText(/ready/i, { timeout: 60_000 });
  await expect(page.locator('[data-crosshair-toggle="axial"]')).toBeEnabled({ timeout: 30_000 });
}
// The workspace UI (every device but iPhone) shows one plane at a time: choose which one is on screen. The other two keep their
// slices and are linked all the same.
async function showPlane(page, p) {
  await page.locator('[data-ipad-view-mode="2d"]').click();
  await page.locator(`[data-ipad-mpr="${p}"]`).click();
  await expect(page.locator(`#${p}-canvas`)).toBeVisible();
  await expect.poll(async () => (await page.locator(`#${p}-canvas`).boundingBox())?.width ?? 0).toBeGreaterThan(50);
}
const readout = page => page.locator('.crosshair-readout:not([hidden])');
const slider = (page, p) => page.locator(`#${p}-slider`);
const sliderValue = async (page, p) => Number(await slider(page, p).inputValue());
const setSlider = (page, p, v) => slider(page, p).evaluate((el, value) => { el.value = String(value); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }, v);
const getCrosshair = page => page.evaluate(async () => {
  const v = new URL(document.querySelector('script[src*="app.js"]').src).search;
  return (await import('./state.js' + v)).getCrosshair();
});
// client position of the centre of a voxel pixel in a plane's canvas (the canvas is stretched over its displayed rectangle)
async function pixelOf(page, plane, col, row) {
  const [w, h] = plane === 'axial' ? [columns, rows] : plane === 'coronal' ? [columns, slices] : [rows, slices];
  const r = await page.locator(`#${plane}-canvas`).boundingBox();
  return { x: r.x + (col + 0.5) / w * r.width, y: r.y + (row + 0.5) / h * r.height };
}
const hash2d = page => page.evaluate(() => {
  const c = document.querySelector('#axial-canvas'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let h = 0; for (let i = 0; i < d.length; i++) h = (h * 31 + d[i]) >>> 0; return h;
});
const overlayPixels = (page, p) => page.evaluate(id => {
  const c = document.getElementById(id), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i]) n++; return n;
}, p + '-crosshair');

test('Axial click: Coronal / Sagittal slices follow and the HU matches the synthetic voxel', async ({ page }) => {
  test.setTimeout(120_000);
  await openSeries(page, dicomFolder());
  await showPlane(page, 'axial');
  // a normal click is not taken over: before the mode is on, a click changes nothing
  await setSlider(page, 'axial', 4);
  const before = await hash2d(page);
  const idle = await pixelOf(page, 'axial', 9, 9);
  await page.mouse.click(idle.x, idle.y);
  expect(await getCrosshair(page)).toBeNull();
  await expect(readout(page)).toHaveCount(0);

  const toggle = page.locator('[data-crosshair-toggle="axial"]');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  expect(await getCrosshair(page)).toEqual({ i: await sliderValue(page, 'sagittal'), j: await sliderValue(page, 'coronal'), k: 4 }); // starts at the three slices on show

  const p = await pixelOf(page, 'axial', 3, 5);
  await page.mouse.click(p.x, p.y);
  expect(await getCrosshair(page)).toEqual({ i: 3, j: 5, k: 4 });
  expect(await sliderValue(page, 'coronal')).toBe(5);
  expect(await sliderValue(page, 'sagittal')).toBe(3);
  expect(await sliderValue(page, 'axial')).toBe(4);
  await expect(readout(page)).toBeVisible();
  await expect(readout(page)).toContainText('i 3 · j 5 · k 4');
  await expect(readout(page)).toContainText('x 0.30 · y 0.50 · z 0.80 mm');
  expect(huA(3, 5, 4)).toBe(-424);
  await expect(readout(page)).toContainText('-424 HU', { timeout: 15_000 });
  // the lines are on their own layer, not on the slice canvas; every plane draws them when it is on screen
  expect(await overlayPixels(page, 'axial')).toBeGreaterThan(0);
  for (const q of ['coronal', 'sagittal']) {
    await showPlane(page, q);
    await expect.poll(() => overlayPixels(page, q), { message: q }).toBeGreaterThan(0);
  }
  await showPlane(page, 'axial');
  expect(await page.locator('.mpr-crosshair-canvas').evaluateAll(cs => cs.some(c => c.classList.contains('mpr-canvas')))).toBe(false);
  expect(await hash2d(page)).toBe(before); // same slice (k=4) as before the mode: identical pixels

  // Esc hides it
  await page.keyboard.press('Escape');
  expect(await getCrosshair(page)).toBeNull();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect(readout(page)).toHaveCount(0);
  await expect.poll(() => overlayPixels(page, 'axial')).toBe(0);
});

test('drag moves the point continuously, release fixes it; Coronal and Sagittal also place it; sliders move the coordinate', async ({ page }) => {
  test.setTimeout(120_000);
  await openSeries(page, dicomFolder());
  await setSlider(page, 'coronal', 5);
  await showPlane(page, 'coronal');
  await page.locator('[data-crosshair-toggle="coronal"]').click();
  // coronal (i,k): row = slices-1-k. Drag from (i=1,k=2) to (i=2,k=7) in steps
  const a = await pixelOf(page, 'coronal', 1, slices - 1 - 2), b = await pixelOf(page, 'coronal', 2, slices - 1 - 7);
  await page.mouse.move(a.x, a.y); await page.mouse.down();
  expect(await getCrosshair(page)).toEqual({ i: 1, j: 5, k: 2 });
  await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 4 });
  const mid = await getCrosshair(page);
  expect(mid.j).toBe(5);
  await page.mouse.move(b.x, b.y, { steps: 4 });
  expect(await getCrosshair(page)).toEqual({ i: 2, j: 5, k: 7 }); // continuous while the button is down
  await page.mouse.up();
  expect(await getCrosshair(page)).toEqual({ i: 2, j: 5, k: 7 });
  expect(await sliderValue(page, 'axial')).toBe(7);
  expect(await sliderValue(page, 'sagittal')).toBe(2);
  expect(await sliderValue(page, 'coronal')).toBe(5);
  await expect(readout(page)).toContainText(`${huA(2, 5, 7)} HU`, { timeout: 15_000 }); // -24, read once the axial slice is shown

  // Sagittal (j,k) -> Axial k, Coronal j (the mode stays on when another plane is shown)
  await showPlane(page, 'sagittal');
  const s = await pixelOf(page, 'sagittal', 9, slices - 1 - 3);
  await page.mouse.click(s.x, s.y);
  expect(await getCrosshair(page)).toEqual({ i: 2, j: 9, k: 3 });
  expect(await sliderValue(page, 'axial')).toBe(3);
  expect(await sliderValue(page, 'coronal')).toBe(9);

  // moving a slice slider moves the matching coordinate
  await setSlider(page, 'axial', 10);
  expect(await getCrosshair(page)).toEqual({ i: 2, j: 9, k: 10 });
  await setSlider(page, 'coronal', 1);
  await setSlider(page, 'sagittal', 12);
  expect(await getCrosshair(page)).toEqual({ i: 12, j: 1, k: 10 });

  // the button again hides it
  await page.locator('[data-crosshair-toggle="sagittal"]').click();
  expect(await getCrosshair(page)).toBeNull();
});

test.describe('touch (iPad: no modifier keys, no mouse)', () => {
  test.use({ hasTouch: true });
  test('a finger tap places the point; the button turns the mode on and off', async ({ page }) => {
    test.setTimeout(120_000);
    await openSeries(page, dicomFolder());
    await showPlane(page, 'axial');
    await setSlider(page, 'axial', 4);
    await page.locator('[data-crosshair-toggle="axial"]').tap();
    const p = await pixelOf(page, 'axial', 3, 5);
    await page.touchscreen.tap(p.x, p.y);
    expect(await getCrosshair(page)).toEqual({ i: 3, j: 5, k: 4 });
    await expect(readout(page)).toContainText('-424 HU', { timeout: 15_000 });
    await page.locator('[data-crosshair-toggle="axial"]').tap();
    expect(await getCrosshair(page)).toBeNull();
  });
});

test('another series clears the crosshair', async ({ page }) => {
  test.setTimeout(120_000);
  await openSeries(page, twoSeriesFolder(), 'Test CT');
  await showPlane(page, 'axial');
  await page.locator('[data-crosshair-toggle="axial"]').click();
  const p = await pixelOf(page, 'axial', 15, 9); // (the slice slider covers the bottom rows of the image)
  await page.mouse.click(p.x, p.y);
  expect(await getCrosshair(page)).toMatchObject({ i: 15, j: 9 });
  await page.locator('[data-ipad-drawer-tab="data"]').click(); // the series list lives in the Data tab of the workspace UI
  await page.locator('.series-card').filter({ hasText: 'Small CT' }).click();
  await expect(page.locator('.ready-badge').first()).toContainText(/ready/i, { timeout: 60_000 });
  await expect(page.locator('[data-crosshair-toggle="axial"]')).toBeEnabled({ timeout: 30_000 });
  expect(await getCrosshair(page)).toBeNull(); // the old index (15) would be out of range for the 8x8x6 series
  await expect(page.locator('[data-crosshair-toggle="axial"]')).toHaveAttribute('aria-pressed', 'false');
  await expect(readout(page)).toHaveCount(0);
  await page.locator('[data-crosshair-toggle="axial"]').click();
  const q = await getCrosshair(page);
  expect(q.i).toBeLessThan(8); expect(q.j).toBeLessThan(8); expect(q.k).toBeLessThan(6);
});
