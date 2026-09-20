
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.186.0/build/three.webgpu.js';
import { WebGLRenderer } from 'https://cdn.jsdelivr.net/npm/three@0.186.0/build/three.module.js';
import dicomParser from 'https://esm.sh/dicom-parser@1.8.21';
import { unzip } from 'https://esm.sh/fflate@0.8.2';

const DEMO_URL='https://zenodo.org/api/records/12761093/files/PET-CT.zip/content';
const DEMO_SIZE=20800000;
const app=document.querySelector('#app');
let currentLanguage='ja';
const I18N={
 ja:{
  subtitle:'マウス・実験動物画像のためのブラウザDICOM CTビューワー',
  gpuChecking:'WEBGPU 確認中',
  demo:'公開マウスCTデモ',openFolder:'DICOMフォルダを開く',
  dataset:'データセット',series:'DICOMシリーズ',selectData:'データを選択してください',
  selectDataHelp:'ローカルフォルダ、または約20.8MBの公開マウスPET/CTデモを利用できます。',
  display:'表示',ctDisplay:'CT表示',windowCenter:'ウィンドウ中心',windowWidth:'ウィンドウ幅',
  segmentation:'セグメンテーション',segments:'組織セグメント',
  bone:'骨',soft:'軟部組織',fat:'脂肪',lung:'肺',min:'最小',max:'最大',opacity:'不透明度',
  surfaceSmooth:'表面平滑化',strength:'強度',resetFilters:'画像フィルターをリセット',
  controls:'断面画像: 左右スワイプ / マウスホイールでスライス移動',
  seriesUnselected:'シリーズ未選択',selectSeries:'左の一覧からCTシリーズを選択してください。',
  footer:'元のキャリブレーション済みCT値は保持されます。',
  slices:'スライス',matrix:'マトリクス',voxel:'ボクセル',stored:'保存形式',
  estimated:'推定展開サイズ',decoding:'CTボリュームを展開中…',ready:'CTボリューム準備完了',
  demoLoading:'公開マウスPET/CTを取得中…',demoSize:'約20.8MBの公開データです。',
  demoFailed:'公開デモを読み込めませんでした',dicomChecking:'DICOMを確認中…',
  pixelDeferred:'Pixel Dataはまだ展開しません。',noSeries:'DICOMシリーズを検出できませんでした',
  original:'元のキャリブレーション済みCT値',processingReset:'処理をリセットしました。元のキャリブレーション済みCT値を復元しました',
  demoCache:'公開デモ: キャッシュ済みデータを使用',demoDone:'公開デモ: ダウンロード完了。端末キャッシュへ保存中'
 },
 en:{
  subtitle:'Browser-based DICOM CT viewer for mouse and laboratory-animal imaging',
  gpuChecking:'WEBGPU CHECKING',
  demo:'Public mouse CT demo',openFolder:'Open DICOM folder',
  dataset:'DATASET',series:'DICOM Series',selectData:'Select data',
  selectDataHelp:'Use a local folder or the approximately 20.8 MB public mouse PET/CT demo.',
  display:'DISPLAY',ctDisplay:'CT display',windowCenter:'Window Center',windowWidth:'Window Width',
  segmentation:'SEGMENTATION',segments:'Tissue segments',
  bone:'Bone',soft:'Soft tissue',fat:'Fat',lung:'Lung',min:'Min',max:'Max',opacity:'Opacity',
  surfaceSmooth:'Surface Smooth',strength:'Strength',resetFilters:'Reset image filters',
  controls:'MPR slices: swipe left/right or use the mouse wheel',
  seriesUnselected:'No Series selected',selectSeries:'Select a CT Series from the list on the left.',
  footer:'Original calibrated CT values are preserved.',
  slices:'Slices',matrix:'Matrix',voxel:'Voxel',stored:'Stored',
  estimated:'Estimated decoded size',decoding:'Decoding CT volume…',ready:'CT volume ready',
  demoLoading:'Loading public mouse PET/CT…',demoSize:'Approximately 20.8 MB of public data.',
  demoFailed:'Could not load the public demo',dicomChecking:'Checking DICOM…',
  pixelDeferred:'Pixel Data has not been expanded yet.',noSeries:'No DICOM Series detected',
  original:'Original calibrated CT values',processingReset:'Processing reset. Original calibrated CT values restored.',
  demoCache:'Public demo: using cached data',demoDone:'Public demo: download complete. Saving to device cache'
 }
};
const tr=key=>I18N[currentLanguage][key]??key;
function applyLanguage(lang){
 currentLanguage=lang;
 document.documentElement.lang=lang;
 document.title=lang==='ja'?'Virtual Rodent Lab — DICOMビューワー':'Virtual Rodent Lab — DICOM Viewer';
 document.querySelectorAll('[data-i18n]').forEach(el=>{const key=el.dataset.i18n;if(key)el.textContent=tr(key)});
 const toggle=document.querySelector('#language-toggle');if(toggle)toggle.textContent=lang==='ja'?'English':'日本語';
}
app.innerHTML=`
<main class="app-shell">
<header class="topbar"><div><p class="eyebrow">SMALL-ANIMAL CT / WEBGPU</p><h1>Virtual Rodent Lab</h1><p class="subtitle" data-i18n="subtitle">マウス・実験動物画像のためのブラウザDICOM CTビューワー</p></div><div class="topbar-actions"><button id="language-toggle" class="secondary-button" type="button">English</button><div id="gpu-status" class="status status-checking" data-i18n="gpuChecking">WEBGPU 確認中</div><button id="demo-button" class="secondary-button" data-i18n="demo">公開マウスCTデモ</button><button id="open-folder" class="primary-button" data-i18n="openFolder">DICOMフォルダを開く</button><input id="folder-input" class="visually-hidden" type="file" webkitdirectory multiple></div></header>
<section class="workspace"><aside class="sidebar"><section class="panel"><div class="panel-heading"><div><p class="panel-kicker" data-i18n="dataset">データセット</p><h2 data-i18n="series">DICOMシリーズ</h2></div></div><div id="scan-state" class="empty-state"><strong data-i18n="selectData">データを選択してください</strong><span data-i18n="selectDataHelp">ローカルフォルダ、または約20.8MBの公開マウスPET/CTデモを利用できます。</span></div><div id="scan-progress" class="progress-wrap is-hidden"><div class="progress-track"><div id="scan-progress-bar" class="progress-bar"></div></div><span id="scan-progress-label">0 / 0</span></div><div id="series-list" class="series-list"></div></section>
<section class="panel compact-panel"><div class="panel-heading"><div><p class="panel-kicker" data-i18n="display">表示</p><h2 data-i18n="ctDisplay">CT表示</h2></div></div><label class="range-row"><span data-i18n="windowCenter">ウィンドウ中心</span><output id="wc-val">—</output><input id="wc" type="range" min="-2000" max="4000" value="500" disabled></label><label class="range-row"><span data-i18n="windowWidth">ウィンドウ幅</span><output id="ww-val">—</output><input id="ww" type="range" min="1" max="8000" value="3000" disabled></label><div class="panel-heading segment-heading"><div><p class="panel-kicker" data-i18n="segmentation">セグメンテーション</p><h2 data-i18n="segments">組織セグメント</h2></div></div><div id="segment-controls" class="segment-controls"><div class="segment-card" data-segment="bone">
<div class="segment-card-head"><label><input class="segment-enabled" type="checkbox" data-seg-enabled="bone" checked disabled><strong data-i18n="bone">骨</strong></label><input class="segment-color" data-seg-color="bone" type="color" value="#f3f0e8" disabled></div>
<label class="segment-range"><span data-i18n="min">最小</span><output data-seg-min-out="bone">—</output><input data-seg-min="bone" type="range" min="0" max="1" value="0" disabled></label>
<label class="segment-range"><span data-i18n="max">最大</span><output data-seg-max-out="bone">—</output><input data-seg-max="bone" type="range" min="0" max="1" value="1" disabled></label>
<label class="segment-range"><span data-i18n="opacity">不透明度</span><output data-seg-opacity-out="bone">0.85</output><input data-seg-opacity="bone" type="range" min="0" max="1" step="0.05" value="0.85" disabled></label>
</div><div class="segment-card" data-segment="soft">
<div class="segment-card-head"><label><input class="segment-enabled" type="checkbox" data-seg-enabled="soft"  disabled><strong data-i18n="soft">軟部組織</strong></label><input class="segment-color" data-seg-color="soft" type="color" value="#d97f7f" disabled></div>
<label class="segment-range"><span data-i18n="min">最小</span><output data-seg-min-out="soft">—</output><input data-seg-min="soft" type="range" min="0" max="1" value="0" disabled></label>
<label class="segment-range"><span data-i18n="max">最大</span><output data-seg-max-out="soft">—</output><input data-seg-max="soft" type="range" min="0" max="1" value="1" disabled></label>
<label class="segment-range"><span data-i18n="opacity">不透明度</span><output data-seg-opacity-out="soft">0.28</output><input data-seg-opacity="soft" type="range" min="0" max="1" step="0.05" value="0.28" disabled></label>
</div><div class="segment-card" data-segment="fat">
<div class="segment-card-head"><label><input class="segment-enabled" type="checkbox" data-seg-enabled="fat"  disabled><strong data-i18n="fat">脂肪</strong></label><input class="segment-color" data-seg-color="fat" type="color" value="#e7c85d" disabled></div>
<label class="segment-range"><span data-i18n="min">最小</span><output data-seg-min-out="fat">—</output><input data-seg-min="fat" type="range" min="0" max="1" value="0" disabled></label>
<label class="segment-range"><span data-i18n="max">最大</span><output data-seg-max-out="fat">—</output><input data-seg-max="fat" type="range" min="0" max="1" value="1" disabled></label>
<label class="segment-range"><span data-i18n="opacity">不透明度</span><output data-seg-opacity-out="fat">0.35</output><input data-seg-opacity="fat" type="range" min="0" max="1" step="0.05" value="0.35" disabled></label>
</div><div class="segment-card" data-segment="lung">
<div class="segment-card-head"><label><input class="segment-enabled" type="checkbox" data-seg-enabled="lung" disabled><strong data-i18n="lung">肺</strong></label><input class="segment-color" data-seg-color="lung" type="color" value="#6fb8d6" disabled></div>
<label class="segment-range"><span data-i18n="min">最小</span><output data-seg-min-out="lung">—</output><input data-seg-min="lung" type="range" min="0" max="1" value="0" disabled></label>
<label class="segment-range"><span data-i18n="max">最大</span><output data-seg-max-out="lung">—</output><input data-seg-max="lung" type="range" min="0" max="1" value="1" disabled></label>
<label class="segment-range"><span data-i18n="opacity">不透明度</span><output data-seg-opacity-out="lung">0.35</output><input data-seg-opacity="lung" type="range" min="0" max="1" step="0.05" value="0.35" disabled></label>
</div></div><div class="surface-smooth-card">
  <label class="surface-smooth-toggle"><input id="surface-smooth-enabled" type="checkbox" checked disabled><strong data-i18n="surfaceSmooth">表面平滑化</strong></label>
  <label class="segment-range"><span data-i18n="strength">強度</span><output id="surface-smooth-value">0.60</output><input id="surface-smooth-strength" type="range" min="0" max="1" step="0.05" value="0.60" disabled></label>
</div>
<div class="filter-control-list">
  <div class="filter-control-card">
    <div class="filter-control-head"><label class="filter-enable-label"><input id="filter-spike-hole" type="checkbox" disabled><strong>Spike / Hole</strong></label></div>
    <label class="segment-range"><span data-i18n="strength">強度</span><output id="spike-hole-strength-value">0.50</output><input id="spike-hole-strength" type="range" min="0" max="1" step="0.05" value="0.50" disabled></label>
  </div>
  <div class="filter-control-card">
    <div class="filter-control-head"><label class="filter-enable-label"><input id="filter-nlm" type="checkbox" disabled><strong>Fast NLM 3D</strong></label></div>
    <label class="segment-range"><span data-i18n="strength">強度</span><output id="nlm-strength-value">0.45</output><input id="nlm-strength" type="range" min="0" max="1" step="0.05" value="0.45" disabled></label>
  </div>
  <div class="filter-control-card">
    <div class="filter-control-head"><label class="filter-enable-label"><input id="filter-anisotropic" type="checkbox" disabled><strong>Anisotropic Diffusion</strong></label></div>
    <label class="segment-range"><span data-i18n="strength">強度</span><output id="anisotropic-strength-value">0.45</output><input id="anisotropic-strength" type="range" min="0" max="1" step="0.05" value="0.45" disabled></label>
  </div>
  <div class="filter-control-card">
    <div class="filter-control-head"><label class="filter-enable-label"><input id="filter-gaussian" type="checkbox" disabled><strong>Gaussian 3D</strong></label></div>
    <label class="segment-range"><span data-i18n="strength">強度</span><output id="gaussian-strength-value">0.40</output><input id="gaussian-strength" type="range" min="0" max="1" step="0.05" value="0.40" disabled></label>
  </div>
  <div class="filter-control-card">
    <div class="filter-control-head"><label class="filter-enable-label"><input id="filter-sigmoid" type="checkbox" disabled><strong>Sigmoid</strong></label></div>
    <label class="segment-range"><span data-i18n="strength">強度</span><output id="sigmoid-strength-value">0.50</output><input id="sigmoid-strength" type="range" min="0" max="1" step="0.05" value="0.50" disabled></label>
  </div>
  <button id="filter-reset" class="tool-chip filter-reset" data-i18n="resetFilters" disabled>画像フィルターをリセット</button>
</div><p class="hint" data-i18n="controls">1本指: 3D回転 / 2本指: ズーム・移動 / MPRは上下ドラッグでスライス移動</p></section></aside>
<section class="viewer-grid"><section class="viewport-card viewport-card-main"><div class="viewport-label"><strong>3D</strong><span id="three-label">WebGPU</span></div><div id="viewport-3d" class="viewport viewport-3d"></div><div id="selected" class="selected-series-overlay"><strong data-i18n="seriesUnselected">シリーズ未選択</strong><span data-i18n="selectSeries">左の一覧からCTシリーズを選択してください。</span></div></section><section class="mpr-column">${['axial','coronal','sagittal'].map(p=>`<article class="viewport-card mpr-card"><div class="viewport-label"><strong>${p[0].toUpperCase()+p.slice(1)}</strong><span id="${p}-label">—</span></div><canvas id="${p}-canvas" class="mpr-canvas"></canvas><input id="${p}-slider" class="slice-slider" type="range" min="0" max="0" value="0" disabled></article>`).join('')}</section></section></section>
<footer><span id="footer" data-i18n="footer">元のキャリブレーション済みCT値は保持されます。</span></footer></main>`;

