// VR render golden check (build 484 guard). Renders a small deterministic synthetic scene (bone ball / plate / rod, soft tissue, complex
// high-opacity fat: thin sheets with holes and single-voxel specks) with the REAL fragment shader of docs/vr-view.js on headless Chromium /
// SwiftShader, in the shader variants the app uses, at 100 % and through the low-resolution path (f < 1: offscreen target + composite pass),
// and compares every image with the committed golden PNG in tests/golden/vr-render/.
//   node tools/vr-render-golden.mjs                       compare (exit 1 above the threshold)
//   node tools/vr-render-golden.mjs --update              regenerate the goldens (review the PNGs, commit them)
//   options: --max-pixels N  --max-diff N   threshold (default 0 / 0: pixel-identical); env GOLDEN_MAX_PIXELS / GOLDEN_MAX_DIFF
//            --shader FILE  render another copy of vr-view.js (e.g. a perturbed scratch copy)    --runs K  render K times, report run-to-run variance
//            --out DIR  where actual / diff PNGs go on failure (default test-results/vr-golden)
//   PW_CHROMIUM=/opt/pw-browsers/chromium (optional: Playwright's own Chromium otherwise)
import fs from 'node:fs'; import path from 'node:path';
import { ROOT, grabShaders, buildScene, withPage, runBatch, sceneArgs, HALF_EXT, encodePng, decodePng, diffPixels } from './lib/vr-gl-harness.mjs';

const argv = process.argv.slice(2), has = f => argv.includes(f), opt = (f, d) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : d; };
const update = has('--update'), maxPixels = +opt('--max-pixels', process.env.GOLDEN_MAX_PIXELS ?? 0), maxDiff = +opt('--max-diff', process.env.GOLDEN_MAX_DIFF ?? 0), runs = +opt('--runs', 1);
const shaderFile = opt('--shader', path.join(ROOT, 'docs/vr-view.js')), outDir = path.resolve(opt('--out', 'test-results/vr-golden')), goldenDir = path.join(ROOT, 'tests/golden/vr-render');
const N = 64, W = 160, H = 160, F_LOW = 0.7;
const OPQ = ['VRL_NO_GENERAL', 'VRL_OPAQUE'], plane = [0.6, 0.3, 0.74], pl = (() => { const l = Math.hypot(...plane); return plane.map(v => v / l); })();
const allOpaque = [[300, 3000, 1, 1], [-200, 299, 1, 1], [-250, -50, 1, 1], [0, 0, 0, 0]];
const zero = [0, 0, 1, 0];
// the variants vr-view.js actually uses: noEvents (no plane) and combined (events: plane / slice / cap) with VRL_OPAQUE, the general loop (full, diag / no combined field),
// the HU path, and the analysis-result colours (VRL_REGIONS)
const noSoft = [[300, 3000, 1, 1], [-200, 299, 1, 0], [-250, -50, 1, 1], [0, 0, 0, 0]]; // soft tissue off: bone and (complex) fat show
const translucent = [[300, 3000, 1, 1], [-200, 299, 0.35, 1], [-250, -50, 0.5, 1], [0, 0, 0, 0]]; // the app's soft-tissue default 0.35; fat 0.5 so that rays pile up opacity through many sheets (ACC_STOP matters)
const cut = [[-pl[0], -pl[1], -pl[2], 0.05], zero, zero, zero]; // the half towards the camera is removed
const boneOnly = [[300, 3000, 1, 1], [-200, 299, 1, 0], [-250, -50, 1, 0], [0, 0, 0, 0]]; // build 526: only the (mask-only) bone is shown, so empty bricks exist to skip
const CASES = [
  { name: 'noevents-bonefat', defines: [...OPQ, 'VRL_NO_EVENTS'], u: { segA: noSoft } },
  { name: 'noevents-allopaque', defines: [...OPQ, 'VRL_NO_EVENTS'], u: { segA: allOpaque } },
  { name: 'combined-section', defines: OPQ, u: { segA: allOpaque, cutPlanes: cut, planeCount: 1, planeCut: 1, capOn: 1, sliceOpacity: 0.7 } },
  { name: 'combined-section-bonefat', defines: OPQ, u: { segA: noSoft, cutPlanes: cut, planeCount: 1, planeCut: 1, capOn: 1, sliceOpacity: 0.7 } },
  { name: 'combined-two-planes', defines: OPQ, u: { segA: allOpaque, cutPlanes: [cut[0], [0, -1, 0, 0.1], zero, zero], planeCount: 2, planeCut: 1, capOn: 1, sliceOpacity: 0.7 } },
  { name: 'full-cls-translucent', defines: [], useClsRaw: true, u: { segA: translucent, distInCls: 0, useDist: 0 } },
  { name: 'full-hu', defines: [], noCls: true, u: { segA: translucent } },
  { name: 'noevents-regions', defines: [...OPQ, 'VRL_NO_EVENTS', 'VRL_REGIONS'], u: { segA: noSoft } },
  { name: 'full-hu-maskonly', defines: [], noCls: true, maskOnly: true, u: { segA: boneOnly } }, // build 526 (issue #132): HU path with a mask-only bone (the scene's edit mask), brick occupancy in use
];
// build 526: the same scene with the pre-526 bricks (every brick a candidate of the mask-only segment = no empty-space skip) and the diag 5 probe
// (R = samples / 1024): the occupancy must skip (fewer samples) without losing a mask voxel (the drawn silhouette is the same; the skip re-phases
// the samples, so single pixels inside the silhouette may differ by dither)
const moCase = CASES[CASES.length - 1], PROOF = [
  { ...moCase, name: 'proof-occ', f: 1 }, { ...moCase, name: 'proof-mixed', f: 1, bricksMixed: true },
  { ...moCase, name: 'proof-occ-probe', f: 1, u: { ...moCase.u, diag: 5 } }, { ...moCase, name: 'proof-mixed-probe', f: 1, bricksMixed: true, u: { ...moCase.u, diag: 5 } },
];
const PROOF_MAX_SILHOUETTE = +opt('--max-silhouette', 24), PROOF_SAMPLE_RATIO = +opt('--max-sample-ratio', 0.6);
const jobs = CASES.flatMap(c => [{ ...c, name: c.name + '-f100', f: 1 }, { ...c, name: c.name + '-f' + Math.round(F_LOW * 100), f: F_LOW }]);

