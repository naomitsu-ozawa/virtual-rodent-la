import { test, expect } from '@playwright/test';
import { dicomFolder } from '../helpers/dicom-folder.js';

// Distances between two points (build 477), PC / iPad flow: long press (or right-click) on a point -> menu -> 距離 -> start (pulsing mark + hint)
// -> the next point picked is the END -> a line + label in 3D and a row in the panel. The same flow as the VR point ring. Synthetic data only
// (16 x 16 x 12 voxels, 0.1 x 0.1 x 0.2 mm). Runs on the WebGL fallback of the sandbox like comments3d.spec.js.
test.beforeEach(async ({ page }, testInfo) => {
  testInfo.pageErrors = [];
  page.on('pageerror', err => testInfo.pageErrors.push(err.message));
});
test.afterEach(async ({}, testInfo) => {
  expect(testInfo.pageErrors, 'uncaught page errors').toEqual([]);
});

async function open3d(page) {
  await page.goto('/');
  await page.locator('#folder-input').setInputFiles(dicomFolder());
  await page.locator('.series-card').first().click();
  await expect(page.locator('.ready-badge').first()).toContainText(/ready/i, { timeout: 60_000 });
  await expect(page.locator('[data-crosshair-toggle="axial"]')).toBeEnabled({ timeout: 30_000 });
  await page.evaluate(async () => { // a stand-in object for the 3D build (as comments3d.spec.js)
    const v = new URL(document.querySelector('script[src*="app.js"]').src).search;
    const st = await import('./state.js' + v), THREE = await import('https://cdn.jsdelivr.net/npm/three@0.186.0/build/three.webgpu.js');
    const s = st.sceneState; if (!s.obj) { s.obj = new THREE.Group(); s.scene.add(s.obj); }
    s.needsRender = true;
  });
}
const mod = (page, fn, arg) => page.evaluate(async ([src, arg]) => {
  const v = new URL(document.querySelector('script[src*="app.js"]').src).search;
  const m = { st: await import('./state.js' + v), c: await import('./comments.js' + v), pf: await import('./project-file.js' + v), ms: await import('./measurements.js' + v) };
  return new Function('m', 'arg', 'return (' + src + ')(m,arg)')(m, arg);
}, [fn.toString(), arg]);
const addAt = (page, text, position) => mod(page, (m, [text, position]) => m.c.addComment(m.c.createComment({ text, position, series: m.pf.datasetFingerprint(m.st.activeSeries) })).id, [text, position]);
const dotCentres = page => page.evaluate(() => [...document.querySelectorAll('.comment-marker-3d:not([hidden])')].map(e => { const r = e.getBoundingClientRect(); return { n: e.textContent, x: r.left + r.width / 2, y: r.top + r.height / 2 }; }));
const state = page => mod(page, m => ({ ms: m.ms.getMeasurements(), start: m.ms.getMeasureStart(), n: m.c.getComments().length }));