const $=s=>document.querySelector(s);
const viewport=$('#viewport-3d'),status=$('#gpu-status'),demoBtn=$('#demo-button'),folderBtn=$('#open-folder'),folderInput=$('#folder-input'),state=$('#scan-state'),prog=$('#scan-progress'),bar=$('#scan-progress-bar'),progLabel=$('#scan-progress-label'),list=$('#series-list'),selected=$('#selected'),footer=$('#footer'),threeLabel=$('#three-label'),wc=$('#wc'),ww=$('#ww'),wcVal=$('#wc-val'),wwVal=$('#ww-val'),gaussianBtn=$('#filter-gaussian'),spikeHoleBtn=$('#filter-spike-hole'),resetFilterBtn=$('#filter-reset'),nlmBtn=$('#filter-nlm'),anisotropicBtn=$('#filter-anisotropic'),sigmoidBtn=$('#filter-sigmoid'),gaussianStrength=$('#gaussian-strength'),gaussianStrengthValue=$('#gaussian-strength-value'),spikeHoleStrength=$('#spike-hole-strength'),spikeHoleStrengthValue=$('#spike-hole-strength-value'),nlmStrength=$('#nlm-strength'),nlmStrengthValue=$('#nlm-strength-value'),anisotropicStrength=$('#anisotropic-strength'),anisotropicStrengthValue=$('#anisotropic-strength-value'),sigmoidStrength=$('#sigmoid-strength'),sigmoidStrengthValue=$('#sigmoid-strength-value'),surfaceSmoothEnabled=$('#surface-smooth-enabled'),surfaceSmoothStrength=$('#surface-smooth-strength'),surfaceSmoothValue=$('#surface-smooth-value');
const planes=Object.fromEntries(['axial','coronal','sagittal'].map(p=>[p,{canvas:$('#'+p+'-canvas'),slider:$('#'+p+'-slider'),label:$('#'+p+'-label')}]))
const languageToggle=$('#language-toggle');
languageToggle.onclick=()=>applyLanguage(currentLanguage==='ja'?'en':'ja');
applyLanguage('ja');;
let volume=null,sourceVolume=null,sceneState=null,activeId=null;
const filterState={spikeHole:false,nlm:false,anisotropic:false,gaussian:false,sigmoid:false};
let filterRebuildTimer=null;
let filterRebuildRevision=0;
const segmentState={
 bone:{enabled:true,color:'#f3f0e8',opacity:.85,min:0,max:1},
 soft:{enabled:false,color:'#d97f7f',opacity:.28,min:0,max:1},
 fat:{enabled:false,color:'#e7c85d',opacity:.35,min:0,max:1},
 lung:{enabled:false,color:'#6fb8d6',opacity:.35,min:0,max:1}
};
let segmentRenderTimer=null;

