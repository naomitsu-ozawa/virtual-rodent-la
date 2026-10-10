// HU line in VR (build 545): armed from the menu, trigger on the volume = START, held = the line stretches along the laser, release = END.
// The line lives in the SAME model as the 2D / 3D screens (hu-line-model.js, voxel coordinates), so a line drawn here shows on the PC views and
// the other way round. The values are the same effective (filtered / raw) HU as on the PC (effective-hu*.js, line-profile.js, hu-line-live.js):
// while dragging a COARSE preview (<= 192 samples, only data already in memory) about 12 times a second, the full read on release.
// vr-view.js owns the controllers, the laser pick and the menu; this module owns the line mesh, the hand panel and the gesture.
//   createVrHuLine(THREE, env) -> { start(c), end(c), update(now), setArmed, isArmed, clear, hasLine, dispose, ... }
//   env: { mesh(): the volume mesh | null, halfExt(), dims(), pick(c, out): voxel {i,j,k} | null (the laser's), pulse(c, amp, ms), flash(text), refresh(), language }
// Frame cost: nothing is allocated while idle or dragging (vectors / arrays are reused); the panel canvas is redrawn only when a sample arrives
// (<= 12.5 Hz), its texture has no mipmaps. The pick runs once per frame only while the trigger is held.
import { getHuLine, setHuLine, clearHuLine, onHuLineChange } from './hu-line-model.js?v=20261010-build545';
import { lineSamples, sampleLine, profileStats } from './line-profile.js?v=20261010-build545';
import { liveProfile, LIVE_MAX_SAMPLES } from './hu-line-live.js?v=20261010-build545';
import { getHuMode, onHuModeChange, resolveHuMode } from './effective-hu.js?v=20261010-build545';
import { readEffectiveSlice, rawHuVolume, peekEffectiveReaders } from './effective-hu-source.js?v=20261010-build545';
import { sourceFilterStages } from './source-filters.js?v=20261010-build545';
import { frameYield } from './utils.js?v=20261010-build545';
import { HAPTIC } from './vr-point.js?v=20261010-build545';
import { createHuPanelGate, HU_MIN_LENGTH_VOXELS, voxelToLocalInto, voxelDistanceMm, sameGrid, PANEL_W, PANEL_H, PANEL_WORLD_W, panelLayout, huRange, plotPoints, panelTexts, huMenuTexts } from './vr-hu-line-core.js?v=20261010-build545';

const LINE_COLOR = 0x35e0ff, START_COLOR = 0x7dffb0, TUBE_R_M = 0.0010, DOT_R_M = 0.0026; // thin tube (1 mm radius at real size) + end markers, in world metres
const PANEL_POS = [0, 0.12, -0.05], PANEL_TILT = -0.5; // in the controller's frame: above the hand, tilted up towards the eyes

