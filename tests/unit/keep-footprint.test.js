import { describe, it, expect } from 'vitest';
import { gpuRunsForTextureFootprint } from '../../docs/medical-volume.js';

// Keep masks on a reduced texture: a texel is kept when any source voxel in its
// footprint is kept. Nearest-row sampling drew thin runs as streaks (build 248).
describe('gpuRunsForTextureFootprint', () => {
  it('keeps a one-row run that falls between sampled rows', () => {
    const src = [9, 9, 3], tex = [5, 5, 2];
    const runs = [new Uint32Array([3, 2, 6]), new Uint32Array(0), new Uint32Array(0)]; // y=3 (between samples 2 and 4)
    const out = gpuRunsForTextureFootprint(runs, src, tex);
    expect(out.length).toBe(2);
    expect([...out[0]]).toEqual([1, 1, 3]); // texel = floor((source + 0.5) * tex / src), as in the shader
    expect(out[1].length).toBe(0);
  });

  it('merges overlapping runs of several source slices and rows into one texel row', () => {
    const src = [8, 8, 4], tex = [4, 4, 2];
    const runs = [new Uint32Array([0, 0, 1]), new Uint32Array([0, 2, 3]), new Uint32Array(0), new Uint32Array([7, 7, 7])];
    const out = gpuRunsForTextureFootprint(runs, src, tex);
    expect([...out[0]]).toEqual([0, 0, 1]);
    expect([...out[1]]).toEqual([3, 3, 3]);
  });

  it('returns the runs unchanged at full resolution', () => {
    const runs = [new Uint32Array([0, 1, 2])];
    expect(gpuRunsForTextureFootprint(runs, [4, 4, 1], [4, 4, 1])).toBe(runs);
  });
});