folderBtn.onclick=()=>{folderInput.value='';folderInput.click()};
folderInput.onchange=async()=>{const files=[...(folderInput.files||[])];if(files.length)await inspect(files,false)};
demoBtn.onclick=async()=>{busy(true);resetVolume();list.replaceChildren();state.classList.remove('is-hidden');prog.classList.remove('is-hidden');state.innerHTML='<strong>'+tr('demoLoading')+'</strong><span>'+tr('demoSize')+'</span>';try{const files=await loadDemo();await inspect(files,true)}catch(e){console.error(e);state.innerHTML='<strong>'+tr('demoFailed')+'</strong><span>'+esc(e.message||e)+'</span>';footer.textContent='Demo error: '+String(e.message||e)}finally{busy(false);prog.classList.add('is-hidden')}};
wc.oninput=ww.oninput=renderAll;
for(const key of Object.keys(segmentState)){
 const enabled=$('[data-seg-enabled="'+key+'"]'),color=$('[data-seg-color="'+key+'"]'),min=$('[data-seg-min="'+key+'"]'),max=$('[data-seg-max="'+key+'"]'),opacity=$('[data-seg-opacity="'+key+'"]');
 enabled.onchange=()=>{segmentState[key].enabled=enabled.checked;renderAll();scheduleSegment3D()};
 color.oninput=()=>{segmentState[key].color=color.value;renderAll();scheduleSegment3D()};
 min.oninput=()=>{segmentState[key].min=Math.min(+min.value,segmentState[key].max);min.value=segmentState[key].min;updateSegmentOutputs(key);renderAll();scheduleSegment3D()};
 max.oninput=()=>{segmentState[key].max=Math.max(+max.value,segmentState[key].min);max.value=segmentState[key].max;updateSegmentOutputs(key);renderAll();scheduleSegment3D()};
 opacity.oninput=()=>{segmentState[key].opacity=+opacity.value;updateSegmentOutputs(key);renderAll();scheduleSegment3D()};
}
surfaceSmoothEnabled.onchange=()=>{surfaceSmoothStrength.disabled=!surfaceSmoothEnabled.checked||!volume;scheduleSegment3D()};
surfaceSmoothStrength.oninput=()=>{surfaceSmoothValue.value=(+surfaceSmoothStrength.value).toFixed(2);scheduleSegment3D()};
const liveFilterState={timer:null,base:null,key:null};
function beginLiveFilter(key){
 if(!volume)return;
 if(liveFilterState.key!==key||!liveFilterState.base){
  liveFilterState.key=key;
  liveFilterState.base=volume;
 }
}
function scheduleLiveFilter(key,fn){
 if(!volume)return;
 beginLiveFilter(key);
 clearTimeout(liveFilterState.timer);
 liveFilterState.timer=setTimeout(()=>void fn(liveFilterState.base),260);
}
function finishLiveFilter(key,fn){
 if(!volume)return;
 beginLiveFilter(key);
 clearTimeout(liveFilterState.timer);
 void fn(liveFilterState.base).finally(()=>{
  if(liveFilterState.key===key){liveFilterState.base=null;liveFilterState.key=null}
 });
}
function bindLiveSlider(input,output,key,fn){
 input.addEventListener('pointerdown',()=>beginLiveFilter(key));
 input.addEventListener('input',()=>{
  output.value=(+input.value).toFixed(2);
  scheduleLiveFilter(key,fn);
 });
 input.addEventListener('change',()=>finishLiveFilter(key,fn));
}
function syncFilterControls(){
 gaussianStrength.disabled=!sourceVolume||!filterState.gaussian;
 spikeHoleStrength.disabled=!sourceVolume||!filterState.spikeHole;
 nlmStrength.disabled=!sourceVolume||!filterState.nlm;
 anisotropicStrength.disabled=!sourceVolume||!filterState.anisotropic;
 sigmoidStrength.disabled=!sourceVolume||!filterState.sigmoid;
 gaussianBtn.disabled=!sourceVolume;spikeHoleBtn.disabled=!sourceVolume;nlmBtn.disabled=!sourceVolume;anisotropicBtn.disabled=!sourceVolume;sigmoidBtn.disabled=!sourceVolume;
 gaussianBtn.checked=filterState.gaussian;spikeHoleBtn.checked=filterState.spikeHole;nlmBtn.checked=filterState.nlm;anisotropicBtn.checked=filterState.anisotropic;sigmoidBtn.checked=filterState.sigmoid;
 resetFilterBtn.disabled=!sourceVolume;
}
function scheduleFilterRebuild(delay=120){
 clearTimeout(filterRebuildTimer);
 filterRebuildTimer=setTimeout(()=>{filterRebuildTimer=null;void rebuildActiveFilters()},delay);
}
async function rebuildActiveFilters(){
 if(!sourceVolume)return;
 const revision=++filterRebuildRevision;
 clearTimeout(liveFilterState.timer);liveFilterState.base=null;liveFilterState.key=null;
 let base=sourceVolume;
 try{
  if(filterState.spikeHole){await applySpikeHole(base);if(revision!==filterRebuildRevision)return;base=volume}
  if(filterState.nlm){await applyNlm3D(base);if(revision!==filterRebuildRevision)return;base=volume}
  if(filterState.anisotropic){await applyAnisotropicDiffusion(base);if(revision!==filterRebuildRevision)return;base=volume}
  if(filterState.gaussian){await applyGaussian3D(base);if(revision!==filterRebuildRevision)return;base=volume}
  if(filterState.sigmoid){await applySigmoid(base);if(revision!==filterRebuildRevision)return;base=volume}
  if(!filterState.spikeHole&&!filterState.nlm&&!filterState.anisotropic&&!filterState.gaussian&&!filterState.sigmoid){
   volume=sourceVolume;renderAll();render3D(volume);footer.textContent=tr('original');
  }
 }finally{syncFilterControls()}
}
for(const [box,key] of [[spikeHoleBtn,'spikeHole'],[nlmBtn,'nlm'],[anisotropicBtn,'anisotropic'],[gaussianBtn,'gaussian'],[sigmoidBtn,'sigmoid']]){
 box.onchange=()=>{filterState[key]=box.checked;syncFilterControls();scheduleFilterRebuild(0)};
}
for(const [input,output,key] of [[spikeHoleStrength,spikeHoleStrengthValue,'spikeHole'],[nlmStrength,nlmStrengthValue,'nlm'],[anisotropicStrength,anisotropicStrengthValue,'anisotropic'],[gaussianStrength,gaussianStrengthValue,'gaussian'],[sigmoidStrength,sigmoidStrengthValue,'sigmoid']]){
 input.oninput=()=>{output.value=(+input.value).toFixed(2);if(filterState[key])scheduleFilterRebuild(160)};
 input.onchange=()=>{if(filterState[key])scheduleFilterRebuild(0)};
}
resetFilterBtn.onclick=()=>{filterState.spikeHole=filterState.nlm=filterState.anisotropic=filterState.gaussian=filterState.sigmoid=false;syncFilterControls();resetProcessing()};


