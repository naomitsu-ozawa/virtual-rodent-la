import { test, expect } from '@playwright/test';
import { dicomFolder } from '../helpers/dicom-folder.js';

// build 541: live update while dragging the HU line, the HU line in 3D, and the shared endpoint model (2D <-> 3D).
// The synthetic CT has no tissue the segment presets would turn into a mesh, so the 3D scene has no object yet (see comments3d.spec.js):
// stand in a plain group (the volume's local frame). withMesh adds an invisible box around the volume tagged as a segment mesh, so the
// mesh ray cast of the 3D pick (surface mode: the WebGL fallback of this sandbox) has a surface to hit.
async function openStudy(page, withMesh = false) {
  await page.goto('/');
  await page.locator('#folder-input').setInputFiles(dicomFolder());
  await page.locator('#series-list .series-card').first().click({ timeout: 30_000 });
  await expect(page.locator('.ready-badge').first()).toContainText(/ready/i, { timeout: 60_000 });
  await expect(page.locator('[data-crosshair-toggle="axial"]')).toBeEnabled({ timeout: 30_000 });
  await page.evaluate(async withMesh => {
    const v = new URL(document.querySelector('script[src*="app.js"]').src).search;
    const st = await import('./state.js' + v), THREE = await import('https://cdn.jsdelivr.net/npm/three@0.186.0/build/three.webgpu.js');
    const s = st.sceneState; if (!s.obj) { s.obj = new THREE.Group(); s.scene.add(s.obj); }
    if (withMesh && !s.obj.children.length) {
      const vol = st.volume, [sx, sy, sz] = vol.spacing, px = vol.columns * sx, py = vol.rows * sy, pz = vol.slices * sz, k = 3.3 / Math.max(px, py, pz);
      const m = new THREE.Mesh(new THREE.BoxGeometry(px * k, py * k, pz * k), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, visible: false }));
      m.userData.segmentKey = 'e2e'; s.obj.add(m);
    }
    s.needsRender = true;
  }, withMesh);
  await page.locator('[data-ipad-view-mode="split"]').click();
  await page.locator('[data-ipad-mpr="axial"]').click();
  await page.locator('#line-profile-toggle').click();
}

test('HU line live update: the plot / stats follow the drag (preview), the release replaces it with the full read; the 3D view shows the line', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await openStudy(page);
  const axial = page.locator('#axial-canvas'), b = await axial.boundingBox();
  const plot = page.locator('#line-profile-result .lp-plot');
  await page.mouse.move(b.x + b.width * 0.2, b.y + b.height * 0.5);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(b.x + b.width * (0.2 + 0.04 * i), b.y + b.height * 0.5, { steps: 2 });
  // still pressed: the coarse live preview is already there (indicator + samples), and no full read has happened
  await expect.poll(async () => (await plot.getAttribute('data-live')) === '1' && Number(await plot.getAttribute('data-n')) > 2, { timeout: 15_000 }).toBe(true);
  await expect(page.locator('#line-profile-result .lp-live')).toBeVisible();
  const liveN = Number(await plot.getAttribute('data-n'));
  expect(liveN).toBeLessThanOrEqual(192);
  await expect(page.locator('#line-profile-result .seg-hist-table td').first()).toContainText('mm'); // the statistics update live too
  // more movement: the preview follows (longer line, more samples)
  for (let i = 11; i <= 16; i++) await page.mouse.move(b.x + b.width * (0.2 + 0.04 * i), b.y + b.height * 0.5, { steps: 2 });
  await expect.poll(async () => Number(await plot.getAttribute('data-n')), { timeout: 15_000 }).toBeGreaterThan(liveN);
  // shared model: the 3D overlay already shows the line being drawn on the slice
  await expect(page.locator('svg.hu-line-3d')).toHaveAttribute('data-visible', '1');
  await page.mouse.up();
  await expect.poll(async () => await plot.getAttribute('data-live'), { timeout: 30_000 }).toBeNull(); // the full read replaced the preview
  await expect(page.locator('#line-profile-result .lp-live')).toBeHidden();
  expect(Number(await plot.getAttribute('data-n'))).toBeGreaterThan(2);
  // the hover marker of the plot shows on the 3D overlay too
  const pb = await plot.boundingBox();
  await page.mouse.move(pb.x + pb.width * 0.5, pb.y + pb.height / 2);
  await expect.poll(async () => (await plot.getAttribute('data-hover')) || '').toMatch(/^[\d.]+\|-?[\d.]+$/);
  await expect.poll(async () => page.evaluate(() => [...document.querySelectorAll('svg.hu-line-3d circle')].filter(c => c.getAttribute('visibility') === 'visible').length), { timeout: 10_000 }).toBeGreaterThanOrEqual(3);
  expect(errors).toEqual([]);
});

