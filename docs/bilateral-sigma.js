// Bilateral 3D intensity sigma, in HU (build 445).
// Before: sigma = ratio × (v.min − v.max), and v.min / v.max differed between devices (DICOM metadata range vs the
// range of the decoded data, rewritten by prepareSourceMprCache), so the same project gave different filter
// results. Now the strength is an absolute HU value that does not depend on the volume range.
// Pure module (no DOM) so that the unit tests and the signature can use it directly.

// Algorithm version of the bilateral intensity term; part of every filter signature (and so of the cache keys).
export const BILATERAL_ALGO = 2;
export const BILATERAL_SIGMA_HU_DEFAULT = 50;
export const BILATERAL_SIGMA_HU_MIN = 10;
export const BILATERAL_SIGMA_HU_MAX = 300;
// Ratio used by projects saved before build 445 that have no sigmaHU and no saved ratio (the old slider default).
export const BILATERAL_LEGACY_RATIO_DEFAULT = 0.02;

const round6 = x => Math.round(x * 1e6) / 1e6;

// sigmaHU a pre-445 project effectively used: ratio × the metadata range (DICOM tags, else the full bit-depth range
// with intercept), i.e. sourceRangeFromMetadata(), taken before any load path rewrites v.min / v.max.
export function legacyBilateralSigmaHU(ratio, range) {
  const r = Number.isFinite(+ratio) && +ratio > 0 ? +ratio : BILATERAL_LEGACY_RATIO_DEFAULT;
  const span = Math.max(1, (range?.max ?? 0) - (range?.min ?? 0));
  return round6(r * span);
}

// Saved bilateral params → params with a sigmaHU. A saved sigmaHU is used as is (never recomputed); otherwise the
// legacy value is derived from the ratio and the metadata range. `legacy` tells the caller that it was derived.
export function resolveBilateralParams(saved, metaRange) {
  const p = saved || {};
  const own = p.sigmaHU;
  if (own !== undefined && own !== null && own !== '' && Number.isFinite(+own) && +own > 0) return { sigmaHU: +own, legacy: false };
  return { sigmaHU: legacyBilateralSigmaHU(p.intensitySigma, metaRange), legacy: true };
}

// The filter signature (cache key part): stages with the bilateral algorithm version added.
export function sourceFilterSignature(stages) {
  return JSON.stringify(stages.map(s => s.key === 'bilateral' ? { ...s, params: { ...s.params, algo: BILATERAL_ALGO } } : s));
}
