// HU line in VR, pure part (build 545): no DOM, no three.js, no app state (unit-tested in tests/unit/vr-hu-line-core.test.js).
// The controller ray hit -> a voxel position of the shared model (hu-line-model.js), the update rate of the hand panel, the panel's layout,
// the plot geometry and the texts. The stateful part (three.js objects, the gesture, the sampling calls) is vr-hu-line.js.

export const HU_PANEL_INTERVAL_MS = 80; // the hand panel's sampling + redraw rate while dragging: 12.5 Hz (the spec: 10-15 Hz)
export const HU_MIN_LENGTH_VOXELS = 1;  // a release closer to the start than this is a mis-click: the previous line is kept
// ready(now, dirty) -> true at most once per interval while dirty; reset() makes the next call ready. Allocation-free (createLiveGate's step() returns an object).
export function createHuPanelGate(intervalMs = HU_PANEL_INTERVAL_MS) {
  let last = -Infinity;
  return {
    ready(now, dirty) { if (!dirty || now - last < intervalMs) return false; last = now; return true; },
    reset() { last = -Infinity; }
  };
}

// the local point (volume object space, as vr-point.js voxelToLocal) -> voxel {i,j,k} written into `out` (float: a ray rarely lands on a centre)
// null when the point is outside the volume box (a half voxel of margin, as the PC model's voxelInside)
export function localToVoxelInto(p, halfExt, dims, out) {
  if (!p || !halfExt || !dims || !out) return null;
  const i = (p.x / (2 * halfExt[0]) + 0.5) * dims.columns - 0.5, j = (0.5 - p.y / (2 * halfExt[1])) * dims.rows - 0.5, k = (p.z / (2 * halfExt[2]) + 0.5) * dims.slices - 0.5; // = analysis-label.js voxelFromLocalVr, without its allocation
  if (!Number.isFinite(i) || !Number.isFinite(j) || !Number.isFinite(k)) return null;
  const m = 0.5; // a half voxel of margin, as the PC model's voxelInside
  if (i < -m || j < -m || k < -m || i > dims.columns - 1 + m || j > dims.rows - 1 + m || k > dims.slices - 1 + m) return null;
  out.i = i; out.j = j; out.k = k;
  return out;
}
// the inverse: voxel {i,j,k} -> the local point written into `out` {x,y,z} (a THREE.Vector3 works too)
export function voxelToLocalInto(v, halfExt, dims, out) {
  out.x = ((v.i + 0.5) / dims.columns - 0.5) * 2 * halfExt[0];
  out.y = (0.5 - (v.j + 0.5) / dims.rows) * 2 * halfExt[1];
  out.z = ((v.k + 0.5) / dims.slices - 0.5) * 2 * halfExt[2];
  return out;
}
// What the laser points at, like PC (hu-line-3d.js pickHuLinePoint): the first visible tissue surface (vh.local: the march of vr-view.js
// volumeHitRay, which already skips what a clipping section cuts away); when the ray meets no tissue, the selected section plane
// (sh.point, inside the box). Both are local points. Writes the voxel into `out` and returns where it came from ('volume' | 'section'), or null (nothing is allocated).
export function voxelFromHits(vh, sh, halfExt, dims, out) {
  if (vh?.local && localToVoxelInto(vh.local, halfExt, dims, out)) return 'volume';
  if (sh?.point && localToVoxelInto(sh.point, halfExt, dims, out)) return 'section';
  return null;
}
// distance a -> b in mm (spacing [sx, sy, sz])
export const voxelDistanceMm = (a, b, spacing) => Math.hypot((b.i - a.i) * (spacing?.[0] || 1), (b.j - a.j) * (spacing?.[1] || 1), (b.k - a.k) * (spacing?.[2] || 1));
// is the VR grid the grid the HU values are read from (the line is stored in voxel coordinates of ONE grid)
export const sameGrid = (a, b) => !!a && !!b && a.columns === b.columns && a.rows === b.rows && a.slices === b.slices;

