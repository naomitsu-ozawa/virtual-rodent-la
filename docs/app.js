
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.186.0/build/three.webgpu.js';
import { WebGLRenderer } from 'https://cdn.jsdelivr.net/npm/three@0.186.0/build/three.module.js';
import dicomParser from 'https://esm.sh/dicom-parser@1.8.21';
import { unzip } from 'https://esm.sh/fflate@0.8.2';

const DEMO_URL='https://zenodo.org/api/records/12761093/files/PET-CT.zip/content';
const DEMO_SIZE=20800000;
const app=document.querySelector('#app');
app.innerHTML=`
<main class="app-shell">
<header class="topbar"><div><p class="eyebrow">SMALL-ANIMAL CT / WEBGPU</p><h1>Virtual Rodent Lab</h1><p class="subtitle">Browser-based DICOM CT viewer for mouse and laboratory-animal imaging</p></div><div class="topbar-actions"><div id="gpu-status" class="status status-checking">WEBGPU CHECKING</div><button id="demo-button" class="secondary-button">公開マウスCTデモ</button><button id="open-folder" class="primary-button">DICOMフォルダを開く</button><input id="folder-input" class="visually-hidden" type="file" webkitdirectory multiple></div></header>
<section class="workspace"><aside class="sidebar"><section class="panel"><div class="panel-heading"><div><p class="panel-kicker">DATASET</p><h2>DICOM Series</h2></div></div><div id="scan-state" class="empty-state"><strong>データを選択してください</strong><span>ローカルフォルダ、または約20.8MBの公開マウスPET/CTデモを利用できます。</span></div><div id="scan-progress" class="progress-wrap is-hidden"><div class="progress-track"><div id="scan-progress-bar" class="progress-bar"></div></div><span id="scan-progress-label">0 / 0</span></div><div id="series-list" class="series-list"></div></section>
<section class="panel compact-panel"><div class="panel-heading"><div><p class="panel-kicker">DISPLAY</p><h2>CT表示</h2></div></div><label class="range-row"><span>Window Center</span><output id="wc-val">—</output><input id="wc" type="range" min="-2000" max="4000" value="500" disabled></label><label class="range-row"><span>Window Width</span><output id="ww-val">—</output><input id="ww" type="range" min="1" max="8000" value="3000" disabled></label><div class="panel-heading segment-heading"><div><p class="panel-kicker">SEGMENTATION</p><h2>組織セグメント</h2></div></div><div id="segment-controls" class="segment-controls"><div class="segment-card" data-segment="bone">
<div class="segment-card-head"><label><input class="segment-enabled" type="checkbox" data-seg-enabled="bone" checked disabled><strong>Bone</strong></label><input class="segment-color" data-seg-color="bone" type="color" value="#f3f0e8" disabled></div>
<label class="segment-range"><span>Min</span><output data-seg-min-out="bone">—</output><input data-seg-min="bone" type="range" min="0" max="1" value="0" disabled></label>
<label class="segment-range"><span>Max</span><output data-seg-max-out="bone">—</output><input data-seg-max="bone" type="range" min="0" max="1" value="1" disabled></label>
<label class="segment-range"><span>Opacity</span><output data-seg-opacity-out="bone">0.85</output><input data-seg-opacity="bone" type="range" min="0" max="1" step="0.05" value="0.85" disabled></label>
</div><div class="segment-card" data-segment="soft">
<div class="segment-card-head"><label><input class="segment-enabled" type="checkbox" data-seg-enabled="soft"  disabled><strong>Soft tissue</strong></label><input class="segment-color" data-seg-color="soft" type="color" value="#d97f7f" disabled></div>
<label class="segment-range"><span>Min</span><output data-seg-min-out="soft">—</output><input data-seg-min="soft" type="range" min="0" max="1" value="0" disabled></label>
<label class="segment-range"><span>Max</span><output data-seg-max-out="soft">—</output><input data-seg-max="soft" type="range" min="0" max="1" value="1" disabled></label>
<label class="segment-range"><span>Opacity</span><output data-seg-opacity-out="soft">0.28</output><input data-seg-opacity="soft" type="range" min="0" max="1" step="0.05" value="0.28" disabled></label>
</div><div class="segment-card" data-segment="fat">
<div class="segment-card-head"><label><input class="segment-enabled" type="checkbox" data-seg-enabled="fat"  disabled><strong>Fat</strong></label><input class="segment-color" data-seg-color="fat" type="color" value="#e7c85d" disabled></div>
<label class="segment-range"><span>Min</span><output data-seg-min-out="fat">—</output><input data-seg-min="fat" type="range" min="0" max="1" value="0" disabled></label>
<label class="segment-range"><span>Max</span><output data-seg-max-out="fat">—</output><input data-seg-max="fat" type="range" min="0" max="1" value="1" disabled></label>
<label class="segment-range"><span>Opacity</span><output data-seg-opacity-out="fat">0.35</output><input data-seg-opacity="fat" type="range" min="0" max="1" step="0.05" value="0.35" disabled></label>
</div></div><div class="tool-grid filter-grid"><button class="tool-chip" disabled>NLM</button><button class="tool-chip" disabled>Anisotropic Diffusion</button><button class="tool-chip" disabled>Spike / Hole</button></div><p class="hint">1本指: 3D回転 / 2本指: ズーム・移動 / MPRは上下ドラッグでスライス移動</p></section></aside>
<section class="viewer-grid"><section class="viewport-card viewport-card-main"><div class="viewport-label"><strong>3D</strong><span id="three-label">WebGPU</span></div><div id="viewport-3d" class="viewport viewport-3d"></div><div id="selected" class="selected-series-overlay"><strong>Series未選択</strong><span>左の一覧からCT Seriesを選択してください。</span></div></section><section class="mpr-column">${['axial','coronal','sagittal'].map(p=>`<article class="viewport-card mpr-card"><div class="viewport-label"><strong>${p}</strong><span id="${p}-label">—</span></div><canvas id="${p}-canvas" class="mpr-canvas"></canvas><input id="${p}-slider" class="slice-slider" type="range" min="0" max="0" value="0" disabled></article>`).join('')}</section></section></section>
<footer><span id="footer">Original calibrated CT values are preserved.</span></footer></main>`;