for(const p of Object.keys(planes)){planes[p].slider.oninput=()=>renderPlane(p);installMprTouch(p)}

async function loadDemo(){
 let response=null,fromCache=false,cache=null;
 progLabel.textContent='Cache check…';
 bar.style.width='0%';

 if('caches' in window){
  try{
   cache=await withTimeout(caches.open('virtual-rodent-demo-v2'),1200,null);
   if(cache){
    response=await withTimeout(cache.match(DEMO_URL),1200,null);
    if(response){fromCache=true;footer.textContent=tr('demoCache');}
   }
  }catch(e){
   console.warn('Cache lookup skipped.',e);
  }
 }

 if(!response){
  progLabel.textContent='接続中…';
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),20000);
  try{
   response=await fetch(DEMO_URL,{mode:'cors',credentials:'omit',signal:controller.signal,cache:'no-store'});
  }finally{
   clearTimeout(timeout);
  }
 }

 if(!response||!response.ok)throw new Error('Demo download failed: HTTP '+(response?.status??'unknown'));

 const reader=response.body?.getReader();let bytes;
 if(reader){
  const chunks=[];let n=0;
  while(true){
   const q=await reader.read();if(q.done)break;if(!q.value)continue;
   chunks.push(q.value);n+=q.value.byteLength;
   byteProgress(n,DEMO_SIZE,fromCache?'Cache':'Download');
  }
  bytes=new Uint8Array(n);let o=0;for(const c of chunks){bytes.set(c,o);o+=c.byteLength}
 }else{
  bytes=new Uint8Array(await response.arrayBuffer());
  byteProgress(bytes.byteLength,bytes.byteLength,fromCache?'Cache':'Download');
 }

 if(!fromCache&&cache){
  const copy=bytes.slice();
  cache.put(DEMO_URL,new Response(copy,{headers:{'Content-Type':'application/zip','Content-Length':String(copy.byteLength)}}))
   .then(()=>updateDemoCacheBadge())
   .catch(e=>console.warn('Demo cache save failed.',e));
 }

 byteProgress(bytes.byteLength,bytes.byteLength,'Unzip');
 const entries=await new Promise((res,rej)=>unzip(bytes,(e,f)=>e?rej(e):res(f)));
 const out=[];for(const [path,b] of Object.entries(entries)){if(path.endsWith('/')||!b.byteLength)continue;out.push(new File([b],path.split('/').pop()||path))}
 footer.textContent=fromCache?tr('demoCache'):tr('demoDone');
 return out;
}
function withTimeout(promise,ms,fallback){
 return Promise.race([promise,new Promise(resolve=>setTimeout(()=>resolve(fallback),ms))]);
}
async function updateDemoCacheBadge(){
 if(!('caches' in window))return;
 try{
  const cache=await withTimeout(caches.open('virtual-rodent-demo-v2'),1200,null);
  if(cache&&await withTimeout(cache.match(DEMO_URL),1200,null))demoBtn.textContent='公開マウスCTデモ ✓';
 }catch{}
}
void updateDemoCacheBadge();
async function inspect(files,auto){
 activeId=null;resetVolume();list.replaceChildren();state.classList.remove('is-hidden');state.innerHTML='<strong>'+tr('dicomChecking')+'</strong><span>'+tr('pixelDeferred')+'</span>';prog.classList.remove('is-hidden');busy(true);
 try{const slices=await parseFiles(files,(a,b)=>progress(a,b));const series=groupSeries(slices);if(!series.length){state.innerHTML='<strong>'+tr('noSeries')+'</strong>';return}state.classList.add('is-hidden');renderSeries(series);if(auto){const ct=series.find(s=>s.modality.toUpperCase()==='CT')||series[0];await selectSeries(ct)}}finally{busy(false);prog.classList.add('is-hidden')}
}

async function parseFiles(files,onProgress){
 const out=[];for(let i=0;i<files.length;i++){const f=files[i];try{const ds=dicomParser.parseDicom(new Uint8Array(await f.arrayBuffer()),{untilTag:'x7fe00010'});const seriesUid=ds.string('x0020000e')?.trim();if(seriesUid){const ps=multi(ds.string('x00280030'),2),pos=multi(ds.string('x00200032'),3);out.push({file:f,studyUid:ds.string('x0020000d')?.trim()||'study',seriesUid,description:ds.string('x0008103e')?.trim()||'Unnamed series',modality:ds.string('x00080060')?.trim()||'Unknown',rows:ds.uint16('x00280010')||0,columns:ds.uint16('x00280011')||0,bits:ds.uint16('x00280100')||16,signed:ds.uint16('x00280103')||0,samples:ds.uint16('x00280002')||1,pixelSpacing:ps?safePair(ps):null,thickness:num(ds.string('x00180050')),spacingBetween:num(ds.string('x00180088')),instance:num(ds.string('x00200013')),pos:pos?safeTriple(pos):null,slope:numberOr(ds.string('x00281053'),1),intercept:numberOr(ds.string('x00281052'),0),ts:ds.string('x00020010')?.trim()||'1.2.840.10008.1.2.1'})}}catch{}onProgress?.(i+1,files.length)}return out
}

