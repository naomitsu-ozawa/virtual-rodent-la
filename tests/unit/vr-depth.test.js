import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as THREE from 'three';
import { readFileSync } from 'node:fs';
// build 497: the volume writes depth (gl_FragDepth) and the distance labels / lines / leaders are depth tested + drawn again as a faint ghost behind the tissue.
// vr-depth.js is pure; vr-measure.js is checked with a three.js scene (no GL); vr-view.js (WebXR, not run in node) and its shader are checked on the source.
const ver = JSON.parse(readFileSync(new URL('../../docs/version.json', import.meta.url), 'utf8')).version, tag = '?v=' + ver.replace(/\./g, '').replace(/-(\d+)$/, '-build$1');
const load = f => import(/* @vite-ignore */ '../../docs/' + f + '.js' + tag);
const { LABEL_HIDE_REAL, LABEL_HIDE_FADE, LABEL_HIDE_DEFAULT, normalizeLabelHide, gpuOcclusionActive, GHOST_ALPHA, DEPTH_BIAS_VOXELS, biasedT, clipDepth, perspectiveDepth } = await load('vr-depth');
const { createVrMeasure } = await load('vr-measure');
const { addMeasurement, getMeasurements, resetMeasurements } = await load('measurements');
const { setComments, addComment, createComment, setMarkersShown } = await load('comments');
const { datasetFingerprint } = await load('project-file');
const { probeKey, LABEL_MID } = await load('measure-label');
const src = readFileSync(new URL('../../docs/vr-view.js', import.meta.url), 'utf8');