const $=s=>document.querySelector(s);
const viewport=$('#viewport-3d'),status=$('#gpu-status'),demoBtn=$('#demo-button'),folderBtn=$('#open-folder'),folderInput=$('#folder-input'),state=$('#scan-state'),prog=$('#scan-progress'),bar=$('#scan-progress-bar'),progLabel=$('#scan-progress-label'),list=$('#series-list'),selected=$('#selected'),footer=$('#footer'),threeLabel=$('#three-label'),wc=$('#wc'),ww=$('#ww'),wcVal=$('#wc-val'),wwVal=$('#ww-val');
const planes=Object.fromEntries(['axial','coronal','sagittal'].map(p=>[p,{canvas:$('#'+p+'-canvas'),slider:$('#'+p+'-slider'),label:$('#'+p+'-label')}]));
let volume=null,sceneState=null,activeId=null;
const segmentState={
 bone:{enabled:true,color:'#f3f0e8',opacity:.85,min:0,max:1},
 soft:{enabled:false,color:'#d97f7f',opacity:.28,min:0,max:1},
 fat:{enabled:false,color:'#e7c85d',opacity:.35,min:0,max:1}
};
let segmentRenderTimer=null;

folderBtn.onclick=()=>{folderInput.value='';folderInput.click()};
folderInput.onchange=async()=>{const files=[...(folderInput.files||[])];if(files.length)await inspect(files,false)};
demoBtn.onclick=async()=>{busy(true);resetVolume();list.replaceChildren();state.classList.remove('is-hidden');prog.classList.remove('is-hidden');state.innerHTML='<strong>公開マウスPET/CTを取得中…</strong><span>20.8MBの公開データです。</span>';try{const files=await loadDemo();await inspect(files,true)}catch(e){console.error(e);state.innerHTML='<strong>公開デモを読み込めませんでした</strong><span>'+esc(e.message||e)+'</span>';footer.textContent='Demo error: '+String(e.message||e)}finally{busy(false);prog.classList.add('is-hidden')}};
wc.oninput=ww.oninput=renderAll;
for(const key of Object.keys(segmentState)){
 const enabled=$('[data-seg-enabled="'+key+'"]'),color=$('[data-seg-color="'+key+'"]'),min=$('[data-seg-min="'+key+'"]'),max=$('[data-seg-max="'+key+'"]'),opacity=$('[data-seg-opacity="'+key+'"]');
 enabled.onchange=()=>{segmentState[key].enabled=enabled.checked;renderAll();scheduleSegment3D()};
 color.oninput=()=>{segmentState[key].color=color.value;renderAll();scheduleSegment3D()};
 min.oninput=()=>{segmentState[key].min=Math.min(+min.value,segmentState[key].max);min.value=segmentState[key].min;updateSegmentOutputs(key);renderAll();scheduleSegment3D()};
 max.oninput=()=>{segmentState[key].max=Math.max(+max.value,segmentState[key].min);max.value=segmentState[key].max;updateSegmentOutputs(key);renderAll();scheduleSegment3D()};
 opacity.oninput=()=>{segmentState[key].opacity=+opacity.value;updateSegmentOutputs(key);renderAll();scheduleSegment3D()};
}