function groupSeries(slices){const m=new Map();for(const s of slices){const k=s.studyUid+'::'+s.seriesUid;(m.get(k)||m.set(k,[]).get(k)).push(s)}return[...m.entries()].map(([id,g])=>{g.sort((a,b)=>((a.pos?.[2]??a.instance??0)-(b.pos?.[2]??b.instance??0)));const f=g[0],rows=Math.max(...g.map(x=>x.rows)),columns=Math.max(...g.map(x=>x.columns)),bits=Math.max(...g.map(x=>x.bits)),bytes=rows*columns*g.length*Math.max(1,Math.ceil(bits/8));let z=f.spacingBetween||f.thickness||1;if(g.length>1&&g[0].pos&&g[1].pos)z=Math.abs(g[1].pos[2]-g[0].pos[2])||z;return{id,description:f.description,modality:f.modality,slices:g,rows,columns,bits,bytes,spacingX:f.pixelSpacing?.[1]??1,spacingY:f.pixelSpacing?.[0]??1,spacingZ:z}}).sort((a,b)=>b.slices.length-a.slices.length)}

function renderSeries(series){list.replaceChildren();for(const s of series){const b=document.createElement('button');b.className='series-card';b.innerHTML='<div class="series-card-header"><div><span class="modality-badge">'+esc(s.modality)+'</span><strong>'+esc(s.description)+'</strong></div><strong class="memory-estimate">'+fmt(s.bytes)+'</strong></div><dl class="series-meta-grid"><div><dt>Slices</dt><dd>'+s.slices.length+'</dd></div><div><dt>Matrix</dt><dd>'+s.columns+' × '+s.rows+'</dd></div><div><dt>Voxel</dt><dd>'+s.spacingX.toFixed(4)+' × '+s.spacingY.toFixed(4)+' × '+s.spacingZ.toFixed(4)+' mm</dd></div><div><dt>Stored</dt><dd>'+s.bits+'-bit</dd></div></dl><p class="series-note">推定展開サイズ: '+fmt(s.bytes)+'</p>';b.onclick=()=>selectSeries(s);b.dataset.id=s.id;list.appendChild(b)}}

async function selectSeries(s){activeId=s.id;for(const n of list.children)n.classList.toggle('is-selected',n.dataset.id===activeId);selected.innerHTML='<strong>'+esc(s.description)+'</strong><span>'+esc(s.modality)+' · '+s.slices.length+' slices · '+s.columns+'×'+s.rows+'</span><span class="ready-badge">CT volume decoding…</span>';prog.classList.remove('is-hidden');busy(true);try{sourceVolume=await decode(s,(a,b)=>progress(a,b));volume=sourceVolume;configure(volume);enableProcessingControls(true);renderAll();render3D(volume);selected.querySelector('.ready-badge').textContent='CT volume ready';footer.textContent='CT range: '+Math.round(volume.min)+' to '+Math.round(volume.max)+' · Float32 '+fmt(volume.data.byteLength)}catch(e){console.error(e);selected.querySelector('.ready-badge').textContent='Decode failed';footer.textContent=String(e.message||e)}finally{prog.classList.add('is-hidden');busy(false)}}

async function decode(s,onProgress){const count=s.columns*s.rows*s.slices.length,data=new Float32Array(count);let min=Infinity,max=-Infinity;for(let z=0;z<s.slices.length;z++){const meta=s.slices[z];if(!['1.2.840.10008.1.2','1.2.840.10008.1.2.1','1.2.840.10008.1.2.2'].includes(meta.ts))throw new Error('Compressed DICOMは次段階で対応: '+meta.ts);const bytes=new Uint8Array(await meta.file.arrayBuffer()),ds=dicomParser.parseDicom(bytes),el=ds.elements.x7fe00010;if(!el)throw new Error('Pixel Data missing');const little=meta.ts!=='1.2.840.10008.1.2.2',view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),n=s.rows*s.columns,off=z*n;for(let i=0;i<n;i++){let raw;if(meta.bits===8){raw=bytes[el.dataOffset+i];if(meta.signed&&raw>127)raw-=256}else if(meta.bits===16){raw=meta.signed?view.getInt16(el.dataOffset+i*2,little):view.getUint16(el.dataOffset+i*2,little)}else throw new Error('Unsupported BitsAllocated='+meta.bits);const v=raw*meta.slope+meta.intercept;data[off+i]=v;if(v<min)min=v;if(v>max)max=v}onProgress?.(z+1,s.slices.length)}return{data,columns:s.columns,rows:s.rows,slices:s.slices.length,spacing:[s.spacingX,s.spacingY,s.spacingZ],min,max}}