// ---- the live values: the VR volume texture's CPU copy ----
// vr-view.js keeps the data the VR texture is built from (prepared.vd: rg8-packed u16, grid dims [tw,th,td], calibration [slope, intercept, bias]).
// It is built from the FILTERED slices when image filters are on (else the raw DICOM), so it is a real, always-resident source for the coarse
// live preview: nothing is decoded, filtered or waited for. HU = (u16 - bias) * slope + intercept. The grid may be reduced against the volume
// (VR texture <= 512 per side): then a sample is a trilinear read of the reduced grid = APPROXIMATE (shown as such); same grid: exact up to the
// packing's rounding to one raw unit. The release always does the exact full read (effective-hu), so the final values equal the PC's.
export const textureIsReduced = (tex, src) => !!tex && !!src && (tex.dims[0] !== src.columns || tex.dims[1] !== src.rows || tex.dims[2] !== src.slices);
// does the texture hold what the effective mode asks for? (filtered mode with filters on needs a filtered texture; raw / no filters needs a raw one)
export const textureMatchesMode = (tex, modeKey) => !!tex && !!tex.data && (modeKey === 'filtered') === !!tex.filtered;
// samples = lineSamples() result in the volume's voxel coordinates (x, y, z); out: Float64Array(samples.n). Trilinear over the texture grid.
export function sampleTexture(samples, tex, src, out) {
  const [tw, th, td] = tex.dims, d = tex.data, [slope, intercept, bias] = tex.calibration, sx = tw / src.columns, sy = th / src.rows, sz = td / src.slices, plane = tw * th;
  const at = (x, y, z) => { const o = (z * plane + y * tw + x) * 2; return d[o] | (d[o + 1] << 8); };
  for (let q = 0; q < samples.n; q++) {
    let u = (samples.x[q] + 0.5) * sx - 0.5, v = (samples.y[q] + 0.5) * sy - 0.5, w = (samples.z[q] + 0.5) * sz - 0.5;
    u = u < 0 ? 0 : u > tw - 1 ? tw - 1 : u; v = v < 0 ? 0 : v > th - 1 ? th - 1 : v; w = w < 0 ? 0 : w > td - 1 ? td - 1 : w;
    const x0 = Math.floor(u), y0 = Math.floor(v), z0 = Math.floor(w), x1 = Math.min(tw - 1, x0 + 1), y1 = Math.min(th - 1, y0 + 1), z1 = Math.min(td - 1, z0 + 1), fx = u - x0, fy = v - y0, fz = w - z0;
    const c00 = at(x0, y0, z0) * (1 - fx) + at(x1, y0, z0) * fx, c10 = at(x0, y1, z0) * (1 - fx) + at(x1, y1, z0) * fx;
    const c01 = at(x0, y0, z1) * (1 - fx) + at(x1, y0, z1) * fx, c11 = at(x0, y1, z1) * (1 - fx) + at(x1, y1, z1) * fx;
    const lo = c00 * (1 - fy) + c10 * fy, hi = c01 * (1 - fy) + c11 * fy;
    out[q] = (lo * (1 - fz) + hi * fz - bias) * slope + intercept;
  }
  return out;
}
// a read error as a clear message (never a bare internal code). '__SUPERSEDED__' = the filters changed meanwhile: not an error to show.
export function readErrorText(lang, e) {
  const m = String(e?.message || e || ''), ja = lang !== 'en';
  if (m.includes('__SUPERSEDED__')) return '';
  if (m.includes('__GPU_UNAVAILABLE__')) return ja ? 'フィルター後の値の計算に WebGPU が必要ですが使えません。HU線タブで「元の値」に切り替えてください' : 'Filtered values need WebGPU, which is not available. Switch to Raw in the HU line tab';
  return (ja ? 'HU線の読み取りに失敗: ' : 'HU line read failed: ') + m.slice(0, 60);
}

