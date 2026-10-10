// VR histogram board (build 543): the per-segment HU histogram of the PC analysis (histogram-ui.js: the same bins, cache, filtered / raw values and
// stats) drawn on a floating canvas board. THREE is passed in (no import, no DOM at module level), as with vr-undo-button.js.
// Cost rules (Quest 3, 72 fps):
//  - the BARS texture (axes, bars, stats table) is redrawn only when the data changed (invalidate(), called from the histogram change listener), or
//    when a segment range moved and has been still for SETTLE_MS (vr-histogram-layout.js shouldRedraw). Never per frame, and not while a slider is dragged.
//  - the HU range lines are small quads (one per segment min / max, plus the VR slice window): per frame the panel only compares the live numbers
//    with what it placed last and moves a quad when one differs, so a dragged slider moves its line every frame with no texture work at all.
//    Each line's number is a tiny canvas that is redrawn only when the rounded HU or the colour changes.
//  - nothing is allocated in update(); every object it touches is created in createVrHistogramPanel.
import { rebinHist, niceStep, huToX } from './histogram.js?v=20261010-build543';
import { PANEL_W, PANEL_H, PLOT, TABLE, STATUS_Y, LINE_W_M, LINE_WIN_W_M, LABEL_W_M, LABEL_H_M, LABEL_PX, boardHeightM, columnsFor, barFraction, countLabel, windowOf, lineLayout, plotMetrics, labelCenterX, shouldRedraw, snapshotRanges, tableColumns, statsCells, tableRows } from './vr-histogram-layout.js?v=20261010-build543';

