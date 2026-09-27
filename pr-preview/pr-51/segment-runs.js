// Extracted verbatim from app.js by tools/extract-module.mjs.
// Depends only on the imports below; never imports from app.js (no cycles).
import { segmentState, segmentNeedsGlobalMask, sourceMprMemoryView, getProcessedSegmentMask, segmentEditState } from './segments.js?v=20260927-build244';
import { activeId, filterRebuildRevision, sourceVolume, current3DVolume, volume, currentLanguage } from './state.js?v=20260927-build244';
import { sourceFilterRuntime, sourceFilterSignature, sourceFilterStages, sourceFilterHalo, readSourceRegion, runSourceFilterWorker, fitSourceTile, getCachedSourceSlice } from './source-filters.js?v=20260927-build244';
import { ensureGpuFilterDevice, gpuValidationScope, setGpuComputeBackend, runGpuSourceFilters, gpuFilterRuntime, gpuStagesSupported } from './gpu-compute.js?v=20260927-build244';
import { isNativeDicomTransferSyntax } from './dicom.js?v=20260927-build244';
import { extractSourceThresholdRuns } from './medical-volume.js?v=20260927-build244';
import { valuesToSegmentBits } from './mask-ops.js?v=20260927-build244';
import { state } from './ui-shell.js?v=20260927-build244';
import dicomParser from 'https://esm.sh/dicom-parser@1.8.21';
import { maskToAnalysisRuns, postprocessSourceRuns, intersectRunArrays, subtractRunArrays } from './run-length.js?v=20260927-build244';
import { frameYield } from './utils.js?v=20260927-build244';
import { BODY_MIN_HU } from './thin-suppress.js?v=20260927-build244';
import { setProcessingBusy } from './busy.js?v=20260927-build244';
import { segmentRunsCacheKey, loadCachedSegmentRuns, storeCachedSegmentRuns } from './run-cache.js?v=20260927-build244';
export async function processSourceRegionMasks(series,target,stages,key,revision,segments){
 const halo=sourceFilterHalo(stages),x0=Math.max(0,target.x-halo),y0=Math.max(0,target.y-halo),z0=Math.max(0,target.z-halo),x1=Math.min(series.columns,target.x+target.width+halo),y1=Math.min(series.rows,target.y+target.height+halo),z1=Math.min(series.slices.length,target.z+target.depth+halo);
 const box={x:x0,y:y0,z:z0,width:x1-x0,height:y1-y0,depth:z1-z0},data=await readSourceRegion(series,box,revision,true);
 if(revision!==sourceFilterRuntime.revision)throw new Error('__SUPERSEDED__');
 const localTarget={x:target.x-x0,y:target.y-y0,z:target.z-z0,width:target.width,height:target.height,depth:target.depth};
 if(gpuStagesSupported(stages)){
  try{
   const bits=await runGpuSourceFilters(data,box.width,box.height,box.depth,sourceVolume.min,sourceVolume.max,stages,localTarget,segments);
   if(bits instanceof Uint32Array){if(revision!==sourceFilterRuntime.revision)throw new Error('__SUPERSEDED__');return bits}
  }catch(e){
   gpuFilterRuntime.lastError='mask: '+String(e?.message||e);if(!gpuFilterRuntime.warned){console.warn('WebGPU mask execution failed; using exact CPU mask path.',e);gpuFilterRuntime.warned=true}
  }
 }
 setGpuComputeBackend(gpuFilterRuntime.lastError?'CPU WORKER · GPU FAIL':'CPU WORKER',gpuFilterRuntime.lastError);
 const message={type:'process',id:++sourceFilterRuntime.nextId,buffer:data.buffer,w:box.width,h:box.height,d:box.depth,min:sourceVolume.min,max:sourceVolume.max,stages,target:localTarget};
 const values=await runSourceFilterWorker(message,key);
 if(revision!==sourceFilterRuntime.revision)throw new Error('__SUPERSEDED__');
 return valuesToSegmentBits(values,segments);
}
export async function getFilteredSourceAxialMaskBlock(zStart,coreDepth,series,segments,keyPrefix='3d-mask-block'){
 const stages=sourceFilterStages();if(!stages.length)return null;
 const revision=sourceFilterRuntime.revision,w=series.columns,h=series.rows,d=series.slices.length,halo=sourceFilterHalo(stages),outDepth=Math.min(d-zStart,coreDepth+(zStart+coreDepth<d?1:0));
 const out=new Uint32Array(w*h*outDepth),[tx,ty]=fitSourceTile(w,h,outDepth,halo,384,128);
 for(let y=0;y<h;y+=ty)for(let x=0;x<w;x+=tx){
  if(revision!==sourceFilterRuntime.revision)throw new Error('__SUPERSEDED__');
  const tw=Math.min(tx,w-x),th=Math.min(ty,h-y),tile=await processSourceRegionMasks(series,{x,y,z:zStart,width:tw,height:th,depth:outDepth},stages,keyPrefix+':'+zStart,revision,segments);
  for(let zz=0;zz<outDepth;zz++)for(let yy=0;yy<th;yy++){
   const src=(zz*th+yy)*tw,dst=(zz*h+y+yy)*w+x;
   out.set(tile.subarray(src,src+tw),dst);
  }
 }
 if(revision!==sourceFilterRuntime.revision)throw new Error('__SUPERSEDED__');
 return{data:out,depth:outDepth,coreDepth:Math.min(coreDepth,d-zStart)};
}
export async function sourceSegmentMaskBlock(v,key,seg,zStart,depth,analysisRevision){
 const series=v.series,stages=sourceFilterStages(),coreDepth=Math.min(depth,series.slices.length-zStart);
 if(stages.length){
  const block=await getFilteredSourceAxialMaskBlock(zStart,coreDepth,series,[{key,seg}],'analysis:'+analysisRevision);
  if(analysisRevision!==sourceFilterRuntime.revision)throw new Error('__SUPERSEDED__');
  const masks=[];
  for(let z=0;z<block.coreDepth;z++){
   const bits=block.data.subarray(z*series.columns*series.rows,(z+1)*series.columns*series.rows),mask=new Uint8Array(bits.length);
   for(let i=0;i<bits.length;i++)mask[i]=(bits[i]&1)?1:0;
   masks.push(mask);
  }
  return masks;
 }
 const masks=[];
 for(let z=0;z<coreDepth;z++){
  if(analysisRevision!==sourceFilterRuntime.revision)throw new Error('__SUPERSEDED__');
  const state=(await decodeSourceSegmentMasks(series.slices[zStart+z],[{key,seg}])).get(key);masks.push(state.mask);
 }
 return masks;
}
export function sourceAnalysisBlockDepth(w,h){
 const preferred=navigator.maxTouchPoints>0?4:16,maxGroups=65535,workgroupSize=256,plane=Math.max(1,w*h),safe=Math.max(1,Math.floor(maxGroups*workgroupSize/plane));
 return Math.max(1,Math.min(preferred,safe));
}
export async function sourceSegmentRunBlockGpu(v,key,seg,zStart,depth,analysisRevision){
 const series=v.series,stages=sourceFilterStages(),coreDepth=Math.min(depth,series.slices.length-zStart),device=await ensureGpuFilterDevice();if(!device)throw new Error('__GPU_ANALYSIS_UNAVAILABLE__');
 const maxGroups=Number(device.limits?.maxComputeWorkgroupsPerDimension)||65535;if(Math.ceil(series.columns*series.rows*coreDepth/256)>maxGroups)throw new Error('__GPU_ANALYSIS_UNAVAILABLE__');
 let rawError=null;
 if(!stages.length&&series.slices.slice(zStart,zStart+coreDepth).every(meta=>isNativeDicomTransferSyntax(meta.ts))){
  try{
   const raw=await gpuValidationScope(device,'raw DICOM analysis RLE',()=>extractSourceThresholdRuns(device,series,zStart,coreDepth,seg));
   if(raw){setGpuComputeBackend('WEBGPU ANALYSIS RAW-RLE');return raw}
  }catch(e){rawError=e;console.warn('Raw DICOM GPU RLE unavailable; retrying decoded CT on WebGPU.',e)}
 }
 const halo=sourceFilterHalo(stages),z0=Math.max(0,zStart-halo),z1=Math.min(series.slices.length,zStart+coreDepth+halo),box={x:0,y:0,z:z0,width:series.columns,height:series.rows,depth:z1-z0},data=await readSourceRegion(series,box,analysisRevision,true);
 if(analysisRevision!==sourceFilterRuntime.revision)throw new Error('__SUPERSEDED__');
 const target={x:0,y:0,z:zStart-z0,width:series.columns,height:series.rows,depth:coreDepth};
 try{
  const result=await gpuValidationScope(device,'decoded CT analysis RLE',()=>runGpuSourceFilters(data,box.width,box.height,box.depth,v.min,v.max,stages,target,[{key,seg}],{analysisRuns:true}));
  if(!result?.analysisRuns)throw new Error('__GPU_ANALYSIS_UNAVAILABLE__');
  setGpuComputeBackend(stages.length?'WEBGPU ANALYSIS FILTER+RLE':'WEBGPU ANALYSIS DECODED-RLE',rawError?.message||null);
  return{items:result.items,coreDepth};
 }catch(e){
  if(rawError&&String(e.message||e)==='__GPU_ANALYSIS_UNAVAILABLE__')gpuFilterRuntime.lastError='raw RLE: '+String(rawError.message||rawError);
  throw e;
 }
}
export function segmentBaseSignature(key,v){
 const s=segmentState[key];return [activeId,key,s.min,s.max,s.opening,s.closing,s.minComponent,s.holeFill,s.surfaceMm,s.thicknessMm,filterRebuildRevision,sourceFilterRuntime.revision,v?.columns,v?.rows,v?.slices].join('|');
}
export function thresholdRunsFromMemory(v,seg){
 const w=v.columns,h=v.rows,d=v.slices,out=new Array(d),plane=w*h;
 if(segmentNeedsGlobalMask(seg))return maskToAnalysisRuns(getProcessedSegmentMask(v,seg),w,h,d);
 for(let z=0;z<d;z++){const rec=[],base=z*plane;for(let y=0;y<h;y++){let x=0,row=base+y*w;while(x<w){while(x<w&&(v.data[row+x]<seg.min||v.data[row+x]>seg.max))x++;if(x>=w)break;const x0=x;while(x+1<w&&v.data[row+x+1]>=seg.min&&v.data[row+x+1]<=seg.max)x++;rec.push(y,x0,x);x++}}out[z]=new Uint32Array(rec)}
 return out;
}
export async function sourceRunsForSegment(v,key,seg,onProgress=null,alive=()=>true){
 if(segmentNeedsGlobalMask(seg)&&v.mprData){
  const memoryView=sourceMprMemoryView(v);
  return thresholdRunsFromMemory(memoryView,seg);
 }
 const d=v.slices,w=v.columns,h=v.rows,out=Array.from({length:d},()=>new Uint32Array(0)),revision=sourceFilterRuntime.revision,blockDepth=sourceAnalysisBlockDepth(w,h);
 onProgress?.(0,d);
 for(let z0=0;z0<d;z0+=blockDepth){
  if(!alive())throw new Error('__SUPERSEDED__');
  let gpu=null;try{gpu=await sourceSegmentRunBlockGpu(v,key,seg,z0,blockDepth,revision)}catch(e){console.warn('Edit base GPU RLE failed; using exact CPU RLE path.',e)}
  if(gpu){
   const per=Array.from({length:gpu.coreDepth},()=>[]);
   for(let i=0;i<gpu.items.length;i+=4){const lz=gpu.items[i];if(lz<per.length)per[lz].push(gpu.items[i+1],gpu.items[i+2],gpu.items[i+3])}
   for(let z=0;z<gpu.coreDepth;z++)out[z0+z]=new Uint32Array(per[z]);
  }else{
   const masks=await sourceSegmentMaskBlock(v,key,seg,z0,blockDepth,revision);
   for(let z=0;z<masks.length;z++)out[z0+z]=maskToAnalysisRuns(masks[z],w,h,1)[0];
  }
  onProgress?.(Math.min(d,z0+blockDepth),d,'threshold');
  if((z0&63)===0)await frameYield();
 }
 if(!segmentNeedsGlobalMask(seg))return out;
 const bodyRuns=(+seg.surfaceMm||0)>0?await sourceBodyRuns(v,(a,b)=>onProgress?.(a,b,'body')):null;
 if(!alive())throw new Error('__SUPERSEDED__');
 return postprocessSourceRuns(out,v,seg,bodyRuns,alive,(a,b)=>onProgress?.(a,b,'thin'));
}
// Body mask runs (voxels at or above BODY_MIN_HU, filters applied) for the
// surface exclusion; one per data/filter state, also cached on the device.
const bodyRunsMemo={signature:'',promise:null};
export function sourceBodyRuns(v,onProgress=null){
 const sig=[activeId,filterRebuildRevision,sourceFilterRuntime.revision,v.columns,v.rows,v.slices].join('|');
 if(bodyRunsMemo.signature===sig&&bodyRunsMemo.promise)return bodyRunsMemo.promise;
 const body={min:BODY_MIN_HU,max:Math.max(BODY_MIN_HU,v.max),opening:0,closing:0,minComponent:0,holeFill:false,surfaceMm:0,thicknessMm:0};
 const promise=(async()=>{
  const k=v.series?await segmentRunsCacheKey(v.series,sourceFilterSignature(sourceFilterStages()),body).catch(()=>null):null;
  if(k)try{const hit=await loadCachedSegmentRuns(k,v.slices);if(hit)return hit}catch{}
  const runs=await sourceRunsForSegment(v,'body',body,onProgress);
  if(k)void storeCachedSegmentRuns(k,runs);
  return runs;
 })();
 bodyRunsMemo.signature=sig;bodyRunsMemo.promise=promise;
 promise.catch(()=>{if(bodyRunsMemo.promise===promise){bodyRunsMemo.signature='';bodyRunsMemo.promise=null}});
 return promise;
}
// Visible per-segment status in the segment card (the global progress bar
// lives on the data tab and is not visible while the segment settings are).
const PHASE_LABELS={ja:{threshold:'しきい値',body:'空気の判定',thin:'薄い領域の除去'},en:{threshold:'threshold',body:'air mask',thin:'thin-region removal'}};
export function setSegmentStatus(key,text,kind=''){
 const el=document.querySelector('[data-seg-status="'+key+'"]');if(!el)return;
 el.textContent=text||'';el.classList.toggle('is-hidden',!text);el.classList.toggle('is-error',kind==='error');el.classList.toggle('is-done',kind==='done');
}
function segmentStatusProgress(key,seg){
 const ja=currentLanguage==='ja',labels=PHASE_LABELS[ja?'ja':'en'],t0=performance.now();
 const phases=['threshold',...((+seg.surfaceMm||0)>0?['body']:[]),...(((+seg.surfaceMm||0)>0||(+seg.thicknessMm||0)>0)?['thin']:[])];
 return (done,total,phase='threshold')=>{
  const i=Math.max(0,phases.indexOf(phase)),pct=total?Math.round(100*done/total):0,sec=Math.round((performance.now()-t0)/1000);
  setSegmentStatus(key,(ja?'処理中 ':'Processing ')+(i+1)+'/'+phases.length+' '+(labels[phase]||phase)+' '+pct+'% · '+sec+(ja?'秒':'s'));
 };
}
export async function ensureSegmentBaseRuns(key,v=current3DVolume||volume,onProgress=null,quiet=false){
 if(!v||!segmentState[key])return null;const st=segmentEditState[key],sig=segmentBaseSignature(key,v);
 if(st.baseRuns&&st.baseSignature===sig)return st.baseRuns;
 // One computation per signature: a click during the background prewarm
 // waits for it (and receives its progress) instead of starting a second pass.
 if(st.pendingBase?.signature===sig){if(onProgress)st.pendingBase.listeners.add(onProgress);return st.pendingBase.promise}
 const pending={signature:sig,listeners:new Set(onProgress?[onProgress]:[]),promise:null},report=(done,total)=>{for(const fn of pending.listeners)fn(done,total)};
 pending.promise=(async()=>{
  if(!quiet)setProcessingBusy(true,currentLanguage==='ja'?'編集領域を準備中':'Preparing editable segment',false);
  const ja=currentLanguage==='ja',t0=performance.now(),statusProgress=segmentNeedsGlobalMask(segmentState[key])?segmentStatusProgress(key,segmentState[key]):null;
  if(statusProgress){pending.listeners.add(statusProgress);statusProgress(0,1,'threshold')}
  try{
   // Source-backed volumes: reuse runs stored on the device by an earlier
   // session with the same data, filters and segment settings (run-cache.js).
   const seg=segmentState[key],cacheKeyPromise=v.sourceBacked&&v.series?segmentRunsCacheKey(v.series,sourceFilterSignature(sourceFilterStages()),seg).catch(()=>null):null;
   let runs=null;
   if(cacheKeyPromise){const k=await cacheKeyPromise;if(k)try{runs=await loadCachedSegmentRuns(k,v.slices);if(runs)report(v.slices,v.slices,'thin')}catch{runs=null}}
   if(!runs){
    // settings changed meanwhile: stop instead of finishing a stale pass
    const alive=()=>segmentBaseSignature(key,v)===sig;
    runs=v.sourceBacked?await sourceRunsForSegment(v,key,seg,report,alive):thresholdRunsFromMemory(v,seg);
    if(cacheKeyPromise&&st.pendingBase===pending)void cacheKeyPromise.then(k=>k&&storeCachedSegmentRuns(k,runs));
   }
   if(st.pendingBase===pending){st.baseRuns=runs;st.baseSignature=sig}
   if(statusProgress)setSegmentStatus(key,(ja?'処理完了 · ':'Done · ')+Math.round((performance.now()-t0)/1000)+(ja?'秒':'s'),'done');
   return runs;
  }
  catch(e){
   if(statusProgress){
    if(String(e?.message||e)==='__SUPERSEDED__')setSegmentStatus(key,ja?'設定が変わったため中断（新しい設定で再計算）':'Stopped: settings changed (recomputing)');
    else setSegmentStatus(key,(ja?'エラー: ':'Error: ')+String(e?.message||e),'error');
   }
   throw e;
  }
  finally{if(st.pendingBase===pending)st.pendingBase=null;if(!quiet)setProcessingBusy(false,'',false)}
 })();
 st.pendingBase=pending;return pending.promise;
}
export async function getFinalSegmentRuns(key,v=current3DVolume||volume,onProgress=null){
 const st=segmentEditState[key],base=await ensureSegmentBaseRuns(key,v,onProgress);if(!base)return null;let runs=base,d=v.slices;
 if(st.keepRuns)runs=intersectRunArrays(runs,st.keepRuns,d);
 if(st.excludeRuns)runs=subtractRunArrays(runs,st.excludeRuns,d);
 st.finalRuns=runs;return runs;
}
export async function decodeSourceSegmentMasks(meta,segments){
 if(!isNativeDicomTransferSyntax(meta.ts)){
  const values=await getCachedSourceSlice(meta),n=meta.rows*meta.columns,blockSize=16384,states=new Map(segments.map(({key,seg})=>[key,{mask:new Uint8Array(n),blocks:[],block:new Uint32Array(blockSize),used:0,min:seg.min,max:seg.max}]));
  for(let i=0;i<n;i++){const value=values[i];for(const state of states.values())if(value>=state.min&&value<=state.max){state.mask[i]=1;if(state.used===state.block.length){state.blocks.push(state.block);state.block=new Uint32Array(blockSize);state.used=0}state.block[state.used++]=i}}
  for(const state of states.values()){if(state.used)state.blocks.push(state.block.subarray(0,state.used));state.block=null;delete state.used;delete state.min;delete state.max}
  return states;
 }
 const bpp=meta.bits===8?1:meta.bits===16?2:0;
 if(!bpp)throw new Error('Unsupported BitsAllocated='+meta.bits);
 let bytes,offset=meta.pixelOffset;
 if(offset!=null){
  bytes=new Uint8Array(await meta.file.slice(offset,offset+meta.rows*meta.columns*bpp).arrayBuffer());
  offset=0;
 }else{
  const all=new Uint8Array(await meta.file.arrayBuffer()),ds=dicomParser.parseDicom(all),el=ds.elements.x7fe00010;
  if(!el)throw new Error('Pixel Data missing');bytes=all;offset=el.dataOffset;
 }
 const little=meta.ts!=='1.2.840.10008.1.2.2',view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),n=meta.rows*meta.columns,blockSize=16384;
 const states=new Map(segments.map(({key,seg})=>[key,{mask:new Uint8Array(n),blocks:[],block:new Uint32Array(blockSize),used:0,min:seg.min,max:seg.max}]));
 const pushIndex=(state,i)=>{
  if(state.used===state.block.length){state.blocks.push(state.block);state.block=new Uint32Array(blockSize);state.used=0}
  state.block[state.used++]=i;
 };
 for(let i=0;i<n;i++){
  let raw;
  if(meta.bits===8){raw=bytes[offset+i];if(meta.signed&&raw>127)raw-=256}
  else raw=meta.signed?view.getInt16(offset+i*2,little):view.getUint16(offset+i*2,little);
  const value=Math.fround(raw*meta.slope+meta.intercept);
  for(const state of states.values()){
   if(value>=state.min&&value<=state.max){state.mask[i]=1;pushIndex(state,i)}
  }
 }
 for(const state of states.values()){
  if(state.used)state.blocks.push(state.block.subarray(0,state.used));
  state.block=null;delete state.used;delete state.min;delete state.max;
 }
 return states;
}
