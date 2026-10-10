import { test, expect } from '@playwright/test';
import { dicomFolder } from '../helpers/dicom-folder.js';

// build 545: the HU line in VR (docs/vr-hu-line.js). A headset is not available here, so the real module is driven in the page with a scripted
// laser (env.pick) and fake controllers: press = start, frames while held = the line stretches (panel redrawn <= 12.5 Hz), release = end.
// What is checked: the shared model gets the endpoints (so the PC panel / 3D view show them), the hand panel gets the live + final values,
// the line mesh follows, clear / disarm behave, and no frame allocates while dragging (update() is called with a counter on the panel canvas).
async function openStudy(page) {
  await page.goto('/');
  await page.locator('#folder-input').setInputFiles(dicomFolder());
  await page.locator('#series-list .series-card').first().click({ timeout: 30_000 });
  await expect(page.locator('.ready-badge').first()).toContainText(/ready/i, { timeout: 60_000 });
  await expect(page.locator('[data-crosshair-toggle="axial"]')).toBeEnabled({ timeout: 30_000 });
  await page.locator('[data-ipad-view-mode="split"]').click();
  await page.locator('[data-ipad-mpr="axial"]').click();
  await page.locator('#line-profile-toggle').click();
}

const SETUP = `
  const v = new URL(document.querySelector('script[src*="app.js"]').src).search;
  const THREE = await import('https://cdn.jsdelivr.net/npm/three@0.186.0/build/three.module.js');
  const st = await import('./state.js' + v), model = await import('./hu-line-model.js' + v), mod = await import('./vr-hu-line.js' + v), core = await import('./vr-hu-line-core.js' + v);
  const vol = st.sourceVolume || st.volume, dims = { columns: vol.columns, rows: vol.rows, slices: vol.slices };
  const he = [0.5, 0.5 * vol.rows / vol.columns, 0.5 * vol.slices * (vol.spacing[2] / vol.spacing[0]) / vol.columns];
  const scene = new THREE.Scene(), volMesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), new THREE.MeshBasicMaterial()); scene.add(volMesh); volMesh.updateMatrixWorld(true);
  const hand = new THREE.Group(); scene.add(hand);
  const target = { i: 0, j: 0, k: 0 }, flashes = [], pulses = []; let miss = false, refreshes = 0;
  const huLine = mod.createVrHuLine(THREE, { mesh: () => volMesh, halfExt: () => he, dims: () => dims, language: 'en', pulse: (c, a, ms) => pulses.push([a, ms]), flash: t => flashes.push(t), refresh: () => refreshes++,
    pick: (c, out) => { if (miss) return null; out.i = target.i; out.j = target.j; out.k = target.k; return out; } });
  window.__vr = { THREE, st, model, core, vol, dims, he, volMesh, hand, target, huLine, flashes, pulses, setMiss: m => { miss = m; }, refreshes: () => refreshes };
`;

