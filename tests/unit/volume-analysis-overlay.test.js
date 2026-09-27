import { describe, it, expect, vi } from 'vitest';
import { MedicalVolumeRenderer } from '../../docs/medical-volume.js';

// setAnalysisRuns packs the analysis regions into the single storage buffer
// the volume shader reads (analysisOverlayAt): [0]=1, [1..rows+1]=offsets,
// then (x0|x1<<16, rgb|focused<<24|valid<<31) pairs per texture row.
globalThis.GPUBufferUsage ??= { STORAGE: 0x80, COPY_DST: 0x8 };
function fakeRenderer(textureDims) {
  const written = [];
  const device = {
    limits: { maxStorageBufferBindingSize: 1 << 20 },
    createBuffer: ({ size }) => ({ size, destroy: vi.fn() }),
    queue: { writeBuffer: (buffer, _offset, data) => written.push({ buffer, data: new Uint32Array(data) }) },
  };
  const r = Object.create(MedicalVolumeRenderer.prototype);
  Object.assign(r, { device, textureDims, analysisOverlaySignature: '', rebuildBindGroup: vi.fn() });
  return { r, written };
}
const runs = (d, perSlice) => Array.from({ length: d }, (_, z) => new Uint32Array(perSlice[z] || []));

describe('MedicalVolumeRenderer.setAnalysisRuns', () => {
  it('packs row offsets and coloured intervals for each region', () => {
    const { r, written } = fakeRenderer([8, 2, 2]);
    const v = { columns: 8, rows: 2, slices: 2 };
    r.setAnalysisRuns([
      { runs: runs(2, { 0: [1, 2, 4] }), color: 0x112233, focused: false },
      { runs: runs(2, { 0: [1, 6, 7], 1: [0, 0, 0] }), color: 0xabcdef, focused: true },
    ], v, 'sig');
    const data = written.at(-1).data, rows = 2 * 2, header = 2 + rows;
    expect(data[0]).toBe(1);
    // rows: (z0,y0) empty, (z0,y1) two intervals, (z1,y0) one, (z1,y1) empty
    expect([...data.slice(1, 2 + rows)]).toEqual([header, header, header + 4, header + 6, header + 6]);
    expect(data[header]).toBe((4 << 16) | 2);
    expect(data[header + 1]).toBe((0x112233 | 0x80000000) >>> 0);
    expect(data[header + 2]).toBe((7 << 16) | 6);
    expect(data[header + 3]).toBe((0xabcdef | 0x1000000 | 0x80000000) >>> 0);
    expect(data[header + 4]).toBe(0);
    expect(r.analysisOverlaySignature).toBe('sig');
    expect(r.rebuildBindGroup).toHaveBeenCalled();
  });

  it('skips the upload when the signature is unchanged and clears when empty', () => {
    const { r, written } = fakeRenderer([4, 1, 1]);
    const v = { columns: 4, rows: 1, slices: 1 };
    r.setAnalysisRuns([{ runs: runs(1, { 0: [0, 1, 2] }), color: 1 }], v, 's1');
    const n = written.length;
    r.setAnalysisRuns([{ runs: runs(1, { 0: [0, 1, 2] }), color: 1 }], v, 's1');
    expect(written.length).toBe(n);
    r.setAnalysisRuns([], v, 's2');
    expect([...written.at(-1).data]).toEqual([0, 0]);
  });
});
