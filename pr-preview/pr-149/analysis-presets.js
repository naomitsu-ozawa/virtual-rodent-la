// Analysis presets: purpose-specific settings applied together (source filters + CT display window + segment HU ranges).
// Pure module (no DOM, no imports) so the unit tests use it directly; docs/analysis-presets-ui.js wires it to the controls.
//
// A "snapshot" is what a preset holds and what the UI reports for the current state:
//   { filters: [{ key, params: { name: number | string } }],   // enabled filters in pipeline order
//     display: { windowCenter, windowWidth },                  // CT window (HU)
//     segments: { bone: { min, max }, ... } }                  // segment HU ranges (only the segments the preset names)
// The shapes match the project file (display / filters.order / segments), so the same controls are driven the same way.
//
// THE BUILT-IN VALUES ARE FITTED TO THE TWO PRACTICE DATA SETS (docs/demo, build 548). Every number below names the measurement
// it comes from; nothing cites literature. Measurements: tissue peaks of the 5x5x5 local mean in homogeneous regions, noise SD
// in the cores of those regions, and the 10-90 % rise distance of the mean edge profile across fat / soft tissue and bone
// edges (the app's own CPU filter kernels from source-filters.js, run on 40-slice slabs of each sample).
//   sample1 (rat abdomen, 0.148 mm): air -1028, fat -98, soft tissue +158, noise SD about 40 HU (raw voxels). No thorax.
//   sample2 (mouse torso, 0.118 mm): air -2012, fat -442, soft tissue -8, noise SD about 42 HU; lung (z < 60) -925.
// The two scans are on DIFFERENT HU SCALES: sample2 = 1.692 x sample1 - 274 (fitted on air and soft tissue; it predicts the
// sample2 fat peak at -439, measured -442; fat sits at 78.5 % / 78.3 % of the way from air to soft tissue on both). No single
// fixed HU range fits both, so the ranges below are written on sample1's scale and, when a built-in preset is applied, mapped
// to the loaded scan through its own air and soft-tissue peaks (hu-calibration.js: REFERENCE_SCALE is sample1's estimate,
// air -1018 / soft tissue +152 with the app's sampling; sample2 gives -2008 / -18). If the peaks are not found the values below
// are used as they are. User presets hold absolute HU and are never mapped. The "sample2" figures in the comments below are
// what the mapping gives on that scan.
//
// Filters: every preset uses the bilateral filter at its own default parameters (strength 0.8, spatial sigma 1.2, 50 HU,
// 2 passes). With noise about 40 HU on both scans it halves the noise SD (sample1 fat 39.5 -> 20.4, soft 40.8 -> 22.6;
// sample2 fat 42.2 -> 24.2, soft 43.1 -> 25.2, lung 62.8 -> 48.8) and moves no tissue mean by more than 3 HU, while the
// 10-90 % edge rise stays the same (fat/soft 3.29 -> 3.25 voxels on sample1, 4.24 -> 4.24 on sample2; bone 3.01 -> 2.99,
// 3.21 -> 3.19). The weaker variants of the previous draft (strength 0.3 / sigma 0.8 / 1 pass, or 30 HU) left the SD at
// 25-37 HU and gained no edge sharpness. The sigmoid is not used: it shifted the sample1 fat mean by 40 HU (-104 -> -144) and,
// with its default centre 0 on sample2's soft-tissue peak, raised the sample2 soft-tissue SD from 25 to 64 HU.

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

// Upper end of "no upper limit" segments (bone, contrast). It was 3000, which cut off 7 % of sample2's bone voxels (its
// densest bone reaches 6226 on that scan's scale); 65535 lies above any value a 16-bit scan can hold.
const HU_TOP = 65535;

// The bilateral filter at its own defaults (the slider values in ui-shell.js / FILTER_UNITS.bilateral.sigmaHU.def)
const DEFAULT_BILATERAL = { key: 'bilateral', params: { strength: 0.8, spatialSigma: 1.2, sigmaHU: 50, passes: 2 } };
const filtersDefault = () => [JSON.parse(JSON.stringify(DEFAULT_BILATERAL))];

export const BUILTIN_PRESETS = [
  {
    id: 'lung',
    name: { ja: '肺', en: 'Lung' },
    filters: filtersDefault(),
    // Only sample2 has lung (its lower thorax). Measured there on its own scale: parenchyma peak -925, range about
    // -1100 .. -600, valley to fat / soft tissue at about -525. Transferred to sample1's scale with the fitted map: peak -385,
    // valley -148; the lower edge -700 is the midpoint between air and the lung peak (sample2 -1468 -> -706). This range is
    // DERIVED BY TRANSFER, not measured: no scan on sample1's scale has a thorax. On sample2 the mapping gives -1467 .. -532.
    display: { windowCenter: -450, windowWidth: 1200 },   // -1050 .. 150: air (-1028) black, soft tissue (+158) white
    segments: { lung: { min: -700, max: -150 } },
  },
  {
    id: 'fat',
    name: { ja: '脂肪', en: 'Fat' },
    filters: filtersDefault(),
    // sample1: fat peak -98, soft-tissue peak +158, valley between them at +8 (flat from about -40 to +20); -250 lies in the
    // nearly empty gap between air and fat (-550 .. -250). The range holds 96 % of sample1's fat region (the app's default
    // -250 .. -50 held 83 %, the previous draft -190 .. -30 90 %). On sample2 the mapping gives -702 .. -277 (its fat peak is -442).
    display: { windowCenter: 0, windowWidth: 500 },       // -250 .. 250: fat dark grey, soft tissue light grey
    segments: { fat: { min: -250, max: 0 } },
  },
  {
    id: 'bone',
    name: { ja: '骨', en: 'Bone' },
    filters: filtersDefault(),
    // Soft tissue ends below 350 on sample1 (99.9th percentile of its local mean 258; above about 350 the count stays flat at
    // the bone partial-volume level); no soft-tissue core voxel reaches 350, with or without the filter. The mapping gives 319
    // on sample2, where its soft tissue ends at 124 and the flat level starts at about 340: this lower edge works on both.
    display: { windowCenter: 900, windowWidth: 2000 },    // -100 .. 1900: bone voxels on sample1 have median 1104, 90th pct. 1664
    segments: { bone: { min: 350, max: HU_TOP } },
  },
  {
    id: 'soft',
    name: { ja: '軟部・造影', en: 'Soft tissue / contrast' },
    filters: filtersDefault(),
    // Soft tissue from the fat / soft valley (+8 on sample1, rounded to 0) to the bone edge 350 (above the 99.9th percentile
    // 258). Neither sample has contrast-enhanced tissue (nothing between the soft-tissue tail and bone), so the contrast range
    // simply continues above 350 and is NOT validated. On sample2 the mapping gives soft tissue -277 .. 319 (peak -8); its holder
    // tube reads -40 .. 0, inside that range.
    display: { windowCenter: 150, windowWidth: 500 },     // -100 .. 400: fat dark, soft tissue (+158) mid grey
    segments: { soft: { min: 0, max: 350 }, contrast: { min: 350, max: HU_TOP } },
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
