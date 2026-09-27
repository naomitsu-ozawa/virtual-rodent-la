// Extracted verbatim from app.js by tools/extract-module.mjs.
// Depends only on the imports below; never imports from app.js (no cycles).
import { mark3DStale, mark3DCurrent } from './three-state.js?v=20260927-build265';
import { updateVolumeFilterBadge, set3DBusy, gpuVolumeRefresh } from './three-status.js?v=20260927-build265';
import { currentLanguage, current3DVolume, volume, activeSeries, threeRenderMode, sceneState, sourceVolume, setActiveId, setActiveSeries, activeId, setSourceVolume, setVolume, setThreeRenderMode, ipadGpuTargetSide, setResidentGpuUploadSeriesId, setResidentMprReadbackDisabled, residentGpuUploadSeriesId, gpuPrewarmScheduled, gpuPrewarmIndex, setGpuPrewarmScheduled, incGpuPrewarmIndex, setFilterOrder, setCtRangeMode, setCtRangeProfile, ctRangeProfile, incSourceRenderRevision, setThreeDCancelRequested, setCurrent3DVolume, setMemoryGpuPreviewActive, incResidentMprEpoch, ctRangeMode, filterOrder, threeDDirty } from './state.js?v=20260927-build265';
import { footer, resetFilterBtn, wc, ww, surfaceSmoothEnabled, surfaceSmoothStrength, planes, spikeHoleStrength, spikeHoleThreshold, nlmStrength, nlmSearchRadius, nlmPatchRadius, anisotropicStrength, anisotropicIterations, smoothingType, gaussianStrength, spatialPasses, sigmoidStrength, sigmoidCenter, bilateralStrength, bilateralSpatial, bilateralIntensity, bilateralPasses, tvWeight, tvIterations, unsharpRadius, unsharpAmount, unsharpThreshold, projectSaveBtn, list, selected, prog, volumeAnalysisToggle, threeLabel, state, renderModeToggle, gaussianBtn, spikeHoleBtn, nlmBtn, anisotropicBtn, sigmoidBtn, bilateralBtn, tvBtn, unsharpBtn, filterAddSelect, filterAddButton, ctRangeAuto, ctRangeFull, $, folderBtn, demoBtn, progLabel, bar } from './ui-shell.js?v=20260927-build265';
import { compareFingerprints, datasetFingerprint, decodeRuns, packProject, PROJECT_EXTENSION, encodeRuns } from './project-file.js?v=20260927-build265';
import { SEGMENT_PRESET_ORDER, segmentState, segmentEditState, segmentNeedsGlobalMask } from './segments.js?v=20260927-build265';
import { FILTER_CATALOG_ORDER, addFilter, applyVolumeAfterFilterRebuild, invalidateSourceFilters, syncFilterControls } from './filter-pipeline.js?v=20260927-build265';
import { setControlValue, applyCtRangeMode, removeSegmentPreset, addSegmentPreset, segmentControl, setControlChecked, clearAnalysisHighlight, scheduleSegment3D, updateSegmentOutputs, renderSegmentPresets, THIN_SLIDERS, configureThinSliders } from './segment-ui.js?v=20260927-build265';
import { syncGpuVolumeEdits, gpuVolumeApplied, gpuVolumeTarget, gpuVolumePlanOptions, updateVolumeCacheControl, gpuVolumeDataSignature } from './gpu-volume-data.js?v=20260927-build265';
import { renderAll, cancelSourceMprWarmup } from './mpr-render.js?v=20260927-build265';
import { updateAnalysisEditorControls } from './edit-tools.js?v=20260927-build265';
import { request3DRender } from './scene3d.js?v=20260927-build265';
import { esc, fmt, isIPadRuntime, isIPhoneRuntime, niceCtStep, isDesktopMac, withTimeout } from './utils.js?v=20260927-build265';
import { decode, prepareSourceMprCache } from './volume-io.js?v=20260927-build265';
import { progress, clearMemoryFilterPreviewCache } from './rebuild-3d.js?v=20260927-build265';
import { ensureMpr3DPreviewCache, syncMpr3DSliceSliders, syncMpr3DOverlayPresentation, disposeMprPlaneGroup } from './mpr3d-overlay.js?v=20260927-build265';
import { tr } from './i18n.js?v=20260927-build265';
import { setGpuComputeBackend, gpuFilterRuntime, gpuFilterPipeline } from './gpu-compute.js?v=20260927-build265';
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.186.0/build/three.webgpu.js';
import { GPU_PREWARM_KINDS } from './gpu-shaders.js?v=20260927-build265';
import { filterState, currentFilterSignature } from './source-filters.js?v=20260927-build265';
import { dispose } from './surface-mesh.js?v=20260927-build265';
import { residentMprJobs } from './mpr-orthogonal.js?v=20260927-build265';
import { unzip } from 'https://esm.sh/fflate@0.8.2';
import { ensureSegmentBaseRuns } from './segment-runs.js?v=20260927-build265';
import { APP_VERSION, APP_BUILD } from './version.js?v=20260927-build265';
export const DEMO_URL='https://zenodo.org/api/records/12761093/files/PET-CT.zip/content';
export const DEMO_SIZE=20800000;
export function updateRenderModeControl(v=volume){
 updateVolumeFilterBadge();
 if(!renderModeToggle)return;
 const mv=sceneState?.medicalVolume,support=mv&&v?mv.support(v,gpuVolumePlanOptions()):{ok:false,reason:'WebGPU volume unavailable'};
 renderModeToggle.disabled=!support.ok;
 renderModeToggle.removeAttribute('data-i18n');renderModeToggle.textContent=threeRenderMode==='volume'?tr('surfaceRender'):tr('volumeRender');
 renderModeToggle.title=support.ok?'':(support.reason||'');
}
export function ensureVolumeTransformProxy(){
 if(sceneState?.obj)return sceneState.obj;
 const group=new THREE.Group();sceneState.obj=group;sceneState.scene.add(group);return group;
}
export function setSurfaceMeshesHiddenForVolume(hidden){
 if(!sceneState?.obj)return;
 sceneState.obj.traverse(o=>{
  if(!o.isMesh)return;
  const isSurface=!!o.userData?.segmentKey||Array.isArray(o.userData?.segmentRanges);
  if(!isSurface)return;
  if(hidden){
   if(o.userData._volumePrevVisible===undefined)o.userData._volumePrevVisible=o.visible;
   o.visible=false;
  }else if(o.userData._volumePrevVisible!==undefined){
   o.visible=!!o.userData._volumePrevVisible;delete o.userData._volumePrevVisible;
  }
 });
}
export function setThreeVolumeOverlay(active){
 const state=sceneState;if(!state?.renderer)return;
 const canvas=state.renderer.domElement;
 if(active){
  state._surfaceBackground=state.scene.background;
  state._surfaceClearAlpha=typeof state.renderer.getClearAlpha==='function'?state.renderer.getClearAlpha():1;
  state.scene.background=null;if(typeof state.renderer.setClearAlpha==='function')state.renderer.setClearAlpha(0);
  Object.assign(canvas.style,{position:'absolute',inset:'0',zIndex:'2',pointerEvents:'auto'});
  setSurfaceMeshesHiddenForVolume(true);
 }else{
  state.scene.background=state._surfaceBackground||new THREE.Color(0x090c0e);
  if(typeof state.renderer.setClearAlpha==='function')state.renderer.setClearAlpha(state._surfaceClearAlpha??1);
  canvas.style.position='';canvas.style.inset='';canvas.style.zIndex='';canvas.style.pointerEvents='';
  setSurfaceMeshesHiddenForVolume(false);
 }
}
// GPU volume view only thresholds: compute the post-processed runs of
// segments that need them (thin-region suppression, Opening, ...) in the
// background and show them as keep masks (gpuVolumeEditDescriptors).
export function syncProcessedSegmentsToVolume(){
 if(threeRenderMode!=='volume')return;
 const v=current3DVolume||volume,keys=SEGMENT_PRESET_ORDER.filter(key=>{const s=segmentState[key];return s?.active&&s.enabled&&segmentNeedsGlobalMask(s)});
 if(!v||!keys.length)return;
 setTimeout(async()=>{
  for(const key of keys){
   if((current3DVolume||volume)!==v||!segmentState[key]?.active)return;
   try{await ensureSegmentBaseRuns(key,v);syncGpuVolumeEdits(sourceVolume||volume)}
   catch(e){if(String(e.message||e)!=='__SUPERSEDED__')console.warn('Segment post-processing for the volume view failed for '+key,e);return}
  }
 },0);
}
export async function activateMedicalVolume(){
 const mv=sceneState?.medicalVolume,target=gpuVolumeTarget();if(!mv||!target)return;
 gpuVolumeRefresh.token++;gpuVolumeRefresh.running=null;
 const planOptions=gpuVolumePlanOptions(),support=mv.support(target,planOptions);if(!support.ok){footer.textContent='GPU Volume: '+support.reason;updateRenderModeControl(target);return}
 set3DBusy(true,currentLanguage==='ja'?'GPUボリューム準備中…':'Preparing GPU volume…');
 try{
  await mv.ensure(target,planOptions);if(mv.lastCacheHit)footer.textContent=tr('volumeCacheLoaded');void updateVolumeCacheControl();ensureVolumeTransformProxy();setThreeRenderMode('volume');mv.setActive(true);syncGpuVolumeEdits(target);syncProcessedSegmentsToVolume();setThreeVolumeOverlay(true);syncMpr3DOverlayPresentation();volumeAnalysisToggle.disabled=false;
  const reduced=!!mv.isReduced?.(target),dims=mv.textureDims||[],profile=gpuVolumeProfileLabel();
  threeLabel.textContent=(sceneState.backend||'3D')+(reduced?' · '+profile+' GPU volume':' · GPU volume');setGpuComputeBackend(reduced?'WEBGPU '+profile.toUpperCase()+' VOLUME RAYCAST · LINEAR':'WEBGPU VOLUME RAYCAST');updateRenderModeControl(target);request3DRender();
  footer.textContent=reduced?(profile+' GPUボリューム · '+dims.join('×')+' · '+fmt(mv.textureBytes)+' · MPR/元データはフル解像度'):(currentLanguage==='ja'?'GPUボリューム · 16-bit CTを3D textureから直接描画':'GPU Volume · direct 16-bit CT 3D-texture ray casting');
 }catch(e){console.error(e);mv.setActive(false);setThreeRenderMode('surface');setGpuComputeBackend('GPU VOLUME ERROR',e?.message||e);footer.textContent='GPU Volume error: '+String(e.message||e);updateRenderModeControl(target)}
 finally{set3DBusy(false)}
}
export function clear3DForSeriesChange(){
 incSourceRenderRevision(false);setThreeDCancelRequested(false);setCurrent3DVolume(null);setMemoryGpuPreviewActive(false);setResidentMprReadbackDisabled(false);setResidentGpuUploadSeriesId(null);clearResidentMprJobs();sceneState?.medicalVolume?.resetData?.();setThreeRenderMode('surface');setThreeVolumeOverlay(false);clearMemoryFilterPreviewCache();set3DBusy(false);clearAnalysisHighlight();
 if(sceneState?.obj){sceneState.obj.parent?.remove(sceneState.obj);dispose(sceneState.obj);sceneState.obj=null}
 disposeMprPlaneGroup();request3DRender();mark3DStale();
}
export async function loadDemo(){
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
export async function updateDemoCacheBadge(){
 if(!('caches' in window))return;
 try{
  const cache=await withTimeout(caches.open('virtual-rodent-demo-v2'),1200,null);
  if(cache&&await withTimeout(cache.match(DEMO_URL),1200,null))demoBtn.textContent='公開マウスCTデモ ✓';
 }catch{}
}
export const detectedSeries={list:[]};
export function useWorkspaceUi(){
 const q=new URLSearchParams(location.search).get('ui');
 if(q==='classic')return false;if(q==='workspace')return true;
 return isIPadRuntime()||isDesktopMac();
}
export function requestIPadSettingsTab(tab){
 if(!useWorkspaceUi())return;
 document.dispatchEvent(new CustomEvent('vrl-ipad-settings-tab',{detail:{tab}}));
}
export async function selectSeries(s){
 setActiveId(s.id);setActiveSeries(s);clear3DForSeriesChange();projectSaveBtn.disabled=true;
 requestIPadSettingsTab('display');
 for(const n of list.children)n.classList.toggle('is-selected',n.dataset.id===activeId);
 selected.innerHTML='<strong>'+esc(s.description)+'</strong><span>'+esc(s.modality)+' · '+s.slices.length+' slices · '+s.columns+'×'+s.rows+(s.sourceBacked?' · full resolution':'')+'</span><span class="ready-badge">CT volume loading…</span>';
 prog.classList.remove('is-hidden');busy(true);let phase='decode';
 try{
  invalidateSourceFilters();
  setSourceVolume(s.sourceBacked?openSourceBackedVolume(s):await decode(s,(x,y)=>progress(x,y)));
  setVolume(sourceVolume);phase='configure';configure(volume);enableProcessingControls(true);scheduleGpuPrewarm();
  let gpuResident=false;
  if(s.sourceBacked){
   const badge=selected.querySelector('.ready-badge');if(badge)badge.textContent='GPU volume…';
   gpuResident=await prepareResidentGpuVolume(sourceVolume);
   if(!gpuResident){
    if(badge)badge.textContent='MPR cache…';
    await prepareSourceMprCache(sourceVolume,(x,y)=>{progress(x,y);const b=selected.querySelector('.ready-badge');if(b)b.textContent='MPR cache '+x+' / '+y});
   }
  }
  const badge=selected.querySelector('.ready-badge');
  if(!gpuResident){if(badge)badge.textContent='3D C/S cache…';await ensureMpr3DPreviewCache()}
  phase='render';renderAll();mark3DStale();
  if(gpuResident){await activateMedicalVolume();mark3DCurrent()}
  if(badge)badge.textContent=s.sourceBacked?(gpuResident?'CT source ready · GPU volume':(volume.mprData?'CT source ready · MPR cached':'CT source ready · streaming MPR')):'CT volume ready · 2D ready';
  footer.textContent=s.sourceBacked?(gpuResident?'Full-resolution source DICOM · GPU-resident MPR':(volume.mprData?'Full-resolution source DICOM · MPR memory cache '+fmt(volume.mprData.byteLength):'Full-resolution source-backed DICOM · streaming MPR')):'CT range: '+Math.round(volume.min)+' to '+Math.round(volume.max)+' · '+volume.data.constructor.name+' '+fmt(volume.data.byteLength);
  projectSaveBtn.disabled=false;syncMpr3DSliceSliders();void applyPendingProject();
 }catch(e){
  console.error(e);const label=phase==='decode'?'Decode failed':phase==='configure'?'Configure failed':'Render failed';
  selected.querySelector('.ready-badge').textContent=label;footer.textContent=label+': '+String(e.message||e)
 }finally{prog.classList.add('is-hidden');busy(false);set3DBusy(false)}
}
export function openSourceBackedVolume(s){
 return{data:null,mprData:null,mprPlaneBuffers:null,mprSagittalDisplayAll:null,mprSagittalDisplayBuffer:null,mprSagittalDisplayMin:null,mprSagittalDisplayMax:null,sourceBacked:true,series:s,columns:s.columns,rows:s.rows,slices:s.slices.length,spacing:[s.spacingX,s.spacingY,s.spacingZ],min:s.min,max:s.max,windowCenter:s.windowCenter,windowWidth:s.windowWidth,storage:'DICOM source'};
}
export function gpuVolumeProfileLabel(){
 if(isIPadRuntime())return'iPad '+ipadGpuTargetSide;
 if(isIPhoneRuntime())return'iPhone';
 return'GPU';
}
export function clearResidentMprJobs(){
 incResidentMprEpoch(false);
 for(const state of Object.values(residentMprJobs)){
  if(state.pending){for(const waiter of state.pending.waiters)waiter.reject(new Error('__SUPERSEDED__'));state.pending=null}
 }
}
export async function prepareResidentGpuVolume(v){
 const mv=sceneState?.medicalVolume;if(!mv||!v?.sourceBacked)return false;
 const planOptions=gpuVolumePlanOptions(),support=mv.support(v,planOptions);if(!support.ok)return false;
 const seriesId=v?.series?.id||null;setResidentGpuUploadSeriesId(seriesId);cancelSourceMprWarmup();
 try{
  const previewSide=(planOptions.maxTextureBytes||planOptions.targetInPlane)?0:384;
  await mv.ensure(v,{prepareBricks:false,previewSide,...planOptions});
  setResidentMprReadbackDisabled(!!mv.isReduced?.(v));
  if(mv.isReduced?.(v)){
   const dims=mv.textureDims||[],profile=gpuVolumeProfileLabel();
   setGpuComputeBackend('WEBGPU '+profile.toUpperCase()+' VOLUME · LINEAR');
   footer.textContent=profile+' GPUボリューム · '+dims.join('×')+' · '+fmt(mv.textureBytes)+' / 2D MPRは原寸ソース';
  }else setGpuComputeBackend('WEBGPU VOLUME RESIDENT');
  return true;
 }catch(e){
  console.warn('GPU resident volume unavailable; using source-backed MPR fallback.',e);setResidentMprReadbackDisabled(true);setGpuComputeBackend('GPU VOLUME FALLBACK',e?.message||e);return false;
 }finally{
  if(residentGpuUploadSeriesId===seriesId)setResidentGpuUploadSeriesId(null);
  set3DBusy(false);
 }
}
export function scheduleGpuPrewarm(){
 if(gpuPrewarmScheduled||gpuFilterRuntime.disabled||gpuPrewarmIndex>=GPU_PREWARM_KINDS.length)return;
 setGpuPrewarmScheduled(true);
 const run=async()=>{
  setGpuPrewarmScheduled(false);
  if(gpuFilterRuntime.disabled||gpuPrewarmIndex>=GPU_PREWARM_KINDS.length)return;
  const kind=GPU_PREWARM_KINDS[incGpuPrewarmIndex(false)];
  try{await gpuFilterPipeline(kind)}catch(e){console.warn('GPU pipeline prewarm skipped:',kind,e)}
  if(gpuPrewarmIndex<GPU_PREWARM_KINDS.length)scheduleGpuPrewarm();
 };
 if('requestIdleCallback' in window)requestIdleCallback(()=>void run(),{timeout:2500});
 else setTimeout(()=>void run(),180);
}
export function enableProcessingControls(enabled){
 if(!enabled){filterState.spikeHole=filterState.nlm=filterState.anisotropic=filterState.gaussian=filterState.sigmoid=filterState.bilateral=filterState.tv=filterState.unsharp=false;setFilterOrder([])}
 gaussianBtn.disabled=!enabled;smoothingType.disabled=!enabled||!filterState.gaussian;spikeHoleBtn.disabled=!enabled;nlmBtn.disabled=!enabled;anisotropicBtn.disabled=!enabled;sigmoidBtn.disabled=!enabled;bilateralBtn.disabled=!enabled;tvBtn.disabled=!enabled;unsharpBtn.disabled=!enabled;filterAddSelect.disabled=!enabled;filterAddButton.disabled=!enabled;
 filterAddSelect.title=volume?.sourceBacked?'フル解像度チャンク処理':'';filterAddButton.title='';
 resetFilterBtn.disabled=!enabled;
 surfaceSmoothEnabled.disabled=!enabled;
 surfaceSmoothStrength.disabled=!enabled||!surfaceSmoothEnabled.checked;
 syncFilterControls();
}
export function buildCtRangeProfile(v){
 const fullMin=Number.isFinite(v.min)?v.min:0,fullMax=Number.isFinite(v.max)&&v.max>fullMin?v.max:fullMin+1,fullSpan=Math.max(fullMax-fullMin,1e-6);
 const center=Number.isFinite(v.windowCenter)?v.windowCenter:(fullMin+fullMax)/2;
 const width=Number.isFinite(v.windowWidth)&&v.windowWidth>0?v.windowWidth:fullSpan;
 return{fullMin,fullMax,fullSpan,center,width,fullWidthMax:Math.max(fullSpan,width)};
}
export function configure(v){
 setCtRangeMode('auto');setCtRangeProfile(buildCtRangeProfile(v));
 const p=ctRangeProfile,center=p.center,initialWidth=p.width;
 wc.min=p.fullMin;wc.max=p.fullMax;wc.value=Math.max(p.fullMin,Math.min(p.fullMax,center));wc.disabled=false;
 ww.min=Math.max(niceCtStep(p.fullSpan),1e-6);ww.max=p.fullWidthMax;ww.value=Math.max(+ww.min,Math.min(p.fullWidthMax,initialWidth));ww.disabled=false;
 sigmoidCenter.min=p.fullMin;sigmoidCenter.max=p.fullMax;sigmoidCenter.value=Math.max(p.fullMin,Math.min(p.fullMax,center));sigmoidCenter.disabled=!filterState.sigmoid;
 const vals={axial:[v.slices,v.slices/2],coronal:[v.rows,v.rows/2],sagittal:[v.columns,v.columns/2]};for(const [plane,[max,mid]]of Object.entries(vals)){planes[plane].slider.max=max-1;planes[plane].slider.value=Math.floor(mid);planes[plane].slider.disabled=false}
 configureSegments(v);
 ctRangeAuto.disabled=ctRangeFull.disabled=false;applyCtRangeMode('auto');
 volumeAnalysisToggle.disabled=!(v.data||v.mprData||v.sourceBacked);updateRenderModeControl(v);
}
export function configureSegments(v){
 const huLike=v.min<=-500&&v.max>=1000;
 const defaults=huLike?{lung:[Math.max(v.min,-950),Math.min(v.max,-300)],fat:[Math.max(v.min,-250),Math.min(v.max,-50)],soft:[Math.max(v.min,-50),Math.min(v.max,350)],bone:[Math.max(v.min,350),v.max]}:{lung:[v.min+(v.max-v.min)*.03,v.min+(v.max-v.min)*.18],fat:[v.min,v.min+(v.max-v.min)*.22],soft:[v.min+(v.max-v.min)*.22,v.min+(v.max-v.min)*.58],bone:[v.min+(v.max-v.min)*.58,v.max]};
 for(const key of Object.keys(segmentState)){
  const cfg=segmentState[key],d=defaults[key];cfg.min=d[0];cfg.max=d[1];
  // thin-region suppression starts off: on large in-memory volumes the
  // processed mask is a whole-volume pass, so it runs only when asked for
  cfg.surfaceMm=0;cfg.thicknessMm=0;configureThinSliders(key,v);
  const enabled=$('[data-seg-enabled="'+key+'"]'),color=$('[data-seg-color="'+key+'"]'),min=$('[data-seg-min="'+key+'"]'),max=$('[data-seg-max="'+key+'"]'),opacity=$('[data-seg-opacity="'+key+'"]');
  const exportBtn=$('[data-seg-export="'+key+'"]'),removeBtn=$('[data-seg-remove="'+key+'"]'),opening=$('[data-seg-opening="'+key+'"]'),closing=$('[data-seg-closing="'+key+'"]'),minComponent=$('[data-seg-min-component="'+key+'"]'),holeFill=$('[data-seg-hole-fill="'+key+'"]');
  const usable=cfg.active;
  enabled.disabled=color.disabled=min.disabled=max.disabled=opacity.disabled=!usable;opening.disabled=closing.disabled=minComponent.disabled=holeFill.disabled=!usable;for(const [attr] of THIN_SLIDERS){const el=$('[data-seg-'+attr+'="'+key+'"]');if(el)el.disabled=!usable}if(exportBtn)exportBtn.disabled=!usable;if(removeBtn)removeBtn.disabled=!usable;enabled.checked=cfg.enabled;color.value=cfg.color;
  min.min=max.min=Math.floor(v.min);min.max=max.max=Math.ceil(v.max);min.value=cfg.min;max.value=cfg.max;opacity.value=cfg.opacity;opening.value=cfg.opening;closing.value=cfg.closing;minComponent.value=cfg.minComponent;holeFill.checked=cfg.holeFill;$('[data-seg-opening-out="'+key+'"]').value=cfg.opening;$('[data-seg-closing-out="'+key+'"]').value=cfg.closing;$('[data-seg-min-component-out="'+key+'"]').value=cfg.minComponent;cfg._maskCache=null;updateSegmentOutputs(key);
 }
 renderSegmentPresets();
}
export const FILTER_PARAM_INPUTS={spikeHole:{strength:spikeHoleStrength,threshold:spikeHoleThreshold},nlm:{strength:nlmStrength,searchRadius:nlmSearchRadius,patchRadius:nlmPatchRadius},anisotropic:{strength:anisotropicStrength,iterations:anisotropicIterations},gaussian:{mode:smoothingType,strength:gaussianStrength,passes:spatialPasses},sigmoid:{strength:sigmoidStrength,center:sigmoidCenter},bilateral:{strength:bilateralStrength,spatialSigma:bilateralSpatial,intensitySigma:bilateralIntensity,passes:bilateralPasses},tv:{weight:tvWeight,iterations:tvIterations},unsharp:{radius:unsharpRadius,amount:unsharpAmount,threshold:unsharpThreshold}};
export const pendingProject={value:null};
export function gatherProject(){
 const series=activeSeries,slices=series.slices.length;
 const project={
  app:{version:APP_VERSION,build:APP_BUILD},savedAt:new Date().toISOString(),
  dataset:datasetFingerprint(series),
  display:{windowCenter:wc.value,windowWidth:ww.value,ctRangeMode,slices:Object.fromEntries(Object.keys(planes).map(p=>[p,+planes[p].slider.value]))},
  filters:{order:filterOrder.filter(k=>filterState[k]).map(key=>({key,params:Object.fromEntries(Object.entries(FILTER_PARAM_INPUTS[key]||{}).map(([name,el])=>[name,el.value]))}))},
  segments:Object.fromEntries(SEGMENT_PRESET_ORDER.map(key=>{const g=segmentState[key];return[key,{active:!!g.active,enabled:!!g.enabled,color:g.color,opacity:g.opacity,min:g.min,max:g.max,opening:g.opening,closing:g.closing,minComponent:g.minComponent,holeFill:!!g.holeFill,surfaceMm:g.surfaceMm,thicknessMm:g.thicknessMm}]})),
  surfaceSmoothing:{enabled:!!surfaceSmoothEnabled?.checked,strength:surfaceSmoothStrength?.value??null},
  // were these filters applied to 3D (volume or surfaces) when saved? A loaded
  // project then restores the 3D state too, not only the 2D preview.
  threeD:{filtersApplied:!!currentFilterSignature()&&(gpuVolumeDataSignature()===currentFilterSignature()||!threeDDirty)},
  edits:{},
 };
 const binaries={};
 for(const key of SEGMENT_PRESET_ORDER){
  const st=segmentEditState[key],entry={};
  for(const kind of['keep','exclude']){const runs=st[kind+'Runs'];if(runs){const path='edits/'+key+'-'+kind+'.bin';binaries[path]=encodeRuns(runs,slices);entry[kind]=path}}
  if(Object.keys(entry).length)project.edits[key]=entry;
 }
 return{project,binaries};
}
export async function deliverProjectFile(bytes,name){
 if(isIPadRuntime()||isIPhoneRuntime()){
  const file=new File([bytes],name,{type:'application/octet-stream'});
  if(navigator.canShare?.({files:[file]})){
   try{await navigator.share({files:[file],title:name});return'shared'}
   catch(e){if(e?.name==='AbortError')return'cancelled';console.warn('Share failed; downloading instead.',e)}
  }
 }
 // octet-stream: with application/zip Safari/iOS renames the download to *.zip
 downloadBlob(new Blob([bytes],{type:'application/octet-stream'}),name);
 return'downloaded';
}
export async function saveProject(){
 if(!volume||!activeSeries)return;
 const ja=currentLanguage==='ja';
 try{
  const{project,binaries}=gatherProject(),bytes=packProject(project,binaries);
  const base=(activeSeries.description||'project').replace(/[^\w\-]+/g,'_').replace(/^_+|_+$/g,'').slice(0,60)||'project';
  const how=await deliverProjectFile(bytes,base+'_'+new Date().toISOString().slice(0,10)+PROJECT_EXTENSION),size=fmt(bytes.byteLength);
  footer.textContent=how==='cancelled'?(ja?'プロジェクトの保存をキャンセルしました':'Project save cancelled')
   :how==='shared'?(ja?'プロジェクトを書き出しました · '+size+' · 「"ファイル"に保存」でDICOMフォルダを選ぶと、次回はフォルダを開くだけで自動適用されます':'Project exported · '+size+' · choose the DICOM folder in "Save to Files" to apply it automatically next time')
   :(ja?'プロジェクトを保存しました · '+size+' · DICOMフォルダに入れておくと、フォルダを開くだけで自動適用されます':'Project saved · '+size+' · keep it in the DICOM folder to apply it automatically when the folder is opened');
 }catch(e){console.error(e);footer.textContent=(ja?'プロジェクトを保存できませんでした: ':'Could not save project: ')+String(e.message||e)}
}
export async function applyPendingProject(){
 const pending=pendingProject.value;if(!pending)return;
 const ja=currentLanguage==='ja',ds=pending.project.dataset||{},label=(ds.description||'')+' · '+ds.columns+'×'+ds.rows+'×'+ds.slices;
 if(!volume||!activeSeries){footer.textContent=ja?'プロジェクトを読み込みました。対応するDICOM（'+label+'）を開くと適用します':'Project loaded. Open the matching DICOM ('+label+') to apply it';return}
 if(!compareFingerprints(ds,datasetFingerprint(activeSeries)).ok){
  const match=detectedSeries.list.find(s=>s!==activeSeries&&compareFingerprints(ds,datasetFingerprint(s)).ok);
  if(match){await selectSeries(match);return}
  const issues=compareFingerprints(ds,datasetFingerprint(activeSeries)).issues.join(', ');
  footer.textContent=ja?'このプロジェクトは別のデータ用です（'+label+'、不一致: '+issues+'）。対応するDICOMを開くと適用します':'This project belongs to other data ('+label+'; mismatch: '+issues+'). Open the matching DICOM to apply it';
  return;
 }
 pendingProject.value=null;
 try{await applyProject(pending);footer.textContent=ja?'プロジェクトを適用しました':'Project applied'}
 catch(e){console.error(e);footer.textContent=(ja?'プロジェクトを適用できませんでした: ':'Could not apply project: ')+String(e.message||e)}
}
export async function applyProject({project,files}){
 // validate and decode edits first, so a broken file changes nothing
 const dims={slices:activeSeries.slices.length,columns:activeSeries.columns,rows:activeSeries.rows},edits={};
 for(const[key,entry]of Object.entries(project.edits||{})){
  if(!SEGMENT_PRESET_ORDER.includes(key))continue;edits[key]={};
  for(const kind of['keep','exclude'])if(entry?.[kind]){const bytes=files[entry[kind]];if(!bytes)throw new Error('missing '+entry[kind]);edits[key][kind]=decodeRuns(bytes,dims)}
 }
 // filters (replayed through the filter controls)
 resetFilterBtn.click();
 for(const{key,params}of project.filters?.order||[]){
  if(!FILTER_CATALOG_ORDER.includes(key))continue;addFilter(key);
  for(const[name,value]of Object.entries(params||{}))setControlValue(FILTER_PARAM_INPUTS[key]?.[name],value);
 }
 // display
 const display=project.display||{};
 if(display.ctRangeMode)applyCtRangeMode(display.ctRangeMode);
 setControlValue(wc,display.windowCenter);setControlValue(ww,display.windowWidth);
 // segments
 for(const key of SEGMENT_PRESET_ORDER){
  const g=project.segments?.[key];if(!g)continue;
  if(!g.active){if(segmentState[key].active)removeSegmentPreset(key);continue}
  if(!segmentState[key].active)addSegmentPreset(key);
  setControlValue(segmentControl('color',key),g.color);
  setControlValue(segmentControl('max',key),g.max);setControlValue(segmentControl('min',key),g.min);setControlValue(segmentControl('max',key),g.max);
  setControlValue(segmentControl('opacity',key),g.opacity);setControlValue(segmentControl('opening',key),g.opening);
  setControlValue(segmentControl('closing',key),g.closing);setControlValue(segmentControl('min-component',key),g.minComponent);
  setControlValue(segmentControl('surface-mm',key),g.surfaceMm??0);setControlValue(segmentControl('thickness-mm',key),g.thicknessMm??0);
  setControlChecked(segmentControl('hole-fill',key),g.holeFill);setControlChecked(segmentControl('enabled',key),g.enabled);
 }
 // surface smoothing
 if(project.surfaceSmoothing){setControlChecked(surfaceSmoothEnabled,project.surfaceSmoothing.enabled);setControlValue(surfaceSmoothStrength,project.surfaceSmoothing.strength)}
 // 3D edits (voxel masks at original resolution)
 for(const key of SEGMENT_PRESET_ORDER){
  const st=segmentEditState[key],e=edits[key]||{};
  st.keepRuns=e.keep||null;st.excludeRuns=e.exclude||null;st.cutRuns=null;st.finalRuns=null;st.undo=[];st.redo=[];st.revision++;
 }
 if(threeRenderMode==='volume'&&sceneState?.medicalVolume?.active)syncGpuVolumeEdits(sourceVolume||volume);
 // slice positions
 for(const[p,idx]of Object.entries(display.slices||{}))if(planes[p]&&Number.isFinite(+idx))planes[p].slider.value=String(Math.max(0,Math.min(+planes[p].slider.max,+idx)));
 // 3D: projects without the flag (saved before build 206) count as applied
 const applied=project.threeD?.filtersApplied??!!(project.filters?.order||[]).length;
 if(applied&&currentFilterSignature()&&(sourceVolume||volume)?.sourceBacked){
  gpuVolumeApplied.seriesId=(sourceVolume||volume)?.series?.id??null;gpuVolumeApplied.signature=currentFilterSignature();
  applyVolumeAfterFilterRebuild.value=true; // see rebuildActiveFilters
 }
 clearAnalysisHighlight();renderAll();scheduleSegment3D();updateAnalysisEditorControls();updateVolumeFilterBadge();
}
export function downloadBlob(blob,filename){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=filename;document.body.appendChild(a);a.click();const url=a.href;a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
export function busy(v){folderBtn.disabled=demoBtn.disabled=v}
export function byteProgress(a,b,label){bar.style.width=Math.min(100,Math.round(a/b*100))+'%';progLabel.textContent=label+' '+fmt(a)+' / '+fmt(b)}