test('HU line in 3D: armed press-drag-release on the 3D surface sets the shared line; plot follows live; the camera does not rotate', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await openStudy(page, true);
  const arm = page.locator('#line-profile-result .lp-3d-toggle');
  await expect(arm).toBeEnabled({ timeout: 30_000 });
  await arm.click();
  await expect(arm).toHaveClass(/is-active/);
  const host = page.locator('#viewport-3d'), cb = await host.boundingBox();
  const quat = () => page.evaluate(async () => {
    const v = new URL(document.querySelector('script[src*="app.js"]').src).search;
    return (await import('./state.js' + v)).sceneState.obj.quaternion.toArray();
  });
  const q0 = await quat();
  const x0 = cb.x + cb.width * 0.42, x1 = cb.x + cb.width * 0.58, y = cb.y + cb.height * 0.5;
  await page.mouse.move(x0, y);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(x0 + (x1 - x0) * i / 8, y + i * 2, { steps: 2 });
  const plot = page.locator('#line-profile-result .lp-plot');
  // while pressed: the live preview is already on the plot
  await expect.poll(async () => (await plot.getAttribute('data-live')) === '1' && Number(await plot.getAttribute('data-n')) > 2, { timeout: 20_000 }).toBe(true);
  await page.mouse.up();
  await expect.poll(async () => await plot.getAttribute('data-live'), { timeout: 30_000 }).toBeNull();
  expect(Number(await plot.getAttribute('data-n'))).toBeGreaterThan(2);
  expect(await quat()).toEqual(q0); // no rotation while drawing
  // the overlay line is anchored at the pressed / released screen positions
  const svg = page.locator('svg.hu-line-3d');
  await expect(svg).toHaveAttribute('data-visible', '1');
  const [ax, ay] = (await svg.getAttribute('data-a')).split(',').map(Number), [bx, by] = (await svg.getAttribute('data-b')).split(',').map(Number);
  expect(Math.abs(ax - (x0 - cb.x))).toBeLessThan(6); expect(Math.abs(ay - (y - cb.y))).toBeLessThan(6);
  expect(Math.abs(bx - (x1 - cb.x))).toBeLessThan(6); expect(Math.abs(by - (y + 16 - cb.y))).toBeLessThan(6);
  // disarmed: a drag on the 3D view rotates again
  await arm.click();
  await expect(arm).not.toHaveClass(/is-active/);
  await page.mouse.move(x0, y); await page.mouse.down(); await page.mouse.move(x0 + 40, y + 30, { steps: 5 }); await page.mouse.up();
  await expect.poll(async () => JSON.stringify(await quat()) !== JSON.stringify(q0), { timeout: 5000 }).toBe(true);
  expect(errors).toEqual([]);
});

test('HU line in 3D: with no surface under the pointer and no section plane the point is ignored (no line, no error)', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await openStudy(page, false);
  const arm = page.locator('#line-profile-result .lp-3d-toggle');
  await expect(arm).toBeEnabled({ timeout: 30_000 });
  await arm.click();
  const host = page.locator('#viewport-3d'), cb = await host.boundingBox();
  await page.mouse.move(cb.x + cb.width * 0.4, cb.y + cb.height * 0.5); await page.mouse.down();
  await page.mouse.move(cb.x + cb.width * 0.6, cb.y + cb.height * 0.5, { steps: 6 }); await page.mouse.up();
  await page.waitForTimeout(500);
  await expect(page.locator('svg.hu-line-3d')).toHaveAttribute('data-visible', '0');
  expect(Number(await page.locator('#line-profile-result .lp-plot').getAttribute('data-n'))).toBe(0);
  expect(errors).toEqual([]);
});
