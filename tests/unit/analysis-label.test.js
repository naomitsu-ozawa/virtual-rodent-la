import { describe, it, expect } from 'vitest';
import { normalizeAnalysisLabel, hasOffset, leaderVisible, withOffset, labelLocal, offsetForLocal, voxelFromLocalVr, voxelFromLocal3d, clampVoxel, setRegionLabel, setRegionLabelOffset, onAnalysisLabelsChange, labelForProject, sameLabel, ANALYSIS_LABEL_MAX } from '../../docs/analysis-label.js';
import { voxelToLocal } from '../../docs/vr-point.js';
import { voxelToLocal3D } from '../../docs/crosshair.js';
import { packProject, unpackProject } from '../../docs/project-file.js';
import { stepDelta } from '../../docs/measure-label.js';

const dims = { columns: 120, rows: 80, slices: 200 }, spacing = [0.1, 0.1, 0.25], halfExt = [0.6, 0.4, 1.4];
const vrStep = [2 * halfExt[0] / dims.columns, -2 * halfExt[1] / dims.rows, 2 * halfExt[2] / dims.slices];
const pcStep = (() => { const k = 3.3 / Math.max(dims.columns * spacing[0], dims.rows * spacing[1], dims.slices * spacing[2]); return [spacing[0] * k, -spacing[1] * k, spacing[2] * k]; })();

describe('analysis label model', () => {
  it('normalizes: anchor required, offset optional, junk dropped, numbers rounded', () => {
    expect(normalizeAnalysisLabel(null)).toBeNull();
    expect(normalizeAnalysisLabel({})).toBeNull();
    expect(normalizeAnalysisLabel({ anchor: { i: 1, j: 2 } })).toBeNull();
    expect(normalizeAnalysisLabel({ anchor: { i: '1', j: 2, k: 3 } })).toBeNull();
    expect(normalizeAnalysisLabel({ anchor: { i: 1, j: 2, k: NaN } })).toBeNull();
    expect(normalizeAnalysisLabel({ anchor: { i: ANALYSIS_LABEL_MAX + 1, j: 0, k: 0 } })).toBeNull();
    expect(normalizeAnalysisLabel({ anchor: { i: 1.23456, j: 2, k: 3 } })).toEqual({ anchor: { i: 1.235, j: 2, k: 3 } });
    // an invalid offset is the default placement, the anchor survives
    expect(normalizeAnalysisLabel({ anchor: { i: 1, j: 2, k: 3 }, offset: { i: 1, j: 'x', k: 0 } })).toEqual({ anchor: { i: 1, j: 2, k: 3 } });
    expect(normalizeAnalysisLabel({ anchor: { i: 1, j: 2, k: 3 }, offset: { i: 4, j: -5, k: 6.0004 }, extra: 1 })).toEqual({ anchor: { i: 1, j: 2, k: 3 }, offset: { i: 4, j: -5, k: 6 } });
  });
  it('leader line only when the label was moved', () => {
    const a = { i: 5, j: 5, k: 5 };
    expect(leaderVisible({ anchor: a })).toBe(false);
    expect(leaderVisible({ anchor: a, offset: { i: 0, j: 0, k: 0 } })).toBe(false);
    expect(leaderVisible({ anchor: a, offset: { i: 0, j: 0, k: 3 } })).toBe(true);
    expect(leaderVisible(null)).toBe(false);
    expect(hasOffset({ anchor: a, offset: { i: 1, j: 0, k: 0 } })).toBe(true);
    expect(hasOffset({ anchor: a })).toBe(false);
  });
  it('withOffset: set, reset (null), refuse an invalid one', () => {
    const l = { anchor: { i: 1, j: 2, k: 3 } };
    expect(withOffset(l, { i: 1, j: 1, k: 1 })).toEqual({ anchor: l.anchor, offset: { i: 1, j: 1, k: 1 } });
    expect(withOffset({ ...l, offset: { i: 1, j: 1, k: 1 } }, null)).toEqual(l);
    expect(withOffset(l, { i: NaN, j: 0, k: 0 })).toBeNull();
    expect(withOffset({ anchor: null }, null)).toBeNull();
  });
});

