// Analysis presets UI: applies a preset (source filters + CT window + segment HU ranges) through the existing setters and
// shows which preset is active / modified. The values and the pure logic live in analysis-presets.js; nothing here adds a
// second way of changing a filter or a range: filters go through applyFilterOrder (shared with the project file), the CT
// window and the segment ranges through setControlValue (the same input / change events a slider drag sends).
import { $, wc, ww, footer } from './ui-shell.js?v=20261010-build553';
import { volume, sourceVolume, activeId, activeSeries, ctRangeMode, ctRangeProfile, currentLanguage } from './state.js?v=20261010-build553';
import { decodeSourceSlice } from './volume-io.js?v=20261010-build553';
import { createWideHist, addWideValues, estimateHuScale, calibrateSnapshot } from './hu-calibration.js?v=20261010-build553';
import { tr } from './i18n.js?v=20261010-build553';
import { SEGMENT_PRESET_ORDER, segmentState, commitExclusiveRanges } from './segments.js?v=20261010-build553';
import { addSegmentPreset, applyCtRangeMode, segmentControl, setControlValue, updateSegmentOutputs } from './segment-ui.js?v=20261010-build553';
import { gatherFilterOrder, applyFilterOrder } from './data-load.js?v=20261010-build553';
import {
  BUILTIN_PRESETS, builtinPresetById, builtinPresetName, normalizeSnapshot, isModified, saveUserPreset, renameUserPreset,
  deleteUserPreset, serializeUserPresets, parseUserPresets, mergeImportedPresets, loadUserPresets, persistUserPresets, cleanPresetName,
} from './analysis-presets.js?v=20261010-build553';

// ---- HU scale of the loaded series (build 550) ------------------------------------------------------------------------
// Built-in presets are written on the rat practice scan's scale and mapped to the loaded scan through its air and soft-tissue
// peaks (hu-calibration.js). The peaks come from a sparse sample of the source slices (24 slices spread over the series,
// every 2nd pixel of every 2nd row: about 1.6 M values for 512 x 512), read from the DICOM source the same way for in-memory
// and source-backed series, so it works while volume.data is null. One estimate per series object (a reload is a new one);
// the work yields to the UI every 4 slices.
const SCALE_SLICES = 24, SCALE_STRIDE = 2;
const scaleCache = new WeakMap();
export function estimateSeriesScale(series) {
  if (!series?.slices?.length) return Promise.resolve({ ok: false, reason: 'no-data' });
  let p = scaleCache.get(series);
  if (!p) {
    p = (async () => {
      const hist = createWideHist(), d = series.slices.length, n = Math.min(SCALE_SLICES, d);
      for (let j = 0; j < n; j++) {
        const meta = series.slices[Math.min(d - 1, Math.floor((j + 0.5) * d / n))];
        const values = await decodeSourceSlice(meta), w = meta.columns, h = meta.rows;
        for (let y = 0; y < h; y += SCALE_STRIDE) addWideValues(hist, values, y * w, y * w + w, SCALE_STRIDE);
        if (j % 4 === 3) await new Promise(r => setTimeout(r, 0));
      }
      return estimateHuScale(hist);
    })().catch(error => { console.warn('HU scale estimate failed:', error); return { ok: false, reason: 'read' }; });
    scaleCache.set(series, p);
  }
  return p;
}

const store = () => { try { return window.localStorage; } catch { return null; } };

// The current state as a snapshot (what a user preset saves, and what the modified check compares).
export function captureSettings() {
  const segments = {};
  for (const key of SEGMENT_PRESET_ORDER) {
    const s = segmentState[key];
    if (s?.active) segments[key] = { min: s.userMin ?? s.min, max: s.userMax ?? s.max };
  }
  return normalizeSnapshot({ filters: gatherFilterOrder(), display: { windowCenter: wc.value, windowWidth: ww.value }, segments });
}

// Applies a snapshot. Returns false when no data is loaded. The CT sliders are widened to the data's full range while the
// values are set (a preset window can lie outside the current Auto track), then the previous mode is restored: Auto
// re-centres on the new values, as it does after a load.
export function applySettings(snap) {
  if (!snap || !volume || !sourceVolume || !ctRangeProfile) return false;
  const mode = ctRangeMode;
  applyCtRangeMode('full');
  applyFilterOrder(snap.filters);
  if (snap.display) { setControlValue(wc, snap.display.windowCenter); setControlValue(ww, snap.display.windowWidth); }
  for (const [key, r] of Object.entries(snap.segments)) {
    if (!SEGMENT_PRESET_ORDER.includes(key)) continue;
    if (!segmentState[key].active) addSegmentPreset(key);
    setControlValue(segmentControl('max', key), r.max); setControlValue(segmentControl('min', key), r.min); setControlValue(segmentControl('max', key), r.max);
    // the exact range (the slider snaps to its step grid), as the project file does
    segmentState[key].userMin = r.min; segmentState[key].userMax = r.max;
  }
  commitExclusiveRanges();
  for (const key of SEGMENT_PRESET_ORDER) updateSegmentOutputs(key);
  applyCtRangeMode(mode);
  return true;
}

