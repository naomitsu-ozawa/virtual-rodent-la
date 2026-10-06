import { test, expect } from '@playwright/test';
import { dicomFolder } from '../helpers/dicom-folder.js';

// Position comments on the 3D view (Issue #88): numbered dots in a layer over the 3D viewport. Runs on the WebGL fallback of the
// sandbox (surface mode); the WebGPU path shares the same scene object / camera / layer and is not exercised here.
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
  // The synthetic CT has no tissue the segment presets would turn into a mesh, so the 3D scene has no object yet: stand in a plain
  // group (a volume's local frame: origin = centre) for the object the real 3D build creates. Rotation / zoom act on it as on the real one.
  await page.evaluate(async () => {
    const v = new URL(document.querySelector('script[src*="app.js"]').src).search;
    const st = await import('./state.js' + v), THREE = await import('https://cdn.jsdelivr.net/npm/three@0.186.0/build/three.webgpu.js');
    const s = st.sceneState; if (!s.obj) { s.obj = new THREE.Group(); s.scene.add(s.obj); }
    s.needsRender = true;
  });
}
// a comment written on the open series (or, with other=true, on another one)
const addAt = (page, text, position, other = false) => page.evaluate(async ([text, position, other]) => {
  const v = new URL(document.querySelector('script[src*="app.js"]').src).search;
  const st = await import('./state.js' + v), c = await import('./comments.js' + v), pf = await import('./project-file.js' + v);
  const fp = pf.datasetFingerprint(st.activeSeries);
  if (other) { fp.seriesUid = 'other-series'; fp.seriesId = 'other'; }
  return c.addComment(c.createComment({ text, position, series: fp })).id;
}, [text, position, other]);
const removeById = (page, id) => page.evaluate(async id => {
  const v = new URL(document.querySelector('script[src*="app.js"]').src).search;
  (await import('./comments.js' + v)).removeComment(id);
}, id);
// where each dot must be: the voxel -> local (independent restatement of the plane-position formula) -> object matrix -> camera
const expected = (page, voxels) => page.evaluate(async voxels => {
  const v = new URL(document.querySelector('script[src*="app.js"]').src).search;
  const st = await import('./state.js' + v), THREE = await import('https://cdn.jsdelivr.net/npm/three@0.186.0/build/three.webgpu.js');
  const { obj, camera } = st.sceneState, vol = st.volume, [sx, sy, sz] = vol.spacing;
  const px = vol.columns * sx, py = vol.rows * sy, pz = vol.slices * sz, scale = 3.3 / Math.max(px, py, pz);
  const host = document.getElementById('viewport-3d'), r = host.getBoundingClientRect();
  obj.updateMatrixWorld(true); camera.updateMatrixWorld(true);
  return voxels.map(q => {
    const p = new THREE.Vector3(((q.i + .5) * sx - px / 2) * scale, -((q.j + .5) * sy - py / 2) * scale, ((q.k + .5) * sz - pz / 2) * scale);
    p.applyMatrix4(obj.matrixWorld).project(camera);
    return { x: r.left + (p.x + 1) / 2 * r.width, y: r.top + (1 - p.y) / 2 * r.height };
  });
}, voxels);
const dots = page => page.locator('.comment-marker-3d:not([hidden])');
async function dotCentres(page) {
  return page.evaluate(() => [...document.querySelectorAll('.comment-marker-3d:not([hidden])')].map(e => { const r = e.getBoundingClientRect(); return { n: e.textContent, x: r.left + r.width / 2, y: r.top + r.height / 2 }; }));
}
async function expectDotsAt(page, voxels) {
  await expect.poll(async () => {
    const got = await dotCentres(page), want = await expected(page, voxels);
    if (got.length !== want.length) return 'count ' + got.length + '/' + want.length;
    return got.every((g, i) => Math.abs(g.x - want[i].x) < 1.6 && Math.abs(g.y - want[i].y) < 1.6) ? 'ok' : JSON.stringify({ got, want });
  }, { timeout: 15_000 }).toBe('ok');
}
async function openPanel(page) {
  await page.locator('[data-ipad-drawer-tab="display"]').click();
  const p = page.locator('#comment-panel');
  if (!(await p.evaluate(el => el.open))) await p.locator('summary').click();
  await expect(p.locator('.comment-show-input')).toBeVisible();
}

test('3D view: numbered dots follow rotation / zoom / resize, switch off with the checkbox, vanish on delete, other series not shown', async ({ page }) => {
  test.setTimeout(150_000);
  await open3d(page);
  await expect(dots(page)).toHaveCount(0);
  const A = { i: 3, j: 5, k: 4 }, B = { i: 12, j: 10, k: 9 };
  const idA = await addAt(page, 'first spot', A);
  await addAt(page, 'second spot', B);
  await addAt(page, 'written on another series', { i: 8, j: 8, k: 6 }, true);
  await expect(dots(page)).toHaveCount(2);
  expect((await dotCentres(page)).map(d => d.n)).toEqual(['1', '2']);
  await expectDotsAt(page, [A, B]);
  await page.screenshot({ path: 'pr99-3d-markers-1-default.png' });

  // rotation (drag on the 3D canvas), then zoom (wheel): the dots stay on their voxels
  const box = await page.locator('#viewport-3d canvas').boundingBox();
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.8);
  await page.mouse.down(); await page.mouse.move(box.x + box.width * 0.62, box.y + box.height * 0.7, { steps: 6 }); await page.mouse.up();
  await expectDotsAt(page, [A, B]);
  const rotated = await dotCentres(page);
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await page.mouse.wheel(0, -250);
  await expectDotsAt(page, [A, B]);
  expect(await dotCentres(page)).not.toEqual(rotated); // it did move
  await page.screenshot({ path: 'pr99-3d-markers-2-rotated-zoomed.png' });

  // resize of the page (the viewport element changes size)
  await page.setViewportSize({ width: 900, height: 700 });
  await expectDotsAt(page, [A, B]);

  // tap on a dot shows its text; a tap elsewhere closes it
  const c1 = (await dotCentres(page))[0];
  await page.mouse.click(c1.x, c1.y);
  await expect(page.locator('.comment-bubble-3d')).toBeVisible();
  await expect(page.locator('.comment-bubble-3d')).toContainText('first spot');
  await page.keyboard.press('Escape');
  await expect(page.locator('.comment-bubble-3d')).toBeHidden();

  // the same switch as the 2D overlays
  await openPanel(page);
  const sw = page.locator('#comment-panel .comment-show-input');
  await sw.uncheck();
  await expect(dots(page)).toHaveCount(0);
  await sw.check();
  await expect(dots(page)).toHaveCount(2);

  // delete -> gone at once, the other keeps its number by list position
  await removeById(page, idA);
  await expect(dots(page)).toHaveCount(1);
  expect((await dotCentres(page))[0].n).toBe('1'); // B is now the first of the list
});
