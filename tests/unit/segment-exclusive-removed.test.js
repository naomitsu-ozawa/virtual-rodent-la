import { describe, it, expect } from 'vitest';
import { effectiveRanges } from '../../docs/segment-exclusive.js';
import { buildThresholdMask, removeSmallMaskComponents } from '../../docs/mask-ops.js';

// Reproduces the owner's report: voxels that a higher-priority segment REMOVED (small-component removal here; the same
// holds for the air boundary, thin suppression and manual edits) are still withheld from the segments below it, because
// the exclusion subtracts the higher segment's HU range (segment-exclusive.js), not the voxels it finally keeps.
// Marked it.fails: the exclusion is still range based; flip to it() when it becomes voxel based.
// (segments.js pulls in DOM modules, so this mirrors its path: applyExclusiveRanges -> seg.min/max -> mask.)
describe('exclusion of voxels removed from the higher segment', () => {
  it.fails('a voxel bone dropped is free for soft', () => {
    const w = 5, h = 5, d = 1, data = new Float32Array(w * h * d).fill(-1000);
    for (let x = 0; x < 3; x++) data[2 * w + x] = 400; // a bone blob of 3 voxels
    data[4 * w + 4] = 350; // an isolated bone-range voxel, removed by minComponent
    const v = { data };
    const r = effectiveRanges({ bone: { userMin: 300, userMax: 2000, active: true }, soft: { userMin: 0, userMax: 380, active: true } }, ['bone', 'soft'], 'priority');
    const bone = removeSmallMaskComponents(buildThresholdMask(v, r.bone), w, h, d, 2);
    expect(bone[4 * w + 4]).toBe(0); // bone really dropped it
    const soft = buildThresholdMask(v, r.soft);
    expect(soft[4 * w + 4]).toBe(1); // so soft should be allowed to take it
  });
});
