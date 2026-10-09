// Per-segment HU histogram panel of the 3D view's analysis overlay (build 534, PC only; nothing here touches the GPU shaders or VR).
// - The voxels of a segment are its FINAL runs (getFinalSegmentRuns: filter-aware, post-processing, edits, voxel takers above).
//   A segment that is a plain HU range on unfiltered data needs no pass of its own: it is a slice of the whole-volume histogram.
// - The HU values are read slice by slice (getCachedSourceSlice on a source-backed volume; the array itself when it exists), so a
//   3.5 GB study is never copied. The pass yields to the UI by time, can be cancelled, restarts when the segment settings change
//   and reads every N-th slice first (a draft) on long volumes. Results: Uint32Array(4096) per segment (histogram.js), cached by
//   the segment cache key (segment-cache-key.js).
// - The HU range of every shown segment is a vertical line; dragging it moves the segment's min / max slider through the very
//   same events as the slider itself (input while moving, change on release), so the segment code runs exactly as for a slider.
import { volume, currentLanguage } from './state.js?v=20261009-build534';
import { segmentState, SEGMENT_PRESET_ORDER, segmentNeedsVoxelMask, segmentEditGen, segmentSourceSignature } from './segments.js?v=20261009-build534';
import { getFinalSegmentRuns } from './segment-runs.js?v=20261009-build534';
import { sourceFilterStages, sourceFilterSignature, getCachedSourceSlice } from './source-filters.js?v=20261009-build534';
import { segmentRunsCacheKey } from './segment-cache-key.js?v=20261009-build534';
import { setCtSliderRange, ctSliderFullBounds, segmentControl } from './segment-ui.js?v=20261009-build534';
import { tr } from './i18n.js?v=20261009-build534';
import { frameYield } from './utils.js?v=20261009-build534';
import { HIST_MIN, HIST_MAX, createHist, binValues, binRuns, scaleHist, histInRange, rebinHist, histExtent, histStats, voxelsToMm3, huToX, xToHu } from './histogram.js?v=20261009-build534';

const POLL_MS = 400, DRAFT_MIN_SLICES = 240, DRAFT_SLICES = 80, CACHE_MAX = 24, CHART_H = 150, PAD = { l: 34, r: 8, t: 14, b: 20 };
const st = {
  open: false, log: false, timer: 0, job: null, lastRun: '', lastDisp: '', doneSig: '', stopSig: '', message: '', lang: '',
  cur: {}, totals: new WeakMap(), runCache: new Map(), volIds: new WeakMap(), nextVolId: 1, drag: null, win: null, hover: null,
  el: null, canvas: null, table: null, progress: null, status: null, cancelBtn: null, logBtn: null, linBtn: null, hint: null
};

const volId = v => { let id = st.volIds.get(v); if (!id) { id = st.nextVolId++; st.volIds.set(v, id); } return id; };
const enabledKeys = () => SEGMENT_PRESET_ORDER.filter(k => segmentState[k].active && segmentState[k].enabled);
// does the segment need its final runs (post-processing / edits / takers above / filtered source), or is it a plain range of the raw data?
const needsRuns = (key, v) => segmentNeedsVoxelMask(key) || (!!v.sourceBacked && sourceFilterStages().length > 0);
const keySig = (key, v) => { const s = segmentState[key]; return [volId(v), sourceFilterSignature(sourceFilterStages()), key, s.min, s.max, s.opening, s.closing, s.minComponent, s.holeFill ? 1 : 0, s.surfaceMm, s.thicknessMm, segmentEditGen[key] | 0, segmentSourceSignature(key, true)].join(','); };
// what must be (re)computed: the run-based segments and whether the whole-volume histogram is needed
function runSignature(v) {
  const keys = enabledKeys(), runKeys = keys.filter(k => needsRuns(k, v)), needTotal = !keys.length || runKeys.length < keys.length;
  return volId(v) + '|' + (needTotal ? 'T' : '-') + '|' + runKeys.map(k => keySig(k, v)).join(';');
}
// what is drawn: every shown segment's range as well (cheap: a plain range is a slice of the total)
const displaySignature = v => runSignature(v) + '|' + enabledKeys().map(k => { const s = segmentState[k]; return [k, s.min, s.max, s.userMin, s.userMax, s.color].join(','); }).join(';') + '|' + st.log + '|' + currentLanguage + '|' + (st.job ? 1 : 0) + st.message;