const sh = grabShaders(shaderFile), scene = await buildScene(N);
const render = () => withPage(async (pg, info) => { const r = await runBatch(pg, { sh, N, W, H, halfExt: HALF_EXT, scene: sceneArgs(scene), cases: [...jobs, ...PROOF], mode: 'color', filter: 'linear' }); return { ...r, info }; });
const results = []; for (let i = 0; i < runs; i++) results.push(await render());
const first = results[0];
console.log('Chromium ' + first.info.version + ' · shader ' + path.relative(ROOT, shaderFile) + ' · ' + jobs.length + ' images ' + W + 'x' + H + ' · threshold: pixels <= ' + maxPixels + ', max channel diff <= ' + maxDiff);
let failed = first.info.problems.length > 0 || first.glError !== 0;
if (first.glError) console.log('GL error ' + first.glError);
if (first.info.problems.length) console.log('FAIL: shader / page problems:\n  ' + first.info.problems.join('\n  '));

if (runs > 1) { // run-to-run variance (same process image order, fresh browser per run)
  let worst = { pixels: 0, maxDiff: 0 };
  for (const j of jobs) for (let i = 1; i < runs; i++) { const d = diffPixels(first.out[j.name], results[i].out[j.name]); if (d.pixels > worst.pixels) worst.pixels = d.pixels; if (d.maxDiff > worst.maxDiff) worst.maxDiff = d.maxDiff; }
  console.log('run-to-run variance over ' + runs + ' fresh browsers: changed pixels (worst image) ' + worst.pixels + ', max channel diff ' + worst.maxDiff);
}
fs.mkdirSync(update ? goldenDir : outDir, { recursive: true });
const BGpx = [0.04, 0.06, 0.09].map(v => Math.round(v * 255));
for (const j of jobs) {
  const px = first.out[j.name], file = path.join(goldenDir, j.name + '.png');
  let covered = 0; for (let i = 0; i < px.length; i += 4) if (Math.abs(px[i] - BGpx[0]) + Math.abs(px[i + 1] - BGpx[1]) + Math.abs(px[i + 2] - BGpx[2]) > 6) covered++;
  const blank = covered < W * H * 0.05; // a scene that renders nothing would "match" a blank golden
  if (blank) { failed = true; console.log('FAIL ' + j.name + ': the scene is (almost) empty, ' + covered + ' pixels drawn'); }
  if (update) { fs.writeFileSync(file, encodePng(px, W, H)); console.log('wrote ' + path.relative(ROOT, file) + ' (' + covered + ' px drawn)'); continue; }
  if (!fs.existsSync(file)) { failed = true; console.log('FAIL ' + j.name + ': golden missing (run with --update)'); continue; }
  const g = decodePng(fs.readFileSync(file));
  if (g.w !== W || g.h !== H) { failed = true; console.log('FAIL ' + j.name + ': golden size ' + g.w + 'x' + g.h); continue; }
  const d = diffPixels(px, g.px), bad = d.pixels > maxPixels || d.maxDiff > maxDiff;
  console.log((bad ? 'FAIL ' : 'ok   ') + j.name + ': changed pixels ' + d.pixels + ', max channel diff ' + d.maxDiff + ' (' + covered + ' px drawn)');
  if (bad) {
    failed = true; fs.writeFileSync(path.join(outDir, j.name + '-actual.png'), encodePng(px, W, H));
    const dp = new Uint8Array(px.length); for (let i = 0; i < px.length; i += 4) { for (let k = 0; k < 3; k++) dp[i + k] = Math.min(255, Math.abs(px[i + k] - g.px[i + k]) * 16); dp[i + 3] = 255; }
    fs.writeFileSync(path.join(outDir, j.name + '-diff.png'), encodePng(dp, W, H));
  }
}
// build 526: the mask-only occupancy proof (not a golden: compared within the run)
{
  const px = n => first.out[n], covered = p => { const c = new Uint8Array(W * H); for (let i = 0; i < c.length; i++) { const o = i * 4; if (Math.abs(p[o] - BGpx[0]) + Math.abs(p[o + 1] - BGpx[1]) + Math.abs(p[o + 2] - BGpx[2]) > 6) c[i] = 1; } return c; };
  const a = covered(px('proof-occ')), b = covered(px('proof-mixed')); let sil = 0, drawn = 0; for (let i = 0; i < a.length; i++) { if (a[i] !== b[i]) sil++; if (b[i]) drawn++; }
  const mean = p => { let s = 0, n = 0; for (let i = 0; i < p.length; i += 4) { s += p[i]; n++; } return s / n; }; // samples / 1024 * 255, averaged over the image
  const sOcc = mean(px('proof-occ-probe')), sMixed = mean(px('proof-mixed-probe')), ratio = sOcc / Math.max(sMixed, 1e-9), d = diffPixels(px('proof-occ'), px('proof-mixed'));
  const bad = sil > PROOF_MAX_SILHOUETTE || ratio > PROOF_SAMPLE_RATIO || drawn < W * H * 0.02 || scene.occupied === 0 || scene.occupied >= scene.brickN ** 3;
  console.log((bad ? 'FAIL ' : 'ok   ') + 'mask-only occupancy proof: occupied bricks ' + scene.occupied + ' / ' + scene.brickN ** 3 + ', silhouette pixels changed ' + sil + ' of ' + drawn + ' drawn (max ' + PROOF_MAX_SILHOUETTE + '), samples per ray ' + (sOcc * 1024 / 255).toFixed(1) + ' with occupancy vs ' + (sMixed * 1024 / 255).toFixed(1) + ' with every brick mixed (ratio ' + ratio.toFixed(3) + ', max ' + PROOF_SAMPLE_RATIO + '); colour diff inside the silhouette ' + d.pixels + ' px / max ' + d.maxDiff);
  if (bad) { failed = true; fs.mkdirSync(outDir, { recursive: true }); for (const n of ['proof-occ', 'proof-mixed']) fs.writeFileSync(path.join(outDir, n + '.png'), encodePng(px(n), W, H)); }
}
if (update) console.log('goldens updated in ' + path.relative(ROOT, goldenDir) + ': review the images and commit them, stating why the picture changed');
else if (failed) { console.error('vr-render-golden FAILED (actual / diff images in ' + path.relative(ROOT, outDir) + '). If the change is intended, rerun with --update, review and commit the goldens.'); process.exit(1); }
else console.log('vr-render-golden OK');