function enableProcessingControls(enabled){
 if(!enabled){filterState.spikeHole=filterState.nlm=filterState.anisotropic=filterState.gaussian=filterState.sigmoid=false}
 gaussianBtn.disabled=!enabled;spikeHoleBtn.disabled=!enabled;nlmBtn.disabled=!enabled;anisotropicBtn.disabled=!enabled;
 resetFilterBtn.disabled=!enabled;
 surfaceSmoothEnabled.disabled=!enabled;
 surfaceSmoothStrength.disabled=!enabled||!surfaceSmoothEnabled.checked;
 syncFilterControls();
}
function cloneVolumeWithData(base,data){
 return{data,columns:base.columns,rows:base.rows,slices:base.slices,spacing:[...base.spacing],min:base.min,max:base.max};
}
async function applyGaussian3D(baseVolume=volume){
 if(!baseVolume)return;setProcessingBusy(true,'Gaussian 3D');
 try{
  const {columns:w,rows:h,slices:d}=baseVolume,n=w*h*d,src=baseVolume.data;
  const strength=+gaussianStrength.value;
  let a=new Float32Array(src),b=new Float32Array(n);
  const axes=[[1,0,0],[0,1,0],[0,0,1]];
  const rounds=Math.max(1,Math.round(1+strength*3));
  for(let round=0;round<rounds;round++)for(let pass=0;pass<axes.length;pass++){
   const [dx,dy,dz]=axes[pass];
   for(let z=0;z<d;z++){
    for(let y=0;y<h;y++){
     const row=z*h*w+y*w;
     for(let x=0;x<w;x++){
      const i=row+x;
      const x0=Math.max(0,x-dx),x1=Math.min(w-1,x+dx);
      const y0=Math.max(0,y-dy),y1=Math.min(h-1,y+dy);
      const z0=Math.max(0,z-dz),z1=Math.min(d-1,z+dz);
      const i0=z0*h*w+y0*w+x0,i1=z1*h*w+y1*w+x1;
      const blurred=(a[i0]+2*a[i]+a[i1])*.25;
      b[i]=a[i]*(1-strength)+blurred*strength;
     }
    }
    if((z&15)===0){progress((round*axes.length+pass)*d+z+1,rounds*axes.length*d);await frameYield()}
   }
   const t=a;a=b;b=t;
  }
  volume=cloneVolumeWithData(baseVolume,a);renderAll();render3D(volume);footer.textContent='Gaussian 3D · live '+(+gaussianStrength.value).toFixed(2);
 }catch(e){console.error(e);footer.textContent='Gaussian error: '+String(e.message||e)}
 finally{setProcessingBusy(false)}
}
async function applySpikeHole(baseVolume=volume){
 if(!baseVolume)return;setProcessingBusy(true,'Spike / Hole');
 try{
  const {columns:w,rows:h,slices:d}=baseVolume,src=baseVolume.data,out=new Float32Array(src);
  const strength=+spikeHoleStrength.value;
  const range=Math.max(1,baseVolume.max-baseVolume.min),threshold=range*(.12-.09*strength),edgeGuard=threshold*(.55+.35*strength);
  const correctionBlend=.20+.75*strength;
  let corrected=0;
  for(let z=1;z<d-1;z++){
   for(let y=1;y<h-1;y++){
    const row=z*h*w+y*w;
    for(let x=1;x<w-1;x++){
     const i=row+x,c=src[i];
     const ns=[src[i-1],src[i+1],src[i-w],src[i+w],src[i-w*h],src[i+w*h]];
     let sum=0,min=Infinity,max=-Infinity;for(const v of ns){sum+=v;if(v<min)min=v;if(v>max)max=v}
     const mean=sum/6,spread=max-min,diff=c-mean;
     if(spread<=edgeGuard&&Math.abs(diff)>threshold){
      const target=mean+Math.sign(diff)*threshold*.08;
      out[i]=c*(1-correctionBlend)+target*correctionBlend;corrected++;
     }
    }
   }
   if((z&7)===0){progress(z,d);await frameYield()}
  }
  volume=cloneVolumeWithData(baseVolume,out);renderAll();render3D(volume);footer.textContent='Spike / Hole · live '+strength.toFixed(2)+' · '+corrected.toLocaleString()+' voxels';
 }catch(e){console.error(e);footer.textContent='Spike/Hole error: '+String(e.message||e)}
 finally{setProcessingBusy(false)}
}
async function applyNlm3D(baseVolume=volume){
 if(!baseVolume)return;setProcessingBusy(true,'Fast NLM 3D');
 try{
  const {columns:w,rows:h,slices:d}=baseVolume,src=baseVolume.data,out=new Float32Array(src);
  const strength=+nlmStrength.value;
  const range=Math.max(1,baseVolume.max-baseVolume.min),hParam=range*(.018+.11*strength),h2=hParam*hParam;
  const offsets=[];
  for(let dz=-1;dz<=1;dz++)for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
   if(dx||dy||dz)offsets.push([dx,dy,dz]);
  }
  const patch=[[0,0,0],[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
  const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
  const sample=(x,y,z)=>src[clamp(z,0,d-1)*h*w+clamp(y,0,h-1)*w+clamp(x,0,w-1)];
  for(let z=0;z<d;z++){
   for(let y=0;y<h;y++){
    for(let x=0;x<w;x++){
     const center=src[z*h*w+y*w+x];
     let weighted=center,weightSum=1;
     for(const [dx,dy,dz] of offsets){
      const nx=x+dx,ny=y+dy,nz=z+dz;
      if(nx<0||ny<0||nz<0||nx>=w||ny>=h||nz>=d)continue;
      let dist2=0;
      for(const [px,py,pz] of patch){
       const a=sample(x+px,y+py,z+pz),b=sample(nx+px,ny+py,nz+pz),dv=a-b;
       dist2+=dv*dv;
      }
      dist2/=patch.length;
      const weight=Math.exp(-dist2/Math.max(h2,1e-6));
      weighted+=weight*src[nz*h*w+ny*w+nx];
      weightSum+=weight;
     }
     out[z*h*w+y*w+x]=weighted/weightSum;
    }
   }
   if((z&3)===0){progress(z+1,d);await frameYield()}
  }
  volume=cloneVolumeWithData(baseVolume,out);renderAll();render3D(volume);
  footer.textContent='Fast NLM 3D · live '+strength.toFixed(2);
 }catch(e){console.error(e);footer.textContent='NLM error: '+String(e.message||e)}
 finally{setProcessingBusy(false)}
}
async function applyAnisotropicDiffusion(baseVolume=volume){
 if(!baseVolume)return;setProcessingBusy(true,'Anisotropic Diffusion');
 try{
  const {columns:w,rows:h,slices:d}=baseVolume,n=w*h*d;
  let a=new Float32Array(baseVolume.data),b=new Float32Array(n);
  const strength=+anisotropicStrength.value;
  const range=Math.max(1,baseVolume.max-baseVolume.min),kappa=range*(.025+.09*strength),kappa2=kappa*kappa,lambda=.06+.14*strength,iterations=Math.max(1,Math.round(1+strength*7));
  for(let iter=0;iter<iterations;iter++){
   b.set(a);
   for(let z=1;z<d-1;z++){
    for(let y=1;y<h-1;y++){
     const row=z*h*w+y*w;
     for(let x=1;x<w-1;x++){
      const i=row+x,c=a[i];
      const neighbors=[a[i-1],a[i+1],a[i-w],a[i+w],a[i-w*h],a[i+w*h]];
      let flux=0;
      for(const nv of neighbors){
       const diff=nv-c;
       const conduct=Math.exp(-(diff*diff)/Math.max(kappa2,1e-6));
       flux+=conduct*diff;
      }
      b[i]=c+lambda*flux;
     }
    }
    if((z&7)===0){progress(iter*d+z+1,iterations*d);await frameYield()}
   }
   const t=a;a=b;b=t;
  }
  volume=cloneVolumeWithData(baseVolume,a);renderAll();render3D(volume);
  footer.textContent='Anisotropic Diffusion · live '+strength.toFixed(2);
 }catch(e){console.error(e);footer.textContent='Anisotropic error: '+String(e.message||e)}
 finally{setProcessingBusy(false)}
}
async function applySigmoid(baseVolume=volume){
 if(!baseVolume)return;setProcessingBusy(true,'Sigmoid');
 try{
  const src=baseVolume.data,out=new Float32Array(src.length);
  const min=baseVolume.min,max=baseVolume.max,range=Math.max(1,max-min);
  const strength=+sigmoidStrength.value,gain=2+strength*10;
  const lo=1/(1+Math.exp(gain*.5)),hi=1/(1+Math.exp(-gain*.5)),norm=Math.max(1e-6,hi-lo);
  for(let i=0;i<src.length;i++){
   const x=Math.max(0,Math.min(1,(src[i]-min)/range));
   const y=(1/(1+Math.exp(-gain*(x-.5)))-lo)/norm;
   out[i]=min+Math.max(0,Math.min(1,y))*range;
   if((i&0x3ffff)===0){progress(i+1,src.length);await frameYield()}
  }
  volume=cloneVolumeWithData(baseVolume,out);renderAll();render3D(volume);
  footer.textContent='Sigmoid · '+strength.toFixed(2);
 }catch(e){console.error(e);footer.textContent='Sigmoid error: '+String(e.message||e)}
 finally{setProcessingBusy(false)}
}
function resetProcessing(){
 clearTimeout(liveFilterState.timer);clearTimeout(filterRebuildTimer);filterRebuildRevision++;liveFilterState.base=null;liveFilterState.key=null;
 filterState.spikeHole=filterState.nlm=filterState.anisotropic=filterState.gaussian=filterState.sigmoid=false;syncFilterControls();
 if(!sourceVolume)return;volume=sourceVolume;renderAll();render3D(volume);footer.textContent=tr('processingReset');
}
function setProcessingBusy(busyState,label='Processing'){
 resetFilterBtn.disabled=busyState||!sourceVolume;
 gaussianBtn.disabled=spikeHoleBtn.disabled=nlmBtn.disabled=anisotropicBtn.disabled=sigmoidBtn.disabled=busyState||!sourceVolume;
 gaussianStrength.disabled=busyState||!sourceVolume||!filterState.gaussian;
 spikeHoleStrength.disabled=busyState||!sourceVolume||!filterState.spikeHole;
 nlmStrength.disabled=busyState||!sourceVolume||!filterState.nlm;
 anisotropicStrength.disabled=busyState||!sourceVolume||!filterState.anisotropic;
 sigmoidStrength.disabled=busyState||!sourceVolume||!filterState.sigmoid;
 folderBtn.disabled=demoBtn.disabled=busyState;prog.classList.toggle('is-hidden',!busyState);
 if(busyState){bar.style.width='0%';progLabel.textContent=label}
}
const frameYield=()=>new Promise(resolve=>setTimeout(resolve,0));

function configure(v){
 const range=Math.max(1,v.max-v.min),center=(v.min+v.max)/2;wc.min=Math.floor(v.min);wc.max=Math.ceil(v.max);wc.value=center;ww.min=1;ww.max=Math.ceil(range);ww.value=range;wc.disabled=ww.disabled=false;
 const vals={axial:[v.slices,v.slices/2],coronal:[v.rows,v.rows/2],sagittal:[v.columns,v.columns/2]};for(const [p,[max,mid]]of Object.entries(vals)){planes[p].slider.max=max-1;planes[p].slider.value=Math.floor(mid);planes[p].slider.disabled=false}
 configureSegments(v);
}
function configureSegments(v){
 const huLike=v.min<=-500&&v.max>=1000;
 const defaults=huLike?{lung:[Math.max(v.min,-950),Math.min(v.max,-300)],fat:[Math.max(v.min,-250),Math.min(v.max,-50)],soft:[Math.max(v.min,-50),Math.min(v.max,350)],bone:[Math.max(v.min,350),v.max]}:{lung:[v.min+(v.max-v.min)*.03,v.min+(v.max-v.min)*.18],fat:[v.min,v.min+(v.max-v.min)*.22],soft:[v.min+(v.max-v.min)*.22,v.min+(v.max-v.min)*.58],bone:[v.min+(v.max-v.min)*.58,v.max]};
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
 const segOrder=['lung','fat','soft','bone'];
 for(let y=0;y<dims[1];y++)for(let x=0;x<dims[0];x++){
  let v;if(p==='axial')v=volume.data[idx*volume.rows*volume.columns+y*volume.columns+x];else if(p==='coronal'){const z=volume.slices-1-y;v=volume.data[z*volume.rows*volume.columns+idx*volume.columns+x]}else{const z=volume.slices-1-y;v=volume.data[z*volume.rows*volume.columns+x*volume.columns+idx]}
  const g=Math.max(0,Math.min(255,Math.round((v-low)*scale)));let rr=g,gg=g,bb=g;
  for(const key of segOrder){const seg=segmentState[key];if(!seg.enabled||v<seg.min||v>seg.max)continue;const rgb=hexRgb(seg.color),a=Math.min(.75,seg.opacity*.65);rr=Math.round(rr*(1-a)+rgb[0]*a);gg=Math.round(gg*(1-a)+rgb[1]*a);bb=Math.round(bb*(1-a)+rgb[2]*a)}
  img.data[q++]=rr;img.data[q++]=gg;img.data[q++]=bb;img.data[q++]=255
 }
 ctx.putImageData(img,0,0)
}
function hexRgb(hex){const n=parseInt(hex.slice(1),16);return[(n>>16)&255,(n>>8)&255,n&255]}

function installMprTouch(p){const c=planes[p];let id=null,startX=0,start=0;c.canvas.onpointerdown=e=>{if(!volume||c.slider.disabled)return;id=e.pointerId;startX=e.clientX;start=+c.slider.value;c.canvas.setPointerCapture(id)};c.canvas.onpointermove=e=>{if(id!==e.pointerId)return;const max=+c.slider.max,sens=Math.max(1,c.canvas.clientWidth/(max+1)),next=Math.round(start+(e.clientX-startX)/sens);c.slider.value=Math.max(0,Math.min(max,next));renderPlane(p)};const end=e=>{if(id!==e.pointerId)return;if(c.canvas.hasPointerCapture(id))c.canvas.releasePointerCapture(id);id=null};c.canvas.onpointerup=end;c.canvas.onpointercancel=end;c.canvas.addEventListener('wheel',e=>{if(!volume||c.slider.disabled)return;e.preventDefault();const max=+c.slider.max,delta=e.deltaY===0?e.deltaX:e.deltaY,step=delta>0?1:-1;c.slider.value=Math.max(0,Math.min(max,+c.slider.value+step));renderPlane(p)},{passive:false})}

async function start3D(){
 const scene=new THREE.Scene();scene.background=new THREE.Color(0x090c0e);const camera=new THREE.PerspectiveCamera(38,1,.1,100);camera.position.z=5.2;scene.add(new THREE.HemisphereLight(0xffffff,0x182028,2.0));const keyLight=new THREE.DirectionalLight(0xffffff,2.4);keyLight.position.set(2,3,4);scene.add(keyLight);
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
 renderer.domElement.onpointermove=e=>{const prev=pointers.get(e.pointerId);if(!prev)return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(!sceneState.obj)return;if(pointers.size===1){const dx=e.clientX-prev.x,dy=e.clientY-prev.y;const qYaw=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),dx*.008);const qPitch=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),dy*.008);sceneState.obj.quaternion.premultiply(qYaw);sceneState.obj.quaternion.premultiply(qPitch);sceneState.obj.quaternion.normalize();return}const[a,b]=[...pointers.values()],d=Math.hypot(b.x-a.x,b.y-a.y),center={x:(a.x+b.x)/2,y:(a.y+b.y)/2};if(lastPinch){distance=THREE.MathUtils.clamp(distance*(lastPinch/Math.max(d,1)),2.2,12);camera.position.z=distance}if(lastCenter){const ps=distance*.0015;sceneState.obj.position.x+=(center.x-lastCenter.x)*ps;sceneState.obj.position.y-=(center.y-lastCenter.y)*ps}lastPinch=d;lastCenter=center};
 const endPointer=e=>{pointers.delete(e.pointerId);if(renderer.domElement.hasPointerCapture(e.pointerId))renderer.domElement.releasePointerCapture(e.pointerId);if(pointers.size<2){lastPinch=0;lastCenter=null}};
 renderer.domElement.onpointerup=endPointer;renderer.domElement.onpointercancel=endPointer;
 renderer.domElement.addEventListener('wheel',e=>{e.preventDefault();distance=THREE.MathUtils.clamp(distance+e.deltaY*.004,2.2,12);camera.position.z=distance},{passive:false});
 const resize=()=>{camera.aspect=viewport.clientWidth/Math.max(viewport.clientHeight,1);camera.updateProjectionMatrix();renderer.setSize(viewport.clientWidth,viewport.clientHeight,false)};new ResizeObserver(resize).observe(viewport);resize();
 renderer.setAnimationLoop(()=>renderer.render(scene,camera));
}
function render3D(v){
 if(!sceneState)return;
 let savedTransform=null;
 if(sceneState.obj){
  savedTransform={
   position:sceneState.obj.position.clone(),
   quaternion:sceneState.obj.quaternion.clone(),
   scale:sceneState.obj.scale.clone()
  };
  sceneState.scene.remove(sceneState.obj);dispose(sceneState.obj)
 }
 const group=new THREE.Group();
 if(savedTransform){
  group.position.copy(savedTransform.position);
  group.quaternion.copy(savedTransform.quaternion);
  group.scale.copy(savedTransform.scale);
 }
 const total=v.columns*v.rows*v.slices;
 const step=Math.max(1,Math.ceil(Math.cbrt(total/300000)));
 for(const key of ['lung','fat','soft','bone']){
  const seg=segmentState[key];
  if(!seg.enabled)continue;
  const mesh=buildSegmentSurface(v,seg,step,key);
  if(mesh)group.add(mesh);
 }
 sceneState.obj=group;sceneState.scene.add(group);
 threeLabel.textContent=(sceneState.backend||'3D')+' · surface mesh';
}
function buildSegmentSurface(v,seg,step,key){
 const w=v.columns,h=v.rows,d=v.slices,[sx,sy,sz]=v.spacing;
 const positions=[],indices=[],vertexMap=new Map();
 const px=w*sx,py=h*sy,pz=d*sz,scale=3.3/Math.max(px,py,pz,1);
 const inside=(x,y,z)=>{
  if(x<0||y<0||z<0||x>=w||y>=h||z>=d)return false;
  const value=v.data[z*h*w+y*w+x];
  return value>=seg.min&&value<=seg.max;
 };
 const vertex=(gx,gy,gz)=>{
  const k=gx+','+gy+','+gz;
  let id=vertexMap.get(k);if(id!==undefined)return id;
  id=positions.length/3;vertexMap.set(k,id);
  positions.push((gx*sx-px/2)*scale,-(gy*sy-py/2)*scale,(gz*sz-pz/2)*scale);
  return id;
 };
 const face=(a,b,c,dv)=>{
  const ia=vertex(...a),ib=vertex(...b),ic=vertex(...c),id=vertex(...dv);
  indices.push(ia,ib,ic,ia,ic,id);
 };
 const maxFaces=key==='bone'?180000:100000;let faces=0;
 outer:for(let z=0;z<d;z+=step)for(let y=0;y<h;y+=step)for(let x=0;x<w;x+=step){
  if(!inside(x,y,z))continue;
  const x1=Math.min(w,x+step),y1=Math.min(h,y+step),z1=Math.min(d,z+step);
  const nx=x-step,ny=y-step,nz=z-step,pxn=x+step,pyn=y+step,pzn=z+step;
  if(!inside(nx,y,z)){face([x,y,z],[x,y,z1],[x,y1,z1],[x,y1,z]);if(++faces>=maxFaces)break outer}
  if(!inside(pxn,y,z)){face([x1,y,z],[x1,y1,z],[x1,y1,z1],[x1,y,z1]);if(++faces>=maxFaces)break outer}
  if(!inside(x,ny,z)){face([x,y,z],[x1,y,z],[x1,y,z1],[x,y,z1]);if(++faces>=maxFaces)break outer}
  if(!inside(x,pyn,z)){face([x,y1,z],[x,y1,z1],[x1,y1,z1],[x1,y1,z]);if(++faces>=maxFaces)break outer}
  if(!inside(x,y,nz)){face([x,y,z],[x,y1,z],[x1,y1,z],[x1,y,z]);if(++faces>=maxFaces)break outer}
  if(!inside(x,y,pzn)){face([x,y,z1],[x1,y,z1],[x1,y1,z1],[x,y1,z1]);if(++faces>=maxFaces)break outer}
 }
 if(!indices.length)return null;
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();
 const material=new THREE.MeshStandardMaterial({
  color:seg.color,transparent:seg.opacity<.999,opacity:seg.opacity,
  roughness:key==='bone'?.55:.8,metalness:0,side:THREE.DoubleSide,
  depthWrite:seg.opacity>.55
 });
 if(surfaceSmoothEnabled.checked){
  taubinSmoothGeometry(geometry,+surfaceSmoothStrength.value);
 }
 const mesh=new THREE.Mesh(geometry,material);mesh.name='segment_'+key;return mesh;
}

