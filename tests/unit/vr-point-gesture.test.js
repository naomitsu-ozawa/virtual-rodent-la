import { describe, it, expect } from 'vitest';
import {
  sectionRayHit, resolveTriggerTarget, createTriggerPress, dragShouldStart, sectionDragStep, planeFoot, planeReach, clampPlaneCenter,
  squareBandContains, rayLocalPlaneX, createHoverPulse, createUndoStack, applyUndo, qMul, qInv, qRot, qNorm, qAngleDeg, HAPTIC, HAPTIC_SILENT,
} from '../../docs/vr-point.js';

// synthetic volume only
const dims = { columns: 10, rows: 8, slices: 6 };
const halfExt = [5, 4, 6];
const pl = (x, y, z, w) => ({ x, y, z, w });
const o = { x: -20, y: 0.1, z: 0.1 }, q = { x: 1, y: 0, z: 0 };

describe('sectionRayHit only', () => {
  const planes = [pl(1, 0, 0, -2), pl(1, 0, 0, 2)];
  it('hits only the named plane even when another is in front', () => {
    expect(sectionRayHit(o, q, { halfExt, dims, planes, count: 2 }).plane).toBe(0);
    const h = sectionRayHit(o, q, { halfExt, dims, planes, count: 2, only: 1 });
    expect(h.plane).toBe(1);
    expect(h.point.x).toBeCloseTo(2);
  });
  it('null when that plane meets the ray outside the box', () => {
    expect(sectionRayHit(o, q, { halfExt, dims, planes: [pl(1, 0, 0, 9)], count: 1, only: 0 })).toBeNull();
  });
  it('null where another clipping plane has cut it away (and kept where it has not)', () => {
    const keeps = [pl(1, 0, 0, -3), pl(1, 0, 0, 2)]; // plane 0 cuts x < -3 away: x = 2 stays
    expect(sectionRayHit(o, q, { halfExt, dims, planes: keeps, count: 2, only: 1, cutBits: 1 })).not.toBeNull();
    const cuts = [pl(1, 0, 0, 3), pl(1, 0, 0, 2)]; // plane 0 cuts x < 3 away: x = 2 is cut
    expect(sectionRayHit(o, q, { halfExt, dims, planes: cuts, count: 2, only: 1, cutBits: 1 })).toBeNull();
  });
  it('works without any classification data (air)', () => {
    expect(sectionRayHit(o, q, { halfExt, dims, planes: [pl(1, 0, 0, 0)], count: 1, only: 0 }).voxel).toBeTruthy();
  });
});