test('PC: long press a dot -> 距離 -> start (marked + hint) -> pick the other dot -> line + label + list; Esc / empty tap cancel; deleting a point removes it', async ({ page }) => {
  test.setTimeout(150_000);
  await open3d(page);
  const A = { i: 3, j: 5, k: 4 }, B = { i: 12, j: 10, k: 9 };
  const idA = await addAt(page, 'first spot', A), idB = await addAt(page, 'second spot', B);
  await expect(page.locator('.comment-marker-3d:not([hidden])')).toHaveCount(2);
  const [a, b] = await dotCentres(page);

  // a plain tap on a dot still shows its bubble (unchanged)
  await page.mouse.click(a.x, a.y);
  await expect(page.locator('.comment-bubble-3d')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.comment-bubble-3d')).toBeHidden();

  // long press (mouse press-and-hold) on A opens the point menu with 距離 / 色 / 削除
  await page.mouse.move(a.x, a.y); await page.mouse.down();
  await expect(page.locator('.point-menu')).toBeVisible({ timeout: 3000 });
  await page.mouse.up();
  await expect(page.locator('.point-menu .point-menu-btn')).toHaveText(['距離', '色', '削除']);
  await expect(page.locator('.comment-bubble-3d')).toBeHidden(); // the release after a long press is not a tap
  await page.locator('.point-menu-distance').click();
  await expect(page.locator('.point-menu')).toBeHidden();
  expect((await state(page)).start).toBe(idA);
  await expect(page.locator('.measure-pill')).toContainText('終点のポイントを選んでください');
  await expect(page.locator('.comment-marker-3d.is-measure-start')).toHaveCount(1);
  await expect(page.locator('.measure-hint-3d')).toBeVisible();

  // Esc cancels
  await page.keyboard.press('Escape');
  expect((await state(page)).start).toBeNull();
  await expect(page.locator('.comment-marker-3d.is-measure-start')).toHaveCount(0);

  // right-click on A -> the same menu -> 距離; then a tap on B is the END
  await page.mouse.click(a.x, a.y, { button: 'right' });
  await expect(page.locator('.point-menu')).toBeVisible();
  await page.locator('.point-menu-distance').click();
  expect((await state(page)).start).toBe(idA);
  await page.mouse.click(b.x, b.y);
  const st = await state(page);
  expect(st.start).toBeNull(); expect(st.ms).toHaveLength(1); expect(st.ms[0]).toMatchObject({ a: idA, b: idB });
  const want = Math.hypot(9 * 0.1, 5 * 0.1, 5 * 0.2); // (12-3, 10-5, 9-4) voxels x (0.1, 0.1, 0.2) mm = 1.2 mm
  const label = page.locator('.measure-label-3d');
  await expect(label).toBeVisible();
  await expect(label).toHaveText(want.toFixed(2) + ' mm');
  await expect(page.locator('.measure-line-3d')).toHaveCount(1);

  // the label can be dragged at any time: only the label moves (the view and the dots stay), the place is kept as labelOffset
  const lb0 = await label.boundingBox(), dotsBefore = await dotCentres(page);
  await page.mouse.move(lb0.x + lb0.width / 2, lb0.y + lb0.height / 2); await page.mouse.down();
  await page.mouse.move(lb0.x + lb0.width / 2 + 30, lb0.y + lb0.height / 2 + 20, { steps: 5 }); await page.mouse.move(lb0.x + lb0.width / 2 + 60, lb0.y + lb0.height / 2 + 40, { steps: 5 }); await page.mouse.up();
  const lb1 = await label.boundingBox();
  expect(Math.abs(lb1.x - lb0.x - 60)).toBeLessThan(4); expect(Math.abs(lb1.y - lb0.y - 40)).toBeLessThan(4);
  expect(await dotCentres(page)).toEqual(dotsBefore); // the 3D view did not rotate
  await expect(page.locator('.comment-bubble-3d')).toBeHidden(); expect((await state(page)).start).toBeNull();
  const moved = (await state(page)).ms[0];
  expect(moved.labelOffset).toBeTruthy(); expect(Object.keys(moved.labelOffset).sort()).toEqual(['i', 'j', 'k']);
  expect(await mod(page, m => m.ms.measurementsForProject(new Set(m.c.getComments().map(c => c.id)))[0].labelOffset)).toEqual(moved.labelOffset); // it goes into the project

  // a label moved far away is SHOWN inside the view (display-time clamp); the stored offset is unchanged
  await mod(page, (m, [id, off]) => m.ms.setLabelOffset(id, off), [moved.id, { i: -900, j: 0, k: 0 }]);
  const view = await page.locator('#viewport-3d').boundingBox();
  await expect.poll(async () => { const b = await label.boundingBox(); return b.x >= view.x - 1 && b.y >= view.y - 1 && b.x + b.width <= view.x + view.width + 1 && b.y + b.height <= view.y + view.height + 1; }).toBe(true);
  expect((await state(page)).ms[0].labelOffset).toEqual({ i: -900, j: 0, k: 0 });
  // double click on the label: back to its default place
  let lb2 = await label.boundingBox(); await page.mouse.dblclick(lb2.x + lb2.width / 2, lb2.y + lb2.height / 2);
  expect((await state(page)).ms[0].labelOffset).toBeUndefined();
  // a point under the press wins over a label on top of it: drag the label onto dot A, then long press there -> the point menu, the label stays
  lb2 = await label.boundingBox(); await page.mouse.move(lb2.x + lb2.width / 2, lb2.y + lb2.height / 2); await page.mouse.down();
  await page.mouse.move(a.x, a.y, { steps: 8 }); await page.mouse.up();
  const onDot = (await state(page)).ms[0].labelOffset; expect(onDot).toBeTruthy();
  await page.mouse.move(a.x, a.y); await page.mouse.down();
  await expect(page.locator('.point-menu')).toBeVisible({ timeout: 3000 }); await page.mouse.up();
  expect((await state(page)).ms[0].labelOffset).toEqual(onDot);
  // the menu of a point whose label was moved offers 「ラベル位置を戻す」
  await page.locator('.point-menu-labelreset').click();
  expect((await state(page)).ms[0].labelOffset).toBeUndefined();
  await mod(page, (m, [id, off]) => m.ms.setLabelOffset(id, off), [moved.id, moved.labelOffset]); // (as moved before, for the list below)

  // the list under the point list
  await page.locator('[data-ipad-drawer-tab="display"]').click();
  const panel = page.locator('#comment-panel');
  if (!(await panel.evaluate(el => el.open))) await panel.locator('summary').click();
  await expect(panel.locator('.measure-item .measure-value')).toHaveText(want.toFixed(2) + ' mm');

  // a tap on empty space while a start is armed cancels (no bubble). (opening the panel resized the view: take the dots again)
  let [a2, b2] = await dotCentres(page);
  await page.mouse.click(a2.x, a2.y, { button: 'right' });
  await page.locator('.point-menu-distance').click();
  const box = await page.locator('#viewport-3d canvas').first().boundingBox();
  await page.mouse.click(box.x + box.width * 0.9, box.y + box.height * 0.1);
  expect((await state(page)).start).toBeNull();

  // delete the measurement from the list
  await panel.locator('.measure-delete').click();
  expect((await state(page)).ms).toHaveLength(0);
  await expect(label).toHaveCount(0);

  // measure again, then delete the point from its menu: the measurement goes with it
  [a2, b2] = await dotCentres(page);
  await page.mouse.click(a2.x, a2.y, { button: 'right' }); await page.locator('.point-menu-distance').click(); await page.mouse.click(b2.x, b2.y);
  expect((await state(page)).ms).toHaveLength(1);
  await page.mouse.click(b2.x, b2.y, { button: 'right' });
  await page.locator('.point-menu-delete').click();
  const after = await state(page);
  expect(after.n).toBe(1); expect(after.ms).toHaveLength(0);
  await expect(page.locator('.measure-line-3d')).toHaveCount(0);
  // the pill carries an undo button (the panel's own one is in a closed <details>): the point and its distance come back
  await expect(page.locator('.measure-pill-undo')).toBeVisible();
  await page.locator('.measure-pill-undo').click();
  const back = await state(page);
  expect(back.n).toBe(2); expect(back.ms).toHaveLength(1);
});

test('PC: colour from the point menu', async ({ page }) => {
  test.setTimeout(150_000);
  await open3d(page);
  const id = await addAt(page, 'spot', { i: 4, j: 4, k: 4 });
  await expect(page.locator('.comment-marker-3d:not([hidden])')).toHaveCount(1);
  const [a] = await dotCentres(page);
  await page.mouse.click(a.x, a.y, { button: 'right' });
  await page.locator('.point-menu-color').click();
  await page.locator('.point-menu-palette .comment-color-opt').nth(2).click();
  const col = await mod(page, (m, id) => m.c.getComments().find(c => c.id === id).color, id);
  expect(col).toBe('#2fbf4f');
});

test('PC: the same flow on the 2D marks (long press -> 距離 -> tap the other mark)', async ({ page }) => {
  test.setTimeout(150_000);
  await open3d(page);
  await page.getByRole('button', { name: '2D', exact: true }).click();
  const idA = await addAt(page, 'a', { i: 3, j: 4, k: 5 }), idB = await addAt(page, 'b', { i: 11, j: 9, k: 5 });
  // show slice k = 5 on the axial plane, then where the two marks are drawn (screen coordinates of the voxels on the image)
  const where = async () => page.evaluate(async () => {
    const v = new URL(document.querySelector('script[src*="app.js"]').src).search;
    const ui = await import('./ui-shell.js' + v), cr = await import('./crosshair.js' + v);
    const sl = ui.planes.axial.slider; if (sl.value !== '5') { sl.value = '5'; sl.dispatchEvent(new Event('input', { bubbles: true })); }
    const ir = ui.planes.axial.canvas.getBoundingClientRect(), dims = { columns: 16, rows: 16, slices: 12 };
    return [{ i: 3, j: 4, k: 5 }, { i: 11, j: 9, k: 5 }].map(q => { const { fx, fy } = cr.planePointFromVoxel('axial', q, dims); return { x: ir.left + fx * ir.width, y: ir.top + fy * ir.height }; });
  });
  await page.waitForTimeout(800);
  let [a, b] = await where();
  await page.mouse.click(a.x, a.y); // a plain tap on a mark still shows its bubble (unchanged)
  await expect(page.locator('.comment-bubble')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.comment-bubble')).toBeHidden();
  await page.mouse.move(a.x, a.y); await page.mouse.down();
  await expect(page.locator('.point-menu')).toBeVisible({ timeout: 3000 });
  await page.mouse.up();
  await expect(page.locator('.comment-bubble')).toBeHidden();
  await page.locator('.point-menu-distance').click();
  expect((await state(page)).start).toBe(idA);
  await expect(page.locator('.measure-pill')).toBeVisible();
  [a, b] = await where();
  await page.mouse.click(b.x, b.y);
  const st = await state(page);
  expect(st.start).toBeNull(); expect(st.ms).toHaveLength(1); expect(st.ms[0]).toMatchObject({ a: idA, b: idB });
  await expect(page.locator('.measure-pill')).toContainText('距離を追加しました');
  // both ends are on the slice on show: the 2D view draws the line and a label (the dark label box) at the midpoint
  [a, b] = await where();
  const solid = () => page.evaluate(([a, b]) => { // opaque pixels in a window around the midpoint (the line, its leader and the compact label beside it)
    const cv = document.getElementById('axial-crosshair'), r = cv.getBoundingClientRect(), k = cv.width / r.width, n = 80;
    const d = cv.getContext('2d').getImageData(Math.round(((a.x + b.x) / 2 - r.left) * k - n / 2), Math.round(((a.y + b.y) / 2 - r.top) * k - n / 2), n, n).data;
    let c = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 200) c++; return c;
  }, [a, b]);
  expect(await solid()).toBeGreaterThan(40);
  // drag the 2D label (found where the default placement puts it): it moves, the slice does not change, the offset is stored
  const lab = await page.evaluate(async ([a, b]) => {
    const v = new URL(document.querySelector('script[src*="app.js"]').src).search, ml = await import('./measure-label.js' + v);
    const cv = document.getElementById('axial-crosshair'), r = cv.getBoundingClientRect();
    const pl = ml.planeLabelPlacement({ x: a.x - r.left, y: a.y - r.top }, { x: b.x - r.left, y: b.y - r.top }, { w: 50, h: 16, gap: 4 });
    return { x: pl.x + r.left, y: pl.y + r.top };
  }, [a, b]);
  await page.mouse.move(lab.x, lab.y); await page.mouse.down(); await page.mouse.move(lab.x + 25, lab.y + 15, { steps: 6 }); await page.mouse.up();
  const after2d = await state(page);
  expect(after2d.ms[0].labelOffset).toBeTruthy();
  expect(await page.evaluate(async () => { const v = new URL(document.querySelector('script[src*="app.js"]').src).search; return (await import('./ui-shell.js' + v)).planes.axial.slider.value; })).toBe('5');
  expect(await solid()).toBeGreaterThan(40);
  // on another slice nothing is drawn
  await page.evaluate(async () => {
    const v = new URL(document.querySelector('script[src*="app.js"]').src).search, ui = await import('./ui-shell.js' + v);
    ui.planes.axial.slider.value = '9'; ui.planes.axial.slider.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForTimeout(500);
  const px2 = await solid();
  expect(px2).toBe(0);
});
