import { test, expect } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
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
  await expect(panel(page).locator('.comment-note')).toContainText(/Esc/); // the crosshair mode was switched on for the user: say so
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
  await expect(panel(page).locator('.comment-item')).toContainText(/Not saved|保存されません/); // it is not written to this series' project
  expect(await getCrosshair(page)).toBeNull();
});

const addHere = async (page, text) => {
  await panel(page).locator('.comment-input').fill(text);
  await panel(page).locator('.comment-add').click();
  await expect(panel(page).locator('.comment-item').filter({ hasText: text })).toHaveCount(1);
};
const saveProjectFile = async (page, name) => {
  const download = page.waitForEvent('download');
  await page.locator('#project-save').click();
  const path = join(mkdtempSync(join(tmpdir(), 'vrl-proj-')), name + '.vrlab');
  await (await download).saveAs(path);
  return path;
};
const texts = page => panel(page).locator('.comment-text').allTextContents();

test('loading a project merges: a comment added after the save stays (same series)', async ({ page }) => {
  test.setTimeout(120_000);
  await openSeries(page, dicomFolder());
  await showPlane(page, 'axial');
  await openPanel(page);
  await addHere(page, 'c1');
  const file = await saveProjectFile(page, 'a');
  await setSlider(page, 'axial', 7);
  await addHere(page, 'c2'); // not in the file
  await page.locator('#project-input').setInputFiles(file);
  await expect(page.locator('#footer')).toContainText(/Project applied|プロジェクトを適用しました/, { timeout: 30_000 });
  await openPanel(page);
  expect((await texts(page)).sort()).toEqual(['c1', 'c2']);
});

test('loading a project merges: a comment written on another series stays', async ({ page }) => {
  test.setTimeout(180_000);
  await openSeries(page, twoSeriesFolder(), 'Test CT');
  await showPlane(page, 'axial');
  await openPanel(page);
  await addHere(page, 'on A');
  const file = await saveProjectFile(page, 'a');
  await page.locator('[data-ipad-drawer-tab="data"]').click();
  await page.locator('.series-card').filter({ hasText: 'Small CT' }).click();
  await expect(page.locator('.ready-badge').first()).toContainText(/ready/i, { timeout: 60_000 });
  await expect(page.locator('[data-crosshair-toggle="axial"]')).toBeEnabled({ timeout: 30_000 });
  await openPanel(page);
  await addHere(page, 'on B');
  await page.locator('#project-input').setInputFiles(file); // A's project: the app switches to series A
  await expect(page.locator('#footer')).toContainText(/Project applied|プロジェクトを適用しました/, { timeout: 60_000 });
  await openPanel(page);
  expect((await texts(page)).sort()).toEqual(['on A', 'on B']);
  await expect(panel(page).locator('.comment-item').filter({ hasText: 'on B' })).toContainText(/Not saved|保存されません/);
});

test('"view this place" keeps the keyboard focus on its button', async ({ page }) => {
  test.setTimeout(120_000);
  await openSeries(page, dicomFolder());
  await showPlane(page, 'axial');
  await openPanel(page);
  await addHere(page, 'focus me');
  const view = panel(page).locator('.comment-item .comment-view');
  await view.focus();
  await page.keyboard.press('Enter');
  await expect(readout(page)).toBeVisible();
  const active = await page.evaluate(() => { const a = document.activeElement; return { cls: a.className, id: a.closest('.comment-item')?.dataset.commentId ?? null }; });
  expect(active.cls).toContain('comment-view');
  expect(active.id).not.toBeNull();
});

test('delete can be undone; unsaved comments warn before the page is closed', async ({ page }) => {
  test.setTimeout(120_000);
  await openSeries(page, dicomFolder());
  await showPlane(page, 'axial');
  await openPanel(page);
  const unload = () => page.evaluate(() => { const e = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(e); return e.defaultPrevented; });
  expect(await unload()).toBe(false);
  await addHere(page, 'one'); await addHere(page, 'two');
  expect(await unload()).toBe(true);
  await saveProjectFile(page, 'u');
  expect(await unload()).toBe(false);
  await panel(page).locator('.comment-item').filter({ hasText: 'one' }).locator('.comment-delete').click();
  await expect(panel(page).locator('.comment-item')).toHaveCount(1);
  expect(await unload()).toBe(true);
  const undo = panel(page).locator('.comment-undo-btn');
  await expect(undo).toBeVisible();
  await expect(undo).toBeFocused();
  await undo.click();
  expect(await texts(page)).toEqual(['one', 'two']); // back at its place
  expect(await unload()).toBe(false); // equal to what was saved again
  await expect(panel(page).locator('.comment-undo')).toBeHidden();
});

