// Analysis presets: purpose-specific settings applied together (source filters + CT display window + segment HU ranges).
// Pure module (no DOM, no imports) so the unit tests use it directly; docs/analysis-presets-ui.js wires it to the controls.
//
// A "snapshot" is what a preset holds and what the UI reports for the current state:
//   { filters: [{ key, params: { name: number | string } }],   // enabled filters in pipeline order
//     display: { windowCenter, windowWidth },                  // CT window (HU)
//     segments: { bone: { min, max }, ... } }                  // segment HU ranges (only the segments the preset names)
// The shapes match the project file (display / filters.order / segments), so the same controls are driven the same way.
//
// THE BUILT-IN VALUES ARE A DRAFT ("たたき台"): reasoned starting points, not validated on real data yet. They are meant to be
// tuned on real scans. Every value below has a one-line reason; none of them cites a reference.

export const PRESET_FORMAT = 'vrl-analysis-presets';
export const PRESET_VERSION = 1;
export const USER_PRESETS_STORAGE_KEY = 'vrl.analysisPresets.v1';
export const MAX_PRESET_NAME = 40;

// Every parameter control of every filter (the keys of FILTER_PARAM_INPUTS in data-load.js). A preset names all of them for
// each filter it uses: the sliders that have no HU reset (strength, passes, ...) keep their last value otherwise.
export const FILTER_PARAM_NAMES = {
  spikeHole: ['strength', 'thresholdHU'],
  nlm: ['hHU', 'searchRadius', 'patchRadius'],
  anisotropic: ['strength', 'kappaHU', 'iterations'],
  gaussian: ['mode', 'strength', 'passes'],
  sigmoid: ['strength', 'center', 'width'],
  bilateral: ['strength', 'spatialSigma', 'sigmaHU', 'passes'],
  tv: ['weight', 'epsHU', 'iterations'],
  unsharp: ['radius', 'amount', 'thresholdHU'],
};

// Upper end of "no upper limit" segments (bone): the control clamps it to the data's maximum.
const HU_TOP = 3000;

export const BUILTIN_PRESETS = [
  {
    id: 'lung',
    name: { ja: '肺', en: 'Lung' },
    // Weak edge-preserving smoothing only: strong smoothing pulls the values of the fine vessel / airway structure and of the
    // parenchyma toward each other, and moves the share of voxels below a fixed threshold (LAA%-type analysis, about -950 HU),
    // so the filter must bias the histogram as little as possible. Spatial sigma 0.8 and one pass stay inside the voxel;
    // sigma 100 HU is far below the air / tissue step (several hundred HU), so edges are kept.
    filters: [{ key: 'bilateral', params: { strength: 0.3, spatialSigma: 0.8, sigmaHU: 100, passes: 1 } }],
    // Lung window: the usual wide window centred between aerated lung (-800 .. -850) and vessels (about -400 and above).
    display: { windowCenter: -600, windowWidth: 1500 },
    // Same as the app's default lung segment: -950 keeps the outside air (-1000) out; -300 keeps the chest wall out.
    segments: { lung: { min: -950, max: -300 } },
  },
  {
    id: 'fat',
    name: { ja: '脂肪', en: 'Fat' },
    // Fat is only about 80-100 HU away from water-like soft tissue, so the intensity sigma must stay below that gap (30 HU):
    // noise inside fat is averaged, the fat / soft-tissue boundary is kept. Two passes of the default spatial sigma.
    filters: [{ key: 'bilateral', params: { strength: 0.8, spatialSigma: 1.2, sigmaHU: 30, passes: 2 } }],
    // Window -190 .. -30 HU (centre -110, width 160): the typical fat range, widely used for fat segmentation.
    display: { windowCenter: -110, windowWidth: 160 },
    segments: { fat: { min: -190, max: -30 } },
  },
  {
    id: 'bone',
    name: { ja: '骨', en: 'Bone' },
    // Edge priority, minimal smoothing: bone edges (cortex) are thin and their steps are 500 HU and more; sigma 250 HU keeps
    // them, a single weak pass only takes the noise off the marrow / soft-tissue side. No sigmoid / unsharp: the threshold
    // analysis should see the data, not an enhanced image.
    filters: [{ key: 'bilateral', params: { strength: 0.3, spatialSigma: 0.8, sigmaHU: 250, passes: 1 } }],
    // High window: centre 400, width 1800 shows trabecular detail and dense cortex in one image.
    display: { windowCenter: 400, windowWidth: 1800 },
    // Same lower bound as the app's default bone segment (350 HU); no upper limit (clamped to the data's maximum).
    segments: { bone: { min: 350, max: HU_TOP } },
  },
  {
    id: 'soft',
    name: { ja: '軟部・造影', en: 'Soft tissue / contrast' },
    // The app's usual working combination: bilateral (strength 0.8, sigma 1.2 voxel, 50 HU, 2 passes) to reduce the noise while
    // keeping organ boundaries, then a sigmoid (0 HU centre, width 300 HU, strength 0.5) that stretches the contrast of soft
    // tissue and enhanced vessels. These are the filters' own default parameter values.
    filters: [
      { key: 'bilateral', params: { strength: 0.8, spatialSigma: 1.2, sigmaHU: 50, passes: 2 } },
      { key: 'sigmoid', params: { strength: 0.5, center: 0, width: 300 } },
    ],
    // Abdominal soft-tissue window (centre 40, width 400) shows soft tissue and a contrast-enhanced vessel (100-400 HU).
    display: { windowCenter: 40, windowWidth: 400 },
    // Same as the app's default soft / contrast segments.
    segments: { soft: { min: -50, max: 350 }, contrast: { min: 300, max: HU_TOP } },
  },
];

