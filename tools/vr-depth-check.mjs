// VR depth read-back check (build 500 guard of the build 497 depth occlusion). The volume's fragment shader writes the clip depth of the first thing a ray shows (pushed back by
// depthBias()) to gl_FragDepth; the distance labels / lines are depth tested against it. This tool renders the synthetic phantom with the REAL fragment shader on headless Chromium /
// SwiftShader at f = 1 (volume pass straight into the depth buffer) and f < 1 (low-resolution target + the app's composite pass, which writes its nearest-sampled depth back), reads the
// depth buffer back and compares, for hit pixels and for miss pixels, with the expected depth: the hit point of the same camera ray (the shader patched at its first hit, as in
// tools/vr-cls-parity.mjs) pushed back by depthBias() of docs/vr-depth.js and projected with the camera matrices (clipDepth). The phantom's voxels are anisotropic on purpose (HALF_EXT).
//   node tools/vr-depth-check.mjs [--shader FILE]        PW_CHROMIUM=/opt/pw-browsers/chromium (optional)
import path from 'node:path'; import { pathToFileURL } from 'node:url';
import * as THREE from 'three';
import { ROOT, grabShaders, buildScene, withPage, runBatch, sceneArgs, HALF_EXT } from './lib/vr-gl-harness.mjs';
const { clipDepth, depthBias } = await import(pathToFileURL(path.join(ROOT, 'docs/vr-depth.js')));

const argv = process.argv.slice(2), opt = (f, d) => { const i = argv.indexOf(f); return i >= 0 ? path.resolve(argv[i + 1]) : d; };
const shaderFile = opt('--shader', path.join(ROOT, 'docs/vr-view.js'));
const N = 64, W = 160, H = 160, F_LOW = 0.5, TOL = 1e-6, MIN_GAIN = 1e-5, MIN_AGREE = 0.995;
const allOpaque = [[300, 3000, 1, 1], [-200, 299, 1, 1], [-250, -50, 1, 1], [0, 0, 0, 0]];
const base = { name: 'surface', defines: ['VRL_NO_GENERAL', 'VRL_OPAQUE', 'VRL_NO_EVENTS'], u: { segA: allOpaque } };
const voxelSize = HALF_EXT.map(h => 2 * h / N), voxelMin = Math.min(...voxelSize);
// the harness camera (tools/lib/vr-gl-harness.mjs): the volume sits at the origin, unit scale, so model-view = the camera's view matrix
const cam = new THREE.PerspectiveCamera(45, W / H, 0.01, 50); cam.position.set(2.0, 1.3, 2.5); cam.lookAt(0, 0, 0); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
const mv = cam.matrixWorldInverse.elements, proj = cam.projectionMatrix.elements;

const sh = grabShaders(shaderFile), scene = await buildScene(N);
const tw = Math.ceil(W * F_LOW), th = Math.ceil(H * F_LOW);
const { depth, hitFull, hitLow, info } = await withPage(async (pg, info) => {
  const sa = sceneArgs(scene), common = { sh, N, halfExt: HALF_EXT, scene: sa, filter: 'linear' };
  const d = await runBatch(pg, { ...common, W, H, mode: 'depth', cases: [{ ...base, name: 'f100', f: 1 }, { ...base, name: 'f50', f: F_LOW }] });
  const hf = await runBatch(pg, { ...common, W, H, mode: 'hit', cases: [base] });
  const hl = await runBatch(pg, { ...common, W: tw, H: th, mode: 'hit', cases: [base] });
  if (d.glError || hf.glError || hl.glError || info.problems.length) throw new Error('GL error ' + [d.glError, hf.glError, hl.glError] + ' ' + info.problems.join('; '));
  const f32 = b => new Float32Array(new Uint8Array(b).buffer);
  return { depth: { f100: f32(d.out.f100), f50: f32(d.out.f50) }, hitFull: { hit: f32(hf.out.surface), rays: hf.raysBuf }, hitLow: { hit: f32(hl.out.surface), rays: hl.raysBuf }, info };
});
console.log('Chromium ' + info.version + ' · shader ' + path.relative(ROOT, shaderFile) + ' · ' + W + 'x' + H + ' · tolerance ' + TOL);