export function createVrHuLine(THREE, env) {
  const t = () => huMenuTexts(env.language);
  const gate = createHuPanelGate(), layout = panelLayout(), plotBuf = new Float32Array(2 * 4096);
  let armed = false, g = null, token = 0, tubeDirty = true, scaleCache = 0, fullBusy = false, res = null, panelHand = null, panelOn = false, disposed = false;
  const a = { i: 0, j: 0, k: 0 }, b = { i: 0, j: 0, k: 0 }, pick = { i: 0, j: 0, k: 0 }; // the shown endpoints (reused), the pick scratch
  const pa = new THREE.Vector3(), pb = new THREE.Vector3(), dir = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), tmpS = new THREE.Vector3();
  let shown = false; // the line is currently drawn (model line or the one being dragged)

  // ---- the line: a thin tube + two end dots, children of the volume mesh (they move / scale with it), drawn over the volume ----
  const mat = (color, op = 1) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, depthTest: false, depthWrite: false, toneMapped: false });
  const tubeGeo = new THREE.CylinderGeometry(1, 1, 1, 8, 1, true), dotGeo = new THREE.SphereGeometry(1, 12, 8);
  const halo = new THREE.Mesh(tubeGeo, mat(0x000000, 0.55)), tube = new THREE.Mesh(tubeGeo, mat(LINE_COLOR)), dotA = new THREE.Mesh(dotGeo, mat(START_COLOR)), dotB = new THREE.Mesh(dotGeo, mat(LINE_COLOR));
  const grp = new THREE.Group(); grp.visible = false; grp.name = 'vr-hu-line';
  for (const [o, ro] of [[halo, 7], [tube, 8], [dotA, 9], [dotB, 9]]) { o.renderOrder = ro; o.frustumCulled = false; grp.add(o); }

  // ---- the hand panel: a CanvasTexture redrawn only when new samples arrive ----
  const canvas = document.createElement('canvas'); canvas.width = PANEL_W; canvas.height = PANEL_H;
  const ctx = canvas.getContext('2d'), tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace; tex.generateMipmaps = false; tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter;
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(PANEL_WORLD_W, PANEL_WORLD_W * PANEL_H / PANEL_W), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
  panel.renderOrder = 10; panel.frustumCulled = false; panel.visible = false; panel.position.set(...PANEL_POS); panel.rotation.x = PANEL_TILT; panel.name = 'vr-hu-panel';

  const modeKey = () => resolveHuMode(getHuMode(), sourceFilterStages().length);
  function drawPanel() {
    if (disposed) return;
    const W = PANEL_W, H = PANEL_H, st = res?.stats, L = layout, v = rawHuVolume();
    const lengthMm = res && v ? voxelDistanceMm(res.a, res.b, v.spacing) : 0;
    const tx = panelTexts(env.language, { stats: st, lengthMm, modeKey: modeKey(), live: !!res?.live, busy: fullBusy && !res?.live, empty: !res });
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(14,20,27,.92)'; ctx.beginPath(); ctx.roundRect(0, 0, W, H, 22); ctx.fill();
    ctx.strokeStyle = res?.live ? '#ffd23d' : '#35e0ff'; ctx.lineWidth = 4; ctx.stroke();
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#e9f3fb'; ctx.font = 'bold 26px system-ui,sans-serif'; ctx.textAlign = 'left'; ctx.fillText(tx.title, L.head.x, L.head.y + L.head.h / 2 + 4);
    ctx.fillStyle = '#9fb3c3'; ctx.font = '24px system-ui,sans-serif'; ctx.textAlign = 'right'; ctx.fillText(tx.length, L.head.x + L.head.w, L.head.y + L.head.h / 2 + 4);
    const p = L.plot;
    ctx.fillStyle = 'rgba(255,255,255,.06)'; ctx.fillRect(p.x, p.y, p.w, p.h);
    if (res && st && st.count > 0) {
      const [lo, hi] = huRange(st), n = plotPoints(res.samples.dist, res.values, res.samples.n, p, lo, hi, res.samples.length, plotBuf);
      ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 1; ctx.fillStyle = '#9fb3c3'; ctx.font = '20px system-ui,sans-serif'; ctx.textAlign = 'right';
      for (const [val, yy] of [[hi, p.y], [lo, p.y + p.h]]) { ctx.beginPath(); ctx.moveTo(p.x, yy); ctx.lineTo(p.x + p.w, yy); ctx.stroke(); ctx.fillText(String(Math.round(val)), p.x - 6, Math.min(p.y + p.h - 6, Math.max(p.y + 8, yy))); }
      ctx.textAlign = 'center'; ctx.fillText('0', p.x, L.axisX.y + 12); ctx.fillText(Math.round(res.samples.length) + ' mm', p.x + p.w - 22, L.axisX.y + 12);
      ctx.strokeStyle = '#35e0ff'; ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.beginPath();
      let pen = false;
      for (let q = 0; q < n; q++) { const x = plotBuf[2 * q], y = plotBuf[2 * q + 1]; if (y !== y) { pen = false; continue; } if (pen) ctx.lineTo(x, y); else { ctx.moveTo(x, y); pen = true; } }
      ctx.stroke();
    } else { ctx.fillStyle = '#9fb3c3'; ctx.font = '24px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.fillText(tx.empty, p.x + p.w / 2, p.y + p.h / 2); }
    for (let i = 0; i < 3; i++) {
      const r = L.stats[i];
      ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 12); ctx.fill();
      ctx.textAlign = 'center'; ctx.fillStyle = '#9fb3c3'; ctx.font = '22px system-ui,sans-serif'; ctx.fillText(tx.stats[i][0] + ' HU', r.x + r.w / 2, r.y + 20);
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 38px system-ui,sans-serif'; ctx.fillText(tx.stats[i][1], r.x + r.w / 2, r.y + r.h - 28);
    }
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    tex.needsUpdate = true;
  }
  function showPanel(c) {
    if (panelHand !== c) { panel.parent?.remove(panel); c.add(panel); panelHand = c; }
    panel.visible = panelOn = true;
  }
  function hidePanel() { panel.visible = panelOn = false; panel.parent?.remove(panel); panelHand = null; }

  // ---- sampling (the same functions as the PC panel) ----
  function liveSample() {
    const v = rawHuVolume(); if (!v || !g) return;
    const r = liveProfile(g.a, g.b, v.spacing, { columns: v.columns, rows: v.rows, slices: v.slices }, peekEffectiveReaders({ mode: getHuMode(), volume: v }), LIVE_MAX_SAMPLES);
    if (r) res = { samples: r.samples, values: r.values, stats: profileStats(r.values), a: { i: g.a.i, j: g.a.j, k: g.a.k }, b: { i: g.b.i, j: g.b.j, k: g.b.k }, live: true };
    drawPanel();
  }
  async function fullRead(la, lb) {
    const v = rawHuVolume(); if (!v) return;
    const tok = ++token, mode = getHuMode(), dims = { columns: v.columns, rows: v.rows, slices: v.slices };
    fullBusy = true; if (panelOn) drawPanel();
    try {
      const samples = lineSamples(la, lb, v.spacing);
      const values = await sampleLine(samples, dims, z => readEffectiveSlice(z, { mode, volume: v }), { cancelled: () => tok !== token || disposed, yieldFn: frameYield, yieldMs: 6 });
      if (!values || tok !== token) return;
      res = { samples, values, stats: profileStats(values), a: la, b: lb, live: false };
    } catch (e) { console.warn('VR HU line read failed', e); if (tok === token) env.flash((env.language === 'en' ? 'HU line read failed: ' : 'HU線の読み取りに失敗: ') + String(e?.message || e)); }
    finally { if (tok === token) { fullBusy = false; if (panelOn) drawPanel(); } }
  }

  // ---- the line mesh ----
  function setEnds(ea, eb, withB) {
    a.i = ea.i; a.j = ea.j; a.k = ea.k;
    if (eb) { b.i = eb.i; b.j = eb.j; b.k = eb.k; }
    shown = true; tubeDirty = true; grp.userData.withB = !!withB;
  }
  function hideLine() { shown = false; grp.visible = false; }
  function layoutLine() {
    const m = env.mesh(), he = env.halfExt(), dims = env.dims();
    if (!m || !he || !dims || !shown) { grp.visible = false; return; }
    if (grp.parent !== m) m.add(grp);
    const e = m.matrixWorld.elements, s = Math.hypot(e[0], e[1], e[2]) || 1; // world scale of the volume: the tube keeps its real thickness
    if (Math.abs(s - scaleCache) > scaleCache * 1e-3) { scaleCache = s; tubeDirty = true; }
    if (!tubeDirty) { grp.visible = true; return; }
    tubeDirty = false;
    const rt = TUBE_R_M / s, rd = DOT_R_M / s, withB = grp.userData.withB;
    voxelToLocalInto(a, he, dims, pa); dotA.position.copy(pa); dotA.scale.setScalar(rd);
    dotB.visible = tube.visible = halo.visible = withB;
    if (withB) {
      voxelToLocalInto(b, he, dims, pb); dotB.position.copy(pb); dotB.scale.setScalar(rd);
      dir.subVectors(pb, pa); const len = dir.length();
      if (len > 1e-9) {
        dir.multiplyScalar(1 / len);
        for (const o of [tube, halo]) { o.position.copy(pa).addScaledVector(dir, len / 2); o.quaternion.setFromUnitVectors(up, dir); o.scale.set(o === halo ? rt * 2.4 : rt, len, o === halo ? rt * 2.4 : rt); }
      } else tube.visible = halo.visible = false;
    }
    grp.visible = true;
  }
  const showModelLine = () => { const L = getHuLine(); if (L) setEnds(L.a, L.b, true); else hideLine(); };

  // ---- the gesture ----
  function start(c) {
    if (!armed || g) return false;
    const v = rawHuVolume(), dims = env.dims();
    if (!v || !sameGrid(v, dims)) { env.flash(t().gridFlash); return false; }
    if (!env.pick(c, pick)) return false; // the laser is on neither tissue nor a section: the trigger keeps its normal action
    token++; fullBusy = false; // an older full read is stale now
    g = { c, a: { i: pick.i, j: pick.j, k: pick.k }, b: { i: pick.i, j: pick.j, k: pick.k }, moved: false, prevShown: shown };
    res = null; gate.reset();
    setEnds(g.a, g.b, false); showPanel(c); drawPanel();
    env.pulse(c, HAPTIC.select.amp, HAPTIC.select.ms);
    return true;
  }
  function end(c) {
    if (!g || g.c !== c) return false;
    const cur = g; g = null;
    if (env.pick(c, pick)) { cur.b.i = pick.i; cur.b.j = pick.j; cur.b.k = pick.k; }
    const v = rawHuVolume();
    if (!v || voxelDistanceMm(cur.a, cur.b, [1, 1, 1]) < HU_MIN_LENGTH_VOXELS) { // a click without a stretch: nothing is drawn, the old line stays
      res = null; hidePanel(); showModelLine(); return true;
    }
    setHuLine(cur.a, cur.b, 'final', 'vr'); // the shared model: the PC views show it too (onHuLineChange below keeps the mesh in step)
    setEnds(cur.a, cur.b, true);
    env.pulse(c, HAPTIC.record.amp, HAPTIC.record.ms);
    void fullRead({ i: cur.a.i, j: cur.a.j, k: cur.a.k }, { i: cur.b.i, j: cur.b.j, k: cur.b.k });
    return true;
  }
  function cancelDrag() { if (!g) return; g = null; res = null; hidePanel(); showModelLine(); }

  function update(now) {
    if (disposed) return;
    if (g) { // the pick follows the laser every frame (smooth line); the sampling + panel at <= 12.5 Hz
      if (env.pick(g.c, pick) && (pick.i !== g.b.i || pick.j !== g.b.j || pick.k !== g.b.k)) {
        g.b.i = pick.i; g.b.j = pick.j; g.b.k = pick.k; g.moved = true; b.i = pick.i; b.j = pick.j; b.k = pick.k; grp.userData.withB = true; tubeDirty = true;
      }
      if (gate.step(now, g.moved).run) { g.moved = false; liveSample(); }
    }
    if (shown) layoutLine();
  }

  // ---- shared state in / out ----
  const offLine = onHuLineChange(ev => {
    if (g) return; // our own drag shows its own line; the model change of another view waits until the release
    if (ev.phase === 'clear') { token++; fullBusy = false; res = null; hideLine(); hidePanel(); return; }
    if (ev.source !== 'vr') { showModelLine(); if (panelOn) { res = null; hidePanel(); } } // drawn elsewhere (PC): the line follows; the hand panel belongs to a VR draw
  });
  const offMode = onHuModeChange(() => { const L = getHuLine(); if (panelOn && !g && L && res) { void fullRead(L.a, L.b); } });
  showModelLine();

  return {
    group: grp, panel,
    isArmed: () => armed,
    hasLine: () => !!getHuLine(),
    isDragging: () => !!g,
    setArmed(on) {
      const v = !!on; if (v === armed) return;
      armed = v; if (!v) { cancelDrag(); if (panelOn) hidePanel(); }
      env.flash(armed ? t().armedFlash : t().disarmFlash); env.refresh();
    },
    clear() { cancelDrag(); token++; fullBusy = false; res = null; clearHuLine('vr'); hideLine(); hidePanel(); env.flash(t().clearedFlash); env.refresh(); },
    start, end, update, cancelDrag,
    onModelChanged: showModelLine,
    stats: () => res?.stats || null,
    dispose() {
      disposed = true; token++; offLine(); offMode(); hidePanel(); grp.parent?.remove(grp);
      tubeGeo.dispose(); dotGeo.dispose(); for (const o of [halo, tube, dotA, dotB]) o.material.dispose();
      tex.dispose(); panel.geometry.dispose(); panel.material.dispose();
    }
  };
}