function taubinSmoothGeometry(geometry,strength){
 const pos=geometry.getAttribute('position');
 const index=geometry.index;
 if(!pos||!index||strength<=0)return;
 const vertexCount=pos.count;
 const neighbors=Array.from({length:vertexCount},()=>new Set());
 const idx=index.array;
 for(let i=0;i<idx.length;i+=3){
  const a=idx[i],b=idx[i+1],c=idx[i+2];
  neighbors[a].add(b);neighbors[a].add(c);
  neighbors[b].add(a);neighbors[b].add(c);
  neighbors[c].add(a);neighbors[c].add(b);
 }
 const coords=new Float32Array(pos.array);
 const tmp=new Float32Array(coords.length);
 const lambda=.34*strength,mu=-.36*strength;
 const pass=(src,dst,factor)=>{
  for(let i=0;i<vertexCount;i++){
   const ns=neighbors[i];
   if(ns.size===0){dst[i*3]=src[i*3];dst[i*3+1]=src[i*3+1];dst[i*3+2]=src[i*3+2];continue}
   let ax=0,ay=0,az=0;
   for(const j of ns){ax+=src[j*3];ay+=src[j*3+1];az+=src[j*3+2]}
   const inv=1/ns.size;ax*=inv;ay*=inv;az*=inv;
   const o=i*3;dst[o]=src[o]+factor*(ax-src[o]);dst[o+1]=src[o+1]+factor*(ay-src[o+1]);dst[o+2]=src[o+2]+factor*(az-src[o+2]);
  }
 };
 const iterations=Math.max(1,Math.round(2+strength*4));
 let a=coords,b=tmp;
 for(let k=0;k<iterations;k++){
  pass(a,b,lambda);[a,b]=[b,a];
  pass(a,b,mu);[a,b]=[b,a];
 }
 pos.array.set(a);pos.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingSphere();
}

