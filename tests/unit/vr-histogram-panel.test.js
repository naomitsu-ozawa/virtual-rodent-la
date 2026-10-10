import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as THREE from 'three';
import { createVrHistogramPanel } from '../../docs/vr-histogram-panel.js';
import { createHist, binValues } from '../../docs/histogram.js';
import { SETTLE_MS, MIN_GAP_MS, PLOT, pxToLocalX } from '../../docs/vr-histogram-layout.js';

// a canvas whose 2D context only counts what is drawn
let counts;
beforeEach(() => {
  counts = { fillRect: 0, fillText: 0, canvases: [] };
  const ctx = new Proxy({}, { get: (t, k) => (k === 'fillRect' || k === 'fillText' ? () => { counts[k]++; } : typeof k === 'string' && /^(beginPath|moveTo|lineTo|stroke|fill|roundRect|clearRect)$/.test(k) ? () => {} : t[k]), set: (t, k, v) => { t[k] = v; return true; } });
  vi.stubGlobal('document', { createElement: () => { const c = { width: 0, height: 0, getContext: () => ctx }; counts.canvases.push(c); return c; } });
});

const KEYS = ['bone', 'soft'], W = 0.46;
const mk = () => {
  const segs = { bone: { active: true, enabled: true, min: 200, max: 1500, color: '#e0d0a0' }, soft: { active: true, enabled: true, min: -100, max: 100, color: '#c06060' } };
  const hist = binValues(createHist(), Float32Array.from([-50, 0, 40, 60, 250, 400, 900]));
  const view = { volume: { spacing: [1, 1, 1] }, res: { list: KEYS.map(key => ({ key, seg: segs[key], hist, draft: false })), total: null }, busy: false, message: '', noSeg: false };
  const getView = vi.fn(() => view);
  const panel = createVrHistogramPanel(THREE, { keys: KEYS, segs, getView, nameOf: k => k, modeText: () => 'Filtered · Linear', log: () => false, widthM: W,
    L: { title: 'T', whole: 'All', busy: '…', noSeg: 'none', window: 'win', empty: 'empty', cols: { name: 'n', count: 'c', volume: 'v', mean: 'm', sd: 's', p50: 'p', min: 'a', max: 'b' } } });
  return { panel, segs, getView, view };
};
const lines = panel => panel.group.children.filter(o => o.geometry?.parameters?.width === 1 && o.geometry?.parameters?.height === 1);

describe('VR histogram panel: redraw only on data / range change', () => {
  it('is hidden and does nothing until opened', () => {
    const { panel, getView } = mk(); panel.update(0, 0, 100);
    expect(panel.group.visible).toBe(false); expect(panel.drawCount).toBe(0); expect(getView).not.toHaveBeenCalled();
  });
  it('opening draws the bars once; 600 further frames with nothing changed draw nothing and read no results', () => {
    const { panel, getView } = mk(); panel.setOpen(true);
    for (let f = 0; f < 600; f++) panel.update(1000 + f * 14, 0, 400);
    expect(panel.drawCount).toBe(1); expect(getView).toHaveBeenCalledTimes(1);
    const before = { ...counts }; for (let f = 0; f < 600; f++) panel.update(10000 + f * 14, 0, 400);
    expect(counts.fillRect).toBe(before.fillRect); expect(counts.fillText).toBe(before.fillText);
  });
  it('a dragged segment slider moves its line every frame and the bars are redrawn once, after it stops', () => {
    const { panel, segs } = mk(); panel.setOpen(true); panel.update(1000, NaN, NaN);
    const [bone] = lines(panel), x0 = bone.position.x; let t = 1000, last = x0, moved = 0;
    for (let i = 0; i < 100; i++) { t += 14; segs.bone.min = 200 + (i + 1) * 5; panel.update(t, NaN, NaN); if (bone.position.x !== last) { moved++; last = bone.position.x; } }
    expect(moved).toBe(100); expect(bone.position.x).toBeGreaterThan(x0); expect(panel.drawCount).toBe(1); // no bar redraw during the drag
    panel.update(t + SETTLE_MS, NaN, NaN); expect(panel.drawCount).toBe(2);                                     // one after it settled
    for (let i = 0; i < 50; i++) panel.update(t + SETTLE_MS + 20 + i * 14, NaN, NaN); expect(panel.drawCount).toBe(2);
  });
  it('new data (invalidate) redraws, at most once per MIN_GAP_MS', () => {
    const { panel } = mk(); panel.setOpen(true); panel.update(1000, NaN, NaN);
    panel.invalidate(); panel.update(1000 + MIN_GAP_MS - 1, NaN, NaN); expect(panel.drawCount).toBe(1);
    panel.update(1000 + MIN_GAP_MS, NaN, NaN); expect(panel.drawCount).toBe(2);
    panel.invalidate(); panel.invalidate(); panel.update(2000, NaN, NaN); expect(panel.drawCount).toBe(3);
  });
  it('the VR window lines follow a slider with no bar redraw', () => {
    const { panel } = mk(); panel.setOpen(true); panel.update(1000, 0, 400);
    const win = lines(panel).slice(-2), a = win[0].position.x; let t = 1000;
    for (let i = 0; i < 60; i++) { t += 14; panel.update(t, i, 400 + i); }
    expect(win[0].position.x).not.toBe(a); expect(panel.drawCount).toBe(1);
  });
});

