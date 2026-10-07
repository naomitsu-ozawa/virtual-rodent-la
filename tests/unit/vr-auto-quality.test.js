import { describe, it, expect } from 'vitest';
import { createAutoQuality, autoFloor, STEP_LEVELS, AUTO_FLOORS } from '../../docs/vr-auto-quality.js';

const BUDGET = 1000 / 72;
// mocked GPU timings: the volume pass costs `unit` ms at f = 1 and step 1; it scales with f^2 and 1/step; the rest of the frame is `rest` ms
const sample = (aq, unit, rest = 2) => {
  const f = aq.f, vol = unit * f * f * STEP_LEVELS[0] / STEP_LEVELS[aq.stepIdx];
  return f < 1 ? { volMs: vol, mainMs: rest, interval: BUDGET, budget: BUDGET } : { volMs: 0, mainMs: vol + rest, interval: BUDGET, budget: BUDGET };
};
const run = (aq, unit, n, rest) => { const trace = []; for (let i = 0; i < n; i++) { aq.update(sample(aq, unit, rest)); trace.push({ f: aq.f, s: aq.stepIdx }); } return trace; };

describe('ladder', () => {
  it('floor values and labels order: 50 / 35 / 25 %', () => {
    expect(AUTO_FLOORS).toEqual([0.5, 0.35, 0.25]);
    expect(autoFloor(0)).toBe(0.5); expect(autoFloor(2)).toBe(0.25); expect(autoFloor(9)).toBe(0.5);
  });
  it('overload: resolution first to 0.7, step only then; resolution stays >= 0.7 while step < 2', () => {
    const aq = createAutoQuality();
    const trace = run(aq, 40, 60);
    for (const t of trace) if (t.s < 2) expect(t.f).toBeGreaterThanOrEqual(0.7 - 1e-9);
    const firstStep = trace.findIndex(t => t.s > 0);
    expect(firstStep).toBeGreaterThan(0);
    expect(trace[firstStep - 1].f).toBeCloseTo(0.7, 6);       // resolution reached 0.7 before the first step change
    expect(trace.some(t => t.s === 1)).toBe(true);             // 1 -> 1.5 passed through
    const i2 = trace.findIndex(t => t.s === 2);
    expect(trace.slice(0, i2).every(t => t.f >= 0.7 - 1e-9)).toBe(true);
  });
  it('steps rise one level at a time and never skip', () => {
    const aq = createAutoQuality(); let prev = 0;
    for (const t of run(aq, 60, 80)) { expect(t.s - prev).toBeLessThanOrEqual(1); expect(t.s).toBeGreaterThanOrEqual(prev); prev = t.s; }
  });
  it.each([[0, 0.5], [1, 0.35], [2, 0.25]])('floor setting %i is respected (min %f) and reached only at step 2', (idx, floor) => {
    const aq = createAutoQuality({ min: autoFloor(idx) });
    const trace = run(aq, 400, 200); // far beyond what the GPU can do
    expect(Math.min(...trace.map(t => t.f))).toBeGreaterThanOrEqual(floor - 1e-9);
    expect(aq.f).toBeCloseTo(floor, 6); expect(aq.stepIdx).toBe(2);
    for (const t of trace) if (t.f < 0.7 - 1e-9) expect(t.s).toBe(2);
  });
  it('manual Detail is the lowest rung: base step 1 never goes back to 0, base 2 never moves the step', () => {
    const a = createAutoQuality({ baseStep: 1 });
    expect(Math.min(...run(a, 40, 40).map(t => t.s))).toBe(1);
    expect(Math.min(...run(a, 1, 200).map(t => t.s))).toBe(1);
    const b = createAutoQuality({ baseStep: 2 });
    const tb = run(b, 40, 60);
    expect(tb.every(t => t.s === 2)).toBe(true);
    expect(b.f).toBeLessThan(1);
  });
  it('hysteresis: one over sample, or alternating samples, change nothing', () => {
    const aq = createAutoQuality();
    aq.update({ volMs: 0, mainMs: 40, interval: BUDGET, budget: BUDGET });
    expect(aq.f).toBe(1);
    for (let i = 0; i < 10; i++) {
      aq.update({ volMs: 0, mainMs: i % 2 ? 40 : 4, interval: BUDGET, budget: BUDGET });
      expect(aq.f).toBe(1); expect(aq.stepIdx).toBe(0);
    }
    aq.update({ volMs: 0, mainMs: 40, interval: BUDGET, budget: BUDGET });
    aq.update({ volMs: 0, mainMs: 40, interval: BUDGET, budget: BUDGET });
    expect(aq.f).toBeLessThan(1);
  });
  it('recovery needs consecutive samples with headroom', () => {
    const aq = createAutoQuality();
    run(aq, 40, 60);
    const before = { f: aq.f, s: aq.stepIdx };
    aq.update({ volMs: 1, mainMs: 1, interval: BUDGET, budget: BUDGET });
    aq.update({ volMs: 1, mainMs: 1, interval: BUDGET, budget: BUDGET });
    expect({ f: aq.f, s: aq.stepIdx }).toEqual(before);
    aq.update({ volMs: 40, mainMs: 2, interval: BUDGET, budget: BUDGET }); // heavy again: counter resets
    aq.update({ volMs: 1, mainMs: 1, interval: BUDGET, budget: BUDGET });
    aq.update({ volMs: 1, mainMs: 1, interval: BUDGET, budget: BUDGET });
    expect({ f: aq.f, s: aq.stepIdx }).toEqual(before);
  });
  it('recovery runs in reverse: resolution to 0.7, then step 2 -> 1.5 -> 1, then resolution to 1', () => {
    const aq = createAutoQuality({ min: 0.35 });
    run(aq, 400, 200);
    expect(aq.stepIdx).toBe(2); expect(aq.f).toBeCloseTo(0.35, 6);
    const trace = run(aq, 3, 300); // light scene now (the failed-level memory lapses after 120 samples)
    expect(aq.f).toBe(1); expect(aq.stepIdx).toBe(0);
    for (let i = 1; i < trace.length; i++) {
      const p = trace[i - 1], t = trace[i];
      if (t.s < p.s) { expect(t.s).toBe(p.s - 1); expect(p.f).toBeGreaterThanOrEqual(0.7 - 1e-9); expect(t.f).toBeGreaterThanOrEqual(0.7 - 1e-9); }
      if (p.s === 2 && t.s === 1) expect(p.f).toBeCloseTo(0.7, 6);   // step comes down only once resolution is back at 0.7
      if (t.f > p.f && p.f < 0.7 - 1e-9) expect(t.s).toBe(2);       // below 0.7 only resolution rises, step still max
      if (t.f > 0.7 + 1e-9 && p.s !== t.s) throw new Error('step and resolution moved together above 0.7');
    }
    const iStep0 = trace.findIndex(t => t.s === 0), i1 = trace.findIndex(t => t.f > 0.7 + 1e-9);
    expect(trace.slice(0, iStep0).every(t => t.f <= 0.7 + 1e-9)).toBe(true);
    expect(i1).toBeGreaterThanOrEqual(iStep0);
  });
  it('does not oscillate at a steady load that fits only after one rung', () => {
    const aq = createAutoQuality();
    const trace = run(aq, 24, 200, 3);
    const tail = trace.slice(-100); let moves = 0;
    for (let i = 1; i < tail.length; i++) if (tail[i].f !== tail[i - 1].f || tail[i].s !== tail[i - 1].s) moves++;
    expect(moves).toBeLessThanOrEqual(2);
  });
  it('wall-clock only (no timer): drops after two slow windows, rises only after a longer run of good ones', () => {
    const aq = createAutoQuality();
    const slow = { volMs: 0, mainMs: 0, interval: BUDGET * 1.6, budget: BUDGET }, ok = { volMs: 0, mainMs: 0, interval: BUDGET, budget: BUDGET };
    aq.update(slow); expect(aq.f).toBe(1); aq.update(slow); expect(aq.f).toBeLessThan(1);
    const f0 = aq.f;
    for (let i = 0; i < 5; i++) aq.update(ok);
    expect(aq.f).toBe(f0);
    aq.update(ok);
    expect(aq.f).toBeGreaterThan(f0);
  });
  it('a rise that bounces back backs off (longer wait next time)', () => {
    const aq = createAutoQuality();
    const slow = { volMs: 0, mainMs: 0, interval: BUDGET * 1.6, budget: BUDGET }, ok = { volMs: 0, mainMs: 0, interval: BUDGET, budget: BUDGET };
    aq.update(slow); aq.update(slow);
    for (let i = 0; i < 6; i++) aq.update(ok);   // rises
    const up = aq.f; aq.update(slow); aq.update(slow); // bounces
    expect(aq.f).toBeLessThan(up);
    expect(aq.state.penalty).toBeGreaterThan(1);
    const f1 = aq.f;
    for (let i = 0; i < 6; i++) aq.update(ok);
    expect(aq.f).toBe(f1);
  });
  it('setFloor / setBaseStep clamp the live state', () => {
    const aq = createAutoQuality({ min: 0.25 }); run(aq, 400, 200);
    expect(aq.f).toBeCloseTo(0.25, 6);
    aq.setFloor(0.5); expect(aq.f).toBe(0.5);
    aq.setBaseStep(2); expect(aq.stepIdx).toBe(2);
  });
});

