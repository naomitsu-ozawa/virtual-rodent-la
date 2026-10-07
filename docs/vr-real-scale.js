// build 489 (Issue #88 item 3): real-size (実寸) reference for the VR / AR volume.
// The volume is built normalised to NORM_LONG (3.3 units) on its longest side and the holder's scale maps that to metres
// (displayed longest side = holder scale x 3.3 m; the default 16.5 cm = 0.05 x 3.3). The magnification shown here is
// displayed size / physical size (voxel spacing x dimensions, anisotropic spacing included), never the raw holder scale
// and never a render-resolution percentage. Pure maths plus one small canvas tag; no DOM needed for the maths (unit-tested).
export const NORM_LONG = 3.3;

// physical extents in mm [x, y, z] = dims x spacing (each axis its own spacing); null when unknown
export function physicalExtentsMm(dims, spacing) {
  if (!dims || !spacing) return null;
  const n = [dims.columns, dims.rows, dims.slices];
  const sp = [spacing.x ?? spacing[0], spacing.y ?? spacing[1], spacing.z ?? spacing[2]];
  const e = n.map((v, i) => v * sp[i]);
  return e.every(v => Number.isFinite(v) && v > 0) ? e : null;
}
export const longestMm = ext => (ext ? Math.max(...ext) : 0);

// displayed longest side in metres for a holder scale
export const displayedLongM = holderScale => holderScale * NORM_LONG;

// displayed size / physical size (1 = real size); 0 when the physical size is unknown
export function realMagnification(holderScale, longMm) {
  if (!(longMm > 0) || !(holderScale > 0)) return 0;
  return (displayedLongM(holderScale) * 1000) / longMm;
}

export const MAX_LONG_M = 0.30; // the largest displayed longest side (m); small animals only (whole body up to about 30 cm)
export const FALLBACK_MIN = 0.025, FALLBACK_MAX = 20; // when the physical size is unknown (limits of the old two-hand scaling)

// real size in holder-scale units
const realScaleOf = longMm => longMm / 1000 / NORM_LONG;

// >30 cm data (human / large animals) is out of scope for now: it is shown fitted to 0.30 m and locked
export const isOversize = longMm => longMm / 1000 > MAX_LONG_M + 1e-9;

// holder-scale limits {min, max, locked}: 1x (real size) .. 0.30 m longest side; oversize data: both = 0.30 m (locked, shown below 1x)
export function scaleLimits(longMm) {
  if (!(longMm > 0)) return { min: FALLBACK_MIN, max: FALLBACK_MAX, locked: false };
  const cap = MAX_LONG_M / NORM_LONG;
  if (isOversize(longMm)) return { min: cap, max: cap, locked: true };
  return { min: Math.min(realScaleOf(longMm), cap), max: cap, locked: false };
}
export function clampScale(s, longMm) {
  const l = scaleLimits(longMm);
  return Math.min(l.max, Math.max(l.min, s));
}

// the holder scale at which 1 m of the patient is 1 m in VR; null when unknown or when the data is oversize (cannot be shown at real size)
export function realHolderScale(longMm) {
  if (!(longMm > 0) || isOversize(longMm)) return null;
  return clampScale(realScaleOf(longMm), longMm);
}

// two-hand pinch: the new scale from the scale and hand distance at the grab (s0, d0) and the current distance d.
// Always derived from the grab values (not accumulated), so pushing past a limit and coming back resumes exactly where the hands cross the limit.
export function pinchScale(s0, d0, d, longMm) {
  const l = scaleLimits(longMm);
  if (l.locked) return l.max;
  return clampScale(s0 * d / Math.max(d0, 1e-3), longMm);
}

// warning shown at load (normal UI) and on entering VR / AR for oversize data; null when none
export function oversizeNote(longMm, lang) {
  if (!isOversize(longMm)) return null;
  return lang === 'ja'
    ? '実寸の最長辺が30cmを超えるため、30cmに縮小して表示します（拡大・縮小はできません）。このアプリはマウス等の小動物（全身撮影でおよそ30cmまで）を想定しています。'
    : 'The real longest side exceeds 30 cm, so it is shown reduced to 30 cm (zooming is disabled). This app is meant for small animals such as mice (whole body up to about 30 cm).';
}
export function sizeWarningHtml(series, lang, esc) {
  const ext = series ? physicalExtentsMm({ columns: series.columns, rows: series.rows, slices: series.slices?.length }, [series.spacingX, series.spacingY, series.spacingZ]) : null;
  const t = oversizeNote(longestMm(ext), lang);
  return t ? '<span class="size-warn" role="status">⚠ ' + esc(t) + '</span>' : '';
}

// 2 significant digits below 10, one decimal place from 10 up; a value within 0.5 % of 1 reads exactly 1
export function formatMagnification(m) {
  if (!(m > 0)) return '';
  if (Math.abs(m - 1) < 0.005) return '1';
  const p = Number(m.toPrecision(2));
  if (p >= 10) return m.toFixed(1);
  return String(p);
}
export const magnificationText = (m, lang) => {
  const t = formatMagnification(m);
  if (!t) return '';
  return lang === 'ja' ? '×' + t + '（実寸比）' : '×' + t + ' (real size)';
};

// a small billboard tag: a canvas plane of fixed world size placed under the lowest corner of the volume's bounding box
export function createScaleTag(THREE) {
  const W = 320, H = 72, canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d'), tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.09 * H / W), new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false, depthTest: false }));
  mesh.renderOrder = 5; mesh.visible = false;
  let text = '';
  const setText = t => {
    if (t === text) return;
    text = t; mesh.userData.text = t;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(14,20,27,.78)'; ctx.beginPath(); ctx.roundRect(0, 0, W, H, 16); ctx.fill();
    ctx.fillStyle = '#e8f1f8'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const lines = t.split('\n');
    lines.forEach((ln, n) => { ctx.font = (n ? '' : 'bold ') + (lines.length > 1 ? 26 : 32) + 'px system-ui,sans-serif'; ctx.fillText(ln, W / 2, lines.length > 1 ? H * (n + 0.5) / lines.length + 1 : H / 2 + 1); });
    tex.needsUpdate = true;
  };
  const v = new THREE.Vector3(), low = new THREE.Vector3();
  // holder: the volume's group (local box = +-halfExt); head: world position of the viewer
  const place = (holder, halfExt, head) => {
    holder.updateWorldMatrix(true, false);
    let best = Infinity;
    for (let i = 0; i < 8; i++) {
      v.set(i & 1 ? halfExt[0] : -halfExt[0], i & 2 ? halfExt[1] : -halfExt[1], i & 4 ? halfExt[2] : -halfExt[2]).applyMatrix4(holder.matrixWorld);
      if (v.y < best) { best = v.y; low.copy(v); }
    }
    mesh.position.copy(low); mesh.position.y -= 0.035;
    mesh.lookAt(head);
  };
  return { mesh, setText, place, get text() { return text; }, dispose() { tex.dispose(); mesh.geometry.dispose(); mesh.material.dispose(); } };
}