for(const p of Object.keys(planes)){planes[p].slider.oninput=()=>renderPlane(p);installMprTouch(p)}

async function loadDemo(){
 const r=await fetch(DEMO_URL,{mode:'cors',credentials:'omit'});if(!r.ok)throw new Error('Demo download failed: HTTP '+r.status);
 const reader=r.body?.getReader();let bytes;
 if(reader){const chunks=[];let n=0;while(true){const q=await reader.read();if(q.done)break;if(!q.value)continue;chunks.push(q.value);n+=q.value.byteLength;byteProgress(n,DEMO_SIZE,'Download')}bytes=new Uint8Array(n);let o=0;for(const c of chunks){bytes.set(c,o);o+=c.byteLength}}else bytes=new Uint8Array(await r.arrayBuffer());
 byteProgress(bytes.byteLength,bytes.byteLength,'Unzip');
 const entries=await new Promise((res,rej)=>unzip(bytes,(e,f)=>e?rej(e):res(f)));const out=[];for(const [path,b] of Object.entries(entries)){if(path.endsWith('/')||!b.byteLength)continue;out.push(new File([b],path.split('/').pop()||path))}return out;
}

async function inspect(files,auto){
 activeId=null;resetVolume();list.replaceChildren();state.classList.remove('is-hidden');state.innerHTML='<strong>DICOMを確認中…</strong><span>Pixel Dataはまだ展開しません。</span>';prog.classList.remove('is-hidden');busy(true);
 try{const slices=await parseFiles(files,(a,b)=>progress(a,b));const series=groupSeries(slices);if(!series.length){state.innerHTML='<strong>DICOM Seriesを検出できませんでした</strong>';return}state.classList.add('is-hidden');renderSeries(series);if(auto){const ct=series.find(s=>s.modality.toUpperCase()==='CT')||series[0];await selectSeries(ct)}}finally{busy(false);prog.classList.add('is-hidden')}
}

async function parseFiles(files,onProgress){
 const out=[];for(let i=0;i<files.length;i++){const f=files[i];try{const ds=dicomParser.parseDicom(new Uint8Array(await f.arrayBuffer()),{untilTag:'x7fe00010'});const seriesUid=ds.string('x0020000e')?.trim();if(seriesUid){const ps=multi(ds.string('x00280030'),2),pos=multi(ds.string('x00200032'),3);out.push({file:f,studyUid:ds.string('x0020000d')?.trim()||'study',seriesUid,description:ds.string('x0008103e')?.trim()||'Unnamed series',modality:ds.string('x00080060')?.trim()||'Unknown',rows:ds.uint16('x00280010')||0,columns:ds.uint16('x00280011')||0,bits:ds.uint16('x00280100')||16,signed:ds.uint16('x00280103')||0,samples:ds.uint16('x00280002')||1,pixelSpacing:ps?safePair(ps):null,thickness:num(ds.string('x00180050')),spacingBetween:num(ds.string('x00180088')),instance:num(ds.string('x00200013')),pos:pos?safeTriple(pos):null,slope:numberOr(ds.string('x00281053'),1),intercept:numberOr(ds.string('x00281052'),0),ts:ds.string('x00020010')?.trim()||'1.2.840.10008.1.2.1'})}}catch{}onProgress?.(i+1,files.length)}return out
}

