import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { localToVoxelInto, voxelToLocalInto, voxelFromHits, voxelDistanceMm, sameGrid, panelLayout, huRange, plotPoints, panelTexts, huMenuTexts, createHuPanelGate, HU_PANEL_INTERVAL_MS, PANEL_W, PANEL_H } from '../../docs/vr-hu-line-core.js';
import { voxelToLocal } from '../../docs/vr-point.js';

const dims = { columns: 64, rows: 48, slices: 32 }, he = [0.5, 0.375, 0.25];

describe('vr-hu-line-core: ray hit -> voxel', () => {
  it('is the inverse of voxelToLocalInto, also for fractional voxels', () => {
    const l = { x: 0, y: 0, z: 0 }, out = { i: 0, j: 0, k: 0 };
    for (const v of [{ i: 0, j: 0, k: 0 }, { i: 63, j: 47, k: 31 }, { i: 10.25, j: 20.5, k: 3.75 }]) {
      voxelToLocalInto(v, he, dims, l);
      expect(localToVoxelInto(l, he, dims, out)).toBe(out);
      expect(out.i).toBeCloseTo(v.i, 9); expect(out.j).toBeCloseTo(v.j, 9); expect(out.k).toBeCloseTo(v.k, 9);
    }
  });
  it('agrees with the VR point convention (vr-point.js voxelToLocal)', () => {
    const l = { x: 0, y: 0, z: 0 }; voxelToLocalInto({ i: 5, j: 7, k: 9 }, he, dims, l);
    expect(l).toEqual(voxelToLocal({ i: 5, j: 7, k: 9 }, he, dims));
  });
  it('rejects points outside the box (more than half a voxel) and bad input, writes nothing then', () => {
    const out = { i: -1, j: -1, k: -1 };
    expect(localToVoxelInto({ x: 0.6, y: 0, z: 0 }, he, dims, out)).toBeNull();
    expect(localToVoxelInto({ x: NaN, y: 0, z: 0 }, he, dims, out)).toBeNull();
    expect(localToVoxelInto(null, he, dims, out)).toBeNull();
    expect(out).toEqual({ i: -1, j: -1, k: -1 });
    expect(localToVoxelInto({ x: 0.5, y: 0, z: 0 }, he, dims, out)).not.toBeNull(); // the outer face of the edge voxel
  });
  it('prefers the tissue hit, falls back to the section plane, null when neither is inside', () => {
    const out = { i: 0, j: 0, k: 0 }, vh = { local: { x: 0.1, y: 0, z: 0 } }, sh = { point: { x: -0.2, y: 0, z: 0 } };
    expect(voxelFromHits(vh, sh, he, dims, out).via).toBe('volume');
    const a = out.i;
    expect(voxelFromHits(null, sh, he, dims, out).via).toBe('section');
    expect(out.i).toBeLessThan(a);
    expect(voxelFromHits({ local: { x: 5, y: 0, z: 0 } }, sh, he, dims, out).via).toBe('section'); // a tissue hit outside the box is not used
    expect(voxelFromHits(null, null, he, dims, out)).toBeNull();
    expect(voxelFromHits(null, { point: { x: 9, y: 9, z: 9 } }, he, dims, out)).toBeNull();
  });
  it('distance in mm and grid comparison', () => {
    expect(voxelDistanceMm({ i: 0, j: 0, k: 0 }, { i: 3, j: 4, k: 0 }, [1, 1, 2])).toBeCloseTo(5);
    expect(voxelDistanceMm({ i: 0, j: 0, k: 0 }, { i: 0, j: 0, k: 3 }, [1, 1, 2])).toBeCloseTo(6);
    expect(voxelDistanceMm({ i: 0, j: 0, k: 0 }, { i: 3, j: 4, k: 0 }, null)).toBeCloseTo(5);
    expect(sameGrid(dims, { ...dims })).toBe(true);
    expect(sameGrid(dims, { ...dims, slices: 33 })).toBe(false);
    expect(sameGrid(null, dims)).toBe(false);
  });
});

describe('vr-hu-line-core: throttle', () => {
  it('runs about 12.5 Hz while dirty and never when idle', () => {
    expect(HU_PANEL_INTERVAL_MS).toBeGreaterThanOrEqual(66); expect(HU_PANEL_INTERVAL_MS).toBeLessThanOrEqual(100); // 10-15 Hz
    const g = createHuPanelGate();
    let runs = 0;
    for (let t = 0; t < 1000; t += 1000 / 72) if (g.step(t, true).run) runs++; // 72 fps frames, always dirty
    expect(runs).toBeGreaterThanOrEqual(10); expect(runs).toBeLessThanOrEqual(15);
    expect(g.step(5000, false)).toEqual({ run: false, wait: 0 });
    g.reset(); expect(g.step(5001, true).run).toBe(true); // a new press samples at once
  });
});

