// Extracted verbatim from app.js by tools/extract-module.mjs.
// Depends only on the imports below; never imports from app.js (no cycles).
import { gpuStepTimes } from './gpu-compute.js?v=20260928-build289';
import { gpuVolumeRefresh, updateVolumeFilterBadge, set3DBusy } from './three-status.js?v=20260928-build289';
import { sourceVolume, volume, sceneState, currentLanguage, threeRenderMode, ipadGpuTargetSide } from './state.js?v=20260928-build289';
import { SEGMENT_PRESET_ORDER, segmentEditState, segmentState, segmentNeedsGlobalMask } from './segments.js?v=20260928-build289';
import { request3DRender } from './scene3d.js?v=20260928-build289';
import { footer, volumeCacheClearBtn } from './ui-shell.js?v=20260928-build289';
import { subtractRunArrays, intersectRunArrays } from './run-length.js?v=20260928-build289';
import { tr } from './i18n.js?v=20260928-build289';
import { fmt, isIPadRuntime, isIPhoneRuntime } from './utils.js?v=20260928-build289';
import { openVolumeCache, cacheKey, textureCacheHandle } from './gpu-volume-cache.js?v=20260928-build289';
import { datasetFingerprint } from './project-file.js?v=20260928-build289';
import { getFilteredSourceAxialBlock, currentFilterSignature, volumeBlockDepth, volumeBlockBudget } from './source-filters.js?v=20260928-build289';
export const gpuVolumeApplied={seriesId:null,signature:''};
export function gpuVolumeDataSignature(){
 const id=(sourceVolume||volume)?.series?.id??null,applied=gpuVolumeApplied.seriesId===id?gpuVolumeApplied.signature:'';
 return applied&&applied===currentFilterSignature()?applied:'';
}
export function filteredSourceSliceProvider(series,blockDepth=null){
 let block=null,start=-1,depth=blockDepth;
 return async z=>{
  depth=depth||volumeBlockDepth(series);
  if(!block||z<start||z>=start+block.coreDepth){start=Math.floor(z/depth)*depth;block=null;block=await getFilteredSourceAxialBlock(start,depth,series,'gpu-volume',volumeBlockBudget())}
  const n=series.rows*series.columns,off=(z-start)*n;return block.data.subarray(off,off+n);
 };
}
export const volumeCacheState={cache:null,failed:false,persistAsked:false};
export async function volumeCache(){
 if(volumeCacheState.cache||volumeCacheState.failed)return volumeCacheState.cache;
 try{volumeCacheState.cache=await openVolumeCache()}catch(e){volumeCacheState.failed=true;console.warn('GPU volume cache unavailable.',e)}
 return volumeCacheState.cache;
}
export async function volumeCacheBudget(){
 const cap=(isIPadRuntime()?1.5:4)*2**30;
 try{const q=(await navigator.storage?.estimate?.())?.quota||0;return Math.max(256*2**20,Math.min(cap,q?q*.3:cap))}catch{return 512*2**20}
}
export function gpuVolumeCacheFor(series,signature){
 return async info=>{
  const cache=await volumeCache();if(!cache)return null;
  const size=info.slices*info.bytesPerSlice,budget=await volumeCacheBudget();
  if(size>budget)return null;
  if(!volumeCacheState.persistAsked){volumeCacheState.persistAsked=true;try{await navigator.storage?.persist?.()}catch{}}
  const key=await cacheKey({dataset:datasetFingerprint(series),filter:signature,plan:info.planSignature,reduced:info.reduced});
  await cache.prune(budget-size,{keep:key});
  return textureCacheHandle(cache,key,{slices:info.slices,bytesPerSlice:info.bytesPerSlice,info:{description:series.description||'',plan:info.planSignature}});
 };
}
export async function updateVolumeCacheControl(){
 if(!volumeCacheClearBtn)return;
 const available=!!sceneState?.medicalVolume,cache=available?await volumeCache():null,bytes=cache?await cache.usage().catch(()=>0):0;
 volumeCacheClearBtn.classList.toggle('is-hidden',!cache);
 volumeCacheClearBtn.textContent=tr('volumeCacheClear')+(bytes?' · '+fmt(bytes):'');
 volumeCacheClearBtn.disabled=!bytes;
}
export function gpuVolumeTarget(){
 const base=sourceVolume||volume,signature=gpuVolumeDataSignature();
 if(!signature||!base?.sourceBacked||!base.series)return base;
 return{...base,filterSignature:signature,sliceData:filteredSourceSliceProvider(base.series),textureCache:gpuVolumeCacheFor(base.series,signature)};
}
export async function refreshGpuVolumeData(){
 const mv=sceneState?.medicalVolume;
 if(!(threeRenderMode==='volume'&&mv?.active))return;
 const wanted=gpuVolumeDataSignature();
 if((mv.dataSignature||'')===wanted||gpuVolumeRefresh.running===wanted){updateVolumeFilterBadge();return}
 const token=++gpuVolumeRefresh.token,target={...gpuVolumeTarget(),isCancelled:()=>token!==gpuVolumeRefresh.token};
 gpuVolumeRefresh.running=wanted;updateVolumeFilterBadge();
 // debug (build 285): total time and per-filter GPU times of the 3D rebuild
 const t0=performance.now();gpuStepTimes.clear();
 try{await mv.ensure(target,gpuVolumePlanOptions());syncGpuVolumeEdits(target);request3DRender();if(mv.lastCacheHit)footer.textContent=tr('volumeCacheLoaded');void updateVolumeCacheControl()
  if(globalThis.__vrlSettings?.debugOn?.()&&!mv.lastCacheHit){const steps=[...gpuStepTimes].map(([n,ms])=>n+' '+(ms/1000).toFixed(1)+'s').join(', ');footer.textContent=(currentLanguage==='ja'?'3D再構築 ':'3D rebuild ')+((performance.now()-t0)/1000).toFixed(1)+'s'+(steps?' · ['+steps+']':'')}}
 catch(e){if(String(e.message||e)!=='__SUPERSEDED__')console.warn('GPU volume filter refresh failed.',e)}
 finally{if(token===gpuVolumeRefresh.token){gpuVolumeRefresh.running=null;set3DBusy(false)}updateVolumeFilterBadge()}
}
export function gpuVolumeEditDescriptors(v=sourceVolume||volume){
 const out={};if(!v)return out;
 for(const key of SEGMENT_PRESET_ORDER){
  const st=segmentEditState[key],seg=segmentState[key];if(!st)continue;
  // post-processed segments (Opening, thin-region suppression, ...): the
  // volume shader only thresholds, so show the processed voxels as a keep mask
  if(seg?.active&&seg.enabled&&segmentNeedsGlobalMask(seg)&&st.baseRuns?.length===v.slices){
   let runs=st.keepRuns?intersectRunArrays(st.baseRuns,st.keepRuns,v.slices):st.baseRuns;
   if(st.excludeRuns)runs=subtractRunArrays(runs,st.excludeRuns,v.slices);
   out[key]={mode:'keep',runs,cutRuns:st.cutRuns};continue;
  }
  if(st.keepRuns){out[key]={mode:'keep',runs:st.excludeRuns?subtractRunArrays(st.keepRuns,st.excludeRuns,v.slices):st.keepRuns,cutRuns:st.cutRuns}}
  else if(st.excludeRuns){out[key]={mode:'exclude',runs:st.excludeRuns,cutRuns:st.cutRuns}}
 }
 return out;
}
// Appends the 3D state to the segment's status line (segment-runs.js owns it;
// DOM access here avoids an import cycle through run-cache.js).
function noteSegment3D(key,text,error){
 const el=typeof document!=='undefined'?document.querySelector('[data-seg-status="'+key+'"]'):null;if(!el||el.classList.contains('is-hidden'))return;
 el.textContent=el.textContent.replace(/ · (3D反映済み|shown in 3D|3D反映エラー: .*|3D error: .*)$/,'')+' · '+text;if(error)el.classList.add('is-error');
}
export function syncGpuVolumeEdits(v=sourceVolume||volume){
 const mv=sceneState?.medicalVolume;if(!mv||!v)return;
 const descs=gpuVolumeEditDescriptors(v),processed=Object.keys(descs).filter(key=>segmentNeedsGlobalMask(segmentState[key]||{}));
 try{mv.setEditRuns(descs,SEGMENT_PRESET_ORDER,v);request3DRender();for(const key of processed)noteSegment3D(key,currentLanguage==='ja'?'3D反映済み':'shown in 3D',false)}
 catch(e){console.error(e);footer.textContent=(currentLanguage==='ja'?'GPU編集マスク更新エラー: ':'GPU edit mask error: ')+String(e.message||e);for(const key of processed)noteSegment3D(key,(currentLanguage==='ja'?'3D反映エラー: ':'3D error: ')+String(e.message||e),true)}
}
export function gpuVolumePlanOptions(){
 if(isIPhoneRuntime())return{maxTextureBytes:96*1024*1024,targetInPlane:0};
 // iPad and desktop: 512 by default (Mac GPUs are no faster than an iPad Air
 // for 3D); 768 or full size (0, desktop only) are explicit choices
 return{maxTextureBytes:0,targetInPlane:ipadGpuTargetSide};
}