function resetVolume(){filterRebuildRevision++;filterState.spikeHole=filterState.nlm=filterState.anisotropic=filterState.gaussian=filterState.sigmoid=false;volume=null;sourceVolume=null;enableProcessingControls(false);surfaceSmoothEnabled.disabled=true;surfaceSmoothStrength.disabled=true;gaussianStrength.disabled=true;spikeHoleStrength.disabled=true;nlmStrength.disabled=true;anisotropicStrength.disabled=true;wc.disabled=ww.disabled=true;for(const key of Object.keys(segmentState)){for(const sel of ['enabled','color','min','max','opacity']){const el=$('[data-seg-'+sel+'="'+key+'"]');if(el)el.disabled=true}}wcVal.value=wwVal.value='—';for(const p of Object.values(planes)){p.slider.disabled=true;p.label.textContent='—';p.canvas.getContext('2d')?.clearRect(0,0,p.canvas.width,p.canvas.height)}if(sceneState?.obj){sceneState.scene.remove(sceneState.obj);dispose(sceneState.obj);sceneState.obj=null}threeLabel.textContent=sceneState?.backend||'3D'}
function dispose(o){o.traverse(c=>{c.geometry?.dispose?.();if(Array.isArray(c.material))c.material.forEach(m=>m.dispose());else c.material?.dispose?.()})}
function busy(v){folderBtn.disabled=demoBtn.disabled=v}
function progress(a,b){bar.style.width=(b?Math.round(a/b*100):0)+'%';progLabel.textContent=a+' / '+b}
function byteProgress(a,b,label){bar.style.width=Math.min(100,Math.round(a/b*100))+'%';progLabel.textContent=label+' '+fmt(a)+' / '+fmt(b)}
function fmt(n){if(!n)return'0 B';const u=['B','KiB','MiB','GiB'];const i=Math.min(Math.floor(Math.log(n)/Math.log(1024)),u.length-1);return(n/1024**i).toFixed(i?2:0)+' '+u[i]}
function num(v){const n=Number(v);return Number.isFinite(n)?n:null}function numberOr(v,f){const n=Number(v);return Number.isFinite(n)?n:f}function multi(v,n){if(!v)return null;const a=v.split('\\').map(Number);return a.length>=n&&a.every(Number.isFinite)?a.slice(0,n):null}function safePair(a){return[a[0],a[1]]}function safeTriple(a){return[a[0],a[1],a[2]]}function esc(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
start3D().catch(e=>{console.error(e);status.textContent='3D RENDERER ERROR';status.className='status status-error';threeLabel.textContent='MPR ONLY';footer.textContent='3D初期化に失敗しました。DICOM/MPRは利用できます: '+String(e.message||e)});
