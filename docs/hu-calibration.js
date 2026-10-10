// HU scale estimation for the built-in analysis presets (build 550). Pure module (no DOM, no imports) so the unit tests use it
// directly; docs/analysis-presets-ui.js samples the loaded series and calls it.
//
// Why: the two practice scans are on different HU scales (rat: air -1028 / soft tissue +158; mouse: air -2012 / soft tissue
// -8, i.e. mouse = 1.692 x rat - 274). The built-in preset ranges are written on the rat's scale (REFERENCE_SCALE) and are
// mapped linearly to the loaded scan through its own air and soft-tissue peaks. Tissue positions agree between the scans on
// that normalized axis (fat at 78.5 % / 78.3 % of the way from air to soft tissue), which is what makes the mapping valid.
//
// Own wide-range binning (1 HU bins from WIDE_MIN): the app's segment histogram (histogram.js) clamps at -1024 and would hide
// the mouse scan's air peak at about -2000.

export const WIDE_MIN = -8192;
export const WIDE_MAX = 16383;
export const WIDE_BINS = WIDE_MAX - WIDE_MIN + 1;

// The scale the built-in preset values are written on: the rat practice scan (sample1), measured with estimateHuScale on the
// same sampling the app uses (see the build 550 notes in analysis-presets.js).
export const REFERENCE_SCALE = Object.freeze({ air: -1018, soft: 152 });

// Plausibility limits: soft tissue lies 700 .. 4000 units above air (rat 1177, mouse 2004); anything else is rejected.
export const MIN_SEPARATION = 700;
export const MAX_SEPARATION = 4000;

export const createWideHist = () => new Uint32Array(WIDE_BINS);

// add values[start..end) with the given stride (NaN skipped, out-of-range values clamped into the end bins)
export function addWideValues(hist, values, start = 0, end = values.length, stride = 1) {
  for (let i = start; i < end; i += stride) {
    const v = values[i];
    if (v !== v) continue;
    const b = Math.round(v) - WIDE_MIN;
    hist[b < 0 ? 0 : b >= WIDE_BINS ? WIDE_BINS - 1 : b]++;
  }
  return hist;
}

const BIN = 10;          // coarse bin (HU) for peak finding
const HALF_WINDOW = 40;  // HU around a peak used for its mass and its centroid

// Finds the air and soft-tissue peaks. Returns { ok: true, air, soft } or { ok: false, reason }.
// - The padding value (the exact minimum value holding >= 0.5 % of the samples: the outside of the reconstruction circle) is
//   ignored, and so is any "peak" whose mass sits in one 1-HU bin (synthetic / constant data, not a noisy tissue).
// - Air is the lowest peak holding >= 1 % of the samples; soft tissue the highest-count peak at least MIN_SEPARATION above it.
//   If that peak is fat (a fat-rich animal), a taller-than-25 % peak above it at the fat position (70-86 % of the way from
//   air) is taken as soft tissue instead.
export function estimateHuScale(hist) {
  const h = Float64Array.from(hist);
  h[0] = 0; h[WIDE_BINS - 1] = 0; // clamped values are not data
  let lo = 0; while (lo < WIDE_BINS && !h[lo]) lo++;
  if (lo >= WIDE_BINS) return { ok: false, reason: 'empty' };
  let total = 0; for (let i = 0; i < WIDE_BINS; i++) total += h[i];
  if (h[lo] >= total * 0.005) { total -= h[lo]; h[lo] = 0; }
  if (total < 1000) return { ok: false, reason: 'few' };
  // coarse histogram, smoothed twice with [1 2 3 2 1]
  const n = Math.ceil(WIDE_BINS / BIN);
  let c = new Float64Array(n);
  for (let i = 0; i < WIDE_BINS; i++) c[Math.floor(i / BIN)] += h[i];
  for (let pass = 0; pass < 2; pass++) {
    const s = new Float64Array(n);
    for (let i = 0; i < n; i++) { let a = 0, w = 0; for (let k = -2; k <= 2; k++) { const j = i + k; if (j < 0 || j >= n) continue; const wk = 3 - Math.abs(k); a += c[j] * wk; w += wk; } s[i] = a / w; }
    c = s;
  }
  const huOf = i => WIDE_MIN + i * BIN + BIN / 2;
  const fine = (hu, fn) => { const a = Math.max(0, Math.round(hu) - HALF_WINDOW - WIDE_MIN), b = Math.min(WIDE_BINS - 1, Math.round(hu) + HALF_WINDOW - WIDE_MIN); for (let i = a; i <= b; i++) fn(i, h[i]); };
  const peaks = [];
  for (let i = 5; i < n - 5; i++) {
    let top = c[i] > 0;
    for (let k = -5; k <= 5 && top; k++) if (k && (c[i + k] > c[i] || (k < 0 && c[i + k] === c[i]))) top = false;
    if (!top) continue;
    let mass = 0, maxBin = 0, sum = 0;
    fine(huOf(i), (j, v) => { mass += v; sum += v * (j + WIDE_MIN); if (v > maxBin) maxBin = v; });
    if (!mass || maxBin > mass * 0.5) continue; // a spike, not a noisy tissue peak
    peaks.push({ hu: sum / mass, height: c[i], share: mass / total });
  }
  const air = peaks.find(p => p.share >= 0.01);
  if (!air) return { ok: false, reason: 'no-air' };
  const above = peaks.filter(p => p.hu >= air.hu + MIN_SEPARATION && p.share >= 0.002);
  if (!above.length) return { ok: false, reason: 'no-soft' };
  let soft = above.reduce((a, b) => (b.height > a.height ? b : a));
  const higher = above.find(p => p.hu > soft.hu && p.height >= soft.height * 0.25 && (soft.hu - air.hu) / (p.hu - air.hu) >= 0.70 && (soft.hu - air.hu) / (p.hu - air.hu) <= 0.86);
  if (higher) soft = higher;
  const sep = soft.hu - air.hu;
  if (sep < MIN_SEPARATION || sep > MAX_SEPARATION) return { ok: false, reason: 'separation' };
  return { ok: true, air: Math.round(air.hu), soft: Math.round(soft.hu) };
}

// v on the reference scale -> the same tissue position on `scale`
export function mapHu(v, scale, ref = REFERENCE_SCALE) {
  return scale.air + (v - ref.air) * (scale.soft - scale.air) / (ref.soft - ref.air);
}

// A preset snapshot mapped to `scale`: the window centre and the segment bounds are mapped, the window width scaled, all
// rounded to whole HU. Bounds at or above `openTop` ("no upper limit") are kept. Filters are not touched: their HU parameters
// act on the noise, which is about the same on both practice scans (SD about 40 HU) although their scales differ.
export function calibrateSnapshot(snap, scale, { openTop = 65535, ref = REFERENCE_SCALE } = {}) {
  if (!snap || !scale) return snap;
  const k = (scale.soft - scale.air) / (ref.soft - ref.air);
  const m = v => (v >= openTop ? v : Math.round(mapHu(v, scale, ref)));
  const segments = {};
  for (const [key, r] of Object.entries(snap.segments || {})) segments[key] = { min: m(r.min), max: m(r.max) };
  const display = snap.display ? { windowCenter: Math.round(mapHu(snap.display.windowCenter, scale, ref)), windowWidth: Math.max(1, Math.round(snap.display.windowWidth * k)) } : null;
  return { filters: JSON.parse(JSON.stringify(snap.filters || [])), display, segments };
}
