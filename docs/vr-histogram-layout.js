// VR histogram board (build 543): pure layout and redraw rules, no THREE, no DOM (unit-tested: tests/unit/vr-histogram-layout.test.js).
// The board is one canvas texture (bars, axes, stats table) that is redrawn only when the data or the segment ranges change, plus a few
// small quads for the HU range lines that are only moved. Everything the two share lives here: the pixel layout of the canvas, the
// HU -> position mapping (metres on the board, for the quads), the chart window and the redraw policy.
import { histStats, huToX, voxelsToMm3 } from './histogram.js?v=20261010-build544';

// canvas size and the plot rectangle inside it (px)
export const PANEL_W = 1024, PANEL_H = 768;
export const PLOT = { x: 96, y: 100, w: 900, h: 260 };
export const TABLE = { y: 436, rowH: 40, maxRows: 5 };
export const STATUS_Y = 726;
// a range line is a thin quad as tall as the plot; its HU label sits above the plot
export const LINE_W_M = 0.0016, LINE_WIN_W_M = 0.0010, LABEL_W_M = 0.052, LABEL_H_M = 0.0205;
export const LABEL_PX = { w: 120, h: 48 };

// how long a change of a segment range must be quiet before the bars are redrawn (the lines move at once), and the shortest gap between redraws
export const SETTLE_MS = 150, MIN_GAP_MS = 100;

export const boardHeightM = widthM => widthM * PANEL_H / PANEL_W;
// canvas px -> metres from the board centre (x right, y up)
export const pxToLocalX = (px, widthM) => (px / PANEL_W - 0.5) * widthM;
export const pxToLocalY = (py, widthM) => (0.5 - py / PANEL_H) * boardHeightM(widthM);

// the number of bar columns for the window [lo, hi]: one per HU when there is room, else at most one per 2 px
export const columnsFor = (lo, hi) => Math.max(1, Math.min(Math.round(hi - lo + 1), Math.floor(PLOT.w / 2)));
// 0..1 bar height for a count
export const barFraction = (count, ymax, log) => (ymax > 0 && count > 0 ? (log ? Math.log10(1 + count) / Math.log10(1 + ymax) : count / ymax) : 0);
export const countLabel = n => (n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? Math.round(n / 1e3) + 'k' : String(n));

// x of an HU on the board for the line quads: out.x in metres from the board centre, out.visible false when the HU is outside the window
// (writes into `out`, so the per-frame caller allocates nothing)
export function lineLayout(hu, lo, hi, widthM, out) {
  const ok = hu === hu && hu >= lo && hu <= hi;
  out.visible = ok;
  out.x = ok ? pxToLocalX(PLOT.x + huToX(hu, lo, hi, PLOT.w), widthM) : 0;
  return out;
}
// the plot's vertical centre and height on the board (metres): the line quads are as tall as the plot
export const plotMetrics = widthM => ({ cy: pxToLocalY(PLOT.y + PLOT.h / 2, widthM), h: PLOT.h / PANEL_H * boardHeightM(widthM), top: pxToLocalY(PLOT.y, widthM) });
// the label above a line: side -1 (the min line) hangs to the left of its line, side +1 (the max line) to the right, so two close lines do not cover each other's number
export const labelCenterX = (lineX, side) => lineX + side * (LABEL_W_M / 2 + 0.002);

// the bar texture must be redrawn when the data arrived (dataDirty) or the segment ranges moved and stayed still for SETTLE_MS (rangeDirty);
// never more often than every MIN_GAP_MS. A drag therefore moves the lines every frame and redraws the bars once it pauses / ends.
export function shouldRedraw({ dataDirty, rangeDirty, now, lastDraw, rangeAt }) {
  if (!dataDirty && !rangeDirty) return false;
  if (now - lastDraw < MIN_GAP_MS) return false;
  return dataDirty || now - rangeAt >= SETTLE_MS;
}
// compare the live segment numbers with the snapshot taken at the last look, storing the new ones: [min, max, shown] per key.
// Returns true when anything changed. `keys` / `segs` are read, `snap` (Float64Array(3 * keys.length)) is updated in place.
export function snapshotRanges(keys, segs, snap) {
  let changed = false;
  for (let i = 0; i < keys.length; i++) {
    const s = segs[keys[i]], on = s && s.active && s.enabled ? 1 : 0;
    const a = on ? +(s.userMin ?? s.min) : 0, b = on ? +(s.userMax ?? s.max) : 0;
    if (snap[3 * i] !== a || snap[3 * i + 1] !== b || snap[3 * i + 2] !== on) { snap[3 * i] = a; snap[3 * i + 1] = b; snap[3 * i + 2] = on; changed = true; }
  }
  return changed;
}

// ---- stats table ----
const fmt = (x, d = 1) => (x == null ? '—' : x.toFixed(d));
// the columns of the table (x of the right edge / left edge in px): name is left aligned, the numbers right aligned
export function tableColumns(hasVolume) {
  const cols = [{ id: 'name', x: 24, align: 'left' }, { id: 'count', x: 330, align: 'right' }];
  if (hasVolume) cols.push({ id: 'volume', x: 500, align: 'right' });
  cols.push({ id: 'mean', x: hasVolume ? 610 : 480, align: 'right' }, { id: 'sd', x: hasVolume ? 700 : 600, align: 'right' }, { id: 'p50', x: hasVolume ? 790 : 720, align: 'right' },
    { id: 'min', x: hasVolume ? 890 : 840, align: 'right' }, { id: 'max', x: hasVolume ? 990 : 980, align: 'right' });
  return cols;
}
// one table row's cells keyed by column id; a stats object from histStats (null = not ready yet)
export function statsCells(stats, spacing, hasVolume) {
  if (!stats) return null;
  const c = { count: stats.count.toLocaleString('en-US'), mean: fmt(stats.mean), sd: fmt(stats.sd), p50: fmt(stats.percentiles?.[50], 0), min: fmt(stats.min, 0), max: fmt(stats.max, 0) };
  if (hasVolume) { const v = voxelsToMm3(stats.count, spacing); c.volume = v == null ? '—' : v.toLocaleString('en-US', { maximumFractionDigits: 1 }); }
  return c;
}
// the rows of the table: [{key, name, color, draft, stats}] — every shown segment, or the whole volume when no segment is shown; capped to TABLE.maxRows
export function tableRows(res, nameOf, wholeName) {
  const rows = res.list.map(r => ({ key: r.key, name: nameOf(r.key), color: r.seg.color, draft: !!r.draft, stats: r.hist ? histStats(r.hist) : null }));
  if (!rows.length && res.total) rows.push({ key: 'all', name: wholeName, color: '#8c969c', draft: !!res.total.draft, stats: histStats(res.total.hist) });
  return rows.slice(0, TABLE.maxRows);
}