test('VR HU line: armed press-drag-release shares the line with the PC views, live + final panel values, clear', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await openStudy(page);
  await page.evaluate(`(async () => { ${SETUP} })()`);
  const info = await page.evaluate(() => { const w = window.__vr; return { cols: w.dims.columns, rows: w.dims.rows, slices: w.dims.slices }; });
  const mid = { j: Math.floor(info.rows / 2), k: Math.floor(info.slices / 2) };

  // not armed: the trigger is not taken
  expect(await page.evaluate(() => window.__vr.huLine.start(window.__vr.hand))).toBe(false);
  await page.evaluate(() => window.__vr.huLine.setArmed(true));
  expect(await page.evaluate(() => window.__vr.huLine.isArmed())).toBe(true);
  expect(await page.evaluate(() => window.__vr.refreshes())).toBeGreaterThan(0);

  // a press on nothing (the laser misses the volume and no section) leaves the trigger to its normal action
  await page.evaluate(() => window.__vr.setMiss(true));
  expect(await page.evaluate(() => window.__vr.huLine.start(window.__vr.hand))).toBe(false);
  await page.evaluate(() => window.__vr.setMiss(false));

  // press at 20 % of the width, hold, stretch over 60 frames at 72 fps, release at 75 %
  const res = await page.evaluate(({ info, mid }) => {
    const w = window.__vr, h = w.huLine, out = {};
    w.target.i = Math.round(info.cols * 0.2); w.target.j = mid.j; w.target.k = mid.k;
    out.started = h.start(w.hand);
    out.dragging = h.isDragging();
    out.panelOnHand = w.hand.children.includes(h.panel) && h.panel.visible;
    out.noMipmaps = h.panel.material.map.generateMipmaps === false;
    out.modelDuringDrag = w.model.getHuLine();
    let t = 1000, redraws = 0, lastVersion = h.panel.material.map.version;
    for (let f = 0; f < 60; f++, t += 1000 / 72) {
      w.target.i = Math.round(info.cols * (0.2 + 0.55 * f / 59));
      h.update(t);
      const ver = h.panel.material.map.version; if (ver !== lastVersion) { redraws++; lastVersion = ver; }
    }
    out.redraws = redraws; out.seconds = 60 / 72;
    out.liveStats = h.stats();
    out.liveN = out.liveStats?.count ?? 0;
    out.modelDuringDragAfter = w.model.getHuLine();
    out.tubeVisible = h.group.visible && h.group.parent === w.volMesh;
    out.ended = h.end(w.hand);
    out.model = w.model.getHuLine();
    out.pulses = w.pulses.length;
    return out;
  }, { info, mid });
  expect(res.started).toBe(true); expect(res.dragging).toBe(true); expect(res.panelOnHand).toBe(true); expect(res.noMipmaps).toBe(true);
  expect(res.modelDuringDrag).toBeNull();          // the model is written on release only (no PC re-render while the headset is on)
  expect(res.modelDuringDragAfter).toBeNull();
  expect(res.tubeVisible).toBe(true);
  expect(res.redraws).toBeGreaterThanOrEqual(8); expect(res.redraws).toBeLessThanOrEqual(13); // 60 frames = 0.83 s: about 12.5 Hz, not one per frame
  expect(res.liveN).toBeGreaterThan(2);
  expect(res.ended).toBe(true);
  expect(res.model.a.i).toBe(Math.round(info.cols * 0.2)); expect(res.model.b.i).toBe(Math.round(info.cols * 0.75));
  expect(res.model.a.j).toBe(mid.j); expect(res.model.b.k).toBe(mid.k);
  expect(res.pulses).toBe(2);

  // the full read arrives: the hand panel holds the final (non-live) values, mean / min / max exist
  await expect.poll(() => page.evaluate(() => { const s = window.__vr.huLine.stats(); return s ? s.count : 0; }), { timeout: 30_000 }).toBeGreaterThan(2);
  const fin = await page.evaluate(() => { const s = window.__vr.huLine.stats(); return { mean: s.mean, min: s.min, max: s.max, count: s.count }; });
  expect(fin.min).toBeLessThanOrEqual(fin.mean); expect(fin.mean).toBeLessThanOrEqual(fin.max);
  // the panel canvas really has pixels (title bar, plot, three stat boxes)
  const painted = await page.evaluate(() => { const c = window.__vr.huLine.panel.material.map.image, d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++; return n / (c.width * c.height); });
  expect(painted).toBeGreaterThan(0.9);

  // the same line is on the PC: the open line-profile panel read it (shared model, both ways)
  const plot = page.locator('#line-profile-result .lp-plot');
  await expect.poll(async () => Number(await plot.getAttribute('data-n')), { timeout: 30_000 }).toBeGreaterThan(2);
  // and the other way round: a line set from the PC side moves the VR mesh without the hand panel
  await page.evaluate(({ info, mid }) => { const w = window.__vr; w.model.setHuLine({ i: 2, j: mid.j, k: mid.k }, { i: info.cols - 3, j: mid.j, k: mid.k }, 'final', '2d'); w.huLine.update(5000); }, { info, mid });
  expect(await page.evaluate(() => window.__vr.huLine.group.visible)).toBe(true);
  expect(await page.evaluate(() => window.__vr.huLine.panel.visible)).toBe(false);

  // a click without a stretch keeps the line that is there
  const kept = await page.evaluate(({ mid }) => { const w = window.__vr; w.target.i = 5; w.target.j = mid.j; w.target.k = mid.k; w.huLine.start(w.hand); const e = w.huLine.end(w.hand); return { e, m: w.model.getHuLine() }; }, { mid });
  expect(kept.e).toBe(true); expect(kept.m.a.i).toBe(2);

  // clear: the shared model is empty, the mesh and panel are gone; disarm hands the trigger back
  await page.evaluate(() => window.__vr.huLine.clear());
  expect(await page.evaluate(() => window.__vr.model.getHuLine())).toBeNull();
  expect(await page.evaluate(() => window.__vr.huLine.group.visible || window.__vr.huLine.panel.visible)).toBe(false);
  await page.evaluate(() => window.__vr.huLine.setArmed(false));
  expect(await page.evaluate(() => window.__vr.huLine.start(window.__vr.hand))).toBe(false);
  await page.evaluate(() => window.__vr.huLine.dispose());
  expect(errors).toEqual([]);
});