function groupSeries(slices){const m=new Map();for(const s of slices){const k=s.studyUid+'::'+s.seriesUid;(m.get(k)||m.set(k,[]).get(k)).push(s)}return[...m.entries()].map(([id,g])=>{g.sort((a,b)=>((a.pos?.[2]??a.instance??0)-(b.pos?.[2]??b.instance??0)));const f=g[0],rows=Math.max(...g.map(x=>x.rows)),columns=Math.max(...g.map(x=>x.columns)),bits=Math.max(...g.map(x=>x.bits)),bytes=rows*columns*g.length*Math.max(1,Math.ceil(bits/8));let z=f.spacingBetween||f.thickness||1;if(g.length>1&&g[0].pos&&g[1].pos)z=Math.abs(g[1].pos[2]-g[0].pos[2])||z;return{id,description:f.description,modality:f.modality,slices:g,rows,columns,bits,bytes,spacingX:f.pixelSpacing?.[1]??1,spacingY:f.pixelSpacing?.[0]??1,spacingZ:z}}).sort((a,b)=>b.slices.length-a.slices.length)}

function renderSeries(series){list.replaceChildren();for(const s of series){const b=document.createElement('button');b.className='series-card';b.innerHTML='<div class="series-card-header"><div><span class="modality-badge">'+esc(s.modality)+'</span><strong>'+esc(s.description)+'</strong></div><strong class="memory-estimate">'+fmt(s.bytes)+'</strong></div><dl class="series-meta-grid"><div><dt>Slices</dt><dd>'+s.slices.length+'</dd></div><div><dt>Matrix</dt><dd>'+s.columns+' × '+s.rows+'</dd></div><div><dt>Voxel</dt><dd>'+s.spacingX.toFixed(4)+' × '+s.spacingY.toFixed(4)+' × '+s.spacingZ.toFixed(4)+' mm</dd></div><div><dt>Stored</dt><dd>'+s.bits+'-bit</dd></div></dl><p class="series-note">推定展開サイズ: '+fmt(s.bytes)+'</p>';b.onclick=()=>selectSeries(s);b.dataset.id=s.id;list.appendChild(b)}}

async function selectSeries(s){activeId=s.id;for(const n of list.children)n.classList.toggle('is-selected',n.dataset.id===activeId);selected.innerHTML='<strong>'+esc(s.description)+'</strong><span>'+esc(s.modality)+' · '+s.slices.length+' slices · '+s.columns+'×'+s.rows+'</span><span class="ready-badge">CT volume decoding…</span>';prog.classList.remove('is-hidden');busy(true);try{volume=await decode(s,(a,b)=>progress(a,b));configure(volume);renderAll();render3D(volume);selected.querySelector('.ready-badge').textContent='CT volume ready';footer.textContent='CT range: '+Math.round(volume.min)+' to '+Math.round(volume.max)+' · Float32 '+fmt(volume.data.byteLength)}catch(e){console.error(e);selected.querySelector('.ready-badge').textContent='Decode failed';footer.textContent=String(e.message||e)}finally{prog.classList.add('is-hidden');busy(false)}}

async function decode(s,onProgress){const count=s.columns*s.rows*s.slices.length,data=new Float32Array(count);let min=Infinity,max=-Infinity;for(let z=0;z<s.slices.length;z++){const meta=s.slices[z];if(!['1.2.840.10008.1.2','1.2.840.10008.1.2.1','1.2.840.10008.1.2.2'].includes(meta.ts))throw new Error('Compressed DICOMは次段階で対応: '+meta.ts);const bytes=new Uint8Array(await meta.file.arrayBuffer()),ds=dicomParser.parseDicom(bytes),el=ds.elements.x7fe00010;if(!el)throw new Error('Pixel Data missing');const little=meta.ts!=='1.2.840.10008.1.2.2',view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),n=s.rows*s.columns,off=z*n;for(let i=0;i<n;i++){let raw;if(meta.bits===8){raw=bytes[el.dataOffset+i];if(meta.signed&&raw>127)raw-=256}else if(meta.bits===16){raw=meta.signed?view.getInt16(el.dataOffset+i*2,little):view.getUint16(el.dataOffset+i*2,little)}else throw new Error('Unsupported BitsAllocated='+meta.bits);const v=raw*meta.slope+meta.intercept;data[off+i]=v;if(v<min)min=v;if(v>max)max=v}onProgress?.(z+1,s.slices.length)}return{data,columns:s.columns,rows:s.rows,slices:s.slices.length,spacing:[s.spacingX,s.spacingY,s.spacingZ],min,max}}