let failed = false;
const fail = m => { failed = true; console.log('FAIL ' + m); };
// the expected depth of full-resolution pixel (x, y): the hit of the pixel itself (f = 1) or of the low-resolution texel the composite pass samples (f < 1: uv = (x + 0.5) / W, nearest)
const expected = (job, x, y) => {
  const lo = job === 'f50', hit = lo ? hitLow : hitFull, w = lo ? tw : W, px = lo ? Math.min(tw - 1, Math.floor((x + 0.5) * F_LOW)) : x, py = lo ? Math.min(th - 1, Math.floor((y + 0.5) * F_LOW)) : y, i = py * w + px;
  if (hit.hit[i * 4 + 3] < 0.5) return { hit: false, biased: 1, plain: 1 };
  const p = [hit.hit[i * 4], hit.hit[i * 4 + 1], hit.hit[i * 4 + 2]], d = [hit.rays[i * 3], hit.rays[i * 3 + 1], hit.rays[i * 3 + 2]], b = depthBias(d, voxelSize, voxelMin);
  return { hit: true, biased: clipDepth(mv, proj, p.map((v, k) => v + d[k] * b)), plain: clipDepth(mv, proj, p), bias: b };
};
for (const job of ['f100', 'f50']) {
  const dz = depth[job], at = (x, y) => dz[y * W + x], label = (job === 'f100' ? 'f = 1' : 'f = ' + F_LOW) + ' ';
  // 1) the centre pixel: a hit
  const c = expected(job, W / 2, H / 2), dc = at(W / 2, H / 2);
  if (!c.hit) fail(label + 'centre pixel is not a hit (phantom / camera changed?)');
  else {
    const err = Math.abs(dc - c.biased), gain = dc - c.plain;
    console.log((err <= TOL && gain > MIN_GAIN ? 'ok   ' : 'FAIL ') + label + 'centre: depth ' + dc.toFixed(7) + ' expected ' + c.biased.toFixed(7) + ' (error ' + err.toExponential(1) + '), behind the unbiased surface by ' + gain.toExponential(2) + ', bias ' + (c.bias / voxelMin).toFixed(2) + ' voxelMin');
    if (!(err <= TOL)) failed = true; if (!(gain > MIN_GAIN)) failed = true;
  }
  // 2) a miss pixel (corner): nothing drawn, the depth buffer keeps its clear value 1
  const dm = at(0, 0); console.log((dm === 1 ? 'ok   ' : 'FAIL ') + label + 'miss corner: depth ' + dm); if (dm !== 1) failed = true;
  // 3) the silhouette edge of the middle row: the first / last hit pixel and the miss pixel next to it
  const row = H / 2; let first = -1, last = -1;
  for (let x = 0; x < W; x++) if (expected(job, x, row).hit) { if (first < 0) first = x; last = x; }
  for (const [name, x, out] of [['left edge', first, first - 1], ['right edge', last, last + 1]]) {
    const e = expected(job, x, row), err = Math.abs(at(x, row) - e.biased), o = expected(job, out, row), eo = Math.abs(at(out, row) - o.biased);
    const okE = err <= TOL && eo <= TOL; console.log((okE ? 'ok   ' : 'FAIL ') + label + name + ': hit pixel x=' + x + ' error ' + err.toExponential(1) + ', next pixel x=' + out + (o.hit ? ' (a hit too at this f)' : ' (miss, depth ' + at(out, row) + ')') + ' error ' + eo.toExponential(1)); if (!okE) failed = true;
  }
  // 4) every pixel
  let ok = 0, hits = 0, worst = 0; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const e = expected(job, x, y), err = Math.abs(at(x, y) - e.biased); if (e.hit) hits++; worst = Math.max(worst, err); if (err <= TOL) ok++; }
  const agree = ok / (W * H); console.log((agree >= MIN_AGREE && hits > W * H * 0.05 ? 'ok   ' : 'FAIL ') + label + 'all pixels: ' + (agree * 100).toFixed(2) + ' % within tolerance (hit pixels ' + hits + ', worst error ' + worst.toExponential(1) + ')'); if (!(agree >= MIN_AGREE && hits > W * H * 0.05)) failed = true;
}
if (failed) { console.error('vr-depth-check FAILED'); process.exit(1); }
console.log('vr-depth-check OK');
