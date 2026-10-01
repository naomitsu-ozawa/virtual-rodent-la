// Analysis results in the project file (build 408): as boot-check, then opens the practice data,
// adds a bone segment and two synthetic analysis regions (boxes of runs), saves the project
// (gatherProject + packProject), clears the results, applies the unpacked project and checks that
// the regions come back with their colour, visibility and voxel count.
//   PW_CHROMIUM=/opt/pw-browsers/chromium node tools/analysis-project-check.mjs
import { chromium } from '@playwright/test';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const root=path.resolve('docs'),nm=path.resolve('node_modules');const errors=[];
const srv=http.createServer((q,r)=>{const p=path.join(root,decodeURIComponent(q.url.split('?')[0]));fs.readFile(p.endsWith('/')?p+'index.html':p,(e,b)=>{if(e){r.writeHead(404);r.end();return}r.writeHead(200,{'content-type':p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':'text/html'});r.end(b)})}).listen(8765);
const map=u=>{
 if(u.includes('three@0.186.0/build/three.module.js'))return nm+'/three/build/three.module.js';
 if(u.includes('three@0.186.0/build/three.webgpu.js'))return nm+'/three/build/three.webgpu.js';
 if(u.includes('three.core.js'))return nm+'/three/build/three.core.js';
 if(u.includes('dicom-parser'))return nm+'/dicom-parser/dist/dicomParser.min.js';
 if(u.includes('fflate'))return nm+'/fflate/esm/browser.js';
 return null};
const b=await chromium.launch({...(process.env.PW_CHROMIUM?{executablePath:process.env.PW_CHROMIUM}:{})});const pg=await b.newPage();
pg.on('console',m=>{if(['error','warning'].includes(m.type()))console.log('console.'+m.type()+':',m.text().slice(0,300))});
pg.on('pageerror',e=>{errors.push(String(e));console.log('PAGEERROR:',String(e).slice(0,500))});
await pg.route(/^https:\/\//,async rt=>{const u=rt.request().url(),f=map(u);
 if(f){let body=fs.readFileSync(f,'utf8');if(u.includes('dicom-parser'))body='const require=()=>({});const module={exports:{}};const exports=module.exports;\n'+body+'\nexport default (module.exports.default||module.exports||window.dicomParser);';
  return rt.fulfill({status:200,contentType:'text/javascript',body})}
 if(u.includes('three-mesh-bvh')||u.includes('cornerstone'))return rt.fulfill({status:200,contentType:'text/javascript',body:'export const MeshBVH=class{};export const acceleratedRaycast=()=>{};export const computeBoundsTree=()=>{};export const disposeBoundsTree=()=>{};export default {};'});
 return rt.abort()});
await pg.goto('http://localhost:8765/index.html');await pg.waitForTimeout(3000);
await pg.click('#sample-demo-button');
const t0=Date.now();while(Date.now()-t0<180000){const s=await pg.evaluate(()=>window.__vrlBusyModal?.()||{});if(!s.active&&Date.now()-t0>5000)break;await pg.waitForTimeout(250)}
const r=await pg.evaluate(async()=>{
 const v=new URL(document.querySelector('script[src*="app.js"]').src).search,im=f=>import('./'+f+v);
 const [st,ops,dl,pf,seg,sg]=await Promise.all([im('state.js'),im('analysis-ops.js'),im('data-load.js'),im('project-file.js'),im('segment-ui.js'),im('segments.js')]);
 const add=document.getElementById('segment-add-select'),btn=document.getElementById('segment-add-button');if(add&&!btn.disabled){add.value='bone';add.dispatchEvent(new Event('change'));btn.click()}
 await new Promise(r=>setTimeout(r,500));
 const vol=st.current3DVolume||st.volume;if(!vol)return{error:'no volume'};
 const box=(z0,z1,y0,y1,x0,x1)=>{const runs=new Array(vol.slices).fill(null);for(let z=z0;z<=z1;z++){const a=[];for(let y=y0;y<=y1;y++)a.push(y,x0,x1);runs[z]=new Int32Array(a)}return runs};
 await ops.addAnalysisRegion(vol,{key:'bone',segmentKeys:['bone'],runsBySlice:box(200,209,200,209,200,219),voxels:2000,mm3:1});
 await ops.addAnalysisRegion(vol,{key:'bone',segmentKeys:['bone'],runsBySlice:box(300,304,100,104,100,104),voxels:125,mm3:1});
 st.analysisRegions[1].visible=false;
 const before=st.analysisRegions.map(r=>({color:r.color,visible:r.visible,voxels:r.voxels,key:r.key}));
 const {project,binaries}=dl.gatherProject(),bytes=pf.packProject(project,binaries),un=pf.unpackProject(bytes);
 seg.clearAnalysisHighlight();const cleared=st.analysisRegions.length;
 await dl.applyProject(un);
 const after=st.analysisRegions.map(r=>({color:r.color,visible:r.visible,voxels:r.voxels,key:r.key}));
 // deletion linked: exclude half of the first box, trim the results to the edit
 const refs=ops.snapshotAnalysisRegionsForSegment('bone'),es=sg.segmentEditState.bone;es.excludeRuns=box(200,204,200,209,200,219);
 await ops.trimAnalysisRegionsAfterEdit('bone',refs);const trimmed=st.analysisRegions.map(r=>r.voxels);es.excludeRuns=null;
 return{before,cleared,after,trimmed,files:Object.keys(binaries).filter(k=>k.startsWith('analysis/')),bytes:bytes.byteLength};
});
console.log(JSON.stringify(r));
const ok=!r.error&&r.cleared===0&&JSON.stringify(r.before)===JSON.stringify(r.after)&&r.files.length===2&&JSON.stringify(r.trimmed)==='[1000,125]';
await b.close();srv.close();
if(errors.length||!ok){console.error('analysis project check FAILED');process.exit(1)}console.log('analysis project check OK');