function configure(v){
 const range=Math.max(1,v.max-v.min),center=(v.min+v.max)/2;wc.min=Math.floor(v.min);wc.max=Math.ceil(v.max);wc.value=center;ww.min=1;ww.max=Math.ceil(range);ww.value=range;wc.disabled=ww.disabled=false;
 const vals={axial:[v.slices,v.slices/2],coronal:[v.rows,v.rows/2],sagittal:[v.columns,v.columns/2]};for(const [p,[max,mid]]of Object.entries(vals)){planes[p].slider.max=max-1;planes[p].slider.value=Math.floor(mid);planes[p].slider.disabled=false}
 configureSegments(v);
}
function configureSegments(v){
 const huLike=v.min<=-500&&v.max>=1000;
 const defaults=huLike?{fat:[Math.max(v.min,-250),Math.min(v.max,-50)],soft:[Math.max(v.min,-50),Math.min(v.max,350)],bone:[Math.max(v.min,350),v.max]}:{fat:[v.min,v.min+(v.max-v.min)*.22],soft:[v.min+(v.max-v.min)*.22,v.min+(v.max-v.min)*.58],bone:[v.min+(v.max-v.min)*.58,v.max]};
 for(const key of Object.keys(segmentState)){
  const cfg=segmentState[key],d=defaults[key];cfg.min=d[0];cfg.max=d[1];
  const enabled=$('[data-seg-enabled="'+key+'"]'),color=$('[data-seg-color="'+key+'"]'),min=$('[data-seg-min="'+key+'"]'),max=$('[data-seg-max="'+key+'"]'),opacity=$('[data-seg-opacity="'+key+'"]');
  enabled.disabled=color.disabled=min.disabled=max.disabled=opacity.disabled=false;enabled.checked=cfg.enabled;color.value=cfg.color;
  min.min=max.min=Math.floor(v.min);min.max=max.max=Math.ceil(v.max);min.value=cfg.min;max.value=cfg.max;opacity.value=cfg.opacity;updateSegmentOutputs(key);
 }
}
function updateSegmentOutputs(key){
 $('[data-seg-min-out="'+key+'"]').value=Math.round(segmentState[key].min);
 $('[data-seg-max-out="'+key+'"]').value=Math.round(segmentState[key].max);
 $('[data-seg-opacity-out="'+key+'"]').value=segmentState[key].opacity.toFixed(2);
}
function scheduleSegment3D(){if(!volume)return;clearTimeout(segmentRenderTimer);segmentRenderTimer=setTimeout(()=>render3D(volume),90)}
function renderAll(){if(!volume)return;wcVal.value=Math.round(+wc.value);wwVal.value=Math.round(+ww.value);for(const p of Object.keys(planes))renderPlane(p)}
function renderPlane(p){
 if(!volume)return;const c=planes[p],idx=+c.slider.value;c.label.textContent=idx+1;
 const dims=p==='axial'?[volume.columns,volume.rows]:p==='coronal'?[volume.columns,volume.slices]:[volume.rows,volume.slices],ctx=c.canvas.getContext('2d');c.canvas.width=dims[0];c.canvas.height=dims[1];
 const img=ctx.createImageData(...dims),low=+wc.value-(+ww.value)/2,scale=255/Math.max(+ww.value,1);let q=0;
 const segOrder=['fat','soft','bone'];
 for(let y=0;y<dims[1];y++)for(let x=0;x<dims[0];x++){
  let v;if(p==='axial')v=volume.data[idx*volume.rows*volume.columns+y*volume.columns+x];else if(p==='coronal'){const z=volume.slices-1-y;v=volume.data[z*volume.rows*volume.columns+idx*volume.columns+x]}else{const z=volume.slices-1-y;v=volume.data[z*volume.rows*volume.columns+x*volume.columns+idx]}
  const g=Math.max(0,Math.min(255,Math.round((v-low)*scale)));let rr=g,gg=g,bb=g;
  for(const key of segOrder){const seg=segmentState[key];if(!seg.enabled||v<seg.min||v>seg.max)continue;const rgb=hexRgb(seg.color),a=Math.min(.75,seg.opacity*.65);rr=Math.round(rr*(1-a)+rgb[0]*a);gg=Math.round(gg*(1-a)+rgb[1]*a);bb=Math.round(bb*(1-a)+rgb[2]*a)}
  img.data[q++]=rr;img.data[q++]=gg;img.data[q++]=bb;img.data[q++]=255
 }
 ctx.putImageData(img,0,0)
}
function hexRgb(hex){const n=parseInt(hex.slice(1),16);return[(n>>16)&255,(n>>8)&255,n&255]}