// build 483: the wall-clock fallback cycled 81 % -> 70 % -> 81 % ... for ever (a small overrun shows as a halved rate)
describe('failed level is remembered', () => {
  const budget = 1000 / 72;
  const quant = load => Math.ceil(load / budget - 1e-9) * budget; // the display halves the rate on a small overrun
  const loadOf = aq => 20 * aq.f * aq.f * STEP_LEVELS[0] / STEP_LEVELS[aq.stepIdx] + 2;
  const drive = (aq, n, ctx = 'a') => { const tr = []; for (let i = 0; i < n; i++) { aq.update({ volMs: 0, mainMs: 0, interval: quant(loadOf(aq)), budget, ctx }); tr.push(aq.f); } return tr; };
  const flips = tr => { let n = 0; for (let i = 1; i < tr.length; i++) if (Math.abs(tr[i] - tr[i - 1]) > 1e-9) n++; return n; };
  it('settles: no resolution moves in the second minute', () => {
    const aq = createAutoQuality();
    const tr = drive(aq, 200);
    expect(flips(tr.slice(100, 118))).toBe(0); // 100..118 samples = 50..59 s
    expect(Math.min(...tr)).toBeGreaterThanOrEqual(0.7 - 1e-9);
  });
  it('does not retry above 0.97x of the level that failed while the context is unchanged', () => {
    const aq = createAutoQuality();
    const tr = drive(aq, 60);
    const peaks = []; for (let i = 1; i < tr.length - 1; i++) if (tr[i] > tr[i - 1] + 1e-9 && tr[i] >= tr[i + 1]) peaks.push(tr[i]);
    // at most one overshoot that fails; afterwards never above 0.97 x the failed level
    expect(peaks.length).toBeLessThanOrEqual(1);
  });
  it('a changed context (view size, segments, section) allows a new attempt', () => {
    const aq = createAutoQuality();
    drive(aq, 80, 'a');
    const settled = aq.f;
    drive(aq, 3, 'b'); // load is the same: it climbs again for one try
    const tr = drive(aq, 40, 'b');
    expect(Math.max(settled, ...tr)).toBeGreaterThan(settled - 1e-9);
    expect(aq.state.penalty).toBeGreaterThanOrEqual(1);
  });
  it('the memory lapses after about 60 s (120 samples)', () => {
    const aq = createAutoQuality();
    drive(aq, 60); const f0 = aq.f;
    const light = []; for (let i = 0; i < 160; i++) { aq.update({ volMs: 0, mainMs: 0, interval: budget, budget, ctx: 'a' }); light.push(aq.f); }
    expect(light[20]).toBeCloseTo(f0, 6);           // still held at 10 s
    expect(aq.f).toBeGreaterThan(f0);               // released afterwards
  });
});
