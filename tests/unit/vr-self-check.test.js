import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createFrameRing, computeStats, judge, formatLine, overall, verdictLine, resultText, resultJson, P5_FPS_RATIO, OVER_FRAME_MAX_RATIO, MIN_FRAMES, RING_CAPACITY } from '../../docs/vr-self-check-core.js';
import { createVrSelfCheck, registerVrSelfCheck, listVrSelfChecks } from '../../docs/vr-self-check.js';

const D72 = 1000 / 72;
const steady = (n, d = D72) => Array.from({ length: n }, () => d);
// n frames at d ms with `hitches` frames of h ms spread out
const withHitches = (n, hitches, h, d = D72) => { const a = steady(n, d); for (let i = 0; i < hitches; i++) a[Math.floor((i + 0.5) * n / hitches)] = h; return a; };

describe('frame ring', () => {
  it('keeps the newest values once full and never grows', () => {
    const r = createFrameRing(4); for (let i = 1; i <= 6; i++) r.push(i);
    expect(r.count).toBe(4); expect([...r.copy()]).toEqual([3, 4, 5, 6]);
    r.reset(); expect(r.count).toBe(0); r.push(9); expect([...r.copy()]).toEqual([9]);
  });
  it('default capacity covers 5 s at 120 Hz', () => { expect(RING_CAPACITY).toBeGreaterThanOrEqual(600); });
});

describe('computeStats / judge', () => {
  it('a steady 72 Hz series passes with mean 72, p5 72, worst 13.9 ms', () => {
    const s = computeStats(steady(360), 72);
    expect(s.meanFps).toBeCloseTo(72, 3); expect(s.p5Fps).toBeCloseTo(72, 3); expect(s.worstMs).toBeCloseTo(D72, 3); expect(s.overCount).toBe(0);
    expect(judge(s).pass).toBe(true);
  });
  it('a few hitches (<= 2 %) over budget still pass when p5 holds', () => {
    const s = computeStats(withHitches(360, 5, 40), 72); // 5 / 360 = 1.4 %
    expect(s.overCount).toBe(5); expect(s.worstMs).toBe(40); expect(s.p5Fps).toBeCloseTo(72, 1); expect(judge(s).pass).toBe(true);
  });
  it('more than 2 % of frames over 1.5x budget fails (reason over)', () => {
    const s = computeStats(withHitches(360, 12, 30), 72); // 3.3 %
    const v = judge(s); expect(v.pass).toBe(false); expect(v.reasons).toContain('over');
  });
  it('a series that is slow overall fails on p5', () => {
    const s = computeStats(steady(300, 1000 / 60), 72); // steady 60 fps on a 72 Hz target
    expect(s.meanFps).toBeCloseTo(60, 3); expect(s.p5Fps).toBeLessThan(P5_FPS_RATIO * 72);
    expect(judge(s).reasons).toContain('p5');
  });
  it('exactly at the thresholds: p5 = 0.9 x target passes, over = 2 % passes', () => {
    const s = computeStats(steady(100, 1000 / (0.9 * 72)), 72); expect(judge(s).reasons).not.toContain('p5');
    const t = computeStats(withHitches(100, 2, 30), 72); expect(t.overRatio).toBeCloseTo(OVER_FRAME_MAX_RATIO); expect(judge(t).reasons).not.toContain('over');
  });
  it('too few frames is a failure (the headset delivered nothing)', () => {
    expect(MIN_FRAMES).toBeGreaterThan(0);
    expect(judge(computeStats(steady(5), 72)).reasons).toEqual(['frames']); expect(judge(computeStats([], 72)).pass).toBe(false);
  });
  it('1 % low is the 99th percentile interval; the target Hz changes the budget', () => {
    const a = steady(200); a[10] = 100; a[11] = 100; a[12] = 100; // 1.5 % at 100 ms
    const s = computeStats(a, 72); expect(s.low1Fps).toBeCloseTo(10, 3);
    expect(computeStats(steady(100, 1000 / 90), 90).overCount).toBe(0); expect(computeStats(steady(100, 1000 / 90), 72).targetHz).toBe(72);
  });
});

