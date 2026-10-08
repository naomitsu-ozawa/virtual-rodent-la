import { describe, it, expect } from 'vitest';
import { clampLabelCenter, planeLabelPlacement, planeVoxelDelta, stepDelta, offsetFromDelta, nearLabelWorld, createFocusTracker, OCCLUDED_ALPHA, LINE_SAMPLES, LABEL_MID, probeKey, labelPart, lineSamplePoints, fadeAlpha, lineAlphas, approachAlpha } from '../../docs/measure-label.js';
import { planePointFromVoxel } from '../../docs/crosshair.js';


describe('2D label placement (beside the line, compact, inside the image)', () => {
  it('perpendicular to the line (the upper side) and clear of it', () => {
    const a = { x: 50, y: 100 }, b = { x: 150, y: 100 }, r = planeLabelPlacement(a, b, { w: 48, h: 14, gap: 4, x0: 0, y0: 0, iw: 300, ih: 200 });
    expect(r.x).toBeCloseTo(100, 9); expect(r.y).toBeCloseTo(100 - (4 + 7), 9); expect(r.mx).toBe(100);
    const c = planeLabelPlacement({ x: 50, y: 50 }, { x: 150, y: 150 }, { w: 48, h: 14, gap: 4, x0: 0, y0: 0, iw: 300, ih: 300 });
    expect((c.x - c.mx) * 100 + (c.y - c.my) * 100).toBeCloseTo(0, 6); expect(c.y).toBeLessThan(c.my);
  });
  it('is clamped into the image rect', () => {
    const r = planeLabelPlacement({ x: 2, y: 3 }, { x: 10, y: 3 }, { w: 48, h: 14, gap: 4, x0: 0, y0: 0, iw: 100, ih: 100 });
    expect(r.x - 24).toBeGreaterThanOrEqual(0); expect(r.y - 7).toBeGreaterThanOrEqual(0);
  });
});

describe('moving a label: pixels / metres <-> voxel offsets', () => {
  it('stepDelta and offsetFromDelta are inverses (any per-voxel step, including a flipped axis)', () => {
    const step = [0.01, -0.02, 0.04], off = { i: 3.5, j: -2, k: 7 };
    const d = stepDelta(off, step); expect(d).toEqual({ x: 0.035, y: 0.04, z: 0.28 });
    const back = offsetFromDelta(d, step); expect(back.i).toBeCloseTo(3.5, 12); expect(back.j).toBeCloseTo(-2, 12); expect(back.k).toBeCloseTo(7, 12);
    expect(offsetFromDelta({ x: 1, y: 1, z: 1 }, [0, 0, 0])).toEqual({ i: 0, j: 0, k: 0 });
  });
  it('planeVoxelDelta inverts the real plane mapping for all three planes (the out-of-plane axis stays 0)', () => {
    const dims = { columns: 16, rows: 20, slices: 12 };
    for (const plane of ['axial', 'coronal', 'sagittal']) {
      const project = v => planePointFromVoxel(plane, v, dims), o = { i: 4, j: 7, k: 5 }, t = { i: 9, j: 3, k: 8 };
      const a = project(o), b = project(t), d = planeVoxelDelta(project, b.fx - a.fx, b.fy - a.fy);
      const back = project({ i: o.i + d.i, j: o.j + d.j, k: o.k + d.k });
      expect(back.fx).toBeCloseTo(b.fx, 9); expect(back.fy).toBeCloseTo(b.fy, 9);
      expect(Object.values(d).filter(x => Math.abs(x) < 1e-9).length).toBe(1); // exactly one axis is out of the plane
    }
  });
  it('the VR default spot is beside the line (perpendicular to it and to the view), on the upper side, `dist` from the midpoint', () => {
    const a = { x: -0.05, y: 1.3, z: -0.6 }, b = { x: 0.05, y: 1.3, z: -0.6 }, head = { x: 0, y: 1.6, z: 0 }, p = nearLabelWorld(a, b, head, 0.02);
    const mid = { x: 0, y: 1.3, z: -0.6 }, dv = { x: p.x - mid.x, y: p.y - mid.y, z: p.z - mid.z };
    expect(Math.hypot(dv.x, dv.y, dv.z)).toBeCloseTo(0.02, 9); expect(dv.x * 0.1).toBeCloseTo(0, 9); // perpendicular to the line
    expect(dv.x * (head.x - mid.x) + dv.y * (head.y - mid.y) + dv.z * (head.z - mid.z)).toBeCloseTo(0, 9); // and to the view direction
    expect(dv.y).toBeGreaterThan(0); // upper side
    expect(Number.isFinite(nearLabelWorld(a, b, { x: 0, y: 1.3, z: -0.6 }, 0.02).y)).toBe(true); // a degenerate view still gives a spot
  });
});