function remember(ck, entry) {
  st.runCache.delete(ck); st.runCache.set(ck, entry);
  while (st.runCache.size > CACHE_MAX) st.runCache.delete(st.runCache.keys().next().value);
}
async function cacheKeyFor(v, key) {
  const seg = segmentState[key], extra = { hist: 1, vol: volId(v), gen: segmentEditGen[key] | 0, src: segmentSourceSignature(key, true) };
  try { return await segmentRunsCacheKey(v.series, sourceFilterSignature(sourceFilterStages()), seg, extra); } catch { return keySig(key, v); }
}

// ---- the pass ----
function setProgress(text, fraction) {
  if (!st.progress) return;
  st.progress.hidden = fraction == null;
  if (fraction != null) st.progress.value = fraction;
  if (st.status) st.status.textContent = text || '';
}
async function streamPass(job, v, runs, todo, wantTotal, step, label) {
  const n = v.slices, plane = v.columns * v.rows, w = v.columns;
  const total = wantTotal ? createHist() : null, hists = todo.map(() => createHist());
  const mem = v.data && v.data.length >= plane * n ? v.data : null;
  let last = performance.now(), sampled = 0;
  for (let z = 0; z < n; z += step) {
    if (job.cancelled) return null;
    const values = mem ? mem.subarray(z * plane, (z + 1) * plane) : await getCachedSourceSlice(v.series.slices[z]);
    if (job.cancelled) return null;
    if (total) binValues(total, values);
    for (let i = 0; i < todo.length; i++) binRuns(hists[i], values, runs[todo[i]]?.[z], w);
    sampled++;
    if (performance.now() - last > 30) { setProgress(label + ' ' + Math.round(100 * z / n) + '%', z / n); await frameYield(); last = performance.now(); }
  }
  const k = sampled ? n / sampled : 1;
  return { total: total && (k === 1 ? total : scaleHist(total, k)), hists: hists.map(h => (k === 1 ? h : scaleHist(h, k))), draft: step > 1 };
}
async function runJob(sig) {
  const v = volume;
  if (!v || st.job) return;
  const job = { sig, cancelled: false };
  st.job = job; st.message = '';
  try {
    const keys = enabledKeys(), runKeys = keys.filter(k => needsRuns(k, v));
    const cks = await Promise.all(runKeys.map(k => cacheKeyFor(v, k)));
    runKeys.forEach((k, i) => { st.cur[k] = { ks: keySig(k, v), ck: cks[i] }; });
    const todo = runKeys.filter((k, i) => { const c = st.runCache.get(cks[i]); return !c || c.draft; });
    const tot = st.totals.get(v), wantTotal = (!keys.length || runKeys.length < keys.length) && (!tot || tot.draft);
    const finish = () => { if (job.cancelled) return false; st.doneSig = sig; return true; };
    if (!todo.length && !wantTotal) { finish(); return; }
    const runs = {};
    for (const k of todo) {
      setProgress(tr('segHistPrepare') + ': ' + (tr(k) || k), 0);
      runs[k] = await getFinalSegmentRuns(k, v, (d, t) => { if (!job.cancelled) setProgress(tr('segHistPrepare') + ': ' + (tr(k) || k) + ' ' + Math.round(100 * d / Math.max(1, t)) + '%', d / Math.max(1, t)); });
      if (job.cancelled) return;
    }
    const steps = v.slices >= DRAFT_MIN_SLICES ? [Math.ceil(v.slices / DRAFT_SLICES), 1] : [1];
    for (const step of steps) {
      const r = await streamPass(job, v, runs, todo, wantTotal, step, step > 1 ? tr('segHistDraft') : tr('segHistReading'));
      if (!r) return;
      if (r.total) st.totals.set(v, { hist: r.total, draft: r.draft });
      todo.forEach((k, i) => remember(st.cur[k].ck, { hist: r.hists[i], draft: r.draft }));
      draw(true);
    }
    finish();
  } catch (e) {
    if (!job.cancelled) { st.stopSig = sig; st.message = String(e?.message || e) === '__SUPERSEDED__' ? '' : tr('segHistError') + ': ' + String(e?.message || e); }
  } finally {
    if (st.job === job) st.job = null;
    setProgress('', null); draw(true);
  }
}
function cancelJob(userAsked) {
  const job = st.job;
  if (!job) return;
  job.cancelled = true; st.job = null;
  if (userAsked) { st.stopSig = job.sig; st.message = tr('segHistCancelled'); }
  setProgress('', null); draw(true);
}