function installMprTouch(p){const c=planes[p];let id=null,startY=0,start=0;c.canvas.onpointerdown=e=>{if(!volume||c.slider.disabled)return;id=e.pointerId;startY=e.clientY;start=+c.slider.value;c.canvas.setPointerCapture(id)};c.canvas.onpointermove=e=>{if(id!==e.pointerId)return;const max=+c.slider.max,sens=Math.max(1,c.canvas.clientHeight/(max+1)),next=Math.round(start-(e.clientY-startY)/sens);c.slider.value=Math.max(0,Math.min(max,next));renderPlane(p)};const end=e=>{if(id!==e.pointerId)return;if(c.canvas.hasPointerCapture(id))c.canvas.releasePointerCapture(id);id=null};c.canvas.onpointerup=end;c.canvas.onpointercancel=end}

async function start3D(){
 const scene=new THREE.Scene();scene.background=new THREE.Color(0x090c0e);const camera=new THREE.PerspectiveCamera(38,1,.1,100);camera.position.z=5.2;
 let renderer,backend='WEBGL';
 if('gpu' in navigator){
  try{
   const gpuRenderer=new THREE.WebGPURenderer({antialias:true});gpuRenderer.setPixelRatio(Math.min(devicePixelRatio,2));await gpuRenderer.init();renderer=gpuRenderer;backend='WEBGPU';
  }catch(error){
   console.warn('WebGPU init failed; falling back to WebGL.',error);
  }
 }
 if(!renderer){
  renderer=new WebGLRenderer({antialias:true,alpha:false});renderer.setPixelRatio(Math.min(devicePixelRatio,2));backend='WEBGL';
 }
 status.textContent=backend+' ACTIVE';status.className=backend==='WEBGPU'?'status status-ok':'status status-warning';threeLabel.textContent=backend;
 viewport.appendChild(renderer.domElement);sceneState={scene,camera,renderer,obj:null,backend};
 const pointers=new Map();let distance=5.2,lastPinch=0,lastCenter=null;
 renderer.domElement.oncontextmenu=e=>e.preventDefault();
 renderer.domElement.onpointerdown=e=>{pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});renderer.domElement.setPointerCapture(e.pointerId);if(pointers.size>=2){const[a,b]=[...pointers.values()];lastPinch=Math.hypot(b.x-a.x,b.y-a.y);lastCenter={x:(a.x+b.x)/2,y:(a.y+b.y)/2}}};
 renderer.domElement.onpointermove=e=>{const prev=pointers.get(e.pointerId);if(!prev)return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(!sceneState.obj)return;if(pointers.size===1){sceneState.obj.rotation.y+=(e.clientX-prev.x)*.008;sceneState.obj.rotation.x+=(e.clientY-prev.y)*.008;return}const[a,b]=[...pointers.values()],d=Math.hypot(b.x-a.x,b.y-a.y),center={x:(a.x+b.x)/2,y:(a.y+b.y)/2};if(lastPinch){distance=THREE.MathUtils.clamp(distance*(lastPinch/Math.max(d,1)),2.2,12);camera.position.z=distance}if(lastCenter){const ps=distance*.0015;sceneState.obj.position.x+=(center.x-lastCenter.x)*ps;sceneState.obj.position.y-=(center.y-lastCenter.y)*ps}lastPinch=d;lastCenter=center};
 const endPointer=e=>{pointers.delete(e.pointerId);if(renderer.domElement.hasPointerCapture(e.pointerId))renderer.domElement.releasePointerCapture(e.pointerId);if(pointers.size<2){lastPinch=0;lastCenter=null}};
 renderer.domElement.onpointerup=endPointer;renderer.domElement.onpointercancel=endPointer;
 renderer.domElement.addEventListener('wheel',e=>{e.preventDefault();distance=THREE.MathUtils.clamp(distance+e.deltaY*.004,2.2,12);camera.position.z=distance},{passive:false});
 const resize=()=>{camera.aspect=viewport.clientWidth/Math.max(viewport.clientHeight,1);camera.updateProjectionMatrix();renderer.setSize(viewport.clientWidth,viewport.clientHeight,false)};new ResizeObserver(resize).observe(viewport);resize();
 renderer.setAnimationLoop(()=>renderer.render(scene,camera));
}
function render3D(v){
 if(!sceneState)return;if(sceneState.obj){sceneState.scene.remove(sceneState.obj);dispose(sceneState.obj)}
 const group=new THREE.Group(),n=v.columns*v.rows*v.slices,stride=Math.max(1,Math.ceil(Math.cbrt(n/1800000))),[sx,sy,sz]=v.spacing,px=v.columns*sx,py=v.rows*sy,pz=v.slices*sz,scale=3.3/Math.max(px,py,pz,1);
 const keys=['fat','soft','bone'],arrays={fat:[],soft:[],bone:[]},caps={fat:50000,soft:70000,bone:110000};
 for(let z=0;z<v.slices;z+=stride)for(let y=0;y<v.rows;y+=stride){const base=z*v.rows*v.columns+y*v.columns;for(let x=0;x<v.columns;x+=stride){const value=v.data[base+x];for(const key of keys){const seg=segmentState[key];if(!seg.enabled||value<seg.min||value>seg.max||arrays[key].length/3>=caps[key])continue;arrays[key].push((x*sx-px/2)*scale,-(y*sy-py/2)*scale,(z*sz-pz/2)*scale)}}}
 for(const key of keys){const seg=segmentState[key],pos=arrays[key];if(!seg.enabled||!pos.length)continue;const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));const m=new THREE.PointsMaterial({size:key==='bone'?.019:.024,color:seg.color,transparent:true,opacity:seg.opacity,sizeAttenuation:true,depthWrite:seg.opacity>.55});const pts=new THREE.Points(g,m);pts.name='segment_'+key;group.add(pts)}
 sceneState.obj=group;sceneState.scene.add(group);threeLabel.textContent=(sceneState.backend||'3D')+' · segmented CT'
}