describe('data space <-> view space (independent of model move / rotate / scale)', () => {
  it('VR and PC local mappings invert to the same voxel', () => {
    const v = { i: 33.4, j: 70.25, k: 120.5 };
    const a = voxelFromLocalVr(voxelToLocal(v, halfExt, dims), halfExt, dims), b = voxelFromLocal3d(voxelToLocal3D(v, dims, spacing), dims, spacing);
    for (const k of ['i', 'j', 'k']) { expect(a[k]).toBeCloseTo(v[k], 9); expect(b[k]).toBeCloseTo(v[k], 9); }
  });
  it('the same offset (voxel units) puts the label at the same DATA place in VR and in the PC view', () => {
    const anchor = { i: 40, j: 30, k: 90 }, off = { i: 12, j: -7, k: 25 };
    const vr = labelLocal(voxelToLocal(anchor, halfExt, dims), off, vrStep), pc = labelLocal(voxelToLocal3D(anchor, dims, spacing), off, pcStep);
    const dv = voxelFromLocalVr(vr, halfExt, dims), dp = voxelFromLocal3d(pc, dims, spacing);
    for (const k of ['i', 'j', 'k']) { expect(dv[k]).toBeCloseTo(anchor[k] + off[k], 9); expect(dp[k]).toBeCloseTo(anchor[k] + off[k], 9); }
  });
  it('offsetForLocal inverts labelLocal (a drag stores what it shows)', () => {
    const al = { x: 0.1, y: -0.2, z: 0.3 }, off = { i: -3.5, j: 8, k: 14.25 };
    for (const step of [vrStep, pcStep]) {
      const back = offsetForLocal(al, labelLocal(al, off, step), step);
      expect(back.i).toBeCloseTo(off.i, 9); expect(back.j).toBeCloseTo(off.j, 9); expect(back.k).toBeCloseTo(off.k, 9);
    }
    expect(labelLocal(al, null, vrStep)).toEqual(al); // no offset: at the anchor
  });
  it('a model move / rotation / scale does not enter the stored offset (only local-space deltas do)', () => {
    // the drag converts world -> mesh local (worldToLocal) before offsetForLocal: the model transform cancels. Emulated with a uniform scale s and a shift.
    const al = { x: 0.2, y: 0.1, z: -0.3 }, target = { x: 0.35, y: 0.05, z: -0.1 };
    const off = offsetForLocal(al, target, vrStep);
    for (const s of [0.5, 1, 3]) {
      const toWorld = p => ({ x: p.x * s + 5, y: p.y * s - 2, z: p.z * s + 1 }), toLocal = p => ({ x: (p.x - 5) / s, y: (p.y + 2) / s, z: (p.z - 1) / s });
      const off2 = offsetForLocal(al, toLocal(toWorld(target)), vrStep);
      expect(off2.i).toBeCloseTo(off.i, 9); expect(off2.j).toBeCloseTo(off.j, 9); expect(off2.k).toBeCloseTo(off.k, 9);
    }
    expect(stepDelta(off, vrStep).x).toBeCloseTo(target.x - al.x, 9);
  });
  it('clampVoxel keeps an anchor inside the volume', () => {
    expect(clampVoxel({ i: -50, j: 1000, k: 10 }, dims)).toEqual({ i: -.5, j: dims.rows - .5, k: 10 });
  });
});

describe('state on the region: set / move / reset / events', () => {
  it('pin, move, reset, unpin and notify', () => {
    const r = { id: 7 }, events = [], off = onAnalysisLabelsChange(e => events.push(e));
    expect(setRegionLabelOffset(r, { i: 1, j: 1, k: 1 })).toBe(false); // nothing pinned yet
    expect(setRegionLabel(r, { anchor: { i: 10, j: 20, k: 30 } })).toBe(true);
    expect(r.label).toEqual({ anchor: { i: 10, j: 20, k: 30 } });
    expect(setRegionLabelOffset(r, { i: 4, j: 0, k: -2 })).toBe(true);
    expect(r.label.offset).toEqual({ i: 4, j: 0, k: -2 });
    expect(events).toEqual([{ id: 7 }, { id: 7, labelOnly: true }]);
    expect(setRegionLabelOffset(r, { i: 4, j: 0, k: -2 })).toBe(true); expect(events.length).toBe(2); // unchanged: no event
    expect(setRegionLabelOffset(r, { i: NaN, j: 0, k: 0 })).toBe(false); expect(r.label.offset).toEqual({ i: 4, j: 0, k: -2 });
    expect(setRegionLabelOffset(r, null)).toBe(true); expect(r.label).toEqual({ anchor: { i: 10, j: 20, k: 30 } }); expect(leaderVisible(r.label)).toBe(false);
    expect(setRegionLabel(r, null)).toBe(true); expect(r.label).toBeUndefined();
    expect(setRegionLabel(r, { anchor: { i: 'a' } })).toBe(false);
    expect(setRegionLabel(null, { anchor: { i: 1, j: 1, k: 1 } })).toBe(false);
    off();
  });
  it('sameLabel / labelForProject', () => {
    expect(labelForProject({})).toBeUndefined();
    expect(labelForProject({ label: { anchor: { i: 1, j: 2, k: 3 }, offset: { i: 0, j: 0, k: 9 } } })).toEqual({ anchor: { i: 1, j: 2, k: 3 }, offset: { i: 0, j: 0, k: 9 } });
    expect(sameLabel({ anchor: { i: 1, j: 2, k: 3 } }, { anchor: { i: 1, j: 2, k: 3 } })).toBe(true);
    expect(sameLabel({ anchor: { i: 1, j: 2, k: 3 } }, { anchor: { i: 1, j: 2, k: 3 }, offset: { i: 1, j: 0, k: 0 } })).toBe(false);
  });
});

describe('project file roundtrip (project.analysis.regions[].label)', () => {
  const region = (extra = {}) => ({ key: 'bone', segmentKeys: ['bone'], color: 0xff0000, visible: true, selected: false, merged: false, groupId: null, runs: 'analysis/region-1.bin', ...extra });
  // what applyProject does with each saved entry
  const load = e => normalizeAnalysisLabel(e.label);
  it('a moved label survives pack -> unpack -> load; the others stay unmoved', () => {
    const lb = { anchor: { i: 11.5, j: 22.25, k: 33 }, offset: { i: -5, j: 2.5, k: 0.125 } };
    const saved = [region({ label: labelForProject({ label: lb }) }), region({ label: labelForProject({ label: { anchor: lb.anchor } }) }), region({ label: labelForProject({}) })];
    const un = unpackProject(packProject({ analysis: { regions: saved } }, {}));
    const back = un.project.analysis.regions.map(load);
    expect(back[0]).toEqual(lb); expect(back[1]).toEqual({ anchor: lb.anchor }); expect(back[2]).toBeNull();
    expect('label' in un.project.analysis.regions[2]).toBe(false); // nothing written when there is no label
  });
  it('an old project (no label field) and a project with a corrupt label load unchanged / without a label', () => {
    const un = unpackProject(packProject({ analysis: { regions: [region(), region({ label: { anchor: 'x' } }), region({ label: 5 })] } }, {}));
    expect(un.project.version).toBe(1); // optional field, no version bump (like comments / measurements)
    expect(un.project.analysis.regions.map(load)).toEqual([null, null, null]);
  });
});