// ---- results as drawn ----
function resultsFor(v) {
  const out = [], tot = st.totals.get(v);
  for (const key of enabledKeys()) {
    const seg = segmentState[key];
    let hist = null, draft = false;
    if (needsRuns(key, v)) { const c = st.cur[key], e = c && c.ks === keySig(key, v) ? st.runCache.get(c.ck) : null; if (e) { hist = e.hist; draft = e.draft; } }
    else if (tot) { hist = histInRange(tot.hist, seg.min, seg.max); draft = tot.draft; }
    out.push({ key, seg, hist, draft, stats: hist ? histStats(hist) : null });
  }
  return { list: out, total: tot || null };
}

// ---- chart ----
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
function niceStep(span, maxTicks) {
  for (const s of [10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000]) if (span / s <= maxTicks) return s;
  return 2000;
}
function chartWindow(res) {
  if (st.drag && st.win) return st.win;
  let lo = Infinity, hi = -Infinity;
  const add = (a, b) => { if (a < lo) lo = a; if (b > hi) hi = b; };
  for (const r of res.list) {
    const e = r.hist && histExtent(r.hist); if (e) add(e[0], e[1]);
    add(r.seg.userMin ?? r.seg.min, r.seg.userMax ?? r.seg.max);
  }
  if (res.total) { const e = histExtent(res.total.hist); if (e) add(e[0], e[1]); }
  if (!(hi > lo)) { lo = -200; hi = 400; }
  lo = clamp(lo, HIST_MIN, HIST_MAX); hi = clamp(hi, HIST_MIN, HIST_MAX);
  const pad = Math.max(10, (hi - lo) * 0.04);
  lo = Math.max(HIST_MIN, Math.floor(lo - pad)); hi = Math.min(HIST_MAX, Math.ceil(hi + pad));
  if (hi - lo < 50) hi = lo + 50;
  return (st.win = [lo, hi]);
}
function plotRect(canvas) { return { x: PAD.l, y: PAD.t, w: Math.max(10, canvas.clientWidth - PAD.l - PAD.r), h: CHART_H - PAD.t - PAD.b }; }
function drawChart(res) {
  const canvas = st.canvas;
  if (!canvas || !canvas.clientWidth) return;
  const dpr = globalThis.devicePixelRatio || 1, W = canvas.clientWidth;
  if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(CHART_H * dpr)) { canvas.width = Math.round(W * dpr); canvas.height = Math.round(CHART_H * dpr); }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, CHART_H);
  const fg = getComputedStyle(canvas).color || '#888', r = plotRect(canvas), [lo, hi] = chartWindow(res);
  ctx.font = '9px system-ui,sans-serif'; ctx.textBaseline = 'middle';
  const series = res.list.filter(s => s.hist);
  if (!res.list.length && res.total) series.push({ key: 'all', seg: { color: '#8c969c' }, hist: res.total.hist });
  const cols = Math.max(1, Math.min(Math.round(hi - lo + 1), Math.floor(r.w / 2)));
  const bars = series.map(s => rebinHist(s.hist, lo, hi, cols));
  let ymax = 1; for (const b of bars) for (const c of b) if (c > ymax) ymax = c;
  const yOf = c => (st.log ? Math.log10(1 + c) / Math.log10(1 + ymax) : c / ymax);
  // axes
  ctx.globalAlpha = 0.35; ctx.strokeStyle = fg; ctx.fillStyle = fg; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(r.x, r.y); ctx.lineTo(r.x, r.y + r.h); ctx.lineTo(r.x + r.w, r.y + r.h); ctx.stroke();
  ctx.globalAlpha = 0.8; ctx.textAlign = 'center';
  const step = niceStep(hi - lo, Math.max(3, Math.floor(r.w / 48)));
  for (let hu = Math.ceil(lo / step) * step; hu <= hi; hu += step) {
    const x = r.x + huToX(hu, lo, hi, r.w);
    ctx.globalAlpha = 0.18; ctx.beginPath(); ctx.moveTo(x, r.y); ctx.lineTo(x, r.y + r.h); ctx.stroke();
    ctx.globalAlpha = 0.8; ctx.fillText(String(hu), x, r.y + r.h + 10);
  }
  ctx.textAlign = 'right'; ctx.fillText(ymax >= 1e6 ? (ymax / 1e6).toFixed(1) + 'M' : ymax >= 1e3 ? Math.round(ymax / 1e3) + 'k' : String(ymax), r.x - 3, r.y + 4);
  ctx.fillText('0', r.x - 3, r.y + r.h);
  // bars (overlay, one colour per segment)
  const bw = r.w / cols;
  bars.forEach((b, i) => {
    ctx.fillStyle = series[i].seg.color; ctx.globalAlpha = series.length > 1 ? 0.55 : 0.75;
    for (let c = 0; c < cols; c++) { if (!b[c]) continue; const h = Math.max(1, yOf(b[c]) * r.h); ctx.fillRect(r.x + c * bw, r.y + r.h - h, Math.max(1, bw - 0.3), h); }
  });
  // HU range lines (draggable)
  ctx.globalAlpha = 1; ctx.lineWidth = 1.5;
  for (const s of res.list) {
    const a = s.seg.userMin ?? s.seg.min, b = s.seg.userMax ?? s.seg.max;
    for (const [hu, side] of [[a, 1], [b, -1]]) {
      if (hu < lo || hu > hi) continue;
      const x = r.x + huToX(hu, lo, hi, r.w);
      ctx.strokeStyle = s.seg.color; ctx.fillStyle = s.seg.color;
      ctx.beginPath(); ctx.moveTo(x, r.y - 2); ctx.lineTo(x, r.y + r.h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, r.y - 2); ctx.lineTo(x + 4 * side, r.y - 2); ctx.lineTo(x, r.y + 3); ctx.fill();
      ctx.fillStyle = fg; ctx.textAlign = side > 0 ? 'left' : 'right'; ctx.fillText(String(Math.round(hu)), x + 5 * side, r.y - 5 + 0);
    }
  }
  ctx.globalAlpha = 1;
}

