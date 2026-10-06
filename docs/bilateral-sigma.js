// Kept for the build 445 / 446 names; the generalised code is in filter-units.js (build 447).
import { FILTER_UNITS, filterLegacyRange, legacyFilterValueHU, resolveFilterParams, sourceFilterSignature } from './filter-units.js?v=20261006-build465';

export { sourceFilterSignature };
export const BILATERAL_ALGO = FILTER_UNITS.bilateral.algo;
export const BILATERAL_SIGMA_HU_DEFAULT = FILTER_UNITS.bilateral.params.sigmaHU.def;
export const BILATERAL_SIGMA_HU_MIN = FILTER_UNITS.bilateral.params.sigmaHU.min;
export const BILATERAL_SIGMA_HU_MAX = FILTER_UNITS.bilateral.params.sigmaHU.max;
export const BILATERAL_LEGACY_RATIO_DEFAULT = 0.02;
export const bilateralLegacyRange = filterLegacyRange;
export function legacyBilateralSigmaHU(ratio, range) { return legacyFilterValueHU('bilateral', 'sigmaHU', { intensitySigma: ratio }, range); }
export function resolveBilateralParams(saved, range) {
  const r = resolveFilterParams('bilateral', saved, range), d = r.derived[0];
  return { sigmaHU: r.values.sigmaHU, legacy: !!d, fallback: !!d?.fallback };
}
