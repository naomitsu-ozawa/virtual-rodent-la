// VR self-check (build 552): one button in the headset runs automated scenarios (about 5 s each) and shows PASS / FAIL with numbers,
// so nobody has to watch the fps readout. Frame intervals come from the XR frame timestamps (the argument of the animation loop
// callback), are kept in a preallocated ring buffer and judged by vr-self-check-core.js (p5 fps >= 0.9 x target, frames over 1.5 x budget <= 2 %).
// This file has no three.js import and no DOM except the after-the-session panel (showSelfCheckPanel), so it runs under node with a fake frame loop.
//
// ---- registering a scenario (other features: VR histogram panel, VR HU line, ...) ----
//   (in your module, with the build tag the other imports carry:) registerVrSelfCheck from the vr-self-check module, then call
//   registerVrSelfCheck({
//     id: 'histogram',                // unique; registering the same id again replaces it (module reload safe)
//     label: 'ヒストグラム',          // the name on the result line (short: the VR panel is narrow)
//     async run(ctx) {                // called once per self-check run, in registration order; always restore what you changed (try / finally)
//       const h = ctx.env.histogram;  // ctx.env = what the VR view offers; a feature adds its own hooks there: selfCheck.env.histogram = {...}
//       if (!h) return ctx.skip('パネルなし');          // not available -> shown as "－ …（実施せず）", not counted
//       h.open();
//       try {
//         return await ctx.measure({ seconds: 5, settleMs: 800, onFrame: (tSec, frac) => { ... } }); // -> stats; onFrame runs every frame before drawing
//       } finally { h.close(); }
//     },
//   });
//   ctx: { hz, budgetMs, ja, env, measure(opts), skip(reason), note(text), cancelled() }. measure() resolves with the stats after settleMs + seconds of frames
//   (settle frames are not counted). Return the stats (or nothing: the last measure() is used). A throw = "✖ …（エラー）". Cancelling (the button, or leaving VR)
//   makes the pending measure() throw so that your finally blocks run.
// The runner is created once per VR session (createVrSelfCheck, vr-view.js); registrations are module level, so a feature registers at import time.
import { DEFAULT_HZ, createFrameRing, computeStats, judge, formatLine, verdictLine, criteriaText, resultText, resultJson, overall, PASS_MARK, FAIL_MARK } from './vr-self-check-core.js?v=20261010-build552';

export { PASS_MARK, FAIL_MARK };
export const SCENARIO_SECONDS = 5, SETTLE_MS = 800;
const CANCEL = Symbol('vr-self-check-cancel');

const registry = new Map();
export function registerVrSelfCheck(def) {
  if (!def || typeof def.id !== 'string' || !def.id || typeof def.run !== 'function') throw new TypeError('registerVrSelfCheck: {id, label, run} required');
  registry.set(def.id, { id: def.id, label: def.label || def.id, run: def.run });
  return () => { if (registry.get(def.id)?.run === def.run) registry.delete(def.id); };
}
export const listVrSelfChecks = () => [...registry.values()].map(d => ({ id: d.id, label: d.label }));

// ---- built-in scenarios (env hooks are optional: a missing one = skipped) ----
registerVrSelfCheck({ id: 'idle', label: '基準', async run(ctx) { return ctx.measure({}); } });
registerVrSelfCheck({
  id: 'rotate', label: '回転',
  async run(ctx) {
    const h = ctx.env.holder; if (!h) return ctx.skip('ボリュームなし');
    const q0 = h.quaternion.clone();
    try { return await ctx.measure({ onFrame: t => { h.quaternion.copy(q0); h.rotateY(0.5 * t); } }); } finally { h.quaternion.copy(q0); }
  },
});
registerVrSelfCheck({
  id: 'section', label: '断面',
  async run(ctx) {
    const sw = ctx.env.sectionSweep, s = sw?.begin(); if (!s) return ctx.skip('断面を出せません');
    try { return await ctx.measure({ onFrame: t => s.set(Math.sin(2 * Math.PI * 0.4 * t)) }); } finally { sw.end(); } // set(u): u in -1..1 across the volume
  },
});
registerVrSelfCheck({
  id: 'rerender', label: '再描画',
  async run(ctx) {
    const rt = ctx.env.renderToggle; if (!rt) return ctx.skip('表示切替なし');
    rt.begin(); let last = -1;
    try { return await ctx.measure({ onFrame: t => { const k = Math.floor(t / 0.25); if (k !== last) { last = k; rt.set(k % 2 === 1); } } }); } finally { rt.end(); } // render mode normal <-> simple every 0.25 s
  },
});

let lastResult = null;
export const lastVrSelfCheckResult = () => lastResult;

