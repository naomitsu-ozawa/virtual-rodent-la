import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
// build 509: (1) the section frame is hidden behind tissue under 「実際に隠す」 (depth tested, no ghost; on top while lit / without GPU occlusion);
// (2) the section limit is 10 (was 4). vr-section-frame.js is pure; vr-view.js (WebXR) and its shader are checked on the source, the run in the XR stub (see the PR).
const ver = JSON.parse(readFileSync(new URL('../../docs/version.json', import.meta.url), 'utf8')).version, tag = '?v=' + ver.replace(/\./g, '').replace(/-(\d+)$/, '-build$1');
const load = f => import(/* @vite-ignore */ '../../docs/' + f + '.js' + tag);
const { MAX_SECTION_PLANES, PLANE_COLORS, nextPlaneColor, frameDepthTest, tagBehindTissue, sectionPage, pageOfPlane, SECTION_ROWS_PER_PAGE } = await load('vr-section-frame');
const { gpuOcclusionActive, occludedPass } = await load('vr-depth');
const read = f => readFileSync(new URL('../../docs/' + f, import.meta.url), 'utf8');
const src = read('vr-view.js');
const squash = t => t.replace(/\s+/g, ''), has = (text, piece) => squash(text).includes(squash(piece));
const fs = src.slice(src.indexOf('const fragmentShader=`'), src.indexOf('// brick min/max in HU'));