describe('clamping a label into the view (display time only)', () => {
  it('keeps a label inside the rect, leaves one that already fits, and works for a rect with an origin', () => {
    const o = { w: 60, h: 14, x0: 0, y0: 0, iw: 400, ih: 300 };
    expect(clampLabelCenter(200, 150, o)).toEqual({ x: 200, y: 150 });
    expect(clampLabelCenter(-500, 9999, o)).toEqual({ x: 32, y: 291 }); // 30 + pad 2, 300 - 7 - 2
    expect(clampLabelCenter(9999, -50, o)).toEqual({ x: 368, y: 9 });
    expect(clampLabelCenter(0, 0, { ...o, x0: 100, y0: 50 })).toEqual({ x: 132, y: 59 });
    expect(clampLabelCenter(5, 5, { w: 60, h: 14, x0: 0, y0: 0, iw: 40, ih: 10 })).toEqual({ x: 32, y: 9 }); // a rect smaller than the label: no crash
  });
});

describe('createFocusTracker (the lit distance label)', () => {
  it('calls back only when the lit label changes; a drag keeps it lit when the hover leaves', () => {
    const calls = [], f = createFocusTracker((n, p) => calls.push([n, p]));
    f.hover('a'); f.hover('a'); expect(calls).toEqual([['a', null]]);
    f.drag('a'); expect(calls.length).toBe(1); // already lit: no change
    f.hover(null); expect(f.get()).toBe('a'); expect(calls.length).toBe(1); // still dragged
    f.drag(null); expect(f.get()).toBeNull(); expect(calls[calls.length - 1]).toEqual([null, 'a']);
    f.drag('b'); f.hover('c'); expect(f.get()).toBe('b'); // the drag wins over the hover
  });
});

describe('depth cue helpers (build 493)', () => {
  it('fadeAlpha: faint only when hidden and not lit', () => {
    expect(fadeAlpha(false, false)).toBe(1); expect(fadeAlpha(true, false)).toBe(OCCLUDED_ALPHA); expect(fadeAlpha(true, true)).toBe(1); expect(fadeAlpha(false, true)).toBe(1);
    expect(OCCLUDED_ALPHA).toBeGreaterThanOrEqual(0.25); expect(OCCLUDED_ALPHA).toBeLessThanOrEqual(0.35);
  });
  it('probe keys: a not dragged label follows the line midpoint, a dragged one its own place', () => {
    expect(labelPart(null)).toBe(LABEL_MID); expect(labelPart(undefined)).toBe(LABEL_MID); expect(labelPart({ i: 1, j: 0, k: 0 })).toBe('L');
    expect(probeKey('m1', LABEL_MID)).toBe('m1|4'); expect(probeKey('m1', 'L')).toBe('m1|L');
  });
  it('lineSamplePoints: n + 1 points from a to b, evenly; the middle one is the midpoint', () => {
    const p = lineSamplePoints({ x: 0, y: 2, z: -4 }, { x: 8, y: 2, z: 4 });
    expect(p).toHaveLength(LINE_SAMPLES + 1); expect(p[0]).toEqual({ x: 0, y: 2, z: -4 }); expect(p[LINE_SAMPLES]).toEqual({ x: 8, y: 2, z: 4 }); expect(p[LABEL_MID]).toEqual({ x: 4, y: 2, z: 0 });
  });
  it('lineAlphas: faint exactly at the hidden samples', () => {
    expect(lineAlphas('m', null)).toEqual(Array(LINE_SAMPLES + 1).fill(1));
    const a = lineAlphas('m', new Set([probeKey('m', 0), probeKey('m', 5), probeKey('x', 1)]));
    expect(a.map(v => v < 1 ? 'h' : '.').join('')).toBe('h....h...');
  });
  it('approachAlpha: moves towards the target, never overshoots, snaps, does not move without time', () => {
    expect(approachAlpha(1, 0.3, 0)).toBe(1);
    const a = approachAlpha(1, 0.3, 35); expect(a).toBeLessThan(1); expect(a).toBeGreaterThan(0.3);
    let v = 1; for (let i = 0; i < 40; i++) v = approachAlpha(v, 0.3, 16); expect(v).toBe(0.3);
    let w = 0.3; for (let i = 0; i < 40; i++) w = approachAlpha(w, 1, 16); expect(w).toBe(1);
  });
});