// ja texts of the VR page (kept here so that vr-view.js has no new language strings)
export function selfCheckTexts(ja = true) {
  return ja ? { button: '自己診断（約 25 秒）', title: 'VR 自己診断', run: '自己診断を始める', stop: '中止', hint: ['ボタンを押すとボリュームが正面に出て、自動で回転・断面・再描画を試します。', '測定中はコントローラに触れず、ヘッドセットを動かさないでください。'], running: '測定中 ', done: '終わりました。この画面の数字を伝えるか、VR 終了後に出る「コピー」で貼り付けてください', cancelled: '中止しました（元の状態に戻しました）', none: 'まだ実行していません', copy: 'コピー', close: '閉じる', save: '保存（JSON）', summary: 'VR 自己診断' }
    : { button: 'Self-check (about 25 s)', title: 'VR self-check', run: 'Start self-check', stop: 'Stop', hint: ['Brings the volume in front and tries rotation, a section sweep and re-rendering automatically.', 'Do not touch the controllers or move around while it runs.'], running: 'Running ', done: 'Done. Read the numbers here, or use Copy after leaving VR', cancelled: 'Cancelled (state restored)', none: 'Not run yet', copy: 'Copy', close: 'Close', save: 'Save (JSON)', summary: 'VR self-check' };
}

// env: { ready()->''|reason, begin()->restore fn, info()->{...}, holder, sectionSweep, renderToggle, ...features' hooks }
export function createVrSelfCheck({ ja = true, getTargetHz = () => DEFAULT_HZ, env = {}, meta = {}, onChange = () => {}, now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now()), log = console.log, storage = null } = {}) {
  const T = selfCheckTexts(ja), ring = createFrameRing();
  let produced = false, phase = 'idle', cur = null, results = [], m = null, runId = 0, note = '', head = '', hz = DEFAULT_HZ;
  const safe = (fn, what) => { try { return fn(); } catch (e) { log('[VR self-check]', what, e); return undefined; } };
  const changed = () => safe(onChange, 'onChange');

  // the frame hook: called once per XR frame at the START of the animation loop (before the scene is drawn); ts = the XR frame time (ms)
  function tick(ts) {
    if (!m) return;
    const t = Number.isFinite(ts) ? ts : now();
    if (m.t0 === null) m.t0 = t;
    const el = t - m.t0;
    if (m.onFrame && !m.failed) { try { m.onFrame(Math.max(0, el - m.settle) / 1000, Math.min(1, Math.max(0, (el - m.settle) / m.durMs))); } catch (e) { m.failed = e; } }
    if (el >= m.settle && m.prev !== null) ring.push(t - m.prev);
    m.prev = t;
    if (m.failed || el >= m.settle + m.durMs) { const x = m; m = null; if (x.failed) x.reject(x.failed); else x.resolve(computeStats(ring.copy(), hz)); }
  }

  function measure(opts = {}) {
    if (m) return Promise.reject(new Error('measure already running'));
    if (cancelRequested()) return Promise.reject(CANCEL);
    ring.reset();
    return new Promise((resolve, reject) => { m = { t0: null, prev: null, settle: opts.settleMs ?? SETTLE_MS, durMs: (opts.seconds ?? SCENARIO_SECONDS) * 1000, onFrame: opts.onFrame || null, failed: null, resolve, reject }; });
  }
  const cancelRequested = () => phase !== 'running';

  async function start() {
    if (phase === 'running') return false;
    const why = safe(() => env.ready?.(), 'ready');
    if (why) { phase = 'idle'; note = why; changed(); return false; }
    const id = ++runId, defs = [...registry.values()];
    phase = 'running'; results = []; note = ''; hz = Math.round(safe(getTargetHz, 'hz') || DEFAULT_HZ);
    head = T.summary + ' build ' + (meta.build ?? '?') + ' · ' + hz + ' Hz';
    let restore; try { restore = env.begin?.(); } catch (e) { log('[VR self-check] begin', e); }
    changed();
    try {
      for (let i = 0; i < defs.length; i++) {
        if (id !== runId || phase !== 'running') break;
        const d = defs[i]; cur = { id: d.id, label: d.label, n: i + 1, of: defs.length }; changed();
        const r = { id: d.id, label: d.label }; let lastStats = null, skipMark = null, sNote = '';
        const ctx = { hz, budgetMs: 1000 / hz, ja, env, skip: reason => (skipMark = { skip: String(reason) }), note: t => { sNote = String(t); }, cancelled: cancelRequested,
          measure: o => measure(o).then(s => { lastStats = s; r.info = safe(() => env.info?.(), 'info') || undefined; return s; }) };
        try {
          const ret = await d.run(ctx);
          if (id !== runId || phase !== 'running') break;
          if (skipMark || (ret && ret.skip)) r.skipped = (skipMark || ret).skip;
          else { const s = ret && typeof ret.frames === 'number' ? ret : lastStats; if (s) { r.stats = s; r.verdict = judge(s); } else r.error = 'no measurement'; }
        } catch (e) {
          if (e === CANCEL || phase !== 'running') break;
          r.error = String(e && e.message || e).slice(0, 80); log('[VR self-check]', d.id, e);
        }
        if (sNote) r.note = sNote;
        results.push(r); changed();
      }
    } finally {
      m = null; cur = null; safe(() => restore?.(), 'restore');
    }
    if (id !== runId) return false;
    if (phase === 'running') finish(); else { phase = 'cancelled'; changed(); }
    return phase === 'done';
  }

  function finish() {
    phase = 'done'; produced = true;
    const res = { head, build: meta.build, when: new Date().toISOString(), hz, info: safe(() => env.info?.(), 'info') || null, results };
    lastResult = { ...res, text: resultText(res, ja), json: resultJson(res) };
    log('[VR self-check]', lastResult.text); log('[VR self-check json]', JSON.stringify(lastResult.json));
    if (storage) safe(() => storage.setItem('vrl-vr-selfcheck', JSON.stringify(lastResult.json)), 'storage');
    changed();
  }

  function cancel() {
    if (phase !== 'running') return;
    phase = 'cancelled'; const x = m; m = null; x?.reject(CANCEL); changed();
  }
  const toggle = () => { if (phase === 'running') cancel(); else start(); };
  // leaving VR: unwind a running scenario (its finally blocks restore state) and show the result panel on the page
  function dispose() { cancel(); runId++; if (produced && lastResult) safe(() => showSelfCheckPanel(ja), 'panel'); }

  // what the VR page draws: { title, lines:[{text,color}], buttonLabel, running }
  function view() {
    const lines = T.hint.map(text => ({ text, color: '#9fb3c3' }));
    lines.push({ text: criteriaText(hz || DEFAULT_HZ, ja), color: '#9fb3c3' });
    if (phase === 'running' && cur) lines.push({ text: T.running + cur.n + ' / ' + cur.of + ' ' + cur.label, color: '#ffd27a' });
    for (const r of results) lines.push({ text: formatLine(r, ja), color: r.skipped ? '#9fb3c3' : r.error || !r.verdict.pass ? '#ff8a80' : '#8de08d' });
    if (phase === 'done') { const o = overall(results); lines.push({ text: verdictLine(results, ja), color: o.pass ? '#8de08d' : '#ff8a80' }); lines.push({ text: T.done, color: '#9fb3c3' }); }
    else if (phase === 'cancelled') lines.push({ text: T.cancelled, color: '#ffd27a' });
    else if (phase === 'idle') lines.push({ text: note || T.none, color: note ? '#ffd27a' : '#9fb3c3' });
    return { title: T.title, lines, buttonLabel: phase === 'running' ? T.stop : T.run, running: phase === 'running' };
  }

  return { tick, start, cancel, toggle, dispose, view, env, get active() { return phase === 'running'; }, get phase() { return phase; }, get results() { return results; }, get measuring() { return !!m; } };
}

