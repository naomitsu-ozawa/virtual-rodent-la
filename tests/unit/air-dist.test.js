import { describe, it, expect } from 'vitest';

// JS mirror of the 'airDist' compute shader (gpu-shaders.js): three passes, one
// axis each, compose the exact squared distance to the nearest air voxel within
// the radius; segment voxels keep g >= 0, others store -(g+1) between passes.
function airDistPasses(values, w, h, d, min, max, sp, n) {
  const idx = (x, y, z) => z * w * h + y * w + x, N = w * h * d;
  let src = Float32Array.from(values);
  for (let axis = 0; axis < 3; axis++) {
    const dst = new Float32Array(N);
    for (let z = 0; z < d; z++) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = idx(x, y, z), inSeg = axis === 0 ? (src[i] >= min && src[i] <= max) : src[i] >= 0;
      let g = 1e30;
      for (let k = -n[axis]; k <= n[axis]; k++) {
        const q = [x, y, z]; q[axis] += k;
        if (q[0] < 0 || q[1] < 0 || q[2] < 0 || q[0] >= w || q[1] >= h || q[2] >= d) continue;
        const e = src[idx(...q)], dd = k * sp[axis];
        if (axis === 0) { if (e < min) g = Math.min(g, dd * dd); }
        else g = Math.min(g, (e < 0 ? -e - 1 : e) + dd * dd);
      }
      dst[i] = inSeg ? g : -(g + 1);
    }
    src = dst;
  }
  return src;
}

describe('airDist separable distance field', () => {
  it('equals brute force for segment voxels within the radius', () => {
    const w = 14, h = 12, d = 9, sp = [0.04, 0.04, 0.08], min = -700, max = -500, N = w * h * d;
    let s = 5; const rnd = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
    const values = new Float32Array(N); for (let i = 0; i < N; i++) { const r = rnd(); values[i] = r < 0.2 ? -1000 : r < 0.7 ? -600 : 50; }
    const maxMm = 3 * 0.04, n = sp.map(v => Math.floor(maxMm / v + 1e-9));
    const out = airDistPasses(values, w, h, d, min, max, sp, n);
    for (let z = 0; z < d; z++) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = z * w * h + y * w + x, inSeg = values[i] >= min && values[i] <= max;
      if (!inSeg) { expect(out[i]).toBeLessThan(0); continue; }
      let best = Infinity;
      for (let dz = -n[2]; dz <= n[2]; dz++) for (let dy = -n[1]; dy <= n[1]; dy++) for (let dx = -n[0]; dx <= n[0]; dx++) {
        const X = x + dx, Y = y + dy, Z = z + dz; if (X < 0 || Y < 0 || Z < 0 || X >= w || Y >= h || Z >= d) continue;
        if (values[Z * w * h + Y * w + X] < min) best = Math.min(best, (dx * sp[0]) ** 2 + (dy * sp[1]) ** 2 + (dz * sp[2]) ** 2);
      }
      // within the slider range the value is exact; beyond it only "farther" matters
      if (best <= maxMm * maxMm * (1 + 1e-5)) expect(out[i]).toBeCloseTo(best, 6);
      else expect(out[i]).toBeGreaterThan(maxMm * maxMm);
    }
  });
});