describe('text', () => {
  const ok = { id: 'idle', label: '基準', stats: computeStats(steady(360), 72), verdict: { pass: true, reasons: [] } };
  const ng = { id: 'rotate', label: '回転', stats: computeStats(withHitches(360, 12, 30), 72), verdict: judge(computeStats(withHitches(360, 12, 30), 72)) };
  it('PASS line: 「✔ 基準 72.0fps（最低 72.0, 最大 14ms）」', () => { expect(formatLine(ok)).toBe('✔ 基準 72.0fps（最低 72.0, 最大 14ms）'); });
  it('FAIL line starts with ✖ and says how late', () => { const t = formatLine(ng); expect(t.startsWith('✖ 回転 ')).toBe(true); expect(t).toContain('遅れ 3.3%'); });
  it('skipped / error lines; skipped ones do not count', () => {
    expect(formatLine({ id: 'x', label: '断面', skipped: '断面を出せません' })).toBe('－ 断面（実施せず：断面を出せません）');
    expect(formatLine({ id: 'x', label: '断面', error: 'boom' })).toContain('✖ 断面（エラー：boom）');
    expect(overall([ok, { skipped: 'a' }]).pass).toBe(true); expect(overall([{ skipped: 'a' }]).pass).toBe(false); expect(overall([ok, ng]).failed).toBe(1);
    expect(verdictLine([ok, ng])).toContain('✖ 総合：不合格（1 / 2'); expect(verdictLine([ok])).toContain('✔ 総合：合格（1 項目）');
  });
  it('resultText / resultJson carry every scenario', () => {
    const res = { head: 'VR 自己診断 build 552 · 72 Hz', build: '552', when: 'now', hz: 72, results: [ok, ng] };
    expect(resultText(res).split('\n')).toHaveLength(4);
    const j = resultJson(res); expect(j.verdict).toBe('FAIL'); expect(j.scenarios[0]).toMatchObject({ id: 'idle', pass: true, meanFps: 72 }); expect(j.scenarios[1].reasons).toContain('over');
    expect(() => JSON.stringify(j)).not.toThrow();
  });
});

// ---- the runner on a fake frame loop (no XR, no DOM) ----
const makeHolder = () => { const q = { v: 0, clone() { return { v: this.v, copy(o) { this.v = o.v; }, } }, copy(o) { this.v = o.v; } }; return { quaternion: q, rotations: 0, rotateY(a) { this.quaternion.v += a; this.rotations++; } }; };
// drive tick() like the XR loop: n frames or until the runner stops measuring
async function drive(sc, { dt = D72, hitchAt = () => 0, max = 20000 } = {}) {
  let t = 1000, k = 0;
  const flush = () => new Promise(r => setTimeout(r, 0));
  for (let i = 0; i < max && sc.active; i++) { t += dt + hitchAt(k++); sc.tick(t); await flush(); }
  return t;
}
const baseEnv = () => {
  const holder = makeHolder(), log = [];
  return { log, holder, ready: () => '', begin: () => { log.push('begin'); return () => log.push('restore'); }, info: () => ({ autoPct: 100 }),
    sectionSweep: { begin: () => { log.push('sec+'); return { set: u => log.push(u) }; }, end: () => log.push('sec-') },
    renderToggle: { begin: () => log.push('rt+'), set: on => log.push(on ? 'simple' : 'normal'), end: () => log.push('rt-') } };
};

