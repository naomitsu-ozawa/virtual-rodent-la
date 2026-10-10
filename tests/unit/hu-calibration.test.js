import { describe, it, expect } from 'vitest';
import {
  WIDE_MIN, createWideHist, addWideValues, estimateHuScale, mapHu, calibrateSnapshot, REFERENCE_SCALE,
} from '../../docs/hu-calibration.js';
import { BUILTIN_PRESETS, builtinPresetById, normalizeSnapshot } from '../../docs/analysis-presets.js';

// deterministic normal samples (LCG + Box-Muller)
function rng(seed) {
  let s = seed >>> 0;
  const u = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return (s + 0.5) / 4294967296; };
  return () => Math.sqrt(-2 * Math.log(u())) * Math.cos(2 * Math.PI * u());
}
// parts: [[mean, sd, count], ...]; sd 0 = a constant value (padding)
function volume(parts, seed = 1) {
  const g = rng(seed), out = [];
  for (const [mean, sd, count] of parts) for (let i = 0; i < count; i++) out.push(sd ? mean + sd * g() : mean);
  return Float32Array.from(out);
}
const estimate = values => estimateHuScale(addWideValues(createWideHist(), values));

describe('wide-range binning', () => {
  it('keeps values far below -1024 (mouse air at about -2000) in their own bins', () => {
    const h = addWideValues(createWideHist(), Float32Array.from([-2000, -2000, -1024, NaN, 99999]));
    expect(h[-2000 - WIDE_MIN]).toBe(2);
    expect(h[-1024 - WIDE_MIN]).toBe(1);
    expect(h[h.length - 1]).toBe(1); // clamped, and ignored by the estimate
  });
  it('honours start / end / stride', () => {
    const h = addWideValues(createWideHist(), Float32Array.from([1, 2, 3, 4, 5, 6]), 1, 6, 2);
    expect([h[2 - WIDE_MIN], h[4 - WIDE_MIN], h[6 - WIDE_MIN], h[3 - WIDE_MIN]]).toEqual([1, 1, 1, 0]);
  });
});

describe('estimateHuScale', () => {
  it('finds air and soft tissue on a mouse-like scale (air -2000, padding -2583)', () => {
    const r = estimate(volume([[-2583, 0, 20000], [-2000, 40, 120000], [-440, 40, 8000], [-10, 40, 50000], [1500, 400, 3000]]));
    expect(r.ok).toBe(true);
    expect(Math.abs(r.air + 2000)).toBeLessThanOrEqual(5);
    expect(Math.abs(r.soft + 10)).toBeLessThanOrEqual(5);
  });
  it('finds air and soft tissue on a rat-like scale (air -1030, padding -1361)', () => {
    const r = estimate(volume([[-1361, 0, 60000], [-1030, 40, 40000], [-100, 40, 9000], [150, 40, 30000]]));
    expect(r.ok).toBe(true);
    expect(Math.abs(r.air + 1030)).toBeLessThanOrEqual(5);
    expect(Math.abs(r.soft - 150)).toBeLessThanOrEqual(5);
  });
  it('takes soft tissue, not fat, when the fat peak is the taller one', () => {
    const r = estimate(volume([[-1030, 40, 40000], [-100, 40, 30000], [150, 40, 15000]]));
    expect(r.ok).toBe(true);
    expect(Math.abs(r.soft - 150)).toBeLessThanOrEqual(5);
  });
  it('fails without air in the field of view, and on constant (synthetic) values', () => {
    expect(estimate(volume([[-100, 40, 20000], [150, 40, 60000]])).ok).toBe(false);
    const spikes = Float32Array.from({ length: 30000 }, (_, i) => -1024 + (i % 7) * 600);
    expect(estimate(spikes).ok).toBe(false);
    expect(estimate(new Float32Array(0)).ok).toBe(false);
  });
  it('fails when air and the next peak are implausibly close', () => {
    const r = estimate(volume([[-1000, 30, 50000], [-600, 30, 50000]]));
    expect(r.ok).toBe(false);
  });
});

describe('mapping the built-in presets', () => {
  const mouse = { air: -2008, soft: -18 }; // estimate on the mouse practice scan
  it('is the identity on the reference scale', () => {
    for (const v of [-700, -250, 0, 350]) expect(mapHu(v, REFERENCE_SCALE)).toBeCloseTo(v, 9);
    const fat = normalizeSnapshot(builtinPresetById('fat'));
    expect(calibrateSnapshot(fat, REFERENCE_SCALE)).toEqual(fat);
  });
  it('maps ranges and the window to the mouse scale; open tops and filters are kept, the input is not changed', () => {
    const soft = normalizeSnapshot(builtinPresetById('soft'));
    const before = JSON.stringify(soft);
    const m = calibrateSnapshot(soft, mouse);
    expect(m.segments.soft).toEqual({ min: -277, max: 319 });
    expect(m.segments.contrast).toEqual({ min: 319, max: 65535 });
    expect(m.display.windowCenter).toBe(-21);
    expect(m.display.windowWidth).toBe(Math.round(500 * 1990 / 1170));
    expect(m.filters).toEqual(soft.filters);
    expect(JSON.stringify(soft)).toBe(before);
    const fat = calibrateSnapshot(normalizeSnapshot(builtinPresetById('fat')), mouse);
    expect(fat.segments.fat).toEqual({ min: -702, max: -277 }); // the mouse fat peak (-442) lies inside
  });
  it('every built-in preset stays valid after mapping', () => {
    for (const p of BUILTIN_PRESETS) {
      const m = normalizeSnapshot(calibrateSnapshot(normalizeSnapshot(p), mouse));
      expect(m, p.id).toBeTruthy();
      expect(m.display.windowWidth).toBeGreaterThan(0);
      for (const r of Object.values(m.segments)) expect(r.min).toBeLessThan(r.max);
    }
  });
});
