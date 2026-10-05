// Colour themes (build 450): the IMAGE does not change with the theme, the background around it does.
// Opens a tiny synthetic CT series (tests/helpers/dicom-folder.js) offline like boot-check, then for each of the six themes
//  - reads the pixels of the three 2D slice canvases (getImageData): they must be identical in every theme,
//  - reads the CSS backgrounds: the 2D canvas follows the theme (light / dark), the 3D one is dark in every theme and is the value the
//    GPU volume view, the WebGL clear colour and the 3D card backdrop all read.
//   PW_CHROMIUM=/opt/pw-browsers/chromium node tools/theme-image-check.mjs
import { chromium } from '@playwright/test';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { dicomFolder } from '../tests/helpers/dicom-folder.js';
const root=path.resolve('docs'),nm=path.resolve('node_modules'),errors=[],PORT=8766;
const srv=http.createServer((q,r)=>{const p=path.join(root,decodeURIComponent(q.url.split('?')[0]));
 fs.readFile(p.endsWith('/')?p+'index.html':p,(e,b)=>{if(e){r.writeHead(404);r.end();return}r.writeHead(200,{'content-type':p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':'text/html'});r.end(b)})}).listen(PORT);
const map=u=>{
 if(u.includes('three@0.186.0/build/three.module.js'))return nm+'/three/build/three.module.js';
 if(u.includes('three@0.186.0/build/three.webgpu.js'))return nm+'/three/build/three.webgpu.js';
 if(u.includes('three.core.js'))return nm+'/three/build/three.core.js';
 if(u.includes('dicom-parser'))return nm+'/dicom-parser/dist/dicomParser.min.js';
 if(u.includes('fflate'))return nm+'/fflate/esm/browser.js';
 return null};
const b=await chromium.launch({...(process.env.PW_CHROMIUM?{executablePath:process.env.PW_CHROMIUM}:{})});
const pg=await b.newPage({viewport:{width:1440,height:900}});
pg.on('pageerror',e=>{const m=String(e);if(/swizzle/.test(m))return; errors.push(m);console.log('PAGEERROR:',m.slice(0,300))}); // swizzle: this headless WebGPU build, unrelated
await pg.route(/^https:\/\//,async rt=>{const u=rt.request().url(),f=map(u);
 if(f){let body=fs.readFileSync(f,'utf8');if(u.includes('dicom-parser'))body='const require=()=>({});const module={exports:{}};const exports=module.exports;\n'+body+'\nexport default (module.exports.default||module.exports||window.dicomParser);';return rt.fulfill({status:200,contentType:'text/javascript',body})}
 if(u.includes('three-mesh-bvh')||u.includes('cornerstone'))return rt.fulfill({status:200,contentType:'text/javascript',body:'export const MeshBVH=class{};export const acceleratedRaycast=()=>{};export const computeBoundsTree=()=>{};export const disposeBoundsTree=()=>{};export default {};'});
 return rt.abort()});
await pg.goto(`http://localhost:${PORT}/index.html`);await pg.waitForTimeout(3000);
await pg.locator('#folder-input').setInputFiles(dicomFolder());
await pg.locator('.series-card').first().waitFor({state:'attached',timeout:60000});
await pg.locator('.series-card').first().click();
await pg.waitForFunction(()=>/ready/i.test(document.querySelector('.ready-badge')?.textContent||''),null,{timeout:60000});
const IDS=['light-standard','light-paper','light-gray','dark-standard','dark-reading','dark-gray'];
const sample=()=>pg.evaluate(()=>{
 const out={canvases:[],bg:{}};
 for(const c of document.querySelectorAll('.mpr-canvas')){const ctx=c.getContext('2d');if(!ctx||!c.width){out.canvases.push(null);continue}
  const d=ctx.getImageData(0,0,c.width,c.height).data;let h=0,nz=0;for(let i=0;i<d.length;i++){h=(h*31+d[i])>>>0;if(d[i])nz++}out.canvases.push({w:c.width,h:c.height,hash:h,nonzero:nz})}
 const c0=document.querySelector('.mpr-canvas'),card=document.querySelector('.viewport-card');
 out.bg={canvas2d:getComputedStyle(c0).backgroundColor,card3d:getComputedStyle(card).backgroundColor,page:getComputedStyle(document.body).backgroundColor};
 return out});
// the MPR draws in steps: wait until the pixels are the same twice in a row (up to 20 s)
{let prev=null,stable=false;for(let i=0;i<40&&!stable;i++){await pg.waitForTimeout(500);const now=JSON.stringify((await sample()).canvases);stable=now===prev&&!now.includes('"nonzero":0');prev=now}
 if(!stable){console.error('FAIL: the 2D canvases did not settle');process.exit(1)}}
const res={};
for(const id of IDS){await pg.selectOption('#theme-quick',id);await pg.waitForTimeout(500);res[id]=await sample();res[id].theme=await pg.evaluate(()=>document.documentElement.dataset.theme);
 // the input of the GPU volume view: the 3D background the renderer reads each frame, and the CSS value it comes from
 res[id].gpu=await pg.evaluate(async()=>{const v=new URL(document.querySelector('script[src*="app.js"]').src).search,m=await import('./canvas-theme.js'+v);return{css:m.canvasBackground3d(),unit:m.canvasBackground3dUnit(),card:getComputedStyle(document.querySelector('.view-card-3d')).backgroundColor}})}
await b.close();srv.close();
let ok=!errors.length;const fail=m=>{ok=false;console.error('FAIL:',m)};
const base=res['dark-standard'].canvases;
if(!base.length||base.some(x=>!x||!x.nonzero))fail('the 2D canvases are empty (no image to compare)');
for(const id of IDS){
 if(res[id].theme!==id)fail(id+': theme not applied');
 if(JSON.stringify(res[id].canvases)!==JSON.stringify(base))fail(id+': the image pixels changed with the theme');
 console.log(id.padEnd(15),'canvas pixels same:',JSON.stringify(res[id].canvases)===JSON.stringify(base),'| 2D bg',res[id].bg.canvas2d,'| 3D bg',res[id].bg.card3d,'| page',res[id].bg.page);
}
// 3D background (GPU volume view clear colour / miss colour, WebGL clear colour, 3D card backdrop): dark in every theme, the same colour in all three places
const seen=new Set();
for(const id of IDS){const g=res[id].gpu;if(!g.css||!g.unit)fail(id+': no 3D background variable');else{
 if(g.unit.some((x,i)=>Math.abs(x-g.css[i]/255)>1e-6))fail(id+': the renderer input differs from the CSS variable');
 if(g.card!=='rgb('+g.css.join(', ')+')')fail(id+': the 3D card backdrop differs from the variable');
 if(Math.max(...g.css)>70)fail(id+': the 3D background should be dark');seen.add(g.css.join())}
 console.log(id.padEnd(15),'3D background (GPU volume / WebGL / card):',JSON.stringify(g.css))}
if(seen.size<5)fail('the 3D backgrounds should differ between themes (tinted like the theme)');
console.log('note: the GPU volume view itself (WebGPU, alphaMode opaque) cannot render in this headless environment; the check covers the value the renderer reads and the shader / clear code is covered by tests/unit/themes.test.js');
const lum=s=>{const m=s.match(/\d+/g).map(Number);return(m[0]*299+m[1]*587+m[2]*114)/1000};
for(const id of IDS){const light=id.startsWith('light'),l2=lum(res[id].bg.canvas2d),l3=lum(res[id].bg.card3d);
 if(light&&l2<150)fail(id+': the 2D background should be light');
 if(!light&&l2>60)fail(id+': the 2D background should be dark');
 if(l3>60)fail(id+': the 3D background should be dark')}
if(!ok){console.error('theme image check FAILED');process.exit(1)}console.log('theme image check OK');