export function initAnalysisPresets() {
  const root = $('#analysis-preset-box');
  if (!root) return;
  const sel = $('#analysis-preset-select'), nameInput = $('#analysis-preset-name'), activeEl = $('#analysis-preset-active');
  const applyBtn = $('#analysis-preset-apply'), saveBtn = $('#analysis-preset-save'), renameBtn = $('#analysis-preset-rename'), deleteBtn = $('#analysis-preset-delete');
  const scaleEl = $('#analysis-preset-scale');
  const exportBtn = $('#analysis-preset-export'), importBtn = $('#analysis-preset-import'), importFile = $('#analysis-preset-import-file');

  let userPresets = loadUserPresets(store());
  let active = null;     // { kind: 'builtin' | 'user', id, name, baseline }
  let applying = false;
  let estimating = false;
  let seriesKey = null;
  let lastRender = '';

  const lang = () => (currentLanguage === 'en' ? 'en' : 'ja');
  const say = key => { if (footer) footer.textContent = tr(key); };
  const confirmAsk = text => { try { return window.confirm(text); } catch { return true; } };
  const selected = () => {
    const v = sel.value || '';
    if (v.startsWith('b:')) { const p = builtinPresetById(v.slice(2)); return p ? { kind: 'builtin', id: p.id, name: builtinPresetName(p, lang()), snap: normalizeSnapshot(p) } : null; }
    if (v.startsWith('u:')) { const p = userPresets.find(x => x.id === v.slice(2)); return p ? { kind: 'user', id: p.id, name: p.name, snap: normalizeSnapshot(p) } : null; }
    return null;
  };
  const save = () => persistUserPresets(store(), userPresets);

  function buildOptions(keep) {
    const l = lang();
    const opt = (v, text) => { const o = document.createElement('option'); o.value = v; o.textContent = text; return o; };
    const g1 = document.createElement('optgroup'); g1.label = tr('presetBuiltin');
    for (const p of BUILTIN_PRESETS) g1.append(opt('b:' + p.id, builtinPresetName(p, l)));
    sel.replaceChildren(g1);
    if (userPresets.length) {
      const g2 = document.createElement('optgroup'); g2.label = tr('presetUser');
      for (const p of userPresets) g2.append(opt('u:' + p.id, p.name));
      sel.append(g2);
    }
    sel.value = [...sel.options].some(o => o.value === keep) ? keep : 'b:' + BUILTIN_PRESETS[0].id;
  }

  // the line under the selector: the active preset, "(modified)" once a setting differs from what it applied
  function activeLabel() {
    if (!active) return { text: tr('presetNone'), state: 'none' };
    if (isModified(active.baseline, captureSettings())) return { text: tr('presetActive') + active.name + tr('presetModified'), state: 'modified' };
    return { text: tr('presetActive') + active.name, state: 'clean' };
  }

  function render() {
    const ready = !!(volume && sourceVolume && ctRangeProfile);
    // the option list follows the language and the user list
    const optKey = lang() + '#' + userPresets.map(p => p.id + p.name).join('|');
    if (optKey !== lastRender) { lastRender = optKey; buildOptions(sel.value); }
    renderScale();
    const cur = selected();
    const a = activeLabel();
    if (activeEl.textContent !== a.text) activeEl.textContent = a.text;
    activeEl.dataset.state = a.state;
    const isUser = cur?.kind === 'user';
    sel.disabled = !volume; applyBtn.disabled = !ready || !cur || estimating;
    saveBtn.disabled = !ready; nameInput.placeholder = tr('presetNamePlaceholder');
    renameBtn.disabled = !isUser; deleteBtn.disabled = !isUser;
    exportBtn.disabled = !userPresets.length; importBtn.disabled = false;
  }

  function refresh() {
    if (applying) return;
    // a different data set: the preset was applied to the previous one
    const k = activeId + ':' + (sourceVolume ? 1 : 0);
    if (seriesKey !== k) { seriesKey = k; active = null; setScale(null); }
    render();
  }

  // the line under the selector that says how the last preset's HU values were obtained (re-rendered on a language change)
  let scaleInfo = null; // { state: 'busy' | 'ok' | 'failed' | 'user', air, soft }
  function setScale(info) { scaleInfo = info; renderScale(); }
  function renderScale() {
    if (!scaleEl) return;
    const i = scaleInfo;
    const text = !i ? '' : i.state === 'busy' ? tr('presetScaleEstimating') : i.state === 'ok' ? tr('presetScaleFrom').replace('{air}', i.air).replace('{soft}', i.soft) : i.state === 'failed' ? tr('presetScaleFailed') : tr('presetScaleUser');
    if (scaleEl.textContent !== text) scaleEl.textContent = text;
    scaleEl.dataset.state = i?.state || 'none'; scaleEl.classList.toggle('is-hidden', !text);
  }

  // user presets hold absolute HU and are applied as they are; built-in presets are mapped to the loaded scan's HU scale
  async function apply(cur) {
    if (!cur?.snap || estimating) return;
    let snap = cur.snap;
    if (cur.kind === 'builtin') {
      const series = activeSeries, vol = sourceVolume;
      estimating = true; setScale({ state: 'busy' }); render();
      let scale;
      try { scale = await estimateSeriesScale(series); } finally { estimating = false; }
      if (activeSeries !== series || sourceVolume !== vol) { setScale(null); render(); return; } // the data changed meanwhile
      if (scale?.ok) {
        snap = calibrateSnapshot(cur.snap, scale);
        setScale({ state: 'ok', air: scale.air, soft: scale.soft });
      } else setScale({ state: 'failed' });
    } else setScale({ state: 'user' });
    applying = true;
    try {
      if (!applySettings(snap)) return;
      // the baseline is what the controls hold after the apply (a slider may have snapped or clamped a value)
      active = { kind: cur.kind, id: cur.id, name: cur.name, baseline: captureSettings() };
      footer.textContent = tr('presetApplied') + cur.name;
    } finally { applying = false; }
    render();
  }

  sel.addEventListener('change', () => { const c = selected(); if (c?.kind === 'user') nameInput.value = c.name; render(); });
  applyBtn.addEventListener('click', () => { void apply(selected()); });
  saveBtn.addEventListener('click', () => {
    const snap = captureSettings(); const name = cleanPresetName(nameInput.value);
    if (!snap) return;
    if (!name) { say('presetNameNeeded'); nameInput.focus(); return; }
    if (BUILTIN_PRESETS.some(p => ['ja', 'en'].some(l => builtinPresetName(p, l).toLowerCase() === name.toLowerCase()))) { say('presetNameBuiltin'); return; }
    const exists = userPresets.some(p => p.name.toLowerCase() === name.toLowerCase());
    if (exists && !confirmAsk(tr('presetOverwriteAsk') + name)) return;
    const r = saveUserPreset(userPresets, name, snap);
    if (!r.preset) return;
    userPresets = r.list;
    const ok = save();
    active = { kind: 'user', id: r.preset.id, name: r.preset.name, baseline: snap };
    buildOptions('u:' + r.preset.id);
    footer.textContent = tr('presetSaved') + r.preset.name + (ok ? '' : tr('presetNoStorage'));
    render();
  });
  renameBtn.addEventListener('click', () => {
    const cur = selected(); if (cur?.kind !== 'user') return;
    const r = renameUserPreset(userPresets, cur.id, nameInput.value);
    if (!r.preset) { say(r.error === 'duplicate' ? 'presetNameDuplicate' : 'presetNameNeeded'); return; }
    userPresets = r.list; save();
    if (active?.id === cur.id) active.name = r.preset.name;
    buildOptions('u:' + cur.id); footer.textContent = tr('presetRenamed') + r.preset.name; render();
  });
  deleteBtn.addEventListener('click', () => {
    const cur = selected(); if (cur?.kind !== 'user') return;
    if (!confirmAsk(tr('presetDeleteAsk') + cur.name)) return;
    userPresets = deleteUserPreset(userPresets, cur.id); save();
    if (active?.id === cur.id) active = null;
    buildOptions('b:' + BUILTIN_PRESETS[0].id); footer.textContent = tr('presetDeleted') + cur.name; render();
  });
  exportBtn.addEventListener('click', () => {
    const blob = new Blob([serializeUserPresets(userPresets)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'analysis-presets.json';
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  importBtn.addEventListener('click', () => importFile.click());
  importFile.addEventListener('change', async () => {
    const f = importFile.files?.[0]; importFile.value = '';
    if (!f) return;
    try {
      const { presets, skipped } = parseUserPresets(await f.text());
      const r = mergeImportedPresets(userPresets, presets);
      userPresets = r.list; save(); buildOptions(sel.value);
      footer.textContent = tr('presetImported') + ' ' + r.added + (r.replaced ? ' (+' + r.replaced + ')' : '') + (skipped ? ' / ' + tr('presetSkipped') + ' ' + skipped : '');
      render();
    } catch { say('presetImportFailed'); }
  });

  buildOptions('b:' + BUILTIN_PRESETS[0].id);
  // Settings change from many places (sliders, filter cards, the histogram's lines, a loaded project); comparing two small
  // snapshots is cheap, so the label follows by polling rather than by listening to every control.
  setInterval(() => { if (!document.hidden) refresh(); }, 400);
  document.addEventListener('vrl-filters-changed', refresh);
  refresh();
}
