import { describe, it, expect } from 'vitest';
import { PANEL_W, PANEL_H, PLOT, SETTLE_MS, MIN_GAP_MS, boardHeightM, pxToLocalX, pxToLocalY, columnsFor, barFraction, countLabel, windowOf, lineLayout, plotMetrics, labelCenterX, shouldRedraw, snapshotRanges, tableColumns, statsCells, tableRows, LABEL_W_M } from '../../docs/vr-histogram-layout.js';
import { createHist, binValues, fitWindow, niceStep, HIST_MIN, HIST_MAX } from '../../docs/histogram.js';

const W = 0.46;
const histOf = values => binValues(createHist(), Float32Array.from(values));

describe('canvas px -> board metres', () => {
  it('the centre of the canvas is the board centre, x grows right, y grows up', () => {
    expect(pxToLocalX(PANEL_W / 2, W)).toBeCloseTo(0); expect(pxToLocalY(PANEL_H / 2, W)).toBeCloseTo(0);
    expect(pxToLocalX(PANEL_W, W)).toBeCloseTo(W / 2); expect(pxToLocalX(0, W)).toBeCloseTo(-W / 2);
    expect(pxToLocalY(0, W)).toBeCloseTo(boardHeightM(W) / 2); expect(pxToLocalY(PANEL_H, W)).toBeCloseTo(-boardHeightM(W) / 2);
  });
  it('the plot rectangle lies inside the canvas, above the table', () => {
    expect(PLOT.x).toBeGreaterThan(0); expect(PLOT.x + PLOT.w).toBeLessThan(PANEL_W); expect(PLOT.y + PLOT.h).toBeLessThan(PANEL_H);
    const pm = plotMetrics(W);
    expect(pm.top).toBeGreaterThan(pm.cy); expect(pm.h).toBeCloseTo(PLOT.h / PANEL_W * W);
  });
});

describe('range line position (bin -> panel)', () => {
  const out = { x: 0, visible: false };
  it('the window edges map to the plot edges, the middle to the plot centre', () => {
    lineLayout(-100, -100, 300, W, out); expect(out.visible).toBe(true); expect(out.x).toBeCloseTo(pxToLocalX(PLOT.x, W));
    lineLayout(300, -100, 300, W, out); expect(out.x).toBeCloseTo(pxToLocalX(PLOT.x + PLOT.w, W));
    lineLayout(100, -100, 300, W, out); expect(out.x).toBeCloseTo(pxToLocalX(PLOT.x + PLOT.w / 2, W));
  });
  it('is linear in HU (a 1 HU step is the same distance everywhere)', () => {
    const xs = [0, 1, 200, 201].map(h => lineLayout(h, -100, 300, W, { x: 0, visible: false }).x);
    expect(xs[1] - xs[0]).toBeCloseTo(xs[3] - xs[2]);
  });
  it('outside the window (or NaN) is hidden', () => {
    expect(lineLayout(-101, -100, 300, W, out).visible).toBe(false); expect(lineLayout(301, -100, 300, W, out).visible).toBe(false);
    expect(lineLayout(NaN, -100, 300, W, out).visible).toBe(false);
  });
  it('writes into the object it is given and returns it (no allocation per frame)', () => {
    const o = { x: 9, visible: true }; expect(lineLayout(0, -100, 300, W, o)).toBe(o);
  });
  it('a min label hangs left of its line and a max label right of it', () => {
    expect(labelCenterX(0.1, -1)).toBeLessThan(0.1 - LABEL_W_M / 2 + 1e-9); expect(labelCenterX(0.1, 1)).toBeGreaterThan(0.1 + LABEL_W_M / 2 - 1e-9);
  });
});

describe('bars', () => {
  it('columns: one per HU while that fits, at most one per 2 px', () => {
    expect(columnsFor(0, 99)).toBe(100); expect(columnsFor(-1024, 3071)).toBe(PLOT.w / 2); expect(columnsFor(5, 5)).toBe(1);
  });
  it('bar fraction: linear and log are 0 for an empty bin and 1 for the maximum', () => {
    expect(barFraction(0, 100, false)).toBe(0); expect(barFraction(100, 100, false)).toBe(1); expect(barFraction(50, 100, false)).toBe(0.5);
    expect(barFraction(0, 100, true)).toBe(0); expect(barFraction(100, 100, true)).toBeCloseTo(1);
    expect(barFraction(10, 100, true)).toBeGreaterThan(barFraction(10, 100, false)); // the log scale lifts small counts
  });
  it('count labels', () => { expect(countLabel(950)).toBe('950'); expect(countLabel(12345)).toBe('12k'); expect(countLabel(2500000)).toBe('2.5M'); });
});

