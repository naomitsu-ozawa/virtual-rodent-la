import { describe, it, expect, beforeAll } from 'vitest';
import { installDomStub, importApp } from '../helpers/dom-stub.js';
import { maskFromAnalysisRuns } from '../../docs/run-length.js';
import { nextDown } from '../../docs/segment-exclusive.js';

// Owner's report (build 459): voxels that a higher-priority segment REMOVED (small-component removal; the same holds for the
// air boundary, thin suppression and manual edits) must be free for the segments below it, voxels it ADDED (hole filling,
// Closing) must not be in the lower ones, and what it keeps must not be in them either: "the higher segment wins, and what it
// adds or removes also moves the segments below it". The state code (segments.js / segment-runs.js) is run for real.
installDomStub();
let S, R;
beforeAll(async () => { S = await importApp('segments'); R = await importApp('segment-runs'); });

const w = 7, h = 7, d = 5, n = w * h * d, at = (x, y, z = 2) => (z * h + y) * w + x;
function setup(data, bone, soft) {
  const order = ['bone', 'soft', 'fat', 'lung'];
  S.segmentExclusive.mode = 'priority'; S.segmentExclusive.order = order;
  for (const k of order) {
    const g = S.segmentState[k], st = S.segmentEditState[k], p = k === 'bone' ? bone : k === 'soft' ? soft : null;
    Object.assign(g, { active: !!p, enabled: true, opening: 0, closing: 0, holeFill: false, minComponent: 0, surfaceMm: 0, thicknessMm: 0, _maskCache: null, _maskCacheKey: '', exclusive: undefined, ...(p || {}), userMin: p?.min ?? 0, userMax: p?.max ?? 1 });
    Object.assign(st, { baseRuns: null, baseSignature: '', pendingBase: null, finalRuns: null, keepRuns: null, excludeRuns: null, cutRuns: null, undo: [], redo: [] });
    S.segmentEditGen[k]++;
  }
  S.applyExclusiveRanges(); S.segmentExclusive.pending.clear();
  return { columns: w, rows: h, slices: d, data, spacing: [1, 1, 1], sourceBacked: false };
}
const maskOf = async (key, v) => maskFromAnalysisRuns(v, await R.getFinalSegmentRuns(key, v));

describe('what the higher segment removes or adds moves the segments below it', () => {
  it('(i) a voxel bone dropped (small component) is free for soft, which keeps its whole range', async () => {
    const data = new Float32Array(n).fill(-1000);
    for (let x = 1; x < 4; x++) data[at(x, 3)] = 400; // a bone blob of 3 voxels
    data[at(6, 6)] = 350; // an isolated bone-range voxel, removed by minComponent
    const v = setup(data, { min: 300, max: 2000, minComponent: 2 }, { min: 0, max: 1000 });
    expect(S.segmentState.soft.min).toBe(0); // bone is a voxel taker: soft's range is not cut by bone's range
    expect(S.segmentSourcesOf('soft')).toEqual(['bone']);
    const bone = await maskOf('bone', v), soft = await maskOf('soft', v);
    expect(bone[at(6, 6)]).toBe(0);
    expect(soft[at(6, 6)]).toBe(1);
  });
  it('(ii) the blob bone kept is not in soft, although it lies in soft\'s HU range', async () => {
    const data = new Float32Array(n).fill(-1000);
    for (let x = 1; x < 4; x++) data[at(x, 3)] = 400;
    data[at(6, 6)] = 350;
    const v = setup(data, { min: 300, max: 2000, minComponent: 2 }, { min: 0, max: 1000 });
    const bone = await maskOf('bone', v), soft = await maskOf('soft', v);
    for (let x = 1; x < 4; x++) { expect(bone[at(x, 3)]).toBe(1); expect(soft[at(x, 3)]).toBe(0); }
    for (let i = 0; i < n; i++) expect(bone[i] + soft[i]).toBeLessThanOrEqual(1);
  });
  it('(iii) a voxel bone filled (hole filling, outside bone\'s HU range) belongs to bone and is removed from soft', async () => {
    const data = new Float32Array(n).fill(-1000);
    for (let z = 1; z <= 3; z++) for (let y = 2; y <= 4; y++) for (let x = 2; x <= 4; x++) data[at(x, y, z)] = 400; // a bone shell ...
    data[at(3, 3, 2)] = 100; // ... around a marrow voxel in soft's range, outside bone's
    const v = setup(data, { min: 300, max: 2000, holeFill: true }, { min: 0, max: 1000 });
    const bone = await maskOf('bone', v), soft = await maskOf('soft', v);
    expect(bone[at(3, 3, 2)]).toBe(1);
    expect(soft[at(3, 3, 2)]).toBe(0);
    // soft still holds nothing else here: its only voxel was the filled one
    expect(soft.reduce((a, b) => a + b, 0)).toBe(0);
  });
  it('a plain bone (no processing) still takes its range from soft by range, as before', () => {
    const data = new Float32Array(n).fill(0);
    setup(data, { min: 300, max: 2000 }, { min: 0, max: 1000 });
    expect(S.segmentState.soft.min).toBe(0);
    expect(S.segmentState.soft.max).toBe(nextDown(300));
    expect(S.segmentSourcesOf('soft')).toEqual([]);
  });
  it('(iv) a manual exclusion in bone frees those voxels for soft, and undo takes them back', async () => {
    const data = new Float32Array(n).fill(-1000);
    for (let x = 1; x < 4; x++) data[at(x, 3)] = 400;
    const v = setup(data, { min: 300, max: 2000 }, { min: 0, max: 1000 });
    expect((await maskOf('soft', v))[at(2, 3)]).toBe(0);
    const st = S.segmentEditState.bone, ex = new Uint32Array([3, 2, 2]); // row y=3, x 2..2 on slice z=2
    const rows = Array.from({ length: d }, (_, z) => (z === 2 ? ex : new Uint32Array(0)));
    st.excludeRuns = rows; st.finalRuns = null; S.segmentEditsChanged('bone');
    expect(S.segmentSourcesOf('soft')).toEqual(['bone']); // bone is now a voxel taker
    expect((await maskOf('bone', v))[at(2, 3)]).toBe(0);
    expect((await maskOf('soft', v))[at(2, 3)]).toBe(1);
    st.excludeRuns = null; st.finalRuns = null; S.segmentEditsChanged('bone'); // undo
    expect(S.segmentSourcesOf('soft')).toEqual([]);
    expect((await maskOf('soft', v))[at(2, 3)]).toBe(0);
    expect((await maskOf('bone', v))[at(2, 3)]).toBe(1);
  });
});