// ---- table ----
const fmt = (x, d = 1) => (x == null ? '—' : x.toFixed(d));
function drawTable(res, v) {
  const t = st.table; if (!t) return;
  const sp = v?.spacing, head = [tr('statSegment'), tr('statCount'), sp ? tr('statVolume') : null, tr('statMean'), 'SD', 'p5', 'p25', 'p50', 'p75', 'p95', tr('statMin'), tr('statMax')].filter(Boolean);
  const rows = res.list.map(s => ({ name: tr(s.key) || s.key, color: s.seg.color, stats: s.stats, draft: s.draft }));
  if (!rows.length && res.total) rows.push({ name: tr('segHistWhole'), color: '#8c969c', stats: histStats(res.total.hist), draft: res.total.draft });
  const table = document.createElement('table'); table.className = 'seg-hist-table';
  const tr0 = table.createTHead().insertRow(); for (const h of head) { const th = document.createElement('th'); th.textContent = h; tr0.append(th); }
  const body = table.createTBody();
  for (const row of rows) {
    const tr1 = body.insertRow(), s = row.stats, cells = [];
    const name = tr1.insertCell(); const sw = document.createElement('span'); sw.className = 'seg-hist-swatch'; sw.style.background = row.color;
    name.append(sw, document.createTextNode(row.name + (row.draft ? ' *' : '')));
    if (!s) { const c = tr1.insertCell(); c.colSpan = head.length - 1; c.textContent = '…'; continue; }
    cells.push(s.count.toLocaleString());
    if (sp) { const mm3 = voxelsToMm3(s.count, sp); cells.push(mm3 == null ? '—' : mm3.toLocaleString(undefined, { maximumFractionDigits: 1 })); }
    cells.push(fmt(s.mean), fmt(s.sd), ...[5, 25, 50, 75, 95].map(p => fmt(s.percentiles[p], 0)), fmt(s.min, 0), fmt(s.max, 0));
    for (const c of cells) tr1.insertCell().textContent = c;
  }
  t.replaceChildren(table);
}
function draw(force = false) {
  if (!st.open || !st.el) return;
  const v = volume;
  if (!v) { st.table?.replaceChildren(); return; }
  if (!force && !st.canvas?.clientWidth) return;
  const res = resultsFor(v);
  drawChart(res); drawTable(res, v);
  if (st.status && !st.job) st.status.textContent = st.message || (enabledKeys().length ? '' : tr('segHistNoSeg'));
  if (st.cancelBtn) { st.cancelBtn.textContent = st.job ? tr('segHistCancel') : tr('segHistRecalc'); st.cancelBtn.disabled = !st.job && !enabledKeysNeedWork(v); }
  st.logBtn?.classList.toggle('is-active', st.log); st.linBtn?.classList.toggle('is-active', !st.log);
}
// "Recalculate" is offered when a pass was cancelled / failed for the current settings
const enabledKeysNeedWork = v => st.doneSig !== runSignature(v);

