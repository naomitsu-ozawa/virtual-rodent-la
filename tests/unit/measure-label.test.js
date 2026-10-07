import { describe, it, expect } from 'vitest';
import { planeLabelPlacement, planeVoxelDelta, stepDelta, offsetFromDelta, nearLabelWorld } from '../../docs/measure-label.js';
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