describe('the setting 「ラベルの隠れ方」', () => {
  it('defaults to 実際に隠す (1); only an explicit 0 selects the fade; garbage / missing falls back to the default', () => {
    expect(LABEL_HIDE_DEFAULT).toBe(LABEL_HIDE_REAL); expect(LABEL_HIDE_REAL).toBe(1); expect(LABEL_HIDE_FADE).toBe(0);
    for (const v of [undefined, null, 1, '1', true, 'x', NaN, 2]) expect(normalizeLabelHide(v), String(v)).toBe(1);
    for (const v of [0, '0', false]) expect(normalizeLabelHide(v), String(v)).toBe(0);
  });
  it('vr-view.js: DEFAULTS carry it, the settings merge keeps a saved 0 and gives old saves the default, and the 位置 tab offers the two choices', () => {
    expect(src).toMatch(/const DEFAULTS=\{[^}]*labelHide:LABEL_HIDE_DEFAULT/);
    expect(src).toContain("const v={...DEFAULTS,...JSON.parse(n||o||'{}')"); // a key missing in an old save takes the default, a saved 0 wins
    expect(src).toContain("lbHide:'ラベルの隠れ方',lbHideV:['実際に隠す','薄くする']");
    expect(src).toMatch(/choice\(y0\+104,L\.lbHide,L\.lbHideV\.map\(\(t,i\)=>\(\{label:t,value:1-i\}\)\),normalizeLabelHide\(settings\.labelHide\)/);
  });
  it('GPU occlusion runs for the default and for a standard depth buffer only; the fade setting or a log / reversed depth buffer falls back to the CPU fade', () => {
    expect(gpuOcclusionActive(undefined, {})).toBe(true); expect(gpuOcclusionActive(1, { logarithmicDepthBuffer: false, reversedDepthBuffer: false })).toBe(true);
    expect(gpuOcclusionActive(0, {})).toBe(false); expect(gpuOcclusionActive(1, { logarithmicDepthBuffer: true })).toBe(false); expect(gpuOcclusionActive(1, { reversedDepthBuffer: true })).toBe(false); expect(gpuOcclusionActive(1, null)).toBe(false);
  });
  it('vr-view.js: the CPU probes of the distances are skipped while the GPU occlusion is on', () => {
    expect(src).toContain('mps=occlusionGpu()?[]:vpMeasure.probes()');
    expect(src).toContain('if(!mps.length){if(vpMeasHidden.size)vpMeasHidden=new Set();measGate.reset();return}');
    expect(src).toContain('occlusion:occlusionGpu()})');
  });
});

describe('the depth formula (the same as the fragment shader)', () => {
  const cam = new THREE.PerspectiveCamera(70, 1.1, 0.01, 50); cam.position.set(0.05, 1.5, 0.2); cam.lookAt(0, 1.3, -0.65); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  const obj = new THREE.Object3D(); obj.position.set(0, 1.3, -0.65); obj.scale.setScalar(0.05); obj.rotation.set(0.3, -0.7, 0.1); obj.updateMatrixWorld();
  const mv = new THREE.Matrix4().multiplyMatrices(cam.matrixWorldInverse, obj.matrixWorld);
  it('clipDepth = the window depth three.js gives the same point (project(): ndc z * 0.5 + 0.5)', () => {
    for (const p of [[0, 0, 0], [1, 0.5, -0.3], [-2, 1, 2], [0.1, -1.5, 0.8]]) {
      const w = new THREE.Vector3(...p).applyMatrix4(obj.matrixWorld).project(cam);
      expect(clipDepth(mv.elements, cam.projectionMatrix.elements, p)).toBeCloseTo(w.z * 0.5 + 0.5, 6);
    }
  });
  it('perspectiveDepth(zEye) agrees with the matrix, grows with the distance and is 0 / 1 at the near / far plane', () => {
    expect(perspectiveDepth(-0.01, 0.01, 50)).toBeCloseTo(0, 6); expect(perspectiveDepth(-50, 0.01, 50)).toBeCloseTo(1, 6);
    const w = new THREE.Vector3(0.2, 1.2, -1.0).project(cam), z = new THREE.Vector3(0.2, 1.2, -1.0).applyMatrix4(cam.matrixWorldInverse).z;
    expect(perspectiveDepth(z, 0.01, 50)).toBeCloseTo(w.z * 0.5 + 0.5, 6);
    expect(perspectiveDepth(-0.5, 0.01, 50)).toBeLessThan(perspectiveDepth(-0.6, 0.01, 50));
  });
  it('a point behind the camera plane has no depth (the shader keeps the box face depth); the result is clamped to 0..1', () => {
    expect(clipDepth(cam.matrixWorldInverse.elements, cam.projectionMatrix.elements, [0.05, 1.5, 5])).toBeNull();
    expect(clipDepth(cam.matrixWorldInverse.elements, cam.projectionMatrix.elements, [0, 1.3, -500])).toBe(1);
  });
  it('the bias pushes the depth behind the surface by DEPTH_BIAS_VOXELS voxels, and the shader uses the same number', () => {
    expect(biasedT(0.4, 0.01)).toBeCloseTo(0.4 + DEPTH_BIAS_VOXELS * 0.01, 12); expect(DEPTH_BIAS_VOXELS).toBeGreaterThanOrEqual(1.5);
    expect(src).toContain('const float DEPTH_BIAS=' + DEPTH_BIAS_VOXELS.toFixed(1) + ';');
    expect(src).toContain('(gDepthT+DEPTH_BIAS*voxelMin)');
  });
});

describe('the fragment shader writes depth (source checks)', () => {
  const fs = src.slice(src.indexOf('const fragmentShader=`'), src.indexOf('// brick min/max in HU'));
  it('every path has a value (default = the box face), a surface hit / the cut face set the first-hit depth with the two matrices, a miss still discards', () => {
    expect(fs).toContain('void main(){\n gl_FragDepth=gl_FragCoord.z;');
    expect(fs).toContain('uniform mat4 projectionMatrix;'); expect(fs).toContain('uniform mat4 modelViewMatrix;');
    expect(fs).toContain('projectionMatrix*(modelViewMatrix*vec4(o+dir*(gDepthT+DEPTH_BIAS*voxelMin),1.0))');
    expect(fs).toContain('if(acc.a<0.004)discard;');
    expect((fs.match(/depthMark\(/g) || []).length).toBe(1 + 5 + 1); // the function + 3 non-opaque hits + 2 cut faces + the post-loop hit
    expect(fs.indexOf('if(acc.a<0.004)discard;')).toBeLessThan(fs.indexOf('gl_FragDepth=clamp('));
  });
  it('the parity anchor of the harness (the post-loop hit shading) is intact', () => {
    expect(fs).toContain('float contribution=(1.0-acc.a)*alpha;acc=vec4(acc.rgb+lit*contribution,acc.a+contribution);hitEnd=true;');
  });
  it('the volume and composite materials write depth in the opaque pass (CustomBlending is kept), the low-res target has a depth texture the composite writes back', () => {
    expect(src).toContain('material.transparent=false;material.depthWrite=true;material.blending=THREE.CustomBlending;');
    expect(src).toContain('base.transparent=false;base.depthWrite=true;base.blending=THREE.CustomBlending;');
    expect(src).toContain('depthBuffer:true,depthTexture:new THREE.DepthTexture(tw0,th0)');
    expect(src).toContain('renderer.clear(true,true,false)');
    expect(src).toContain('gl_FragDepth=texture(depthImg,uv).r;');
    expect(src).toContain('compMaterial.uniforms.depthImg.value=lowTarget.depthTexture');
    expect((src.match(/toneMapped:false,depthWrite:true,transparent:false/g) || []).length).toBe(2); // both composite materials (warm-up and session)
  });
});

describe('collateral: what lies inside the volume stays visible (source checks)', () => {
  it('the section frame (+ arrow) and its glow have no depth test and are drawn after the volume; the boards (menu / help), the hand cue and the laser keep the depth test (they are outside the volume)', () => {
    expect(src).toContain("new THREE.LineBasicMaterial({color,transparent:true,depthTest:false}),h=0.12");
    expect(src).toContain('frameLine.renderOrder=2'); expect(src).toContain('arrow.renderOrder=2'); expect(src).toContain('glow.renderOrder=3');
    expect(src).toMatch(/MeshBasicMaterial\(\{color:0xffffff,transparent:true,opacity:0\.95,side:THREE\.DoubleSide,depthTest:false,depthWrite:false/);
    expect(src).toContain('new THREE.MeshBasicMaterial({map:tex,transparent:true,toneMapped:false}));\n let widgets=[]'); // the boards: a board BEHIND the volume must stay covered by it
    expect(src).toContain('{const top=!!rh;ray.renderOrder=dot.renderOrder=top?8:0;');
  });
  it('the point markers, cursors, rings and the scale tag already have no depth test', () => {
    for (const f of ['vr-point-markers', 'vr-ring', 'vr-real-scale']) {
      const t = readFileSync(new URL('../../docs/' + f + '.js', import.meta.url), 'utf8');
      expect(t.includes('depthTest:false') || t.includes('depthTest: false'), f).toBe(true);
      expect(t.includes('depthTest:true') || t.includes('depthTest: true'), f).toBe(false);
    }
  });
});

describe('vr-measure.js: depth test + ghost, lit on top, fade mode unchanged', () => {
  const ctx = new Proxy({}, { get: (t, k) => (k in t ? t[k] : () => {}), set: (t, k, v) => { t[k] = v; return true } });
  beforeEach(() => { vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) }); setComments([]); resetMeasurements(); setMarkersShown(true); });
  afterEach(() => vi.unstubAllGlobals());
  const series = { id: 's::1', description: 'synthetic', modality: 'CT', columns: 16, rows: 16, spacingX: 0.1, spacingY: 0.2, spacingZ: 0.5, slices: Array.from({ length: 12 }, (_, i) => (i ? {} : { studyUid: 's', seriesUid: 'q', instanceUid: 'i0' })) };
  const fp = datasetFingerprint(series);
  const make = () => {
    for (const [id, i, j, k] of [['p1', 2, 3, 1], ['p2', 12, 9, 8]]) addComment(createComment({ text: id, position: { i, j, k }, series: fp, id }));
    const m = addMeasurement('p1', 'p2'), scene = new THREE.Scene(), mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2)), holder = new THREE.Group();
    holder.position.set(0, 1.3, -0.6); holder.scale.setScalar(0.05); holder.add(mesh); scene.add(holder); scene.updateMatrixWorld(true);
    const base = { fingerprint: fp, dims: { columns: 16, rows: 16, slices: 12 }, halfExt: [8, 8, 6], mesh, head: new THREE.Vector3(0, 1.6, 0), spacing: [0.1, 0.2, 0.5], hint: '' };
    const v = createVrMeasure(THREE, scene), settle = args => { let t = 1000; for (let i = 0; i < 30; i++) v.update({ ...args, now: (t += 50) }) };
    v.update(base);
    const label = scene.children.find(o => o.isMesh && o.renderOrder === 6), line = scene.children.find(o => o.isLine && o.geometry.attributes.position.count > 2), leader = scene.children.find(o => o.isLine && o.geometry.attributes.position.count === 2);
    return { m, scene, base, v, label, line, leader, settle };
  };
  it('occlusion on: line / leader / label are depth tested without writing depth; each has a ghost child (GreaterDepth, GHOST_ALPHA) sharing the geometry', () => {
    const { v, base, label, line, leader, settle } = make();
    settle({ ...base, occlusion: true });
    for (const o of [label, line, leader]) {
      expect(o.material.depthTest, o.type).toBe(true); expect(o.material.depthWrite, o.type).toBe(false);
      expect(o.children.length).toBe(1); const g = o.children[0];
      expect(g.geometry).toBe(o.geometry); expect(g.material.depthFunc).toBe(THREE.GreaterDepth); expect(g.material.depthTest).toBe(true); expect(g.material.depthWrite).toBe(false); expect(g.material.visible).toBe(true); expect(g.renderOrder).toBe(o.renderOrder);
    }
    expect(label.children[0].material.opacity).toBeCloseTo(GHOST_ALPHA, 6); expect(line.children[0].material.opacity).toBeCloseTo(0.95 * GHOST_ALPHA, 6); expect(leader.children[0].material.opacity).toBeCloseTo(0.6 * GHOST_ALPHA, 6);
    expect(label.material.opacity).toBe(1); v.dispose();
  });
  it('a lit (laser on it / grabbed) label and its leader are fully on top (no depth test, no ghost); the line keeps the depth test', () => {
    const { m, v, base, label, line, leader, settle } = make();
    settle({ ...base, occlusion: true, lit: new Set([m.id]) });
    expect(label.material.depthTest).toBe(false); expect(label.children[0].material.visible).toBe(false); expect(leader.material.depthTest).toBe(false); expect(leader.children[0].material.visible).toBe(false);
    expect(line.material.depthTest).toBe(true); expect(line.children[0].material.visible).toBe(true);
    settle({ ...base, occlusion: true }); expect(label.material.depthTest).toBe(true); expect(label.children[0].material.visible).toBe(true);
    v.dispose();
  });
  it('occlusion on ignores the CPU judgement (hidden): nothing fades; picking is still geometric', () => {
    const { m, v, base, label, line, settle } = make(), hid = new Set([probeKey(m.id, LABEL_MID), probeKey(m.id, 3)]);
    settle({ ...base, occlusion: true, hidden: hid }); expect(label.material.opacity).toBe(1); expect(line.geometry.attributes.color.getW(3)).toBe(1);
    const o = label.position.clone().add(new THREE.Vector3(0, 0, 0.5)); expect(v.pickLabel(o, new THREE.Vector3(0, 0, -1))?.id).toBe(m.id); v.dispose();
  });
  it('occlusion off (薄くする): no depth test, no ghost, the CPU fade as in build 493-494', () => {
    const { m, v, base, label, line, leader, settle } = make();
    settle({ ...base, occlusion: true }); settle({ ...base, occlusion: false, hidden: new Set([probeKey(m.id, LABEL_MID)]) });
    for (const o of [label, line, leader]) { expect(o.material.depthTest, o.type).toBe(false); expect(o.children[0].material.visible, o.type).toBe(false); }
    expect(label.material.opacity).toBeCloseTo(0.3, 6); v.dispose();
  });
  it('dispose removes everything (ghosts are children: nothing is left in the scene)', () => {
    const { scene, v } = make(); expect(getMeasurements().length).toBe(1); v.dispose(); expect(scene.children.filter(o => o.renderOrder >= 4).length).toBe(0);
  });
});
