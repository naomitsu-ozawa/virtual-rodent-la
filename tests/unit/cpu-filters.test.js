import { describe, it, expect, vi } from 'vitest';
import * as K from '../../docs/cpu-filters.js';

// CPU 3D filter kernels (fallback path). The loops were moved from app.js
// unchanged (verified voxel-identical against the old apply* functions when
// extracted, build 230); these tests pin their basic behaviour.
const vol = (w, h, d, fill) => {
  const data = new Float32Array(w * h * d);
  for (let i = 0; i < data.length; i++) data[i] = typeof fill === 'function' ? fill(i) : fill;
  let min = Infinity, max = -Infinity;
  for (const v of data) { if (v < min) min = v; if (v > max) max = v; }
  return { columns: w, rows: h, slices: d, data, min, max };
};
const P = {
  cpuGaussian3D: { strength: 0.6, passes: 2 },
  cpuMedian3D: { strength: 1, passes: 1 },
  cpuSpikeHole: { strength: 0.7, thresholdRatio: 0.05 },
  cpuNlm3D: { strength: 0.5, searchRadius: 1, patchRadius: 1 },
  cpuAnisotropicDiffusion: { strength: 0.5, iterations: 2 },
  cpuBilateral3D: { strength: 0.6, spatialSigma: 1.2, intensitySigma: 0.1, passes: 1 },
  cpuTvDenoising3D: { weight: 0.2, iterations: 2 },
  cpuUnsharpMask3D: { radius: 1, amount: 0.8, threshold: 0.01 },
};

describe('cpu-filters', () => {
  it('leave a constant volume unchanged', async () => {
    for (const [name, params] of Object.entries(P)) {
      const v = vol(6, 5, 4, 120);
      const { data } = await K[name](v, params);
      expect(data.length, name).toBe(v.data.length);
      for (const x of data) expect(x, name).toBeCloseTo(120, 4);
    }
  });

  it('spike/hole and median remove an isolated spike', async () => {
    const make = () => { const v = vol(7, 7, 7, 100); v.data[3 * 49 + 3 * 7 + 3] = 3000; v.max = 3000; return v; };
    const center = 3 * 49 + 3 * 7 + 3;
    const spike = await K.cpuSpikeHole(make(), { strength: 1, thresholdRatio: 0.05 });
    expect(spike.corrected).toBe(1);
    expect(spike.data[center]).toBeLessThan(400);
    const median = await K.cpuMedian3D(make(), { strength: 1, passes: 1 });
    expect(median.data[center]).toBe(100);
  });

  it('gaussian with strength 0 is the identity', async () => {
    const v = vol(5, 4, 3, i => (i * 37) % 200);
    const { data } = await K.cpuGaussian3D(v, { strength: 0, passes: 2 });
    expect([...data]).toEqual([...v.data]);
  });

  it('sigmoid stays within [min, max] and preserves order', async () => {
    const v = vol(10, 1, 1, i => -1000 + i * 250);
    const r = await K.cpuSigmoid(v, { strength: 0.5, center: 0 });
    expect(r.centerValue).toBe(0);
    for (let i = 0; i < r.data.length; i++) {
      expect(r.data[i]).toBeGreaterThanOrEqual(v.min - 1e-3);
      expect(r.data[i]).toBeLessThanOrEqual(v.max + 1e-3);
      if (i) expect(r.data[i]).toBeGreaterThanOrEqual(r.data[i - 1]);
    }
  });

  it('reports progress and returns loop statistics', async () => {
    const onProgress = vi.fn();
    await K.cpuGaussian3D(vol(4, 4, 4, 1), { strength: 0.5, passes: 1 }, onProgress);
    expect(onProgress).toHaveBeenCalledWith(1, 12);
    const r = await K.cpuAnisotropicDiffusion(vol(4, 4, 4, 1), { strength: 0.5, iterations: 2 });
    expect(r.iterations).toBe(2);
    const n = await K.cpuNlm3D(vol(3, 3, 3, 1), { strength: 0.5, searchRadius: 1.4, patchRadius: 0.6 });
    expect([n.searchRadius, n.patchRadius]).toEqual([1, 1]);
  });
});