describe('the section limit is 10', () => {
  it('MAX_SECTION_PLANES = 10 and there is a distinct colour for every plane', () => {
    expect(MAX_SECTION_PLANES).toBe(10);
    expect(PLANE_COLORS.length).toBe(10); expect(new Set(PLANE_COLORS).size).toBe(10);
    expect(PLANE_COLORS.slice(0, 4)).toEqual([0xf2d27a, 0x8ec5ff, 0xf5a3c7, 0x9be3b0]); // the build 400 palette keeps its first four
    for (const c of PLANE_COLORS) { expect(c).toBeGreaterThan(0); expect(c).toBeLessThanOrEqual(0xffffff); }
  });
  it('nextPlaneColor: the first colour nobody uses; a removed plane gives its colour back; 10 planes use all 10 colours', () => {
    const used = [];
    for (let i = 0; i < 10; i++) used.push(nextPlaneColor(used));
    expect(used).toEqual(PLANE_COLORS);
    const without = used.filter((_, i) => i !== 2);
    expect(nextPlaneColor(without)).toBe(PLANE_COLORS[2]);
    expect(nextPlaneColor([])).toBe(PLANE_COLORS[0]);
  });
  it('the shader: one #define SECTION_PLANES equal to the limit, no plane array / loop of 4 left, only the planes in use are tested', () => {
    expect(fs).toMatch(new RegExp('#define SECTION_PLANES ' + MAX_SECTION_PLANES + '\\n'));
    expect(fs).toContain('uniform vec4 cutPlanes[SECTION_PLANES];');
    expect(fs).not.toMatch(/cutPlanes\[4\]/); expect(fs).not.toMatch(/(sliceT|crossT|crossOk)\[4\]/);
    expect(has(fs, 'for(int i=0;i<SECTION_PLANES;i++){ crossT[i]=-1e30;if(i>=planeCount)continue;')).toBe(true); // the per-ray plane test skips the unused indices
    expect(has(fs, 'for(int i=0;i<SECTION_PLANES;i++){if(i>=planeCount)break;if(crossT[i]>=t-1e-5')).toBe(true);
    expect(has(fs, 'for(int i=1;i<SECTION_PLANES;i++){if(i>=nSlice)break;')).toBe(true);
    // the segment arrays are not planes: they stay 4
    expect(fs).toContain('uniform vec4 segA[4];'); expect(fs).toContain('uniform vec4 segC[4];');
  });
  it('vr-view.js: the uniform array holds MAX_SECTION_PLANES vectors (the 5th plane must not throw), planeCount is the number of SHOWN planes, the limit is enforced by the ring, the menu and the B/Y long press', () => {
    expect(has(src, 'cutPlanes:{value:Array.from({length:MAX_SECTION_PLANES},()=>new THREE.Vector4(0,0,1,0))}')).toBe(true);
    expect(has(src, 'const MAX_PLANES=MAX_SECTION_PLANES')).toBe(true);
    expect(has(src, 'u.planeCount.value=n;u.planeCut.value=cutBits;')).toBe(true);
    expect(has(src, 'u.cutPlanes.value[n].set(tmpN.x,tmpN.y,tmpN.z,tmpN.dot(tmpP));if(pl.cut&&settings.cut)cutBits|=1<<n;n++;')).toBe(true);
    expect(has(src, "case'section-add':return planes.length<MAX_PLANES;")).toBe(true);
    expect(has(src, "case'section-add':if(planes.length<MAX_PLANES)addPlane(c);break;")).toBe(true);
    expect(has(src, 'if(planes.length>=MAX_PLANES){pulse(c,0.15,30);ui.flash=L.maxPlanes;')).toBe(true);
    expect(src).toContain("maxPlanes:'断面は10枚までです'"); expect(src).toContain("maxPlanes:'Up to 10 planes'");
    expect(src).not.toMatch(/MAX_PLANES=4/);
  });
  it('the planes bit mask fits an int for 10 planes (planeCut >> i)', () => {
    let bits = 0; for (let i = 0; i < MAX_SECTION_PLANES; i++) bits |= 1 << i;
    expect(bits).toBe(1023);
  });
  it('the ring catalog describes the limit', () => {
    expect(read('vr-ring.js')).toContain("when:'planes<10'");
  });
  it('the number tag draws two digits ("10") in a smaller font', () => {
    expect(has(src, "ctx.font='bold '+(i>=9?54:64)+'px system-ui,sans-serif';ctx.fillText(String(i+1),48,52)")).toBe(true);
  });
  it('the 断面 tab lists 4 planes per page (10 rows do not fit the menu): the page follows the selected plane, ▲▼ turn it, the rest of the tab keeps its place', () => {
    expect(SECTION_ROWS_PER_PAGE).toBe(4);
    expect(sectionPage(0)).toEqual({ page: 0, pages: 1, from: 0, to: 0 });
    expect(sectionPage(4, 0)).toEqual({ page: 0, pages: 1, from: 0, to: 4 });
    expect(sectionPage(5, 1)).toEqual({ page: 1, pages: 2, from: 4, to: 5 });
    expect(sectionPage(10, 2)).toEqual({ page: 2, pages: 3, from: 8, to: 10 });
    expect(sectionPage(10, 9)).toEqual({ page: 2, pages: 3, from: 8, to: 10 }); // clamped
    expect(sectionPage(10, -3).page).toBe(0); expect(sectionPage(10, undefined).page).toBe(0);
    expect([0, 3, 4, 7, 8, 9].map(i => pageOfPlane(i))).toEqual([0, 0, 1, 1, 2, 2]);
    // every plane appears on exactly one page
    const seen = []; for (let p = 0; p < 3; p++) { const g = sectionPage(10, p); for (let i = g.from; i < g.to; i++) seen.push(i); }
    expect(seen).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(has(src, 'const yb2=y0+86+SECTION_ROWS_PER_PAGE*76;')).toBe(true);
    expect(has(src, 'planes.forEach((pl,i)=>{if(i<pg.from||i>=pg.to)return;')).toBe(true);
  });
  it('VR sections are not part of any saved file (project / settings): nothing to migrate, an old save with <= 4 planes is not affected', () => {
    for (const f of ['project-file.js', 'app-settings.js', 'settings.js']) { const t = read(f); expect(t, f).not.toMatch(/cutPlanes|vr-section|VR section/i); }
    // the VR settings saved in localStorage hold no plane list
    expect(src).toMatch(/const DEFAULTS=\{[^}]*\}/); expect(src.match(/const DEFAULTS=\{[^}]*\}/)[0]).not.toMatch(/planes/);
  });
  it('the PC / iPad 3D renderer has its own single section and does not share the limit', () => {
    for (const f of ['medical-volume.js', 'scene3d.js', 'section-view.js']) expect(read(f), f).not.toMatch(/MAX_SECTION_PLANES|MAX_PLANES|cutPlanes\[/);
  });
});