describe('resolveTriggerTarget', () => {
  const pt = d => ({ id: 'p1', distance: d }), tis = t => ({ t }), band = t => ({ t });
  it('board first', () => expect(resolveTriggerTarget({ board: { item: 1 }, ringOwnOpen: true, point: pt(0.1), tissue: tis(0.1) }).kind).toBe('board'));
  it('own ring: confirm with a lit item, else close', () => {
    expect(resolveTriggerTarget({ ringOwnOpen: true, ringHighlight: 2, point: pt(0.1) })).toEqual({ kind: 'ring-confirm', ref: 2 });
    expect(resolveTriggerTarget({ ringOwnOpen: true, ringHighlight: 0 }).kind).toBe('ring-confirm');
    expect(resolveTriggerTarget({ ringOwnOpen: true, ringHighlight: null, point: pt(0.1) }).kind).toBe('ring-close');
  });
  it('moving beats tag and point', () => {
    expect(resolveTriggerTarget({ moving: true, placement: { voxel: 1 }, tab: { t: 1 }, point: pt(0.1) })).toEqual({ kind: 'move', ref: { voxel: 1 } });
    expect(resolveTriggerTarget({ moving: true, tab: { t: 1 } })).toEqual({ kind: 'move', ref: null });
  });
  it('number tag beats a nearer point', () => expect(resolveTriggerTarget({ tab: { t: 5 }, point: pt(0.1) }).kind).toBe('section'));
  it('nearest of point / band / target', () => {
    expect(resolveTriggerTarget({ mode: 'surface', point: pt(1), tissue: tis(2) }).kind).toBe('point');
    expect(resolveTriggerTarget({ mode: 'surface', band: band(1), tissue: tis(2) }).kind).toBe('section');
    expect(resolveTriggerTarget({ mode: 'surface', tissue: tis(2) }).kind).toBe('record');
    expect(resolveTriggerTarget({ mode: 'surface', point: pt(3), band: band(2.5), tissue: tis(2) }).kind).toBe('record');
  });
  it('ties: point > band > target', () => {
    expect(resolveTriggerTarget({ mode: 'surface', point: pt(1), band: band(1), tissue: tis(1) }).kind).toBe('point');
    expect(resolveTriggerTarget({ mode: 'surface', band: band(1 + 5e-7), tissue: tis(1) }).kind).toBe('section');
    expect(resolveTriggerTarget({ mode: 'surface', band: band(1.001), tissue: tis(1) }).kind).toBe('record');
  });
  it('surface mode: a section face in front never steals (planes are not candidates)', () => {
    expect(resolveTriggerTarget({ mode: 'surface', plane: { t: 0.2 }, tissue: tis(1) })).toMatchObject({ kind: 'record', ref: { t: 1 } });
  });
  it('section mode: the plane wins even with tissue in front', () => {
    const r = resolveTriggerTarget({ mode: 'section', plane: { t: 2 }, tissue: tis(1) });
    expect(r).toMatchObject({ kind: 'record', ref: { t: 2 } });
    expect(resolveTriggerTarget({ mode: 'section', tissue: tis(1) }).kind).toBe('none');
  });
  it('analysis tab: tissue is a label in either mode', () => {
    for (const mode of ['section', 'surface']) expect(resolveTriggerTarget({ mode, analysis: true, tissue: tis(1), plane: { t: 0.5 } }).kind).toBe('label');
  });
  it('empty needs canDrag', () => {
    expect(resolveTriggerTarget({ canDrag: true }).kind).toBe('empty');
    expect(resolveTriggerTarget({ canDrag: false }).kind).toBe('none');
    expect(resolveTriggerTarget({}).kind).toBe('none');
  });
});

describe('createTriggerPress', () => {
  it('tap before 500 ms', () => { const p = createTriggerPress(); p.press(0); expect(p.update(499)).toBeNull(); expect(p.release(499)).toBe('tap'); });
  it('long once at 500 ms, then late', () => {
    const p = createTriggerPress(); p.press(1000);
    expect(p.update(1500)).toBe('long'); expect(p.update(1600)).toBeNull(); expect(p.release(1700)).toBe('late');
  });
  it('late even without an update, and idle gives nothing', () => {
    const p = createTriggerPress(); expect(p.update(10)).toBeNull(); expect(p.release(20)).toBeNull();
    p.press(0); expect(p.release(500)).toBe('late');
  });
});

describe('dragShouldStart', () => {
  it('position', () => { expect(dragShouldStart({ dPosM: 0.009 })).toBe(false); expect(dragShouldStart({ dPosM: 0.011 })).toBe(true); });
  it('rotation', () => { expect(dragShouldStart({ dAngleDeg: 1.4 })).toBe(false); expect(dragShouldStart({ dAngleDeg: 1.6 })).toBe(true); });
  it('hold', () => { expect(dragShouldStart({ heldMs: 499 })).toBe(false); expect(dragShouldStart({ heldMs: 500 })).toBe(true); });
});