export const builtinPresetById = id => BUILTIN_PRESETS.find(p => p.id === id) || null;
export const builtinPresetName = (p, lang = 'ja') => p?.name?.[lang] || p?.name?.ja || '';

// ---- snapshots -------------------------------------------------------------------------------------------------------

const finite = v => Number.isFinite(+v) && v !== '' && v !== null;
const clone = x => JSON.parse(JSON.stringify(x));
const roundNum = v => Math.round(+v * 1e4) / 1e4;

// A preset body (or a snapshot) cleaned to the snapshot shape; null if nothing valid remains. Unknown filters / parameters /
// segments are dropped, numbers are made finite, so imported JSON can never inject anything into the controls.
export function normalizeSnapshot(raw, { segmentKeys = ['bone', 'soft', 'fat', 'lung', 'contrast'] } = {}) {
  if (!raw || typeof raw !== 'object') return null;
  const filters = [];
  const seen = new Set();
  for (const f of Array.isArray(raw.filters) ? raw.filters : []) {
    const names = FILTER_PARAM_NAMES[f?.key];
    if (!names || seen.has(f.key)) continue;
    const params = {};
    for (const name of names) {
      const v = f.params?.[name];
      if (name === 'mode') { if (typeof v === 'string' && /^[a-z]{1,20}$/.test(v)) params[name] = v; }
      else if (finite(v)) params[name] = +v;
    }
    seen.add(f.key);
    filters.push({ key: f.key, params });
  }
  let display = null;
  if (raw.display && finite(raw.display.windowCenter) && finite(raw.display.windowWidth) && +raw.display.windowWidth > 0) {
    display = { windowCenter: +raw.display.windowCenter, windowWidth: +raw.display.windowWidth };
  }
  const segments = {};
  for (const key of segmentKeys) {
    const s = raw.segments?.[key];
    if (s && finite(s.min) && finite(s.max) && +s.min <= +s.max) segments[key] = { min: +s.min, max: +s.max };
  }
  if (!filters.length && !display && !Object.keys(segments).length && !Array.isArray(raw.filters)) return null;
  return { filters, display, segments };
}

// Same content? Numbers compare to 1e-4 (a slider may snap a value to its step grid), filter order matters.
export function snapshotsEqual(a, b) {
  if (!a || !b) return false;
  if (a.filters.length !== b.filters.length) return false;
  for (let i = 0; i < a.filters.length; i++) {
    const x = a.filters[i], y = b.filters[i];
    if (x.key !== y.key) return false;
    const names = new Set([...Object.keys(x.params), ...Object.keys(y.params)]);
    for (const n of names) {
      const p = x.params[n], q = y.params[n];
      if (typeof p === 'string' || typeof q === 'string') { if (p !== q) return false; }
      else if (!finite(p) || !finite(q) || roundNum(p) !== roundNum(q)) return false;
    }
  }
  if ((a.display == null) !== (b.display == null)) return false;
  if (a.display && (roundNum(a.display.windowCenter) !== roundNum(b.display.windowCenter) || roundNum(a.display.windowWidth) !== roundNum(b.display.windowWidth))) return false;
  const ka = Object.keys(a.segments).sort(), kb = Object.keys(b.segments).sort();
  if (ka.join() !== kb.join()) return false;
  for (const k of ka) if (roundNum(a.segments[k].min) !== roundNum(b.segments[k].min) || roundNum(a.segments[k].max) !== roundNum(b.segments[k].max)) return false;
  return true;
}

