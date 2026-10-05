// Filter parameters in absolute HU (builds 445-447).
// Before, the strength of several filters was a fraction of (v.max - v.min), and v.min / v.max differed between load
// paths and devices (DICOM metadata range vs the range of the decoded data, rewritten by prepareSourceMprCache), so the
// same project gave different results. Now each of these parameters is an absolute HU value, saved in the project file
// and used as it is. Projects saved before have only the old (ratio / strength) parameters; their HU value is derived
// from the old parameter and the range the old code effectively used (see filterLegacyRange).
// Pure module (no DOM) so that the unit tests and the signature can use it directly.

const round6 = x => Math.round(x * 1e6) / 1e6;
const spanOf = range => Math.max(1, (range?.max ?? 0) - (range?.min ?? 0));
const num = (x, d) => (Number.isFinite(+x) && x !== '' && x !== null && x !== undefined ? +x : d);
const ratioOf = (saved, name, def) => { const r = num(saved?.[name], def); return r > 0 ? r : def; };

// One entry per filter: `algo` = version of its HU-based algorithm (part of the filter signature, so cache entries made
// by the ratio-era code are never reused); `params` = the HU parameters:
//  name       parameter name in the project file and in the stage params (all HU)
//  label      short name for messages
//  def/min/max/step   new-project default and slider range (min / max / step null = no slider)
//  legacy(saved, span)  HU value of a project that only has the old parameters; span = max(1, range.max - range.min)
export const FILTER_UNITS = {
  spikeHole: { algo: 2, params: {
    thresholdHU: { label: 'Spike/Hole threshold', def: 100, min: 20, max: 1000, step: 5, legacy: (s, span) => ratioOf(s, 'threshold', 0.075) * span } } },
  nlm: { algo: 2, params: {
    hHU: { label: 'NLM h', def: 40, min: 5, max: 300, step: 1, legacy: (s, span) => span * (0.018 + 0.11 * num(s?.strength, 0.45)) } } },
  anisotropic: { algo: 2, params: {
    kappaHU: { label: 'Anisotropic kappa', def: 60, min: 5, max: 300, step: 1, legacy: (s, span) => span * (0.025 + 0.09 * num(s?.strength, 0.45)) } } },
  tv: { algo: 2, params: {
    epsHU: { label: 'TV eps', def: 1, min: null, max: null, step: null, legacy: (s, span) => 1e-4 * span } } },
  unsharp: { algo: 2, params: {
    thresholdHU: { label: 'Unsharp threshold', def: 60, min: 0, max: 500, step: 5, legacy: (s, span) => ratioOf(s, 'threshold', 0.02) * span } } },
  bilateral: { algo: 2, params: {
    sigmaHU: { label: 'Bilateral sigma', def: 50, min: 10, max: 300, step: 1, legacy: (s, span) => ratioOf(s, 'intensitySigma', 0.02) * span } },
  },
};

// The range v.min / v.max a pre-447 project effectively used. It depends on the load path:
//  - sourceBacked series, resident GPU volume prepared: the metadata range (sourceRangeFromMetadata(): DICOM tags, else
//    the full bit-depth range with intercept)
//  - sourceBacked series, no resident GPU volume: prepareSourceMprCache() rewrites it to the data range (device dependent)
//  - small series (not sourceBacked): decode() returns the data range on every device, and nothing rewrites it
// The device-dependent middle case cannot be reproduced; the metadata range is used for sourceBacked series (the value
// the project was most likely made with). Small series use the data range, which is what they always used.
export function filterLegacyRange(sourceBacked, metaRange, dataRange) { return sourceBacked ? metaRange : dataRange; }

// HU value of one parameter derived from the old parameters; NaN if the range is not finite.
export function legacyFilterValueHU(key, name, saved, range) {
  const def = FILTER_UNITS[key]?.params?.[name];
  if (!def || !Number.isFinite(range?.min) || !Number.isFinite(range?.max)) return NaN;
  return round6(def.legacy(saved || {}, spanOf(range)));
}

// Saved params of one filter → { values: {name: HU}, derived: [{name, value, fallback}] }. A saved HU value is used as it
// is (never recomputed); a missing one is derived from the old parameters and the range, and if that is not possible
// (range not finite) the new-project default is used and `fallback` is set. `derived` is empty for a new project.
export function resolveFilterParams(key, saved, range) {
  const out = { values: {}, derived: [] };
  for (const [name, def] of Object.entries(FILTER_UNITS[key]?.params || {})) {
    const own = saved?.[name];
    if (own !== undefined && own !== null && own !== '' && Number.isFinite(+own) && +own > 0) { out.values[name] = +own; continue; }
    const v = legacyFilterValueHU(key, name, saved, range);
    const ok = Number.isFinite(v) && v > 0;
    out.values[name] = ok ? v : def.def;
    out.derived.push({ name, label: def.label, value: out.values[name], fallback: !ok });
  }
  return out;
}

// The filter signature (cache key part): stages with the algorithm version of every HU-based filter added.
export function sourceFilterSignature(stages) {
  return JSON.stringify(stages.map(s => FILTER_UNITS[s.key] ? { ...s, params: { ...s.params, algo: FILTER_UNITS[s.key].algo } } : s));
}
