// GPU info tab check: opens the settings > GPU info tab from the status bar, checks the report text and the copy button.
// Run: PW_CHROMIUM=... node tools/gpu-diagnostics-check.mjs   (NO_WEBGPU=1 to start without WebGPU)
// Startup check without network: serves docs/, maps the CDN imports to node_modules
// (stubs for three-mesh-bvh / cornerstone), loads index.html in Chromium and
// fails on any page error. Run before asking for a device check: npm run boot-check
import { chromium } from '@playwright/test';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const root=path.resolve('docs'),nm=path.resolve('node_modules');const errors=[];
const srv=http.createServer((q,r)=>{const p=path.join(root,decodeURIComponent(q.url.split('?')[0]));
 // build 437: the practice data's bundled project (docs/demo/sample1/project.vrlab) is applied on load; the checks start
 // from the bare data unless SAMPLE_PROJECT=1
 if(p.endsWith('project.vrlab')&&!process.env.SAMPLE_PROJECT){r.writeHead(404);r.end();return}
 fs.readFile(p.endsWith('/')?p+'index.html':p,(e,b)=>{if(e){r.writeHead(404);r.end();return}r.writeHead(200,{'content-type':p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':'text/html'});r.end(b)})}).listen(8766);
const map=u=>{
 if(u.includes('three@0.186.0/build/three.module.js'))return nm+'/three/build/three.module.js';
 if(u.includes('three@0.186.0/build/three.webgpu.js'))return nm+'/three/build/three.webgpu.js';
 if(u.includes('three.core.js'))return nm+'/three/build/three.core.js';
 if(u.includes('dicom-parser'))return nm+'/dicom-parser/dist/dicomParser.min.js';
 if(u.includes('fflate'))return nm+'/fflate/esm/browser.js';
 return null};
const b=await chromium.launch({args:process.env.NO_WEBGPU?['--disable-features=Vulkan','--disable-webgpu']:[],...(process.env.PW_CHROMIUM?{executablePath:process.env.PW_CHROMIUM}:{})});const ctx=await b.newContext({permissions:['clipboard-read','clipboard-write']});const pg=await ctx.newPage();
pg.on('console',m=>{if(['error','warning'].includes(m.type()))console.log('console.'+m.type()+':',m.text().slice(0,300))});
pg.on('pageerror',e=>{errors.push(String(e));console.log('PAGEERROR:',String(e).slice(0,500))});
await pg.route(/^https:\/\//,async rt=>{const u=rt.request().url(),f=map(u);
 if(f){let body=fs.readFileSync(f,'utf8');if(u.includes('dicom-parser'))body='const require=()=>({});const module={exports:{}};const exports=module.exports;\n'+body+'\nexport default (module.exports.default||module.exports||window.dicomParser);';
  return rt.fulfill({status:200,contentType:'text/javascript',body})}
 if(u.includes('three-mesh-bvh')||u.includes('cornerstone'))return rt.fulfill({status:200,contentType:'text/javascript',body:'export const MeshBVH=class{};export const acceleratedRaycast=()=>{};export const computeBoundsTree=()=>{};export const disposeBoundsTree=()=>{};export default {};'});
 return rt.abort()});
await pg.goto('http://localhost:8766/index.html');await pg.waitForTimeout(4000);
let fail=0;const ok=(c,m)=>{console.log((c?'ok   ':'FAIL ')+m);if(!c)fail++};
await pg.click('#gpu-status-bar');await pg.waitForTimeout(800);
ok(await pg.evaluate(()=>document.getElementById('settings-dialog').open),'status bar click opens settings');
ok(await pg.evaluate(()=>!document.querySelector('[data-settings-panel=gpu]').hidden),'GPU info panel is shown');
const rep=await pg.inputValue('#gpu-report');console.log(rep.split('\n').slice(10,22).join('\n'));
ok(/navigator\.gpu: /.test(rep)&&/User Agent: /.test(rep),'report has navigator.gpu and UA');
const prefShown=await pg.evaluate(()=>!document.getElementById('gpu-pref-row').hidden);const os=await pg.evaluate(()=>/Linux|Windows/.test(navigator.userAgent)&&!/Android/.test(navigator.userAgent));
ok(prefShown===os,'preference row visible only on Linux/Windows (visible='+prefShown+')');
await pg.click('#gpu-copy');await pg.waitForTimeout(800);
const clip=await pg.evaluate(()=>navigator.clipboard.readText()).catch(()=> '');
ok(clip.includes('User Agent'),'copy button put the report on the clipboard');
ok(/コピーしました|Copied|コピーできません/.test(await pg.textContent('#gpu-copy-msg')),'copy message shown');
// preference change shows the reload note
if(prefShown){await pg.selectOption('#set-gpu-preference','low-power');ok(await pg.evaluate(()=>!document.getElementById('gpu-pref-reload').hidden),'reload note after changing preference');
 await pg.click('#gpu-copy');await pg.waitForTimeout(500);ok((await pg.inputValue('#gpu-report')).includes('low-power'),'report shows stored preference');}
console.log('status bar:',await pg.textContent('#gpu-status-text'));
await b.close();srv.close();if(errors.length||fail){console.error('gpu diagnostics check FAILED');process.exit(1)}console.log('gpu diagnostics check OK');