// ---- dragging the range lines ----
function setSlider(key, which, hu) {
  const el = segmentControl(which, key); if (!el) return;
  const step = +el.step || 1, full = ctSliderFullBounds(el);
  let val = Math.round(hu / step) * step;
  if (full) val = clamp(val, full[0], full[1]);
  if (val < +el.min || val > +el.max) setCtSliderRange(el, Math.min(val, +el.min), Math.max(val, +el.max), step);
  el.value = String(val);
  el.dispatchEvent(new Event('input', { bubbles: true })); // the slider's own handler (user range, effective ranges, previews)
}
function hitLine(e) {
  const v = volume; if (!v || !st.canvas) return null;
  const res = resultsFor(v), r = plotRect(st.canvas), [lo, hi] = chartWindow(res), box = st.canvas.getBoundingClientRect(), x = e.clientX - box.left;
  let best = null, bd = 9;
  for (const s of res.list) for (const which of ['min', 'max']) {
    const hu = which === 'min' ? (s.seg.userMin ?? s.seg.min) : (s.seg.userMax ?? s.seg.max), d = Math.abs(r.x + huToX(hu, lo, hi, r.w) - x);
    if (d < bd) { bd = d; best = { key: s.key, which }; }
  }
  return best;
}
function installDrag(canvas) {
  canvas.style.touchAction = 'none';
  canvas.addEventListener('pointerdown', e => {
    const hit = hitLine(e); if (!hit) return;
    const v = volume; st.drag = hit; st.win = chartWindow(resultsFor(v)); canvas.setPointerCapture?.(e.pointerId); e.preventDefault();
  });
  canvas.addEventListener('pointermove', e => {
    if (!st.drag) { canvas.style.cursor = hitLine(e) ? 'ew-resize' : ''; return; }
    const r = plotRect(canvas), [lo, hi] = st.win, box = canvas.getBoundingClientRect();
    setSlider(st.drag.key, st.drag.which, xToHu(e.clientX - box.left - r.x, lo, hi, r.w));
    draw(true);
  });
  const end = e => {
    if (!st.drag) return;
    const { key, which } = st.drag; st.drag = null; canvas.releasePointerCapture?.(e.pointerId);
    segmentControl(which, key)?.dispatchEvent(new Event('change', { bubbles: true })); // on release, like the slider
    st.win = null; draw(true);
  };
  canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
}