describe('runner: built-in scenarios on a fake frame loop', () => {
  it('runs idle, rotate, section, rerender in order, restores state and reports one line each', async () => {
    const env = baseEnv(), changes = vi.fn(), sc = createVrSelfCheck({ env, getTargetHz: () => 72, meta: { build: '552' }, onChange: changes, log: () => {} });
    expect(sc.view().lines.at(-1).text).toContain('まだ実行していません');
    const p = sc.start(); expect(sc.active).toBe(true);
    await drive(sc); expect(await p).toBe(true);
    expect(sc.phase).toBe('done'); expect(sc.results.map(r => r.id)).toEqual(expect.arrayContaining(['idle', 'rotate', 'section', 'rerender']));
    expect(sc.results.every(r => r.verdict.pass)).toBe(true);
    expect(sc.results[0].stats.frames).toBeGreaterThan(300); expect(sc.results[0].stats.meanFps).toBeCloseTo(72, 1); // 5 s at 72 Hz, settle excluded
    expect(env.holder.rotations).toBeGreaterThan(300); expect(env.holder.quaternion.v).toBe(0); // rotated, then restored
    expect(env.log[0]).toBe('begin'); expect(env.log.at(-1)).toBe('restore'); expect(env.log).toContain('sec+'); expect(env.log).toContain('sec-'); expect(env.log).toContain('simple'); expect(env.log.indexOf('rt-')).toBeGreaterThan(env.log.indexOf('rt+'));
    const u = env.log.filter(x => typeof x === 'number'); expect(Math.min(...u)).toBeLessThan(-0.9); expect(Math.max(...u)).toBeGreaterThan(0.9); // the sweep covers the range
    const lines = sc.view().lines.map(l => l.text);
    expect(lines.filter(t => t.startsWith('✔ ')).length).toBe(sc.results.length + 1); // one per scenario + the overall line
    expect(lines.some(t => t.startsWith('✔ 基準 72.0fps（最低 72.0, 最大 14ms）'))).toBe(true);
    expect(changes).toHaveBeenCalled();
  });
  it('hitches during a scenario turn its line into ✖ and the overall verdict into 不合格', async () => {
    const env = baseEnv(), sc = createVrSelfCheck({ env, meta: { build: '552' }, log: () => {} });
    const p = sc.start(); await drive(sc, { hitchAt: k => (k % 25 === 0 ? 30 : 0) }); await p; // every 25th frame 30 ms late: ~4 %
    expect(sc.results.some(r => !r.verdict.pass)).toBe(true);
    const lines = sc.view().lines; expect(lines.some(l => l.text.startsWith('✖ ') && l.color === '#ff8a80')).toBe(true); expect(lines.some(l => l.text.includes('総合：不合格'))).toBe(true);
  });
  it('a missing hook skips the scenario (not counted), a missing volume refuses to start', async () => {
    const env = { ready: () => '', begin: () => () => {}, holder: makeHolder() }, sc = createVrSelfCheck({ env, log: () => {} });
    const p = sc.start(); await drive(sc); await p;
    expect(sc.results.find(r => r.id === 'section').skipped).toBeTruthy(); expect(sc.results.find(r => r.id === 'idle').verdict.pass).toBe(true);
    const sc2 = createVrSelfCheck({ env: { ready: () => 'ボリュームがありません' }, log: () => {} });
    expect(await sc2.start()).toBe(false); expect(sc2.active).toBe(false); expect(sc2.view().lines.at(-1).text).toBe('ボリュームがありません');
  });
  it('cancel in the middle unwinds the scenario (finally blocks run) and restores the state', async () => {
    const env = baseEnv(), sc = createVrSelfCheck({ env, log: () => {} });
    const p = sc.start(); let t = 1000;
    for (let i = 0; i < 100; i++) { t += D72; sc.tick(t); await new Promise(r => setTimeout(r, 0)); }
    sc.cancel(); await p; await new Promise(r => setTimeout(r, 0));
    expect(sc.phase).toBe('cancelled'); expect(env.log.at(-1)).toBe('restore'); expect(sc.view().lines.at(-1).text).toContain('中止しました');
    sc.tick(t + 20); // a late frame after the cancel is harmless
    expect(sc.view().buttonLabel).toBe('自己診断を始める');
  });
  it('toggle starts, and stops a running check; ticks without a measurement do nothing', async () => {
    const sc = createVrSelfCheck({ env: baseEnv(), log: () => {} }); sc.tick(1); sc.tick(NaN);
    sc.toggle(); expect(sc.active).toBe(true); expect(sc.view().buttonLabel).toBe('中止'); sc.toggle(); expect(sc.active).toBe(false);
    await new Promise(r => setTimeout(r, 0));
  });
  it('the last result is stored as JSON text (console / storage) and the target Hz comes from the session', async () => {
    const store = {}, logs = [], env = baseEnv(), sc = createVrSelfCheck({ env, getTargetHz: () => 90, storage: { setItem: (k, v) => { store[k] = v; } }, log: (...a) => logs.push(a.join(' ')) });
    const p = sc.start(); await drive(sc, { dt: 1000 / 90 }); await p;
    const j = JSON.parse(store['vrl-vr-selfcheck']); expect(j.targetHz).toBe(90); expect(j.verdict).toBe('PASS'); expect(j.scenarios[0].info).toEqual({ autoPct: 100 });
    expect(logs.some(l => l.includes('[VR self-check json]'))).toBe(true);
  });
});

