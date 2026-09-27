// Extracted verbatim from app.js by tools/extract-module.mjs.
// Depends only on the imports below; never imports from app.js (no cycles).
import { sourceVolume, volume, sceneState, currentLanguage, threeRenderMode, ipadGpuTargetSide } from './state.js?v=20260927-build235';
import { currentFilterSignature } from './mpr-render.js?v=20260927-build235';
import { SEGMENT_PRESET_ORDER, segmentEditState } from './segments.js?v=20260927-build235';
import { request3DRender, gpuVolumeRefresh, updateVolumeFilterBadge, set3DBusy } from './scene3d.js?v=20260927-build235';
import { footer, volumeCacheClearBtn } from './ui-shell.js?v=20260927-build235';
import { subtractRunArrays } from './run-length.js?v=20260927-build235';
import { tr } from './i18n.js?v=20260927-build235';
import { fmt, isIPadRuntime, isIPhoneRuntime } from './utils.js?v=20260927-build235';
import { openVolumeCache, cacheKey, textureCacheHandle } from './gpu-volume-cache.js?v=20260927-build235';
import { datasetFingerprint } from './project-file.js?v=20260927-build235';
import { getFilteredSourceAxialBlock } from './source-filters.js?v=20260927-build235';
export const gpuVolumeApplied={seriesId:null,signature:''};
export function gpuVolumeDataSignature(){
 const id=(sourceVolume||volume)?.series?.id??null,applied=gpuVolumeApplied.seriesId===id?gpuVolumeApplied.signature:'';
 return applied&&applied===currentFilterSignature()?applied:'';
}
export function filteredSourceSliceProvider(series,blockDepth=8){
 let block=null,start=-1;
 return async z=>{
  if(!block||z<start||z>=start+block.coreDepth){start=Math.floor(z/blockDepth)*blockDepth;block=await getFilteredSourceAxialBlock(start,blockDepth,series,'gpu-volume')}
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
 try{await mv.ensure(target,gpuVolumePlanOptions());syncGpuVolumeEdits(target);request3DRender();if(mv.lastCacheHit)footer.textContent=tr('volumeCacheLoaded');void updateVolumeCacheControl()}
 catch(e){if(String(e.message||e)!=='__SUPERSEDED__')console.warn('GPU volume filter refresh failed.',e)}
 finally{if(token===gpuVolumeRefresh.token){gpuVolumeRefresh.running=null;set3DBusy(false)}updateVolumeFilterBadge()}
}
export function gpuVolumeEditDescriptors(v=sourceVolume||volume){
 const out={};if(!v)return out;
 for(const key of SEGMENT_PRESET_ORDER){
  const st=segmentEditState[key];if(!st)continue;
  if(st.keepRuns){out[key]={mode:'keep',runs:st.excludeRuns?subtractRunArrays(st.keepRuns,st.excludeRuns,v.slices):st.keepRuns,cutRuns:st.cutRuns}}
  else if(st.excludeRuns){out[key]={mode:'exclude',runs:st.excludeRuns,cutRuns:st.cutRuns}}
 }
 return out;
}
export function syncGpuVolumeEdits(v=sourceVolume||volume){
 const mv=sceneState?.medicalVolume;if(!mv||!v)return;
 try{mv.setEditRuns(gpuVolumeEditDescriptors(v),SEGMENT_PRESET_ORDER,v);request3DRender()}
 catch(e){console.error(e);footer.textContent=(currentLanguage==='ja'?'GPU編集マスク更新エラー: ':'GPU edit mask error: ')+String(e.message||e)}
}
export function gpuVolumePlanOptions(){
 if(isIPadRuntime())return{maxTextureBytes:0,targetInPlane:ipadGpuTargetSide};
 if(isIPhoneRuntime())return{maxTextureBytes:96*1024*1024,targetInPlane:0};
 return{maxTextureBytes:0,targetInPlane:0};
}