// ---- panel ----
function build() {
  const box = st.el, mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const bar = mk('div', 'seg-hist-bar'), title = mk('strong', '', tr('segHistTitle'));
  st.linBtn = mk('button', 'seg-hist-mini', tr('segHistLinear')); st.logBtn = mk('button', 'seg-hist-mini', tr('segHistLog'));
  for (const b of [st.linBtn, st.logBtn]) b.type = 'button';
  st.linBtn.onclick = () => { st.log = false; draw(true); }; st.logBtn.onclick = () => { st.log = true; draw(true); };
  bar.append(title, st.linBtn, st.logBtn);
  st.canvas = mk('canvas', 'seg-hist-canvas'); st.canvas.style.height = CHART_H + 'px'; installDrag(st.canvas);
  const prog = mk('div', 'seg-hist-progress');
  st.progress = document.createElement('progress'); st.progress.max = 1; st.progress.value = 0; st.progress.hidden = true;
  st.status = mk('span', 'seg-hist-status'); st.cancelBtn = mk('button', 'seg-hist-mini', tr('segHistRecalc')); st.cancelBtn.type = 'button';
  st.cancelBtn.onclick = () => { if (st.job) cancelJob(true); else { st.stopSig = ''; st.message = ''; st.lastRun = ''; tick(true); } };
  prog.append(st.progress, st.status, st.cancelBtn);
  st.table = mk('div', 'seg-hist-tablewrap'); st.hint = mk('div', 'seg-hist-hint', tr('segHistHint'));
  box.replaceChildren(bar, st.canvas, prog, st.table, st.hint);
  st.lang = currentLanguage;
}
function tick(force = false) {
  const v = volume;
  if (!st.open || !v) { if (st.job && !v) cancelJob(false); return; }
  if (st.lang !== currentLanguage) { build(); draw(true); }
  const run = runSignature(v), disp = displaySignature(v);
  if (disp !== st.lastDisp) { st.lastDisp = disp; draw(true); }
  if (run !== st.lastRun) {
    // the settings moved: stop the pass now, restart once they are stable (the next tick sees the same signature)
    st.lastRun = run; if (st.job && st.job.sig !== run) cancelJob(false); if (st.stopSig !== run) st.stopSig = ''; if (!force) return;
  }
  if (!st.job && run !== st.doneSig && run !== st.stopSig) void runJob(run);
}
function setOpen(on, btn) {
  st.open = !!on; st.el.classList.toggle('is-hidden', !st.open); btn.classList.toggle('is-active', st.open);
  clearInterval(st.timer); st.timer = 0;
  if (st.open) { build(); st.lastRun = ''; st.lastDisp = ''; st.timer = setInterval(tick, POLL_MS); tick(true); requestAnimationFrame(() => draw(true)); }
  else cancelJob(false);
}
export function installSegmentHistogram() {
  const btn = document.getElementById('seg-hist-toggle'), box = document.getElementById('seg-hist-result');
  if (!btn || !box) return;
  st.el = box;
  btn.onclick = () => { if (volume) setOpen(!st.open, btn); };
  // the sliders move the lines (and the other way round): redraw after the slider's own handler ran
  const follow = e => { if (st.open && e.target?.matches?.('[data-seg-min],[data-seg-max]')) requestAnimationFrame(() => draw(true)); };
  document.addEventListener('input', follow, true); document.addEventListener('change', follow, true);
  addEventListener('resize', () => draw(true));
  document.addEventListener('vrl-themechange', () => draw(true));
  setInterval(() => { btn.disabled = !volume; if (!volume && st.open) setOpen(false, btn); }, 1000);
}
