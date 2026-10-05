import { describe, it, expect } from 'vitest';
import { effectiveRanges, nextUp, nextDown } from '../../docs/segment-exclusive.js';

const segs = o => Object.fromEntries(Object.entries(o).map(([k, [a, b, active = true]]) => [k, { userMin: a, userMax: b, active }]));
const inSeg = (r, v) => v >= r.min && v <= r.max;

describe('non-overlapping segments (build 438)', () => {
  it('off keeps the user ranges', () => {
    const r = effectiveRanges(segs({ fat: [-250, 81], soft: [-93, 248] }), ['fat', 'soft'], 'off');
    expect(r.fat).toMatchObject({ min: -250, max: 81 });
    expect(r.soft).toMatchObject({ min: -93, max: 248 });
  });
  it('priority: the upper card takes the overlap, no gap and no double value', () => {
    const r = effectiveRanges(segs({ bone: [354, 61530], fat: [-250, 81], soft: [-93, 248] }), ['bone', 'fat', 'soft'], 'priority');
    expect(r.fat).toMatchObject({ min: -250, max: 81 });
    expect(r.soft.min).toBe(nextUp(81));
    expect(r.soft.max).toBe(248);
    for (const v of [-250, -93, 0, 81, 81.00001, 81.5, 82, 248]) {
      const n = ['bone', 'fat', 'soft'].filter(k => inSeg(r[k], v)).length;
      expect(n).toBe(1);
    }
  });
  it('soft above fat gives the overlap to soft', () => {
    const r = effectiveRanges(segs({ fat: [-250, 81], soft: [-93, 248] }), ['soft', 'fat'], 'priority');
    expect(r.soft).toMatchObject({ min: -93, max: 248 });
    expect(r.fat.max).toBe(nextDown(-93));
  });
  it('a range inside a lower one: the piece with the middle stays, the other is reported', () => {
    const r = effectiveRanges(segs({ fat: [-250, 81], soft: [-300, 300] }), ['fat', 'soft'], 'priority');
    expect(r.soft.min).toBe(nextUp(81));
    expect(r.soft.max).toBe(300);
    expect(r.soft.dropped).toEqual([[-300, nextDown(-250)]]);
  });
  it('a fully covered range is empty', () => {
    const r = effectiveRanges(segs({ fat: [-250, 81], soft: [-100, 0] }), ['fat', 'soft'], 'priority');
    expect(r.soft.empty).toBe(true);
    expect(r.soft.max).toBeLessThan(r.soft.min);
  });
  it('inactive segments neither take nor lose values', () => {
    const r = effectiveRanges(segs({ fat: [-250, 81, false], soft: [-93, 248] }), ['fat', 'soft'], 'priority');
    expect(r.soft).toMatchObject({ min: -93, max: 248 });
  });
  it('a dropped piece stays free for the segments below', () => {
    const r = effectiveRanges(segs({ fat: [-250, 81], soft: [-300, 300], lung: [-950, -260] }), ['fat', 'soft', 'lung'], 'priority');
    expect(r.lung.max).toBe(-260);
    expect(inSeg(r.lung, -280)).toBe(true);
  });
});