const WIN_COLOR = '#ffffff';
// opts: keys (segment ids), segs (segmentState), getView() -> {volume, res, busy, message, noSeg}, nameOf(key), modeText() (e.g. "Filtered · Linear"),
//       L {title, whole, busy, noSeg, window, cols:{name,count,volume,mean,sd,p50,min,max}, empty}, log() -> bool, widthM
export function createVrHistogramPanel(THREE, opts) {
  const { keys, segs, getView, nameOf, modeText, L, widthM } = opts;
  const canvas = document.createElement('canvas'); canvas.width = PANEL_W; canvas.height = PANEL_H;
  const ctx = canvas.getContext('2d'), tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace;
  const group = new THREE.Group(); group.visible = false;
  const board = new THREE.Mesh(new THREE.PlaneGeometry(widthM, boardHeightM(widthM)), new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false }));
  board.renderOrder = 1; group.add(board);
  const pm = plotMetrics(widthM), lineGeo = new THREE.PlaneGeometry(1, 1), labelGeo = new THREE.PlaneGeometry(LABEL_W_M, LABEL_H_M);
  // line slots: 2 per segment (min, max) and 2 for the VR slice window; [line quad, label quad, label canvas] each
  const mkSlot = (side, wide) => {
    const lc = document.createElement('canvas'); lc.width = LABEL_PX.w; lc.height = LABEL_PX.h;
    const lt = new THREE.CanvasTexture(lc); lt.colorSpace = THREE.SRGBColorSpace;
    const line = new THREE.Mesh(lineGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }));
    line.scale.set(wide, pm.h + 0.004, 1); line.position.z = 0.0008; line.renderOrder = 2; line.visible = false;
    const label = new THREE.Mesh(labelGeo, new THREE.MeshBasicMaterial({ map: lt, transparent: true, toneMapped: false, depthWrite: false }));
    label.position.z = 0.0012; label.renderOrder = 3; label.visible = false;
    group.add(line, label);
    return { line, label, lc, lctx: lc.getContext('2d'), lt, side, on: false, hu: NaN, ver: -1, color: '', shownHu: NaN, shownColor: '' };
  };
  const slots = [];
  for (let i = 0; i < keys.length; i++) slots.push(mkSlot(-1, LINE_W_M), mkSlot(1, LINE_W_M));
  const winSlots = [mkSlot(-1, LINE_WIN_W_M), mkSlot(1, LINE_WIN_W_M)];
  const tmp = { x: 0, visible: false }, snap = new Float64Array(3 * keys.length);
  const rd = { dataDirty: false, rangeDirty: false, now: 0, lastDraw: 0, rangeAt: 0 }; // the argument of shouldRedraw, reused every frame
  let open = false, dataDirty = false, rangeDirty = false, rangeAt = 0, lastDraw = -1e9, drawCount = 0, haveWindow = false, lo = 0, hi = 1, ver = 0;

  const drawLabel = (s, hu, color) => {
    const c = s.lctx, w = LABEL_PX.w, h = LABEL_PX.h;
    c.clearRect(0, 0, w, h); c.fillStyle = 'rgba(14,20,27,.9)'; c.beginPath(); c.roundRect(1, 1, w - 2, h - 2, 10); c.fill();
    c.strokeStyle = color; c.lineWidth = 3; c.stroke();
    c.fillStyle = '#fff'; c.font = 'bold 28px system-ui,sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(Math.round(hu)), w / 2, h / 2 + 1);
    s.lt.needsUpdate = true; s.shownHu = Math.round(hu); s.shownColor = color;
  };
  const hide = s => { s.on = false; s.line.visible = false; s.label.visible = false; };
  // put a line where `hu` is (or hide it); does nothing when neither the value, the window nor the colour changed since the last call
  const place = (s, show, hu, color) => {
    if (!show || !haveWindow) { if (s.line.visible) hide(s); s.on = false; s.ver = -1; return; }
    if (s.on && hu === s.hu && s.ver === ver && color === s.color) return;
    s.on = true; s.hu = hu; s.ver = ver; s.color = color;
    lineLayout(hu, lo, hi, widthM, tmp);
    if (!tmp.visible) { s.line.visible = false; s.label.visible = false; return; }
    if (s.line.material.userData.c !== color) { s.line.material.color.set(color); s.line.material.userData.c = color; }
    s.line.position.x = tmp.x; s.line.position.y = pm.cy; s.line.visible = true;
    if (Math.round(hu) !== s.shownHu || color !== s.shownColor) drawLabel(s, hu, color);
    s.label.position.x = labelCenterX(tmp.x, s.side); s.label.position.y = pm.top + LABEL_H_M / 2 + 0.002; s.label.visible = true;
  };

  // ---- the bars texture ----
  const redraw = now => {
    drawCount++; lastDraw = now; dataDirty = false; rangeDirty = false;
    const W = PANEL_W, H = PANEL_H;
    ctx.clearRect(0, 0, W, H); ctx.fillStyle = 'rgba(14,20,27,.94)'; ctx.beginPath(); ctx.roundRect(0, 0, W, H, 30); ctx.fill();
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.font = 'bold 32px system-ui,sans-serif'; ctx.fillText(L.title, 24, 44);
    ctx.textAlign = 'right'; ctx.fillStyle = '#9fb3c3'; ctx.font = '24px system-ui,sans-serif'; ctx.fillText(modeText(), W - 24, 44);
    const view = getView();
    if (!view.volume) { haveWindow = false; ctx.textAlign = 'left'; ctx.fillText(L.empty, 24, 140); tex.needsUpdate = true; ver++; return; }
    const res = view.res, win = windowOf(res); lo = win[0]; hi = win[1]; haveWindow = true; ver++;
    const series = res.list.filter(s => s.hist);
    if (!res.list.length && res.total) series.push({ key: 'all', seg: { color: '#8c969c' }, hist: res.total.hist });
    const cols = columnsFor(lo, hi), bars = series.map(s => rebinHist(s.hist, lo, hi, cols));
    let ymax = 1; for (const b of bars) for (const c of b) if (c > ymax) ymax = c;
    const log = opts.log();
    // axes and HU ticks
    ctx.strokeStyle = '#8aa0b0'; ctx.fillStyle = '#9fb3c3'; ctx.lineWidth = 2; ctx.globalAlpha = 0.5;
    ctx.beginPath(); ctx.moveTo(PLOT.x, PLOT.y); ctx.lineTo(PLOT.x, PLOT.y + PLOT.h); ctx.lineTo(PLOT.x + PLOT.w, PLOT.y + PLOT.h); ctx.stroke();
    ctx.globalAlpha = 1; ctx.font = '20px system-ui,sans-serif'; ctx.textAlign = 'center';
    const step = niceStep(hi - lo, 9);
    for (let hu = Math.ceil(lo / step) * step; hu <= hi; hu += step) {
      const x = PLOT.x + huToX(hu, lo, hi, PLOT.w);
      ctx.globalAlpha = 0.18; ctx.beginPath(); ctx.moveTo(x, PLOT.y); ctx.lineTo(x, PLOT.y + PLOT.h); ctx.stroke();
      ctx.globalAlpha = 0.9; ctx.fillText(String(hu), x, PLOT.y + PLOT.h + 20);
    }
    ctx.globalAlpha = 0.9; ctx.textAlign = 'right'; ctx.fillText(countLabel(ymax), PLOT.x - 8, PLOT.y + 10); ctx.fillText('0', PLOT.x - 8, PLOT.y + PLOT.h);
    // bars (one colour per segment, overlaid)
    const bw = PLOT.w / cols;
    bars.forEach((b, i) => {
      ctx.fillStyle = series[i].seg.color; ctx.globalAlpha = series.length > 1 ? 0.55 : 0.78;
      for (let c = 0; c < cols; c++) { if (!b[c]) continue; const h = Math.max(1.5, barFraction(b[c], ymax, log) * PLOT.h); ctx.fillRect(PLOT.x + c * bw, PLOT.y + PLOT.h - h, Math.max(1.5, bw - 0.4), h); }
    });
    ctx.globalAlpha = 1;
    // stats table
    const sp = view.volume.spacing, hasVol = !!(sp && sp.length >= 3), tc = tableColumns(hasVol), rows = tableRows(res, nameOf, L.whole);
    ctx.font = 'bold 21px system-ui,sans-serif'; ctx.fillStyle = '#9fb3c3';
    for (const c of tc) { ctx.textAlign = c.align; ctx.fillText(L.cols[c.id] || '', c.x, TABLE.y); }
    rows.forEach((r, i) => {
      const y = TABLE.y + TABLE.rowH * (i + 1), cells = statsCells(r.stats, sp, hasVol);
      ctx.fillStyle = r.color; ctx.fillRect(tc[0].x, y - 9, 18, 18);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 26px system-ui,sans-serif'; ctx.textAlign = 'left'; ctx.fillText(r.name + (r.draft ? ' *' : ''), tc[0].x + 28, y);
      if (!cells) { ctx.textAlign = 'right'; ctx.fillText('…', tc[1].x, y); return; }
      ctx.font = '25px system-ui,sans-serif'; ctx.textAlign = 'right';
      for (let k = 1; k < tc.length; k++) ctx.fillText(cells[tc[k].id], tc[k].x, y);
    });
    // status line and the key of the white lines
    ctx.font = '22px system-ui,sans-serif'; ctx.textAlign = 'left'; ctx.fillStyle = '#ffd27a';
    ctx.fillText(view.busy ? L.busy : view.message || (view.noSeg ? L.noSeg : ''), 24, STATUS_Y);
    ctx.textAlign = 'right'; ctx.fillStyle = WIN_COLOR; ctx.fillText(L.window, W - 24, STATUS_Y);
    tex.needsUpdate = true;
  };

  return {
    group, board,
    get drawCount() { return drawCount; },
    get isOpen() { return open; },
    setOpen(on) {
      open = !!on; group.visible = open;
      if (open) { dataDirty = true; lastDraw = -1e9; haveWindow = false; snap.fill(NaN); for (const s of slots) s.on = false; for (const s of winSlots) s.on = false; } // first look: redraw at once
    },
    // new data / mode / language: the next update() redraws the bars (a redraw is at most one per MIN_GAP_MS)
    invalidate() { dataDirty = true; },
    // once per frame while the board is shown: winLo / winHi = the VR slice window in HU (NaN when none). No allocation.
    update(now, winLo, winHi) {
      if (!open) return;
      if (snapshotRanges(keys, segs, snap)) { rangeDirty = true; rangeAt = now; }
      rd.dataDirty = dataDirty; rd.rangeDirty = rangeDirty; rd.now = now; rd.lastDraw = lastDraw; rd.rangeAt = rangeAt;
      if (shouldRedraw(rd)) redraw(now);
      for (let i = 0; i < keys.length; i++) {
        const s = segs[keys[i]], on = !!(s && s.active && s.enabled);
        place(slots[2 * i], on, on ? +(s.userMin ?? s.min) : NaN, on ? s.color : '');
        place(slots[2 * i + 1], on, on ? +(s.userMax ?? s.max) : NaN, on ? s.color : '');
      }
      const wOn = winLo === winLo && winHi === winHi;
      place(winSlots[0], wOn, winLo, WIN_COLOR); place(winSlots[1], wOn, winHi, WIN_COLOR);
    },
    dispose() {
      tex.dispose(); board.geometry.dispose(); board.material.dispose(); lineGeo.dispose(); labelGeo.dispose();
      for (const s of [...slots, ...winSlots]) { s.lt.dispose(); s.line.material.dispose(); s.label.material.dispose(); }
      group.removeFromParent();
    },
  };
}