describe('sectionDragStep', () => {
  const I = { x: 0, y: 0, z: 0, w: 1 };
  const axisAngle = (a, deg) => { const h = deg * Math.PI / 360, s = Math.sin(h), l = Math.hypot(...a); return { x: a[0] / l * s, y: a[1] / l * s, z: a[2] / l * s, w: Math.cos(h) }; };
  const base = { p0: { x: 0.1, y: 0.2, z: 0.3 }, q0: I, c0: { x: 1, y: 0, z: 0 }, Qp0: I, halfExt: [5, 4, 6] };
  const step = (o2 = {}) => sectionDragStep({ ...base, p: base.p0, q: base.q0, ...o2 });
  it('no hand motion: unchanged', () => {
    const r = step(); expect(r.c).toEqual({ x: 1, y: 0, z: 0 }); expect(qAngleDeg(r.Qp)).toBeCloseTo(0); expect(r.n.x).toBeCloseTo(1);
  });
  it('2 cm along the normal moves the centre 2 cm', () => {
    const r = step({ p: { x: 0.12, y: 0.2, z: 0.3 } }); expect(r.c.x).toBeCloseTo(1.02); expect(r.c.y).toBeCloseTo(0);
  });
  it('motion along the plane is dropped', () => {
    const r = step({ p: { x: 0.1, y: 3, z: -2 } }); expect(r.c).toEqual({ x: 1, y: 0, z: 0 });
  });
  it('30 deg about the normal: normal unchanged', () => {
    const r = step({ q: axisAngle([1, 0, 0], 30) }); expect(r.n.x).toBeCloseTo(1); expect(r.n.y).toBeCloseTo(0); expect(r.c.x).toBeCloseTo(1);
  });
  it('30 deg about an in-plane axis: normal turns 30 deg, centre stays', () => {
    const r = step({ q: axisAngle([0, 0, 1], 30) });
    expect(Math.acos(r.n.x) * 180 / Math.PI).toBeCloseTo(30);
    expect(r.c).toEqual({ x: 1, y: 0, z: 0 });
  });
  it('holder rotation does not matter (inputs are in holder space)', () => {
    // the same relative hand motion expressed in a rotated holder frame: hand and section both given in holder space -> identical result
    const R = axisAngle([0, 1, 0], 70), Ri = qInv(R);
    const toH = v => qRot(Ri, v);
    const world = { p0: { x: 0.3, y: 0.1, z: -0.2 }, p: { x: 0.35, y: 0.1, z: -0.2 } };
    const qw = axisAngle([0, 0, 1], 20);
    const a = sectionDragStep({ ...base, p0: world.p0, p: world.p, q: qMul(Ri, qMul(R, qw)), q0: qMul(Ri, R) }); // holder-space q = inv(R)*world
    const b = sectionDragStep({ ...base, p0: world.p0, p: world.p, q: qw, q0: I });
    expect(a.c.x).toBeCloseTo(b.c.x); expect(a.n.y).toBeCloseTo(b.n.y);
    expect(toH(qRot(R, { x: 1, y: 2, z: 3 })).y).toBeCloseTo(2);
  });
  it('clamps at R(n)', () => {
    const r = step({ p: { x: 50, y: 0.2, z: 0.3 } });
    expect(r.c.x).toBeCloseTo(5); expect(r.n.x * r.c.x + r.n.y * r.c.y + r.n.z * r.c.z).toBeCloseTo(planeReach(r.n, base.halfExt));
    const s = step({ p: { x: -50, y: 0.2, z: 0.3 } }); expect(s.c.x).toBeCloseTo(-5);
  });
  it('quaternion helpers', () => {
    const a = axisAngle([0, 0, 1], 90), v = qRot(a, { x: 1, y: 0, z: 0 });
    expect(v.y).toBeCloseTo(1); expect(qAngleDeg(qMul(a, qInv(a)))).toBeCloseTo(0); expect(qNorm({ x: 0, y: 0, z: 0, w: 2 }).w).toBeCloseTo(1);
  });
});

describe('planeFoot / planeReach / clamp', () => {
  const s = Math.SQRT1_2;
  it('axis aligned', () => {
    expect(planeReach({ x: 1, y: 0, z: 0 }, [5, 4, 6])).toBe(5); expect(planeFoot({ x: 0, y: 1, z: 0 }, 2)).toEqual({ x: 0, y: 2, z: 0 });
  });
  it('45 degrees', () => {
    expect(planeReach({ x: s, y: s, z: 0 }, [5, 4, 6])).toBeCloseTo((5 + 4) * s);
    const c = clampPlaneCenter({ x: 10 * s, y: 10 * s, z: 0 }, { x: s, y: s, z: 0 }, [5, 4, 6]);
    expect(c.x * s + c.y * s).toBeCloseTo((5 + 4) * s);
  });
});

