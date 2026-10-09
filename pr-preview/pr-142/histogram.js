// Per-segment HU histogram (build 534). Pure functions only (no DOM, no app state), so the unit tests use them directly.
// Fixed 1-HU bins from HIST_MIN (-1024) to HIST_MAX (3071): 4096 bins; values outside are clamped into the two end bins
// (bin 0 = "<= -1024", the last bin = ">= 3071"). A histogram is a Uint32Array(HIST_BINS); the results of a whole volume stay tiny.
export const HIST_MIN = -1024;
export const HIST_MAX = 3071;
export const HIST_BINS = HIST_MAX - HIST_MIN + 1;
export const HIST_PERCENTILES = [5, 25, 50, 75, 95];

export const createHist = () => new Uint32Array(HIST_BINS);
// HU (any number) -> bin index, rounded to the nearest HU and clamped
export function huToBin(hu) {
  const i = Math.round(+hu) - HIST_MIN;
  return i < 0 ? 0 : i >= HIST_BINS ? HIST_BINS - 1 : i;
}
export const binToHu = i => i + HIST_MIN;

// add values[start..end) to hist (NaN is skipped)
export function binValues(hist, values, start = 0, end = values.length) {
  for (let i = start; i < end; i++) {
    const v = values[i];
    if (v !== v) continue;
    const b = Math.round(v) - HIST_MIN;
    hist[b < 0 ? 0 : b >= HIST_BINS ? HIST_BINS - 1 : b]++;
  }
  return hist;
}
// add the voxels of one slice that lie in `runs` (the analysis run format: triples y, x0, x1 with x1 inclusive) to hist;
// `values` is the slice (width w, row-major)
export function binRuns(hist, values, runs, w) {
  if (!runs) return hist;
  for (let i = 0; i + 2 < runs.length; i += 3) {
    const base = runs[i] * w;
    binValues(hist, values, base + runs[i + 1], base + runs[i + 2] + 1);
  }
  return hist;
}
export function mergeHist(dst, src) {
  for (let i = 0; i < HIST_BINS; i++) dst[i] += src[i];
  return dst;
}
// every count multiplied by k (a draft that read every k-th slice is scaled up to the whole volume)
export function scaleHist(hist, k) {
  const out = createHist();
  for (let i = 0; i < HIST_BINS; i++) out[i] = Math.round(hist[i] * k);
  return out;
}
// the bins of `hist` inside the HU range [min, max] (a segment defined by a plain HU range needs no pass of its own: it is a slice of the total)
export function histInRange(hist, min, max) {
  const out = createHist();
  if (!(max >= min) || max < HIST_MIN - 0.5 || min > HIST_MAX + 0.5) return out;
  const a = huToBin(Math.ceil(min - 0.5)), b = huToBin(Math.floor(max + 0.5));
  for (let i = a; i <= b; i++) out[i] = hist[i];
  return out;
}
export function histCount(hist) {
  let n = 0;
  for (let i = 0; i < HIST_BINS; i++) n += hist[i];
  return n;
}
// counts for display: the HU window [lo, hi] (inclusive, whole HU) cut into `columns` columns of equal width.
// Returns Float64Array(columns); a column holds the sum of the bins it covers.
export function rebinHist(hist, lo, hi, columns) {
  const out = new Float64Array(Math.max(1, columns | 0));
  const a = Math.max(HIST_MIN, Math.round(lo)), b = Math.min(HIST_MAX, Math.round(hi));
  if (b < a) return out;
  const n = out.length, span = hi - lo + 1;
  for (let hu = a; hu <= b; hu++) {
    let c = Math.floor((hu - lo) / span * n);
    if (c < 0) c = 0; else if (c >= n) c = n - 1;
    out[c] += hist[hu - HIST_MIN];
  }
  return out;
}
// the HU extent that holds data (first / last non-empty bin), or null for an empty histogram
export function histExtent(hist) {
  let a = 0, b = HIST_BINS - 1;
  while (a < HIST_BINS && !hist[a]) a++;
  if (a >= HIST_BINS) return null;
  while (b > a && !hist[b]) b--;
  return [binToHu(a), binToHu(b)];
}
// count, mean, SD (population), min, max and the percentiles p5 / p25 / p50 / p75 / p95, all from the bins (bin value = its HU;
// a percentile is the first bin whose cumulative count reaches p % of the voxels, "nearest rank"). Empty: count 0, the rest null.
export function histStats(hist, percentiles = HIST_PERCENTILES) {
  const count = histCount(hist);
  const out = { count, mean: null, sd: null, min: null, max: null, percentiles: Object.fromEntries(percentiles.map(p => [p, null])) };
  if (!count) return out;
  let sum = 0, first = -1, last = -1;
  for (let i = 0; i < HIST_BINS; i++) {
    const c = hist[i];
    if (!c) continue;
    if (first < 0) first = i;
    last = i;
    sum += c * binToHu(i);
  }
  const mean = sum / count;
  let ss = 0;
  for (let i = first; i <= last; i++) { const c = hist[i]; if (c) { const d = binToHu(i) - mean; ss += c * d * d; } }
  out.mean = mean; out.sd = Math.sqrt(ss / count); out.min = binToHu(first); out.max = binToHu(last);
  const targets = percentiles.map(p => Math.max(1, Math.ceil(count * p / 100)));
  const order = percentiles.map((p, i) => i).sort((x, y) => percentiles[x] - percentiles[y]);
  let cum = 0, pi = 0;
  for (let i = first; i <= last && pi < order.length; i++) {
    cum += hist[i];
    while (pi < order.length && cum >= targets[order[pi]]) { out.percentiles[percentiles[order[pi]]] = binToHu(i); pi++; }
  }
  return out;
}
// volume in mm³ of `count` voxels (null when the spacing is unknown)
export function voxelsToMm3(count, spacing) {
  if (!spacing || spacing.length < 3) return null;
  const v = (+spacing[0]) * (+spacing[1]) * (+spacing[2]);
  return Number.isFinite(v) && v > 0 ? count * v : null;
}
// pixel <-> HU for the chart (window [lo, hi], plot width w)
export const huToX = (hu, lo, hi, w) => (hu - lo) / Math.max(1, hi - lo) * w;
export const xToHu = (x, lo, hi, w) => lo + x / Math.max(1, w) * (hi - lo);
