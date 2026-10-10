import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { dicomFolder } from '../helpers/dicom-folder.js';

// build 543: the VR histogram board reads the PC histogram's results (same pass, cache and filtered / raw values). Without a headset the board
// is built on the page with the real three.js and a visible-less group: the bars are drawn once for a stable state and not again for many frames,
// and a moved segment slider moves the board's line without a bar redraw.
const q = readFileSync('docs/app.js', 'utf8').match(/\.\/histogram-ui\.js(\?v=[^']+)'/)?.[1] ?? readFileSync('docs/segment-runs.js', 'utf8').match(/\.\/segments\.js(\?v=[^']+)/)[1];

test('VR histogram board: same results as the PC card, redrawn only on data / range change', async ({ page }) => {
  test.setTimeout(150_000);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await page.locator('#folder-input').setInputFiles(dicomFolder());
  await page.locator('#series-list .series-card').first().click({ timeout: 30_000 });
  await expect(page.locator('.ready-badge').first()).toContainText(/ready/i, { timeout: 60_000 });
  await page.evaluate(() => {
    const sel = document.getElementById('segment-add-select'), btn = document.getElementById('segment-add-button');
    sel.value = 'soft'; sel.dispatchEvent(new Event('change')); btn.click();
  });
  const out = await page.evaluate(async q => {
    const H = await import('/histogram-ui.js' + q), S = await import('/segments.js' + q), HH = await import('/histogram.js' + q), P = await import('/vr-histogram-panel.js' + q);
    const THREE = await import('https://cdn.jsdelivr.net/npm/three@0.186.0/build/three.module.js');
    H.acquireHistogram('e2e', { sliceMs: 5 }); // no PC card open: the pass still runs for the VR consumer
    let view = null;
    for (let i = 0; i < 200; i++) { view = H.getHistogramView(); const r = view.res.list[0]; if (r?.hist && !r.draft && !view.busy) break; await new Promise(r => setTimeout(r, 100)); }
    const keys = S.SEGMENT_PRESET_ORDER, segs = S.segmentState;
    const panel = P.createVrHistogramPanel(THREE, { keys, segs, getView: H.getHistogramView, nameOf: k => k, modeText: () => 'm', log: () => false, widthM: 0.46,
      L: { title: 't', whole: 'all', busy: 'busy', noSeg: 'none', window: 'w', empty: 'e', cols: {} } });
    panel.setOpen(true);
    let t = 1000; panel.update(t, 0, 400);
    const first = panel.drawCount, lineMeshes = panel.group.children.filter(o => o.geometry?.parameters?.width === 1 && o.geometry?.parameters?.height === 1);
    const idx = keys.indexOf('soft'), minLine = lineMeshes[2 * idx], x0 = minLine.position.x;
    for (let i = 0; i < 300; i++) { t += 14; panel.update(t, 0, 400); }
    const stable = panel.drawCount;
    for (let i = 0; i < 20; i++) { t += 14; segs.soft.userMin = (segs.soft.userMin ?? segs.soft.min) + 5; panel.update(t, 0, 400); }
    const during = panel.drawCount, x1 = minLine.position.x;
    panel.update(t + 300, 0, 400);
    const stats = HH.histStats(view.res.list[0].hist);
    H.releaseHistogram('e2e'); panel.dispose();
    return { first, stable, during, after: panel.drawCount, moved: x1 !== x0, count: stats.count, hasHist: !!view.res.list[0].hist, draft: view.res.list[0].draft };
  }, q);
  expect(out.hasHist).toBe(true); expect(out.count).toBeGreaterThan(0);
  expect(out.first).toBe(1); expect(out.stable).toBe(1);   // bars drawn once, not per frame
  expect(out.during).toBe(1); expect(out.moved).toBe(true); // slider drag: the line moves, the bars do not redraw
  expect(out.after).toBe(2);                                // one redraw after it settled
  expect(errors).toEqual([]);
});
