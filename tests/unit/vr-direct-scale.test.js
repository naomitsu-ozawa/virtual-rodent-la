import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { DIRECT_LEVELS, directScaleOn, viewportScaleSupported, snapDown, levelAbove, fixedScale, startScale, createChangeGate, effectiveScale } from '../../docs/vr-direct-scale.js';
import { createAutoQuality, STEP_LEVELS } from '../../docs/vr-auto-quality.js';

describe('setting', () => {
  it('is OFF by default in vr-view.js (dscale:0) and only exactly 1 turns it on', () => {
    const src = readFileSync('docs/vr-view.js', 'utf8');
    expect(src).toMatch(/const DEFAULTS=\{[^}]*dscale:0[^}]*\}/);
    expect(directScaleOn({})).toBe(false);
    expect(directScaleOn({ dscale: 0 })).toBe(false);
    expect(directScaleOn({ dscale: true })).toBe(false);
    expect(directScaleOn(undefined)).toBe(false);
    expect(directScaleOn({ dscale: 1 })).toBe(true);
  });
  it('the off path of the render loop still picks the old resolution expression', () => {
    const src = readFileSync('docs/vr-view.js', 'utf8');
    expect(src).toContain('const f=dsOn?1:auto?aq.f:(VRES[settings.vres]??1);');
  });
  it('viewport scale support is detected from XRView.prototype', () => {
    expect(viewportScaleSupported({})).toBe(false);
    expect(viewportScaleSupported({ XRView: class {} })).toBe(false);
    expect(viewportScaleSupported({ XRView: class { requestViewportScale() {} } })).toBe(true);
  });
});

describe('scale steps', () => {
  it('are coarse and descending', () => {
    expect(DIRECT_LEVELS).toEqual([1, 0.85, 0.7, 0.6]);
  });
  it('snapDown / levelAbove', () => {
    expect(snapDown(1)).toBe(1); expect(snapDown(0.9)).toBe(0.85); expect(snapDown(0.85)).toBe(0.85);
    expect(snapDown(0.69)).toBe(0.6); expect(snapDown(0.3)).toBe(0.6);
    expect(levelAbove(0.6)).toBe(0.7); expect(levelAbove(0.85)).toBe(1); expect(levelAbove(1)).toBe(null);
  });
  it('fixed choices and the session-start fallback', () => {
    expect(fixedScale(1)).toBe(1); expect(fixedScale(0.7)).toBe(0.7); expect(fixedScale(0.5)).toBe(0.5); expect(fixedScale(0.2)).toBe(0.5);
    expect(fixedScale(0, 0.85)).toBe(0.85);
    expect(startScale(0)).toBe(0.7); expect(startScale(0.5)).toBe(0.5);
  });
  it('effective scale is relative to the widest viewport', () => {
    expect(effectiveScale(850, 1000)).toBeCloseTo(0.85, 6); expect(effectiveScale(0, 0)).toBe(1);
  });
});

describe('change gate', () => {
  it('allows the first change, then waits for the minimum interval', () => {
    const g = createChangeGate(2000);
    expect(g.ready(0)).toBe(true); g.mark(0);
    expect(g.ready(1999)).toBe(false); expect(g.ready(2000)).toBe(true);
    g.mark(2000); expect(g.ready(3000)).toBe(false); g.reset(); expect(g.ready(3000)).toBe(true);
  });
});

describe('ladder on coarse levels', () => {
  const BUDGET = 1000 / 72;
  const sample = (aq, unit, rest = 2) => ({ mainMs: unit * aq.f * aq.f * STEP_LEVELS[0] / STEP_LEVELS[aq.stepIdx] + rest, interval: BUDGET, budget: BUDGET });
  const run = (aq, unit, n) => { const t = []; for (let i = 0; i < n; i++) { aq.update(sample(aq, unit)); t.push(aq.f); } return t; };
  it('with no levels the ladder is untouched (continuous, as before)', () => {
    const aq = createAutoQuality();
    expect(aq.levels).toBe(null);
    const t = run(aq, 11, 30);
    expect(t.some(f => !DIRECT_LEVELS.includes(+f.toFixed(6)))).toBe(true);
  });
  it('overload only ever lands on a level and never skips below the floor', () => {
    const aq = createAutoQuality(); aq.setLevels(DIRECT_LEVELS);
    const t = run(aq, 11, 80);
    for (const f of t) expect(DIRECT_LEVELS).toContain(f);
    expect(Math.min(...t)).toBeGreaterThanOrEqual(0.6);
    expect(t).toContain(0.85);
  });
  it('recovers upward one level at a time when the load goes away', () => {
    const aq = createAutoQuality(); aq.setLevels(DIRECT_LEVELS);
    run(aq, 60, 40);
    const t = run(aq, 1, 600);
    for (let i = 1; i < t.length; i++) { const a = DIRECT_LEVELS.indexOf(t[i - 1]), b = DIRECT_LEVELS.indexOf(t[i]); expect(a - b).toBeLessThanOrEqual(1); }
    expect(t[t.length - 1]).toBe(1);
  });
  it('setLevels moves the present f onto a level and null returns to continuous', () => {
    const aq = createAutoQuality({ f: 0.77 }); aq.setLevels(DIRECT_LEVELS);
    expect(aq.f).toBe(0.7); aq.setLevels(null); expect(aq.levels).toBe(null);
  });
});