// The current state restricted to what the baseline holds: a preset that names only the lung segment is not "modified"
// because the user also added a bone card. (Filters and the CT window always take part.)
export function restrictSnapshot(current, baseline) {
  const segments = {};
  for (const k of Object.keys(baseline?.segments || {})) if (current.segments?.[k]) segments[k] = current.segments[k];
  return { filters: current.filters, display: baseline?.display ? current.display : null, segments };
}

export function isModified(baseline, current) {
  if (!baseline || !current) return false;
  return !snapshotsEqual(baseline, restrictSnapshot(current, baseline));
}

// ---- user presets ----------------------------------------------------------------------------------------------------

export const cleanPresetName = name => String(name ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, MAX_PRESET_NAME);
const sameName = (a, b) => cleanPresetName(a).toLowerCase() === cleanPresetName(b).toLowerCase();

// id from the name, unique among `list`
function newId(list) {
  let i = list.length + 1;
  const ids = new Set(list.map(p => p.id));
  while (ids.has('u' + i)) i++;
  return 'u' + i;
}

// Saves `snapshot` under `name`: replaces the preset of that name (overwrite) or appends. Returns { list, preset, overwritten }.
export function saveUserPreset(list, name, snapshot) {
  const n = cleanPresetName(name);
  if (!n) return { list, preset: null, overwritten: false, error: 'name' };
  const snap = normalizeSnapshot(snapshot);
  if (!snap) return { list, preset: null, overwritten: false, error: 'snapshot' };
  const at = list.findIndex(p => sameName(p.name, n));
  const next = list.slice();
  if (at >= 0) { const preset = { ...clone(snap), id: list[at].id, name: n }; next[at] = preset; return { list: next, preset, overwritten: true }; }
  const preset = { ...clone(snap), id: newId(list), name: n };
  next.push(preset);
  return { list: next, preset, overwritten: false };
}

// Renames; refuses an empty name or a name another preset already has.
export function renameUserPreset(list, id, name) {
  const n = cleanPresetName(name);
  const at = list.findIndex(p => p.id === id);
  if (at < 0) return { list, preset: null, error: 'missing' };
  if (!n) return { list, preset: null, error: 'name' };
  if (list.some((p, i) => i !== at && sameName(p.name, n))) return { list, preset: null, error: 'duplicate' };
  const next = list.slice();
  next[at] = { ...list[at], name: n };
  return { list: next, preset: next[at] };
}

export const deleteUserPreset = (list, id) => list.filter(p => p.id !== id);

// ---- JSON export / import --------------------------------------------------------------------------------------------

export function serializeUserPresets(list) {
  return JSON.stringify({ format: PRESET_FORMAT, version: PRESET_VERSION, presets: list.map(p => ({ name: p.name, filters: p.filters, display: p.display, segments: p.segments })) }, null, 2);
}

// Text → { presets: [valid presets, ids not yet assigned], skipped: n }; throws Error('format') for anything that is not
// this file. Never executes or stores anything but the cleaned fields.
export function parseUserPresets(text) {
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('format'); }
  if (!data || data.format !== PRESET_FORMAT || !Array.isArray(data.presets)) throw new Error('format');
  if (!(Number(data.version) >= 1) || Number(data.version) > PRESET_VERSION) throw new Error('version');
  const presets = [];
  let skipped = 0;
  for (const raw of data.presets) {
    const name = cleanPresetName(raw?.name);
    const snap = normalizeSnapshot(raw);
    if (!name || !snap) { skipped++; continue; }
    presets.push({ name, ...snap });
  }
  return { presets, skipped };
}

// Imported presets are merged: a preset with an existing name overwrites it, the others are appended.
export function mergeImportedPresets(list, imported) {
  let next = list.slice();
  let added = 0, replaced = 0;
  for (const p of imported) {
    const r = saveUserPreset(next, p.name, p);
    if (!r.preset) continue;
    next = r.list;
    if (r.overwritten) replaced++; else added++;
  }
  return { list: next, added, replaced };
}

// ---- localStorage (every access guarded: private windows, blocked storage, quota) --------------------------------------

export function loadUserPresets(storage) {
  try {
    const text = storage?.getItem(USER_PRESETS_STORAGE_KEY);
    if (!text) return [];
    const { presets } = parseUserPresets(text);
    return mergeImportedPresets([], presets).list;
  } catch { return []; }
}

export function persistUserPresets(storage, list) {
  try { storage.setItem(USER_PRESETS_STORAGE_KEY, serializeUserPresets(list)); return true; } catch { return false; }
}