describe('vr-hu-line-core: panel layout and plot', () => {
  it('keeps every block inside the canvas without overlaps', () => {
    const L = panelLayout(), inside = r => r.x >= 0 && r.y >= 0 && r.x + r.w <= PANEL_W && r.y + r.h <= PANEL_H && r.w > 0 && r.h > 0;
    for (const r of [L.head, L.plot, L.axisX, ...L.stats]) expect(inside(r), JSON.stringify(r)).toBe(true);
    expect(L.plot.y).toBeGreaterThanOrEqual(L.head.y + L.head.h);
    expect(L.axisX.y).toBeGreaterThanOrEqual(L.plot.y + L.plot.h);
    expect(L.stats[0].y).toBeGreaterThanOrEqual(L.axisX.y + L.axisX.h);
    for (let i = 1; i < 3; i++) expect(L.stats[i].x).toBeGreaterThanOrEqual(L.stats[i - 1].x + L.stats[i - 1].w);
  });
  it('huRange adds a margin and never collapses', () => {
    const [lo, hi] = huRange({ min: -100, max: 300 });
    expect(lo).toBeLessThan(-100); expect(hi).toBeGreaterThan(300);
    const [a, b] = huRange({ min: 40, max: 40 }); expect(b - a).toBeGreaterThanOrEqual(20);
    expect(huRange(null)).toEqual([-100, 100]);
  });
  it('plotPoints maps into the rect, leaves gaps for NaN, allocates nothing (fills the given buffer)', () => {
    const r = { x: 10, y: 20, w: 100, h: 50 }, out = new Float32Array(16), dist = [0, 5, 10], values = [0, NaN, 100];
    expect(plotPoints(dist, values, 3, r, 0, 100, 10, out)).toBe(3);
    expect([out[0], out[1]]).toEqual([10, 70]); // x at 0 mm, the lowest value at the bottom
    expect(out[3]).toBeNaN();
    expect([out[4], out[5]]).toEqual([110, 20]); // the end at the right edge, the highest value at the top
    expect(plotPoints(dist, [500, -500, 0], 3, r, 0, 100, 10, out)).toBe(3); expect(out[1]).toBe(20); expect(out[3]).toBe(70); // clamped
    expect(plotPoints([0], [5], 1, r, 0, 10, 0, out)).toBe(1); expect(out[0]).toBe(60); // a zero-length line sits in the middle
    expect(plotPoints(new Float64Array(100), new Float64Array(100), 100, r, 0, 1, 1, out)).toBe(8); // capped by the buffer
  });
  it('texts: mode, live, length, mean / min / max, in both languages', () => {
    const st = { mean: 12.34, min: -5.2, max: 99.9 };
    const ja = panelTexts('ja', { stats: st, lengthMm: 12.345, modeKey: 'filtered', live: true });
    expect(ja.title).toContain('フィルター後'); expect(ja.title).toContain('ライブ'); expect(ja.length).toBe('12.3 mm');
    expect(ja.stats).toEqual([['平均', '12.3'], ['最小', '-5'], ['最大', '100']]);
    const en = panelTexts('en', { stats: null, lengthMm: 0, modeKey: 'raw', busy: true, empty: true });
    expect(en.title).toContain('Raw'); expect(en.title).toContain('reading'); expect(en.stats[0][1]).toBe('—'); expect(en.length).toBe('');
    for (const lang of ['ja', 'en']) { const m = huMenuTexts(lang); expect(m.help.length).toBe(4); expect(m.tab.length).toBeGreaterThan(0); }
  });
});

describe('vr-view.js wiring of the HU line (source guard; the file is a WebXR module, not run in node)', () => {
  const src = readFileSync(new URL('../../docs/vr-view.js', import.meta.url), 'utf8');
  it('the trigger hands over to the HU line only when armed, after the menu / ring / board checks, and the release ends it first', () => {
    const ss = src.indexOf("addEventListener('selectstart'"), se = src.indexOf("addEventListener('selectend'");
    const press = src.slice(ss, se), iHu = press.indexOf('huLine.start(c)');
    expect(iHu).toBeGreaterThan(press.indexOf("res.kind==='ring-close'"));
    expect(iHu).toBeLessThan(press.indexOf('const pr={t0:now'));
    expect(press).toContain('huLine.isArmed()');
    expect(src.slice(se, se + 200)).toContain('huLine.end(c)');
  });
  it('is updated in the frame loop, disposed on exit, and has its own tab id that does not collide with the quick-ring editor (7)', () => {
    expect(src).toContain('huLine.update(js0)'); expect(src).toContain('huLine.dispose()');
    expect(src).toContain('TAB_IDS=[0,1,2,3,4,5,6,8]'); expect(src).toContain('ui.tab===8'); expect(src).toContain('ui.tab===7');
  });
  it('the HU-line module allocates no per-frame objects in update() and uses a mipmap-free canvas texture', () => {
    const m = readFileSync(new URL('../../docs/vr-hu-line.js', import.meta.url), 'utf8');
    expect(m).toContain('generateMipmaps = false');
    const u = m.slice(m.indexOf('function update(now)'), m.indexOf('// ---- shared state'));
    expect(u).not.toMatch(/new THREE\.|new Float|\.map\(|\.filter\(|\[\.\.\./);
  });
});
