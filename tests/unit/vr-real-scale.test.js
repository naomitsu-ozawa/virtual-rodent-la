import { describe, it, expect } from 'vitest';
import { physicalExtentsMm, longestMm, realMagnification, realHolderScale, formatMagnification, magnificationText, NORM_LONG, scaleLimits, clampScale, pinchScale, isOversize, oversizeNote, sizeWarningHtml } from '../../docs/vr-real-scale.js';

const DEFAULT_SCALE = 0.165 / NORM_LONG; // the initial display: longest side 16.5 cm
// synthetic mouse-like micro-CT: 400 x 200 x 500 voxels at 0.2 x 0.2 x 0.2 mm -> 80 x 40 x 100 mm
const mouse = { dims: { columns: 400, rows: 200, slices: 500 }, sp: [0.2, 0.2, 0.2] };

describe('vr-real-scale', () => {
  it('physical extent = dims x spacing, with anisotropic spacing', () => {
    expect(physicalExtentsMm(mouse.dims, mouse.sp)).toEqual([80, 40, 100]);
    // thick slices decide the longest side: 100 x 100 x 40 slices x 3 mm = 120 mm
    const e = physicalExtentsMm({ columns: 100, rows: 100, slices: 40 }, { x: 0.5, y: 0.5, z: 3 });
    expect(e).toEqual([50, 50, 120]);
    expect(longestMm(e)).toBe(120);
    expect(physicalExtentsMm(null, mouse.sp)).toBeNull();
    expect(physicalExtentsMm(mouse.dims, [0.2, 0.2, 0])).toBeNull();
  });
  it('the initial 16.5 cm display against real size', () => {
    expect(realMagnification(DEFAULT_SCALE, 100)).toBeCloseTo(1.65, 10);
    expect(realMagnification(DEFAULT_SCALE, 330)).toBeCloseTo(0.5, 10);
  });
  it('1x reset: scale for real size shows exactly 1 for any size and spacing', () => {
    for (const L of [30, 100, 120, 300]) {
      const s = realHolderScale(L);
      expect(realMagnification(s, L)).toBeCloseTo(1, 10);
    }
    expect(realHolderScale(0)).toBeNull();
    expect(realHolderScale(450)).toBeNull(); // over 30 cm: no real-size display
  });
  it('two-hand scaling multiplies the value by the hand-distance ratio (inside the limits)', () => {
    const L = 50, s0 = realHolderScale(L) * 2; // shown at 2x
    expect(realMagnification(pinchScale(s0, 0.3, 0.6, L), L)).toBeCloseTo(4, 10);
    expect(realMagnification(pinchScale(s0, 0.3, 0.15, L), L)).toBeCloseTo(1, 10); // 0.5x of 2x = exactly the 1x floor
    expect(realMagnification(pinchScale(s0, 0.3, 0.05, L), L)).toBeCloseTo(1, 10); // below: stops at 1x
  });
  it('formatting: 2 significant digits, one decimal from 10', () => {
    expect(formatMagnification(0.8)).toBe('0.8');
    expect(formatMagnification(0.8123)).toBe('0.81');
    expect(formatMagnification(1.66)).toBe('1.7'); // 1.66
    expect(formatMagnification(1.0004)).toBe('1');
    expect(formatMagnification(9.4)).toBe('9.4');
    expect(formatMagnification(12.34)).toBe('12.3');
    expect(formatMagnification(0)).toBe('');
    expect(magnificationText(0.8, 'ja')).toBe('×0.8（実寸比）');
    expect(magnificationText(1, 'en')).toBe('×1 (real size)');
  });

  it('limits: 1x .. 0.30 m; a 3 cm specimen is 1x = 3 cm up to 10x', () => {
    const l = scaleLimits(30);
    expect(displayed(l.min)).toBeCloseTo(0.03, 10);
    expect(displayed(l.max)).toBeCloseTo(0.30, 10);
    expect(realMagnification(l.max, 30)).toBeCloseTo(10, 10);
    expect(l.locked).toBe(false);
  });
  it('limits with anisotropic spacing use the longest physical side', () => {
    const L = longestMm(physicalExtentsMm({ columns: 100, rows: 100, slices: 40 }, { x: 0.5, y: 0.5, z: 3 })); // 120 mm
    const l = scaleLimits(L);
    expect(displayed(l.min)).toBeCloseTo(0.12, 10);
    expect(clampScale(0.001, L)).toBeCloseTo(l.min, 12);
  });
  it('the default 16.5 cm start respects the minimum (a 20 cm specimen starts at 1x)', () => {
    expect(displayed(clampScale(DEFAULT_SCALE, 200))).toBeCloseTo(0.2, 10);
    expect(displayed(clampScale(DEFAULT_SCALE, 100))).toBeCloseTo(0.165, 10);
  });
  it('pinch beyond the limits stops at them and resumes from the grab value (no drift)', () => {
    const L = 100, s0 = DEFAULT_SCALE, lim = scaleLimits(L);
    expect(pinchScale(s0, 0.3, 3, L)).toBe(lim.max);
    expect(pinchScale(s0, 0.3, 0.001, L)).toBeCloseTo(lim.min, 12);
    expect(pinchScale(s0, 0.3, 0.3, L)).toBeCloseTo(s0, 12);
    expect(pinchScale(s0, 0.3, 0.33, L)).toBeCloseTo(s0 * 1.1, 12);
  });
  it('over 30 cm: fitted to 0.30 m, scale locked, indicator below 1x', () => {
    const L = 700;
    expect(isOversize(L)).toBe(true);
    expect(isOversize(300)).toBe(false);
    const l = scaleLimits(L);
    expect(l.locked).toBe(true);
    expect(displayed(l.max)).toBeCloseTo(0.30, 10);
    expect(clampScale(DEFAULT_SCALE, L)).toBeCloseTo(l.max, 12);
    expect(pinchScale(0.05, 0.3, 0.9, L)).toBe(l.max);
    expect(pinchScale(0.05, 0.3, 0.1, L)).toBe(l.max);
    const m = realMagnification(l.max, L);
    expect(m).toBeCloseTo(300 / 700, 10);
    expect(magnificationText(m, 'ja')).toBe('×0.43（実寸比）');
  });
  it('the warning appears only for over 30 cm', () => {
    expect(oversizeNote(300, 'ja')).toBeNull();
    expect(oversizeNote(300.5, 'ja')).toContain('30cmを超える');
    expect(oversizeNote(500, 'en')).toContain('30 cm');
    const esc = x => x;
    expect(sizeWarningHtml({ columns: 512, rows: 512, slices: { length: 100 }, spacingX: 1, spacingY: 1, spacingZ: 1 }, 'ja', esc)).toContain('size-warn');
    expect(sizeWarningHtml({ columns: 400, rows: 200, slices: { length: 500 }, spacingX: 0.2, spacingY: 0.2, spacingZ: 0.2 }, 'ja', esc)).toBe('');
    expect(sizeWarningHtml(null, 'ja', esc)).toBe('');
  });
});
const displayed = s => s * NORM_LONG;