describe('frame band', () => {
  const h = 0.12, b = 0.006;
  it('inside / outside / corner / edges', () => {
    expect(squareBandContains(0, h, h, b)).toBe(true);
    expect(squareBandContains(0, 0, h, b)).toBe(false);
    expect(squareBandContains(0, h + 0.01, h, b)).toBe(false);
    expect(squareBandContains(h, h, h, b)).toBe(true);
    expect(squareBandContains(h + b, 0.05, h, b)).toBe(true);
    expect(squareBandContains(h - b, 0.05, h, b)).toBe(true);
    expect(squareBandContains(h - b - 0.001, 0.05, h, b)).toBe(false);
    expect(squareBandContains(h + b + 0.001, 0, h, b)).toBe(false);
  });
  it('ray with the X=0 plane', () => {
    const r = rayLocalPlaneX({ x: -2, y: 0.1, z: 0.2 }, { x: 1, y: 0, z: 0 });
    expect(r.t).toBeCloseTo(2); expect(r.y).toBeCloseTo(0.1); expect(r.z).toBeCloseTo(0.2);
    expect(rayLocalPlaneX({ x: -2, y: 0, z: 0 }, { x: 0, y: 1, z: 0 })).toBeNull();
    expect(rayLocalPlaneX({ x: -2, y: 0, z: 0 }, { x: -1, y: 0, z: 0 })).toBeNull();
  });
});

describe('createHoverPulse', () => {
  it('new id pulses once', () => { const h = createHoverPulse(); expect(h.update('a', 0)).toBe(true); expect(h.update('a', 50)).toBe(false); });
  it('another id within 100 ms does not; after 100 ms does', () => {
    const h = createHoverPulse(); h.update('a', 0);
    expect(h.update('b', 99)).toBe(false);
    expect(h.update('c', 200)).toBe(true);
  });
  it('null resets (but the debounce still holds)', () => {
    const h = createHoverPulse(); h.update('a', 0); h.update(null, 10);
    expect(h.update('a', 50)).toBe(false);
    h.update(null, 60); expect(h.update('a', 300)).toBe(true);
  });
});

describe('undo stack and applyUndo', () => {
  const fake = () => {
    const list = [{ id: 'a', pos: 1 }, { id: 'b', pos: 2 }], log = [];
    return { list, log,
      removeComment: id => { const n = list.length; const i = list.findIndex(c => c.id === id); if (i >= 0) list.splice(i, 1); log.push('rm' + id); return list.length !== n; },
      restoreComment: (c, index) => { if (list.some(x => x.id === c.id)) return false; list.splice(index, 0, c); return true; },
      updateCommentPosition: (id, v) => { const c = list.find(x => x.id === id); if (!c) return null; c.pos = v; return c; } };
  };
  it('add / delete / move are undone', () => {
    const s = fake();
    expect(applyUndo({ type: 'add', id: 'a' }, s)).toBe(true); expect(s.list.map(c => c.id)).toEqual(['b']);
    expect(applyUndo({ type: 'delete', c: { id: 'a', pos: 1 }, index: 0 }, s)).toBe(true); expect(s.list.map(c => c.id)).toEqual(['a', 'b']);
    expect(applyUndo({ type: 'move', id: 'b', from: 7, to: 2 }, s)).toBe(true); expect(s.list[1].pos).toBe(7);
  });
  it('failed ops return false', () => {
    const s = fake();
    expect(applyUndo({ type: 'add', id: 'zzz' }, s)).toBe(false);
    expect(applyUndo({ type: 'delete', c: { id: 'a' }, index: 0 }, s)).toBe(false);
    expect(applyUndo({ type: 'move', id: 'zzz', from: 1 }, s)).toBe(false);
    expect(applyUndo({ type: 'what' }, s)).toBe(false); expect(applyUndo(null, s)).toBe(false);
  });
  it('keeps 20, drops the oldest', () => {
    const u = createUndoStack(); for (let i = 0; i < 25; i++) u.push({ type: 'add', id: 'c' + i });
    expect(u.size).toBe(20); expect(u.pop().id).toBe('c24');
    let last; while (u.size) last = u.pop(); expect(last.id).toBe('c5'); expect(u.pop()).toBeNull();
    u.push({ type: 'add', id: 'x' }); u.clear(); expect(u.size).toBe(0);
  });
});

describe('haptic table', () => {
  it('values of the spec', () => {
    expect(HAPTIC.record).toMatchObject({ amp: 0.5, ms: 20, count: 1 });
    expect(HAPTIC.select).toMatchObject({ amp: 0.35, ms: 18, count: 1 });
    expect(HAPTIC.longPress.count).toBe(2); expect(HAPTIC.hover).toMatchObject({ amp: 0.08, ms: 8, debounceMs: 100 });
    expect(HAPTIC_SILENT).toContain('gateBlocked');
  });
});