function resetVolume(){volume=null;wc.disabled=ww.disabled=true;for(const key of Object.keys(segmentState)){for(const sel of ['enabled','color','min','max','opacity']){const el=$('[data-seg-'+sel+'="'+key+'"]');if(el)el.disabled=true}}wcVal.value=wwVal.value='—';for(const p of Object.values(planes)){p.slider.disabled=true;p.label.textContent='—';p.canvas.getContext('2d')?.clearRect(0,0,p.canvas.width,p.canvas.height)}if(sceneState?.obj){sceneState.scene.remove(sceneState.obj);dispose(sceneState.obj);sceneState.obj=null}threeLabel.textContent=sceneState?.backend||'3D'}
function dispose(o){o.traverse(c=>{c.geometry?.dispose?.();if(Array.isArray(c.material))c.material.forEach(m=>m.dispose());else c.material?.dispose?.()})}
function busy(v){folderBtn.disabled=demoBtn.disabled=v}
function progress(a,b){bar.style.width=(b?Math.round(a/b*100):0)+'%';progLabel.textContent=a+' / '+b}
function byteProgress(a,b,label){bar.style.width=Math.min(100,Math.round(a/b*100))+'%';progLabel.textContent=label+' '+fmt(a)+' / '+fmt(b)}
function fmt(n){if(!n)return'0 B';const u=['B','KiB','MiB','GiB'];const i=Math.min(Math.floor(Math.log(n)/Math.log(1024)),u.length-1);return(n/1024**i).toFixed(i?2:0)+' '+u[i]}
function num(v){const n=Number(v);return Number.isFinite(n)?n:null}function numberOr(v,f){const n=Number(v);return Number.isFinite(n)?n:f}function multi(v,n){if(!v)return null;const a=v.split('\\').map(Number);return a.length>=n&&a.every(Number.isFinite)?a.slice(0,n):null}function safePair(a){return[a[0],a[1]]}function safeTriple(a){return[a[0],a[1],a[2]]}function esc(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
start3D().catch(e=>{console.error(e);status.textContent='3D RENDERER ERROR';status.className='status status-error';threeLabel.textContent='MPR ONLY';footer.textContent='3D初期化に失敗しました。DICOM/MPRは利用できます: '+String(e.message||e)});