describe('VR histogram panel: lines', () => {
  it('a segment line sits at its HU on the plot; the window edges are the plot edges', () => {
    const { panel, segs } = mk(); panel.setOpen(true); panel.update(1000, NaN, NaN);
    const [bmin, bmax, smin, smax] = lines(panel);
    expect([bmin, bmax, smin, smax].every(l => l.visible)).toBe(true);
    expect(bmin.position.x).toBeLessThan(bmax.position.x); expect(smin.position.x).toBeLessThan(smax.position.x);
    expect(bmin.position.x).toBeGreaterThan(pxToLocalX(PLOT.x, W) - 1e-9); expect(bmax.position.x).toBeLessThan(pxToLocalX(PLOT.x + PLOT.w, W) + 1e-9);
    expect(segs.soft.min).toBe(-100);
  });
  it('a segment that is switched off or whose line leaves the window has no line', () => {
    const { panel, segs } = mk(); panel.setOpen(true); panel.update(1000, NaN, NaN);
    const [bmin, bmax, smin, smax] = lines(panel);
    segs.soft.enabled = false; panel.update(1014, NaN, NaN); expect(smin.visible).toBe(false); expect(smax.visible).toBe(false); expect(bmin.visible).toBe(true);
    segs.bone.userMax = 100000; panel.update(1028, NaN, NaN); expect(bmax.visible).toBe(false);
  });
  it('no window lines without a VR window; closing hides everything', () => {
    const { panel } = mk(); panel.setOpen(true); panel.update(1000, NaN, NaN);
    expect(lines(panel).slice(-2).every(l => !l.visible)).toBe(true);
    panel.setOpen(false); expect(panel.group.visible).toBe(false);
  });
  it('the number labels are redrawn only when the rounded HU changes', () => {
    const { panel, segs } = mk(); panel.setOpen(true); panel.update(1000, NaN, NaN);
    const t0 = counts.fillText; for (let f = 0; f < 100; f++) panel.update(1014 + f, NaN, NaN); expect(counts.fillText).toBe(t0);
    segs.bone.min = 201; panel.update(1200, NaN, NaN); expect(counts.fillText).toBe(t0 + 1);
    segs.bone.min = 201.2; panel.update(1214, NaN, NaN); expect(counts.fillText).toBe(t0 + 1); // same rounded number
  });
  it('no data (no volume): draws the empty board without lines', () => {
    const { panel, view } = mk(); view.volume = null; panel.setOpen(true); panel.update(1000, 0, 400);
    expect(panel.drawCount).toBe(1); expect(lines(panel).every(l => !l.visible)).toBe(true);
  });
  it('dispose removes the board and frees what it made', () => {
    const { panel } = mk(), parent = new THREE.Group(); parent.add(panel.group); panel.dispose(); expect(parent.children).toHaveLength(0);
  });
});
