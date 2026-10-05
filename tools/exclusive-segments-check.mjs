// Non-overlapping segments (build 438): bare practice data, bone / fat / soft with the owner's ranges (fat −250…81, soft
// −93…248). Mode 'off': voxels in both fat and soft base runs > 0; mode 'priority' (cards bone → fat → soft): 0, and the
// soft runs + fat runs = their union. Hiding the fat card (checkbox) leaves soft unchanged. A soft range around the fat
// one (−300…300) keeps the piece with its middle and the card reports the dropped piece. Project save → other mode /
// order → load restores mode, order, user ranges and the ranges in use (exactly: before 438 each load moved a range by a
// slider step). Reported only: voxels in both fat and soft after Closing 1 on fat (Closing adds voxels after the split).
//   PW_CHROMIUM=/opt/pw-browsers/chromium node tools/exclusive-segments-check.mjs
import { chromium } from '@playwright/test';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const root=path.resolve('docs'),nm=path.resolve('node_modules');const errors=[];
const srv=http.createServer((q,r)=>{const p=path.join(root,decodeURIComponent(q.url.split('?')[0]));
 // build 437: the practice data's bundled project (docs/demo/sample1/project.vrlab) is applied on load; the checks start
 // from the bare data unless SAMPLE_PROJECT=1
 if(p.endsWith('project.vrlab')&&!process.env.SAMPLE_PROJECT){r.writeHead(404);r.end();return}
 fs.readFile(p.endsWith('/')?p+'index.html':p,(e,b)=>{if(e){r.writeHead(404);r.end();return}r.writeHead(200,{'content-type':p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':'text/html'});r.end(b)})}).listen(8765);
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
const idle=async()=>{const t0=Date.now();while(Date.now()-t0<300000){const s=await pg.evaluate(()=>window.__vrlBusyModal?.()||{});if(!s.active&&Date.now()-t0>1500)break;await pg.waitForTimeout(250)}};
await idle();
const r=await pg.evaluate(async()=>{
 const v=new URL(document.querySelector('script[src*="app.js"]').src).search,im=f=>import('./'+f+v);
 const [st,seg,sr,rl,sg,dl,pf]=await Promise.all([im('state.js'),im('segment-ui.js'),im('segment-runs.js'),im('run-length.js'),im('segments.js'),im('data-load.js'),im('project-file.js')]);
 const wait=ms=>new Promise(r=>setTimeout(r,ms)),idle=async()=>{await wait(1200);for(let t=Date.now();Date.now()-t<600000;){await wait(300);if(!window.__vrlBusyModal?.().active)break}};
 const add=k=>{const a=document.getElementById('segment-add-select');a.value=k;a.dispatchEvent(new Event('change'));document.getElementById('segment-add-button').click()};
 for(const k of ['bone','fat','soft'])add(k);await idle();
 const S=sg.segmentState,vol=st.current3DVolume||st.volume,d=vol.slices;
 const setR=(k,a,b)=>{seg.setControlValue(seg.segmentControl('min',k),a);seg.setControlValue(seg.segmentControl('max',k),b)};
 setR('fat',-250,81);setR('soft',-93,248);await idle();
 const mode=m=>{const sel=document.getElementById('segment-exclusive-mode');sel.value=m;sel.dispatchEvent(new Event('change'))};
 const runs=async k=>await sr.ensureSegmentBaseRuns(k,vol);
 const count=async()=>{const f=await runs('fat'),s=await runs('soft');const both=rl.analysisRunsVoxelCount(rl.intersectRunArrays(f,s,d)),uni=rl.analysisRunsVoxelCount(rl.unionRunArrays(f,s,d));return{fat:rl.analysisRunsVoxelCount(f),soft:rl.analysisRunsVoxelCount(s),both,union:uni,fatRange:[S.fat.min,S.fat.max],softRange:[S.soft.min,S.soft.max],user:{fat:[S.fat.userMin,S.fat.userMax],soft:[S.soft.userMin,S.soft.userMax]}}};
 const out={order:[...sg.segmentExclusive.order],cards:[...document.querySelectorAll('#segment-controls [data-segment]')].filter(c=>!c.classList.contains('is-hidden')).map(c=>c.dataset.segment)};
 mode('off');await idle();out.off=await count();
 mode('priority');await idle();out.priority=await count();
 out.note=document.querySelector('[data-seg-effective="soft"]').textContent;
 // hide the fat card (checkbox): soft keeps its voxels
 const en=seg.segmentControl('enabled','fat');en.checked=false;en.dispatchEvent(new Event('change'));await idle();out.hidden=await count();en.checked=true;en.dispatchEvent(new Event('change'));await idle();
 // nested: soft around fat
 setR('soft',-300,300);await idle();out.nested={soft:[S.soft.min,S.soft.max],dropped:S.soft.exclusive?.dropped,note:document.querySelector('[data-seg-effective="soft"]').textContent};
 setR('soft',-93,248);await idle();
 // project round trip
 const before={mode:sg.segmentExclusive.mode,order:[...sg.segmentExclusive.order],fat:[S.fat.userMin,S.fat.userMax,S.fat.min,S.fat.max],soft:[S.soft.userMin,S.soft.userMax,S.soft.min,S.soft.max]};
 const {project,binaries}=dl.gatherProject(),un=pf.unpackProject(pf.packProject(project,binaries));
 mode('off');sg.segmentExclusive.order=['bone','soft','fat','lung'];await idle();
 await dl.applyProject(un);await idle();
 const after={mode:sg.segmentExclusive.mode,order:[...sg.segmentExclusive.order],fat:[S.fat.userMin,S.fat.userMax,S.fat.min,S.fat.max],soft:[S.soft.userMin,S.soft.userMax,S.soft.min,S.soft.max]};
 out.roundTrip={before,after,saved:project.segmentOptions,savedSoft:[project.segments.soft.min,project.segments.soft.max]};
 // known limit (reported, not asserted): Closing / hole fill add voxels after the ranges are split
 seg.setControlValue(seg.segmentControl('closing','fat'),1);await idle();await wait(1500);await idle();
 {const f=await sr.getFinalSegmentRuns('fat',vol),s2=await sr.getFinalSegmentRuns('soft',vol);out.closingBoth=rl.analysisRunsVoxelCount(rl.intersectRunArrays(f,s2,d))}
 return out;
});
console.log(JSON.stringify(r));
const ok=r.off.both>0&&r.priority.both===0&&r.priority.union===r.priority.fat+r.priority.soft&&r.hidden.soft===r.priority.soft&&r.nested.dropped?.length===1&&r.nested.note.length>0&&JSON.stringify(r.roundTrip.before)===JSON.stringify(r.roundTrip.after)&&r.cards.join()==='bone,fat,soft';
await b.close();srv.close();
if(errors.length||!ok){console.error('exclusive segments check FAILED');process.exit(1)}console.log('exclusive segments check OK');