describe('chart window (same rule as the PC chart)', () => {
  it('the window covers the data and the ranges with a little padding', () => {
    const res = { list: [{ seg: { min: 100, max: 300, color: '#fff' }, hist: histOf([120, 150, 250]) }], total: null };
    const [lo, hi] = windowOf(res); expect(lo).toBeLessThanOrEqual(100); expect(hi).toBeGreaterThanOrEqual(300); expect(hi - lo).toBeGreaterThanOrEqual(50);
  });
  it('userMin / userMax win over min / max', () => {
    const res = { list: [{ seg: { min: 100, max: 300, userMin: -500, userMax: 900 }, hist: null }], total: null };
    const [lo, hi] = windowOf(res); expect(lo).toBeLessThanOrEqual(-500); expect(hi).toBeGreaterThanOrEqual(900);
  });
  it('nothing at all: the default window; always inside the histogram range', () => {
    expect(windowOf({ list: [], total: null })).toEqual(fitWindow([]));
    const [lo, hi] = fitWindow([[-5000, 9000]]); expect(lo).toBe(HIST_MIN); expect(hi).toBe(HIST_MAX);
    expect(niceStep(400, 9)).toBe(50); expect(niceStep(1e6, 3)).toBe(2000);
  });
  it('whole-volume histogram counts when no segment is listed', () => {
    const [lo, hi] = windowOf({ list: [], total: { hist: histOf([-800, 40, 900]) } }); expect(lo).toBeLessThanOrEqual(-800); expect(hi).toBeGreaterThanOrEqual(900);
  });
});

describe('redraw policy: bars are not redrawn while a slider moves', () => {
  const base = { dataDirty: false, rangeDirty: false, now: 1000, lastDraw: 0, rangeAt: 0 };
  it('nothing dirty: never', () => expect(shouldRedraw(base)).toBe(false));
  it('new data: at once (after the minimum gap)', () => {
    expect(shouldRedraw({ ...base, dataDirty: true })).toBe(true);
    expect(shouldRedraw({ ...base, dataDirty: true, lastDraw: 1000 - MIN_GAP_MS + 1 })).toBe(false);
  });
  it('a range that is still moving waits; once still for SETTLE_MS it redraws', () => {
    expect(shouldRedraw({ ...base, rangeDirty: true, rangeAt: 1000 })).toBe(false);
    expect(shouldRedraw({ ...base, rangeDirty: true, rangeAt: 1000 - SETTLE_MS + 1 })).toBe(false);
    expect(shouldRedraw({ ...base, rangeDirty: true, rangeAt: 1000 - SETTLE_MS })).toBe(true);
  });
  it('a drag (a change every 14 ms for 2 s) never redraws; the redraw follows the release', () => {
    let draws = 0, lastDraw = 0, rangeAt = 0;
    for (let t = 0; t < 2000; t += 14) { rangeAt = t; if (shouldRedraw({ dataDirty: false, rangeDirty: true, now: t, lastDraw, rangeAt })) { draws++; lastDraw = t; } }
    expect(draws).toBe(0);
    expect(shouldRedraw({ dataDirty: false, rangeDirty: true, now: 2000 + SETTLE_MS, lastDraw, rangeAt })).toBe(true);
  });
  it('snapshotRanges reports a change once and then nothing', () => {
    const keys = ['bone', 'soft'], segs = { bone: { active: true, enabled: true, min: 200, max: 3000 }, soft: { active: true, enabled: false, min: 0, max: 100 } };
    const snap = new Float64Array(6).fill(NaN);
    expect(snapshotRanges(keys, segs, snap)).toBe(true); expect(snapshotRanges(keys, segs, snap)).toBe(false);
    segs.bone.userMin = 250; expect(snapshotRanges(keys, segs, snap)).toBe(true); expect(snapshotRanges(keys, segs, snap)).toBe(false);
    segs.soft.min = 5; expect(snapshotRanges(keys, segs, snap)).toBe(false); // not shown: its range is not part of the picture
    segs.soft.enabled = true; expect(snapshotRanges(keys, segs, snap)).toBe(true);
    delete segs.bone; expect(snapshotRanges(keys, segs, snap)).toBe(true);
  });
});

describe('stats table', () => {
  const h = histOf([10, 20, 30, 40, 50]);
  it('columns: the volume column only with a spacing', () => {
    expect(tableColumns(true).map(c => c.id)).toEqual(['name', 'count', 'volume', 'mean', 'sd', 'p50', 'min', 'max']);
    expect(tableColumns(false).map(c => c.id)).toEqual(['name', 'count', 'mean', 'sd', 'p50', 'min', 'max']);
    for (const has of [true, false]) { const xs = tableColumns(has).map(c => c.x); expect(xs).toEqual([...xs].sort((a, b) => a - b)); expect(xs.at(-1)).toBeLessThanOrEqual(PANEL_W); }
  });
  it('cells come from histStats: count, mean, SD, median, min, max', () => {
    const rows = tableRows({ list: [{ key: 'soft', seg: { color: '#c33' }, hist: h, draft: false }], total: null }, k => k + '!', 'All');
    expect(rows).toHaveLength(1); expect(rows[0].name).toBe('soft!');
    const c = statsCells(rows[0].stats, [0.5, 0.5, 2], true);
    expect(c).toMatchObject({ count: '5', mean: '30.0', p50: '30', min: '10', max: '50' }); expect(c.sd).toBe('14.1'); expect(c.volume).toBe('2.5');
    expect(statsCells(rows[0].stats, null, true).volume).toBe('—'); expect(statsCells(rows[0].stats, null, false).volume).toBeUndefined();
  });
  it('no stats yet: null cells; no segment: one whole-volume row; capped to the table height', () => {
    expect(statsCells(null, null, false)).toBeNull();
    expect(tableRows({ list: [], total: { hist: h, draft: true } }, k => k, 'All')).toMatchObject([{ key: 'all', name: 'All', draft: true }]);
    const many = Array.from({ length: 9 }, (_, i) => ({ key: 'k' + i, seg: { color: '#fff' }, hist: null }));
    expect(tableRows({ list: many, total: null }, k => k, 'All').length).toBeLessThan(9);
  });
});
