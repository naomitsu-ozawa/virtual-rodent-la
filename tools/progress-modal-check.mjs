// Progress modal check (build 405): as boot-check (docs/ served, CDN imports from node_modules), then
// opens the practice data (docs/demo/sample1) and watches the central progress modal: it must show
// up (the load takes longer than the delay), block input (pointer-events auto) while shown, and be
// gone with no job left running at the end. Screenshots of the modal at desktop and iPad size.
//   PW_CHROMIUM=/opt/pw-browsers/chromium node tools/progress-modal-check.mjs [outDir]
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
const b=await chromium.launch({...(process.env.PW_CHROMIUM?{executablePath:process.env.PW_CHROMIUM}:{})});const outDir=process.argv[2]||'.';
const pg=await b.newPage({viewport:{width:1280,height:800}});
pg.on('console',m=>{if(['error','warning'].includes(m.type()))console.log('console.'+m.type()+':',m.text().slice(0,300))});
pg.on('pageerror',e=>{errors.push(String(e));console.log('PAGEERROR:',String(e).slice(0,500))});
await pg.route(/^https:\/\//,async rt=>{const u=rt.request().url(),f=map(u);
 if(f){let body=fs.readFileSync(f,'utf8');if(u.includes('dicom-parser'))body='const require=()=>({});const module={exports:{}};const exports=module.exports;\n'+body+'\nexport default (module.exports.default||module.exports||window.dicomParser);';
  return rt.fulfill({status:200,contentType:'text/javascript',body})}
 if(u.includes('three-mesh-bvh')||u.includes('cornerstone'))return rt.fulfill({status:200,contentType:'text/javascript',body:'export const MeshBVH=class{};export const acceleratedRaycast=()=>{};export const computeBoundsTree=()=>{};export const disposeBoundsTree=()=>{};export default {};'});
 return rt.abort()});
await pg.goto('http://localhost:8765/index.html');await pg.waitForTimeout(3000);
const st=()=>pg.evaluate(()=>{const s=window.__vrlBusyModal?.()||{},el=document.getElementById('job-modal');return{...s,pe:el?getComputedStyle(el).pointerEvents:'',shown:!!el&&!el.classList.contains('is-hidden')}});
const t0=Date.now();await pg.click('#sample-demo-button');
let seen=0,labels=new Set(),blocked=true,shot=false,idleSince=0,last=null;
while(Date.now()-t0<180000){
 const s=await st();last=s;
 if(s.shown){seen++;labels.add(s.label);if(s.pe!=='auto')blocked=false;
  if(!shot){await pg.screenshot({path:outDir+'/progress-modal-desktop.png'});await pg.setViewportSize({width:820,height:1180});await pg.waitForTimeout(150);await pg.screenshot({path:outDir+'/progress-modal-ipad.png'});await pg.setViewportSize({width:1280,height:800});shot=true}}
 if(!s.active&&!s.shown&&Date.now()-t0>3000){if(!idleSince)idleSince=Date.now();if(Date.now()-idleSince>3000)break}else idleSince=0;
 await pg.waitForTimeout(100);
}
const end=await st();
console.log('modal seen in',seen,'polls; labels:',[...labels].join(' | ')||'-','; blocks input:',blocked,'; at the end: shown',end.shown,'active',end.active,'; '+((Date.now()-t0)/1000).toFixed(1)+' s');
const ok=seen>0&&blocked&&!end.shown&&!end.active;
// 3D rebuild with 中断: the modal shows the 'three' job with a cancel button; pressing it ends the job
let rebuild='skipped (button disabled)';
if(await pg.evaluate(()=>{const b=document.getElementById('filter-rebuild-3d');if(!b||b.disabled)return false;b.click();return true})){
 let s3=null;const t1=Date.now();while(Date.now()-t1<20000){s3=await st();if(s3.shown&&s3.name==='three')break;if(!s3.active&&Date.now()-t1>3000)break;await pg.waitForTimeout(100)}
 if(!(s3?.shown&&s3.name==='three'))rebuild='no modal (rebuild ended within '+((Date.now()-t1)/1000).toFixed(1)+' s)';
 else{const btn=await pg.evaluate(()=>{const b=document.querySelector('#job-modal .job-button');return b&&!b.classList.contains('is-hidden')?b.textContent:''});
  await pg.click('#job-modal .job-button');const t2=Date.now();let e=null;while(Date.now()-t2<30000){e=await st();if(!e.shown)break;await pg.waitForTimeout(100)}
  rebuild='modal "'+s3.label+'", button "'+btn+'", after 中断: '+(e.shown?'STILL SHOWN':'closed in '+((Date.now()-t2)/1000).toFixed(1)+' s');if(e.shown)errors.push('modal still shown after cancel')}}
console.log('3D rebuild:',rebuild);
// the 3D adapter directly (no WebGPU here, so no real 3D job): set3DBusy shows 中断, which presses the 3D cancel button
const three=await pg.evaluate(async()=>{const m=await import('./three-status.js'+new URL(document.querySelector('script[src*="app.js"]').src).search);let pressed=0;const c=document.getElementById('three-busy-cancel');const on=()=>{pressed++};c?.addEventListener('click',on);
 m.set3DBusy(true,'3D check');await new Promise(r=>setTimeout(r,600));const b=document.querySelector('#job-modal .job-button'),v=window.__vrlBusyModal();const txt=b?.textContent||'';b?.click();
 await new Promise(r=>setTimeout(r,50));m.set3DBusy(false);await new Promise(r=>setTimeout(r,50));c?.removeEventListener('click',on);return{shown:v.visible,label:v.label,txt,pressed,after:window.__vrlBusyModal()}});
console.log('set3DBusy: shown',three.shown,'label',three.label,'button',three.txt,'cancel pressed',three.pressed,'after: shown',three.after.visible,'active',three.after.active);
if(!three.shown||three.pressed!==1||three.after.visible||three.after.active)errors.push('3D adapter check failed');
// VR preparation: runs in the modal ('vr'), then the page panel shows up with the start button
const vr=await pg.evaluate(async()=>{const v=new URL(document.querySelector('script[src*="app.js"]').src).search,m=await import('./vr-view.js'+v);
 m.showPreparePanel({language:'ja',mode:'vr',onStart:()=>{}});const t0=performance.now();let seen=false,label='';
 while(performance.now()-t0<120000){const s=window.__vrlBusyModal(),p=document.getElementById('vr-prepare-panel');if(s.visible&&s.name==='vr'){seen=true;label=s.label}
  if(p&&p.style.display!=='none'&&!s.active)return{seen,label,panel:true,start:!p.querySelector('.start').disabled,ph:p.querySelector('.ph').textContent,s:((performance.now()-t0)/1000).toFixed(1)};
  await new Promise(r=>setTimeout(r,100))}
 return{seen,label,panel:false}});
console.log('VR preparation:',JSON.stringify(vr));
if(!vr.panel)errors.push('VR panel did not appear');
// a short job never shows: open and close a slot within the delay
const short=await pg.evaluate(async()=>{const m=await import('./progress-modal.js'+new URL(document.querySelector('script[src*="app.js"]').src).search);m.setBusySlot('check',true,{label:'short'});await new Promise(r=>setTimeout(r,150));const a=window.__vrlBusyModal().visible;m.setBusySlot('check',false);await new Promise(r=>setTimeout(r,500));return{during:a,after:window.__vrlBusyModal().visible}});
console.log('short job: shown during',short.during,'after',short.after);
await b.close();srv.close();
if(errors.length||!ok||short.during||short.after){console.error('progress modal check FAILED');process.exit(1)}console.log('progress modal check OK');