test('the toolbar "add comment" button next to the crosshair button makes a positioned comment that shows in the list', async ({ page }) => {
  test.setTimeout(120_000);
  await openSeries(page, dicomFolder());
  await showPlane(page, 'axial');
  await setSlider(page, 'axial', 4);
  await page.locator('[data-crosshair-toggle="axial"]').click();
  const p = await pixelOf(page, 'axial', 3, 5);
  await page.mouse.click(p.x, p.y);
  expect(await getCrosshair(page)).toEqual({ i: 3, j: 5, k: 4 });

  const btn = page.locator('[data-comment-toggle="axial"]');
  await expect(btn).toBeEnabled();
  await expect(btn).toHaveText(/\S/); // a text label, not an icon only
  const [cb, bb] = await Promise.all([page.locator('[data-crosshair-toggle="axial"]').boundingBox(), btn.boundingBox()]);
  expect(bb.height).toBeGreaterThanOrEqual(cb.height - 1); // as big as the crosshair button
  await btn.click(); // the drawer stays closed: the popover is in the card
  const pop = page.locator('.comment-popover');
  await expect(pop).toBeVisible();
  await expect(pop.locator('.comment-input')).toBeFocused();
  await expect(pop).toContainText('i 3 · j 5 · k 4');
  expect(await getCrosshair(page)).toEqual({ i: 3, j: 5, k: 4 }); // opening it moved nothing
  await pop.locator('.comment-input').fill('from the toolbar');
  await pop.locator('.comment-pop-save').click();
  await expect(pop).toBeHidden({ timeout: 5_000 });
  expect(await getCrosshair(page)).toEqual({ i: 3, j: 5, k: 4 });

  await openPanel(page);
  const item = panel(page).locator('.comment-item');
  await expect(item).toHaveCount(1);
  await expect(item).toContainText('from the toolbar');
  await expect(item).toContainText('i 3 · j 5 · k 4');

  // Esc closes the popover only: the crosshair mode stays on
  await page.locator('[data-ipad-drawer-tab="display"]').click().catch(() => {});
  await btn.click();
  await expect(pop).toBeVisible();
  await pop.locator('.comment-input').press('Escape');
  await expect(pop).toBeHidden();
  await expect(page.locator('[data-crosshair-toggle="axial"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(item).toHaveCount(1);
});

test('markers: shown on the slice of the comment, hidden elsewhere / by the toggle / after delete; the slice pixels never change', async ({ page }) => {
  test.setTimeout(120_000);
  await openSeries(page, dicomFolder());
  await showPlane(page, 'axial');
  await setSlider(page, 'axial', 4); await setSlider(page, 'coronal', 5); await setSlider(page, 'sagittal', 3);
  expect(await overlayPixels(page, 'axial')).toBe(0);
  await openPanel(page);
  await panel(page).locator('.comment-input').fill('marked spot');
  await panel(page).locator('.comment-add').click();
  await expect(panel(page).locator('.comment-no')).toHaveText('1');
  await expect.poll(() => overlayPixels(page, 'axial')).toBeGreaterThan(50); // crosshair mode is off: markers show all the same
  const before = await hash2d(page);

  await setSlider(page, 'axial', 6); // 2 slices away: faint ring
  const faint = await (async () => { await expect.poll(() => overlayPixels(page, 'axial')).toBeGreaterThan(0); return overlayPixels(page, 'axial'); })();
  await setSlider(page, 'axial', 4);
  await expect.poll(() => overlayPixels(page, 'axial')).toBeGreaterThan(faint);
  await setSlider(page, 'axial', 9);
  await expect.poll(() => overlayPixels(page, 'axial')).toBe(0);
  await setSlider(page, 'axial', 4);
  await expect.poll(() => overlayPixels(page, 'axial')).toBeGreaterThan(50);
  expect(await hash2d(page)).toBe(before);

  // tap on the marker: the text appears; a swipe elsewhere still moves the slice
  const at = await pixelOf(page, 'axial', 3, 5);
  await page.mouse.click(at.x, at.y);
  await expect(page.locator('.comment-bubble:not([hidden])')).toContainText('marked spot');

  const toggle = panel(page).locator('.comment-show-input');
  await expect(toggle).toBeChecked();
  await toggle.uncheck();
  await expect.poll(() => overlayPixels(page, 'axial')).toBe(0);
  await toggle.check();
  await expect.poll(() => overlayPixels(page, 'axial')).toBeGreaterThan(50);

  await panel(page).locator('.comment-delete').click();
  await expect.poll(() => overlayPixels(page, 'axial')).toBe(0);
  await panel(page).locator('.comment-undo-btn').click();
  await expect.poll(() => overlayPixels(page, 'axial')).toBeGreaterThan(50);
});

test('markers: a tap on a marker in crosshair mode places the crosshair and opens no bubble', async ({ page }) => {
  test.setTimeout(120_000);
  await openSeries(page, dicomFolder());
  await showPlane(page, 'axial');
  await setSlider(page, 'axial', 2); await setSlider(page, 'coronal', 4); await setSlider(page, 'sagittal', 10);
  await openPanel(page);
  await panel(page).locator('.comment-add').click();
  await expect.poll(() => overlayPixels(page, 'axial')).toBeGreaterThan(50);
  await page.locator('[data-crosshair-toggle="axial"]').click();
  const q = await pixelOf(page, 'axial', 10, 4);
  await page.mouse.click(q.x, q.y);
  expect(await getCrosshair(page)).toEqual({ i: 10, j: 4, k: 2 });
  await expect(page.locator('.comment-bubble:not([hidden])')).toHaveCount(0);
});

test('edit: the list text changes in place, Esc cancels, blank is not saved, position / time stay, the marker bubble shows the new text', async ({ page }) => {
  test.setTimeout(120_000);
  await openSeries(page, dicomFolder());
  await showPlane(page, 'axial');
  await setSlider(page, 'axial', 4); await setSlider(page, 'coronal', 5); await setSlider(page, 'sagittal', 3);
  await openPanel(page);
  await panel(page).locator('.comment-input').fill('first text');
  await panel(page).locator('.comment-add').click();
  const item = panel(page).locator('.comment-item');
  await expect(item).toContainText('first text');
  const meta = await item.locator('.comment-meta').textContent();

  // Esc cancels: the old text stays, the editor closes, the focus returns to the edit button
  await item.locator('.comment-edit').click();
  const input = item.locator('.comment-edit-input');
  await expect(input).toBeFocused();
  await expect(input).toHaveValue('first text');
  await input.fill('discarded');
  await input.press('Escape');
  await expect(item.locator('.comment-edit-input')).toHaveCount(0);
  await expect(item).toContainText('first text');
  await expect(item.locator('.comment-edit')).toBeFocused();

  // blank is not saved: still editing, the text is unchanged
  await item.locator('.comment-edit').click();
  await input.fill('   ');
  await item.locator('.comment-edit-save').click();
  await expect(input).toBeVisible();
  await expect(panel(page).locator('.comment-note')).not.toHaveText('');
  await item.locator('.comment-edit-cancel').click();
  await expect(item).toContainText('first text');

  // save: list, marker bubble and the project data follow; position and time do not change
  await item.locator('.comment-edit').click();
  await input.fill('second text');
  await item.locator('.comment-edit-save').click();
  await expect(item.locator('.comment-edit-input')).toHaveCount(0);
  await expect(item.locator('.comment-text')).toHaveText('second text');
  expect(await item.locator('.comment-meta').textContent()).toBe(meta);
  const at = await pixelOf(page, 'axial', 3, 5);
  await page.mouse.click(at.x, at.y);
  await expect(page.locator('.comment-bubble:not([hidden])')).toContainText('second text');
  const saved = await page.evaluate(async () => {
    const v = new URL(document.querySelector('script[src*="app.js"]').src).search;
    return (await import('./data-load.js' + v)).gatherProject().project.comments;
  });
  expect(saved).toHaveLength(1);
  expect(saved[0].text).toBe('second text');
  expect(saved[0].position).toEqual({ i: 3, j: 5, k: 4 });
});