// after the session: the same kind of panel as the benchmark's (copy button), plus a JSON download. DOM only here.
export function showSelfCheckPanel(ja = true) {
  if (!lastResult || typeof document === 'undefined') return;
  const T = selfCheckTexts(ja);
  document.getElementById('vr-selfcheck-panel')?.remove();
  const panel = document.createElement('div'); panel.id = 'vr-selfcheck-panel';
  Object.assign(panel.style, { position: 'fixed', left: '16px', top: '16px', zIndex: '9999', background: '#111d', backdropFilter: 'blur(6px)', color: '#fff', padding: '12px', borderRadius: '12px', maxWidth: 'min(92vw,640px)', font: '14px system-ui,sans-serif' });
  const pre = document.createElement('pre'); pre.style.cssText = 'margin:0 0 8px;white-space:pre-wrap;font:13px ui-monospace,monospace'; pre.textContent = lastResult.text; panel.append(pre);
  const row = document.createElement('div'); row.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap';
  const full = lastResult.text + '\n' + JSON.stringify(lastResult.json);
  const copy = document.createElement('button'); copy.type = 'button'; copy.textContent = T.copy; copy.onclick = () => { navigator.clipboard?.writeText(full).catch(() => {}); };
  const save = document.createElement('a'); save.textContent = T.save; save.download = 'vr-self-check.json'; save.href = 'data:application/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(lastResult.json, null, 1)); save.style.cssText = 'color:#9cf;align-self:center';
  const close = document.createElement('button'); close.type = 'button'; close.textContent = T.close; close.onclick = () => panel.remove();
  row.append(copy, save, close); panel.append(row); document.body.append(panel);
}