describe('registerVrSelfCheck (extension API)', () => {
  it('a registered scenario runs after the built-ins with a usable ctx; the same id replaces; unregister removes', async () => {
    const seen = [], off = registerVrSelfCheck({ id: 'test-ext', label: '拡張', async run(ctx) {
      seen.push([ctx.hz, ctx.budgetMs > 0, !!ctx.env.histogram]); ctx.env.histogram.open();
      try { return await ctx.measure({ seconds: 1, settleMs: 100, onFrame: (t, f) => seen.push(f) }); } finally { ctx.env.histogram.close(); }
    } });
    const env = baseEnv(); env.log.length = 0; const calls = []; env.histogram = { open: () => calls.push('open'), close: () => calls.push('close') };
    const sc = createVrSelfCheck({ env, getTargetHz: () => 72, log: () => {} }), p = sc.start(); await drive(sc); await p;
    expect(listVrSelfChecks().at(-1)).toEqual({ id: 'test-ext', label: '拡張' });
    const r = sc.results.at(-1); expect(r.id).toBe('test-ext'); expect(r.stats.frames).toBeGreaterThan(60); expect(calls).toEqual(['open', 'close']); expect(seen[0]).toEqual([72, true, true]);
    expect(seen.at(-1)).toBeLessThanOrEqual(1);
    off(); expect(listVrSelfChecks().some(d => d.id === 'test-ext')).toBe(false);
    expect(() => registerVrSelfCheck({ id: 'bad' })).toThrow();
  });
  it('an error thrown by a scenario is one ✖ line, the others still run', async () => {
    const off = registerVrSelfCheck({ id: 'test-err', label: '壊れ', async run() { throw new Error('boom'); } });
    const sc = createVrSelfCheck({ env: baseEnv(), log: () => {} }), p = sc.start(); await drive(sc); await p; off();
    expect(sc.results.find(r => r.id === 'test-err').error).toBe('boom'); expect(sc.results.find(r => r.id === 'idle').verdict.pass).toBe(true);
    expect(sc.view().lines.some(l => l.text.startsWith('✖ 壊れ（エラー：boom）'))).toBe(true);
  });
});

describe('vr-view.js wiring (static)', () => {
  const src = readFileSync(new URL('../../docs/vr-view.js', import.meta.url), 'utf8');
  it('imports the module, feeds it the XR frame time, opens it from 詳細 and unwinds it on cleanup', () => {
    expect(src).toMatch(/from '\.\/vr-self-check\.js\?v=/);
    expect(src).toMatch(/renderer\.setAnimationLoop\(xrTs=>\{\s*selfCheck\.tick\(xrTs\)/);
    expect(src).toContain('selfCheckTexts(ja)'); expect(src).toContain('SC.button'); expect(src).toContain('ui.tab===8');
    expect(src).toMatch(/renderer\.setAnimationLoop\(null\);selfCheck\.dispose\(\)/);
  });
});

describe('result panel on leaving VR', () => {
  it('only a runner that finished a check shows the page panel (an old result is not shown again)', async () => {
    const shown = []; globalThis.document = { getElementById: () => null, createElement: () => { shown.push(1); throw new Error('stop'); } };
    try {
      const a = createVrSelfCheck({ env: baseEnv(), log: () => {} }), p = a.start(); await drive(a); await p;
      a.dispose(); expect(shown.length).toBe(1); // finished: the panel is built (the stub stops it)
      const b = createVrSelfCheck({ env: baseEnv(), log: () => {} }); b.dispose(); expect(shown.length).toBe(1); // never run in this session: nothing
    } finally { delete globalThis.document; }
  });
});
