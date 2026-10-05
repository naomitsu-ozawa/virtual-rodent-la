import { test, expect } from '@playwright/test';
import { dicomFolder, syntheticDataset } from '../helpers/dicom-folder.js';
import { twoSeriesFolder, huA } from '../helpers/two-series-folder.js';

// Position comments (Issue #88 stage 2), on the tiny synthetic CT (16x16x12, spacing 0.1 x 0.1 x 0.2 mm): no GPU, no demo data.
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


const panel = page => page.locator('#comment-panel');
async function openPanel(page) {
  await page.locator('[data-ipad-drawer-tab="display"]').click();
  const p = panel(page);
  if (!(await p.evaluate(el => el.open))) await p.locator('summary').click();
  await expect(p.locator('.comment-input')).toBeVisible();
}

test('comment at a crosshair position, move away, "view this place" brings the three planes and the HU back', async ({ page }) => {
  test.setTimeout(120_000);
  await openSeries(page, dicomFolder());
  await showPlane(page, 'axial');
  await setSlider(page, 'axial', 4);
  await page.locator('[data-crosshair-toggle="axial"]').click();
  const p = await pixelOf(page, 'axial', 3, 5);
  await page.mouse.click(p.x, p.y);
  expect(await getCrosshair(page)).toEqual({ i: 3, j: 5, k: 4 });

  await openPanel(page);
  await expect(panel(page).locator('.comment-add')).toBeEnabled();
  await panel(page).locator('.comment-input').fill('suspicious spot');
  await panel(page).locator('.comment-add').click();
  const item = panel(page).locator('.comment-item');
  await expect(item).toHaveCount(1);
  await expect(item).toContainText('suspicious spot');
  await expect(item).toContainText('i 3 · j 5 · k 4');
  await expect(item.locator('.comment-view')).toBeEnabled();

  // go somewhere else: another point and other slices
  const q = await pixelOf(page, 'axial', 12, 10);
  await page.mouse.click(q.x, q.y);
  await setSlider(page, 'axial', 9);
  expect(await getCrosshair(page)).toEqual({ i: 12, j: 10, k: 9 });
  await expect(readout(page)).toContainText('i 12 · j 10 · k 9');

  await item.locator('.comment-view').click();
  expect(await getCrosshair(page)).toEqual({ i: 3, j: 5, k: 4 });
  expect(await sliderValue(page, 'axial')).toBe(4);
  expect(await sliderValue(page, 'coronal')).toBe(5);
  expect(await sliderValue(page, 'sagittal')).toBe(3);
  await expect(readout(page)).toContainText('i 3 · j 5 · k 4');
  await expect(readout(page)).toContainText('-424 HU', { timeout: 15_000 });

  // the project file carries it (positions only: loading a project never moves a view, see applyProject)
  const saved = await page.evaluate(async () => {
    const v = new URL(document.querySelector('script[src*="app.js"]').src).search;
    return (await import('./data-load.js' + v)).gatherProject().project.comments;
  });
  expect(saved).toHaveLength(1);
  expect(saved[0]).toMatchObject({ text: 'suspicious spot', position: { i: 3, j: 5, k: 4 } });

  // delete
  await item.locator('.comment-delete').click();
  await expect(item).toHaveCount(0);
});

test('without a crosshair the three slices on show are recorded; "view this place" turns the crosshair on', async ({ page }) => {
  test.setTimeout(120_000);
  await openSeries(page, dicomFolder());
  await showPlane(page, 'axial');
  await setSlider(page, 'axial', 6); await setSlider(page, 'coronal', 2); await setSlider(page, 'sagittal', 11);
  expect(await getCrosshair(page)).toBeNull();
  await openPanel(page);
  await panel(page).locator('.comment-add').click();
  await expect(panel(page).locator('.comment-item')).toContainText('i 11 · j 2 · k 6');
  await setSlider(page, 'axial', 1); await setSlider(page, 'coronal', 8); await setSlider(page, 'sagittal', 0);
  await panel(page).locator('.comment-view').click();
  expect(await getCrosshair(page)).toEqual({ i: 11, j: 2, k: 6 });
  expect(await sliderValue(page, 'axial')).toBe(6);
  expect(await sliderValue(page, 'coronal')).toBe(2);
  expect(await sliderValue(page, 'sagittal')).toBe(11);
});

test('a comment of another series cannot be viewed here', async ({ page }) => {
  test.setTimeout(120_000);
  await openSeries(page, twoSeriesFolder(), 'Test CT');
  await showPlane(page, 'axial');
  await openPanel(page);
  await panel(page).locator('.comment-input').fill('on the 16x16 series');
  await panel(page).locator('.comment-add').click();
  await expect(panel(page).locator('.comment-view')).toBeEnabled();
  await page.locator('[data-ipad-drawer-tab="data"]').click();
  await page.locator('.series-card').filter({ hasText: 'Small CT' }).click();
  await expect(page.locator('.ready-badge').first()).toContainText(/ready/i, { timeout: 60_000 });
  await expect(page.locator('[data-crosshair-toggle="axial"]')).toBeEnabled({ timeout: 30_000 });
  await openPanel(page);
  await expect(panel(page).locator('.comment-item')).toContainText('on the 16x16 series');
  await expect(panel(page).locator('.comment-view')).toBeDisabled();
  expect(await getCrosshair(page)).toBeNull();
});