describe('the section frame under the depth occlusion', () => {
  const gl = { logarithmicDepthBuffer: false, reversedDepthBuffer: false };
  it('frameDepthTest: tested (= hidden behind tissue) only with the GPU occlusion and while not lit; lit or no occlusion = on top', () => {
    expect(frameDepthTest(true, false)).toBe(true);
    expect(frameDepthTest(true, true)).toBe(false);   // laser on the band / tag, grabbed, dragged
    expect(frameDepthTest(false, false)).toBe(false); // 「薄くする」 / no standard depth: as before build 509
    expect(frameDepthTest(false, true)).toBe(false);
    expect(frameDepthTest(undefined, undefined)).toBe(false);
    // the same rule as the labels / markers (vr-depth.js occludedPass)
    for (const o of [true, false]) for (const l of [true, false]) expect(frameDepthTest(o, l)).toBe(occludedPass(o, l));
  });
  it('per mode: 実際に隠す + standard depth, 実際に隠す + log depth, 薄くする', () => {
    const state = (setting, caps, lit) => frameDepthTest(gpuOcclusionActive(setting, caps), lit);
    expect(state(1, gl, false)).toBe(true); expect(state(1, gl, true)).toBe(false);
    expect(state(1, { ...gl, logarithmicDepthBuffer: true }, false)).toBe(false);
    expect(state(1, { ...gl, reversedDepthBuffer: true }, false)).toBe(false);
    expect(state(0, gl, false)).toBe(false); expect(state(0, gl, true)).toBe(false);
  });
  it('vr-view.js: the outline + arrow (one material) and the number tag are switched per frame from the same lit set as the glow; the glow and the other materials never write depth', () => {
    expect(has(src, 'const occF=occlusionGpu();for(const pl of planes){const gc=glowBy.get(pl);')).toBe(true);
    expect(has(src, 'const dt=frameDepthTest(occF,gc!==undefined);pl.mat.depthTest=dt;pl.handle.material.depthTest=dt')).toBe(true);
    // the glow (shown only while lit) is always on top
    expect(src).toMatch(/MeshBasicMaterial\(\{color:0xffffff,transparent:true,opacity:0\.95,side:THREE\.DoubleSide,depthTest:false,depthWrite:false/);
    // a thin frame / tag must not write depth: with the test on they would clip the labels drawn after them
    expect(has(src, 'new THREE.LineBasicMaterial({color,transparent:true,depthTest:false,depthWrite:false}),h=0.12')).toBe(true);
    expect(has(src, 'side:THREE.DoubleSide,depthTest:false,depthWrite:false}));\n  handle.rotation.y')).toBe(true);
    expect(has(src, 'arrow=new THREE.LineSegments(')).toBe(true); expect(has(src, '0.065,-0.02,0)]),mat);')).toBe(true); // the arrow shares mat
  });
  it('the frame needs no extra bias on the cut face: the volume writes the cut face depth pushed behind the plane; a slice writes none', () => {
    expect(has(fs, 'gl_FragDepth=clamp(cp.z/cp.w*0.5+0.5,0.0,1.0)')).toBe(true);
    expect(has(fs, 'depthMark(capAt,contribution)')).toBe(true);
    expect(fs).not.toMatch(/depthMark\(sliceT/); // a slice writes no depth: the frame on it is in front of whatever the ray reaches behind it (the far box face if nothing), and tissue in front of it writes its own depth
    expect(has(src, 'polygonOffset')).toBe(false);
  });
  it('tagBehindTissue: only with the occlusion, only when the tissue is nearer than the tag by more than eps', () => {
    expect(tagBehindTissue(true, 0.5, 0.3, 1e-4)).toBe(true);
    expect(tagBehindTissue(true, 0.5, 0.5, 1e-4)).toBe(false);     // a tag on the cut face (tissue hit = the plane): stays pickable
    expect(tagBehindTissue(true, 0.5, 0.49995, 1e-4)).toBe(false); // within eps
    expect(tagBehindTissue(true, 0.5, 0.6, 1e-4)).toBe(false);     // the tissue is behind the tag
    expect(tagBehindTissue(true, 0.5, null, 1e-4)).toBe(false); expect(tagBehindTissue(true, 0.5, undefined)).toBe(false);
    expect(tagBehindTissue(false, 0.5, 0.1, 1e-4)).toBe(false);    // 薄くする: the frame is always visible, as before
    expect(tagBehindTissue(true, null, 0.1)).toBe(false);
  });
  it('vr-view.js: a hidden tag does not take the laser (the band already loses to a nearer tissue hit by distance in resolveTriggerTarget); a held plane keeps its tag', () => {
    expect(has(src, 'if(tab&&vh&&!draggedBy(tab.pl,null)&&tagBehindTissue(occlusionGpu(),tab.t,vh.distance,occEps))tab=null;')).toBe(true);
    expect(has(src, 'if(vh&&(sh||tab)&&vrHalfExt&&vrDims&&mesh?.parent)')).toBe(true);
    // the tag test comes after the tissue hit and before the target resolution
    expect(src.indexOf('tagBehindTissue(occlusionGpu()')).toBeGreaterThan(src.indexOf('c.userData.volHit=vh'));
    expect(src.indexOf('tagBehindTissue(occlusionGpu()')).toBeLessThan(src.indexOf('resolveTriggerTarget({board'));
  });
});