// ---- the hand panel (a canvas of PANEL_W x PANEL_H px) ----
export const PANEL_W = 512, PANEL_H = 300, PANEL_WORLD_W = 0.17; // world width in metres (height follows the aspect)
export function panelLayout(w = PANEL_W, h = PANEL_H) {
  const pad = 14, head = 44, statH = 84, gap = 8, axisL = 58, axisB = 22;
  const py = head + gap + 6, plot = { x: pad + axisL, y: py, w: w - 2 * pad - axisL, h: h - pad - statH - gap - (axisB + 4) - py };
  const sw = (w - 2 * pad - 2 * gap) / 3, sy = h - pad - statH;
  return {
    pad, head: { x: pad, y: 0, w: w - 2 * pad, h: head }, plot,
    axisX: { x: plot.x, y: plot.y + plot.h + 4, w: plot.w, h: axisB },
    stats: [0, 1, 2].map(i => ({ x: pad + i * (sw + gap), y: sy, w: sw, h: statH }))
  };
}
// the HU range of the plot: min..max of the stats with a margin (a flat line still gets a visible span); [lo, hi]
export function huRange(stats) {
  if (!stats || stats.min == null || stats.max == null) return [-100, 100];
  let lo = stats.min, hi = stats.max;
  const span = Math.max(hi - lo, 20), m = span * 0.08;
  if (hi - lo < 20) { const c = (hi + lo) / 2; lo = c - 10; hi = c + 10; }
  return [lo - m, hi + m];
}
// plot points: x from dist (mm) over [0, maxMm], y from value over [lo, hi]; written into `out` (Float32Array, x, y pairs), NaN values give a NaN y
// (a gap). Returns the number of points. No allocation.
export function plotPoints(dist, values, n, rect, lo, hi, maxMm, out) {
  const cnt = Math.min(n, (out.length / 2) | 0), sx = maxMm > 0 ? rect.w / maxMm : 0, sy = hi > lo ? rect.h / (hi - lo) : 0;
  for (let q = 0; q < cnt; q++) {
    const v = values[q];
    out[2 * q] = rect.x + (maxMm > 0 ? dist[q] * sx : rect.w / 2);
    out[2 * q + 1] = v === v ? rect.y + rect.h - (Math.min(hi, Math.max(lo, v)) - lo) * sy : NaN;
  }
  return cnt;
}
// Texts (ja / en). modeKey: 'filtered' | 'raw' (the mode really read). busy: the full read is running (a live preview is shown meanwhile).
export function panelTexts(lang, { stats, lengthMm, modeKey, live, approx, busy, empty, failed }) {
  const ja = lang !== 'en', f = (x, d) => (x == null || !Number.isFinite(x) ? '—' : x.toFixed(d));
  return {
    title: (ja ? 'HU線' : 'HU line') + ' · ' + (modeKey === 'raw' ? (ja ? '元の値' : 'Raw') : (ja ? 'フィルター後' : 'Filtered')) + (live ? (approx ? (ja ? ' · ライブ（概算）' : ' · live (approx.)') : (ja ? ' · ライブ' : ' · live')) : failed ? (ja ? ' · 読み取り失敗（ライブ値）' : ' · read failed (live values)') : busy ? (ja ? ' · 計算中…' : ' · reading…') : ''),
    length: lengthMm > 0 ? f(lengthMm, 1) + ' mm' : '',
    empty: empty ? (ja ? 'ライブ値なし（離すと計算します）' : 'No live values (computed on release)') : '',
    stats: [[ja ? '平均' : 'Mean', f(stats?.mean, 1)], [ja ? '最小' : 'Min', f(stats?.min, 0)], [ja ? '最大' : 'Max', f(stats?.max, 0)]]
  };
}
// the menu tab's texts
export function huMenuTexts(lang) {
  return lang === 'en'
    ? { tab: 'HU line', title: 'HU line (line profile)', arm: 'HU line tool', on: 'ON', off: 'OFF', clear: 'Clear the line', mode: 'Values', filtered: 'Filtered', raw: 'Raw', modeNote: 'Same setting as the 2D/3D screens',
        help: ['ON: pull the trigger on the volume = START, keep it held and move = the line stretches, release = END', 'The graph, mean, min and max follow on the panel at your hand (about 12 times a second, approximate), the exact values after the release',
          'No tissue under the laser: the selected section plane is used. With a section cut, only the visible surface counts', 'The line is shared with the 2D / 3D screens (both ways). OFF returns the trigger to its normal actions'],
        armedFlash: 'HU line ON: trigger = start, hold, release = end', disarmFlash: 'HU line OFF', clearedFlash: 'HU line cleared', gridFlash: 'HU line is not available for this data', hasLine: 'Line: ', none: 'No line' }
    : { tab: 'HU線', title: 'HU線（ラインプロファイル）', arm: 'HU線ツール', on: 'ON', off: 'OFF', clear: '線を消す', mode: '値', filtered: 'フィルター後', raw: '元の値', modeNote: '2D/3D画面と同じ設定です',
        help: ['ON：ボリュームにレーザーを当ててトリガーを押す＝始点、押したまま動かす＝線が伸びる、離す＝終点', '手元のパネルにグラフと平均・最小・最大が表示されます（1秒に約12回更新・概算、離すと正確な値）',
          '組織に当たらないときは選択中の断面に当たります。断面で切ったときは見えている表面だけが対象です', '線は2D／3D画面と共有されます（どちらで引いても両方に出ます）。OFFでトリガーは通常の動作に戻ります'],
        armedFlash: 'HU線 ON：トリガー＝始点、押したまま動かし、離す＝終点', disarmFlash: 'HU線 OFF', clearedFlash: 'HU線を消しました', gridFlash: 'このデータではHU線を使えません', hasLine: '線：', none: '線はありません' };
}
