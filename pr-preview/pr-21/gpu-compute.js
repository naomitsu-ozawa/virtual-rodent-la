// Extracted verbatim from app.js by tools/extract-module.mjs.
// Depends only on the imports below; never imports from app.js (no cycles).
import { setGpuPrewarmIndex, setGpuPrewarmScheduled, sceneState } from './state.js?v=20260926-build194';
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.186.0/build/three.webgpu.js';
import { normalizeVrlWgsl, gpuFilterShader, GPU_PREWARM_KINDS } from './gpu-shaders.js?v=20260926-build194';
import { isDesktopMac } from './utils.js?v=20260926-build194';
import { surfaceSmoothingActive, strongSurfaceSmoothingActive } from './settings.js?v=20260926-build194';
import { surfaceSmoothStrength, status } from './ui-shell.js?v=20260926-build194';
export const gpuFilterRuntime={device:null,adapter:null,initPromise:null,disabled:false,pipelines:new Map(),warned:false,lastBackend:'CPU',lastError:'',adapterLabel:'',retryAfter:0,initAttempts:0,bufferPool:new Map(),bufferPoolBytes:0,sharedRendererDevice:false,workgroupSize:128,lastShaderKind:''};
export function gpuAdapterLabel(adapter){
 try{
  const info=adapter?.info;if(!info)return'';
  return [...new Set([info.vendor,info.architecture,info.device,info.description].filter(Boolean).map(v=>String(v).trim()).filter(Boolean))].join(' ');
 }catch{return''}
}
export function gpuDeviceMode(device){return device?.features?.has?.('core-features-and-limits')?'CORE':'COMPAT'}
export function gpuComputeWorkgroupSize(device=gpuFilterRuntime.device){
 const a=Number(device?.limits?.maxComputeInvocationsPerWorkgroup)||128,b=Number(device?.limits?.maxComputeWorkgroupSizeX)||a;
 const cap=Math.max(1,Math.min(256,a,b));return cap>=256?256:cap>=128?128:cap>=64?64:Math.max(1,cap);
}
export function gpuDeviceRequestDescriptor(adapter){
 const requiredFeatures=[];if(adapter?.features?.has?.('core-features-and-limits'))requiredFeatures.push('core-features-and-limits');
 const requiredLimits={};
 if((adapter?.limits?.maxComputeInvocationsPerWorkgroup||0)>=256)requiredLimits.maxComputeInvocationsPerWorkgroup=256;
 if((adapter?.limits?.maxComputeWorkgroupSizeX||0)>=256)requiredLimits.maxComputeWorkgroupSizeX=256;
 const maxBufferSize=Number(adapter?.limits?.maxBufferSize)||0;if(maxBufferSize>0)requiredLimits.maxBufferSize=maxBufferSize;
 const maxStorageBufferBindingSize=Number(adapter?.limits?.maxStorageBufferBindingSize)||0;if(maxStorageBufferBindingSize>0)requiredLimits.maxStorageBufferBindingSize=maxStorageBufferBindingSize;
 return{requiredFeatures,requiredLimits};
}
export async function requestVrlGpuAdapter(){
 let adapter=null;
 try{adapter=await navigator.gpu.requestAdapter({powerPreference:'high-performance',featureLevel:'core'})}catch{}
 if(!adapter)try{adapter=await navigator.gpu.requestAdapter({powerPreference:'high-performance'})}catch{}
 if(!adapter)try{adapter=await navigator.gpu.requestAdapter()}catch{}
 return adapter;
}
export async function requestVrlGpuDevice(){
 const adapter=await requestVrlGpuAdapter();if(!adapter)throw new Error('WebGPU core adapter unavailable');
 const device=await adapter.requestDevice(gpuDeviceRequestDescriptor(adapter));
 return{adapter,device};
}
export function updateGpuStatus(){
 if(!status)return;
 const render=sceneState?.backend||'INIT';
 const compute=gpuFilterRuntime.lastBackend||(gpuFilterRuntime.device?'WEBGPU READY':'CPU');
 const adapter=gpuFilterRuntime.adapterLabel?(' · '+gpuFilterRuntime.adapterLabel):'';
 const failure=/FAIL|ERROR|LOST/.test(compute)&&gpuFilterRuntime.lastError?(' · '+gpuFilterRuntime.lastError.slice(0,96)):'';
 status.removeAttribute('data-i18n');
 status.textContent='Render '+render+' · Compute '+compute+failure+adapter;
 const computeGpu=compute.startsWith('WEBGPU'),gpuActive=render==='WEBGPU'||computeGpu;
 status.className=gpuActive?'status status-ok':'status status-warning';
 status.title=gpuFilterRuntime.lastError||'';
}
export function setGpuComputeBackend(label,error=''){
 gpuFilterRuntime.lastBackend=label;
 if(error)gpuFilterRuntime.lastError=String(error);
 else if(label.startsWith('WEBGPU'))gpuFilterRuntime.lastError='';
 updateGpuStatus();
}
export function installGpuErrorListener(device){
 if(!device||device.__vrlErrorListenerInstalled)return;
 try{
  device.__vrlErrorListenerInstalled=true;
  device.addEventListener?.('uncapturederror',event=>{
   const message=String(event?.error?.message||event?.message||'uncaptured WebGPU error'),kind=gpuFilterRuntime.lastShaderKind?(' ['+gpuFilterRuntime.lastShaderKind+']'):'';
   gpuFilterRuntime.lastError='uncaptured'+kind+': '+message;
   setGpuComputeBackend('WEBGPU GPU FAIL',gpuFilterRuntime.lastError);
   console.error('Virtual Rodent Lab WebGPU error:',event?.error||event);
  });
 }catch{}
}
export async function gpuValidationScope(device,label,fn){
 if(!device?.pushErrorScope||!device?.popErrorScope)return fn();
 let popped=false;device.pushErrorScope('validation');
 try{
  const result=await fn(),validation=await device.popErrorScope();popped=true;
  if(validation)throw new Error(label+': '+validation.message);
  return result;
 }catch(e){
  if(!popped){
   try{const validation=await device.popErrorScope();popped=true;if(validation&&!String(e?.message||e).includes(validation.message))throw new Error(label+': '+validation.message+' | '+String(e?.message||e))}catch(scopeError){if(scopeError!==e)throw scopeError}
  }
  throw e;
 }
}
export const GPU_FILTER_KEYS=new Set(['gaussian','sigmoid','spikeHole','unsharp','anisotropic','tv','bilateral','nlm']);
export function gpuStagesSupported(stages){
 return stages.every(stage=>GPU_FILTER_KEYS.has(stage.key));
}
export function gpuPoolLimit(){return navigator.maxTouchPoints>0?64*1024*1024:(isDesktopMac()?256:192)*1024*1024}
export function gpuBufferBucketSize(bytes){
 let size=4096;while(size<bytes)size*=2;return size;
}
export function acquireGpuWorkBuffer(device,bytes){
 const size=gpuBufferBucketSize(bytes),bucket=gpuFilterRuntime.bufferPool.get(size);
 if(bucket?.length){const buffer=bucket.pop();gpuFilterRuntime.bufferPoolBytes-=size;return{buffer,size}}
 return{buffer:device.createBuffer({size,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),size};
}
export function releaseGpuWorkBuffer(buffer,size){
 if(!buffer||gpuFilterRuntime.sharedRendererDevice&&gpuFilterRuntime.device?.lost===undefined){try{buffer?.destroy?.()}catch{};return}
 const limit=gpuPoolLimit();
 if(size>limit/2||gpuFilterRuntime.bufferPoolBytes+size>limit){try{buffer.destroy()}catch{};return}
 let bucket=gpuFilterRuntime.bufferPool.get(size);if(!bucket){bucket=[];gpuFilterRuntime.bufferPool.set(size,bucket)}
 if(bucket.length>=2){try{buffer.destroy()}catch{};return}
 bucket.push(buffer);gpuFilterRuntime.bufferPoolBytes+=size;
}
export function clearGpuBufferPool(){
 for(const bucket of gpuFilterRuntime.bufferPool.values())for(const buffer of bucket){try{buffer.destroy()}catch{}}
 gpuFilterRuntime.bufferPool.clear();gpuFilterRuntime.bufferPoolBytes=0;
}
export async function verifyGpuComputeDevice(device){
 if(!device)return false;const wg=gpuComputeWorkgroupSize(device);gpuFilterRuntime.workgroupSize=wg;
 const out=device.createBuffer({size:4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC}),read=device.createBuffer({size:4,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
 try{
  const code=`struct TestBuffer {
 data : array<u32, 1>
}
@group(0) @binding(0) var<storage, read_write> testBuffer : TestBuffer;
@compute @workgroup_size(${wg})
fn main(@builtin(local_invocation_index) localIndex : u32) {
 if (localIndex == 0u) {
  testBuffer.data[0] = 7u;
 }
}`;
  const module=device.createShaderModule({label:'VRL compute self-test',code});
  if(typeof module.getCompilationInfo==='function'){const info=await module.getCompilationInfo(),errors=(info.messages||[]).filter(m=>m.type==='error');if(errors.length)throw new Error('self-test WGSL: '+errors.map(m=>m.message).join(' | '))}
  const pipeline=await gpuValidationScope(device,'compute self-test pipeline',async()=>device.createComputePipelineAsync?await device.createComputePipelineAsync({layout:'auto',compute:{module,entryPoint:'main'}}):device.createComputePipeline({layout:'auto',compute:{module,entryPoint:'main'}}));
  const group=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:out}}]}),encoder=device.createCommandEncoder({label:'VRL compute self-test'}),pass=encoder.beginComputePass();
  pass.setPipeline(pipeline);pass.setBindGroup(0,group);pass.dispatchWorkgroups(1);pass.end();encoder.copyBufferToBuffer(out,0,read,0,4);device.queue.submit([encoder.finish()]);
  await read.mapAsync(GPUMapMode.READ);const value=new Uint32Array(read.getMappedRange().slice(0))[0];read.unmap();
  if(value!==7)throw new Error('compute self-test readback mismatch: '+value);
  return true;
 }finally{try{out.destroy()}catch{}try{read.destroy()}catch{}}
}
export function adoptRendererGpuDevice(renderer,adapter=null,explicitDevice=null){
 const device=explicitDevice||renderer?.backend?.device;
 if(!device||typeof device.createBuffer!=='function'||gpuFilterRuntime.device===device)return false;
 clearGpuBufferPool();gpuFilterRuntime.pipelines.clear();gpuFilterRuntime.device=device;gpuFilterRuntime.adapter=adapter;gpuFilterRuntime.disabled=false;gpuFilterRuntime.sharedRendererDevice=true;gpuFilterRuntime.initPromise=null;gpuFilterRuntime.retryAfter=0;gpuFilterRuntime.lastError='';gpuFilterRuntime.adapterLabel=gpuAdapterLabel(adapter);gpuFilterRuntime.lastBackend='WEBGPU CHECKING';gpuFilterRuntime.workgroupSize=gpuComputeWorkgroupSize(device);setGpuPrewarmIndex(0);setGpuPrewarmScheduled(false);installGpuErrorListener(device);
 try{device.lost.then(()=>{if(gpuFilterRuntime.device===device){gpuFilterRuntime.device=null;gpuFilterRuntime.sharedRendererDevice=false;gpuFilterRuntime.pipelines.clear();clearGpuBufferPool();setGpuPrewarmIndex(0);setGpuPrewarmScheduled(false);setGpuComputeBackend('GPU DEVICE LOST','WebGPU device lost')}})}catch{}
 void verifyGpuComputeDevice(device).then(async ok=>{if(gpuFilterRuntime.device===device&&ok){await verifyGpuPipelineSet();if(gpuFilterRuntime.device===device)setGpuComputeBackend('WEBGPU '+gpuDeviceMode(device)+' FULL VERIFIED · WG'+gpuFilterRuntime.workgroupSize)}}).catch(e=>{if(gpuFilterRuntime.device===device){gpuFilterRuntime.lastError='verify ['+(gpuFilterRuntime.lastShaderKind||'self-test')+']: '+String(e?.message||e);setGpuComputeBackend('WEBGPU RENDER ONLY · COMPUTE FAIL',gpuFilterRuntime.lastError)}});
 updateGpuStatus();return true;
}
export async function ensureGpuFilterDevice(){
 if(!('gpu' in navigator)){gpuFilterRuntime.disabled=true;setGpuComputeBackend('CPU · WebGPU unavailable','navigator.gpu is unavailable');return null}
 gpuFilterRuntime.disabled=false;
 if(gpuFilterRuntime.device)return gpuFilterRuntime.device;
 // Safari/iPad can refuse a second adapter request even while the Three.js WebGPU
 // renderer already owns a valid GPUDevice. Reuse that renderer device first.
 const rendererDevice=sceneState?.renderer?.backend?.device;
 if(rendererDevice&&typeof rendererDevice.createBuffer==='function'){
  adoptRendererGpuDevice(sceneState.renderer,gpuFilterRuntime.adapter,rendererDevice);
  if(gpuFilterRuntime.device)return gpuFilterRuntime.device;
 }
 if(gpuFilterRuntime.initPromise)return gpuFilterRuntime.initPromise;
 const now=performance.now();if(gpuFilterRuntime.retryAfter>now)return null;
 gpuFilterRuntime.initPromise=(async()=>{
  gpuFilterRuntime.initAttempts++;setGpuComputeBackend('WEBGPU CHECKING');
  try{
   const {adapter,device}=await requestVrlGpuDevice();
   gpuFilterRuntime.adapter=adapter;gpuFilterRuntime.device=device;gpuFilterRuntime.sharedRendererDevice=false;gpuFilterRuntime.adapterLabel=gpuAdapterLabel(adapter);gpuFilterRuntime.retryAfter=0;gpuFilterRuntime.lastError='';gpuFilterRuntime.warned=false;gpuFilterRuntime.workgroupSize=gpuComputeWorkgroupSize(device);installGpuErrorListener(device);setGpuComputeBackend('WEBGPU CHECKING');
   device.lost.then(info=>{if(gpuFilterRuntime.device===device){gpuFilterRuntime.device=null;gpuFilterRuntime.pipelines.clear();clearGpuBufferPool();setGpuPrewarmIndex(0);setGpuPrewarmScheduled(false);gpuFilterRuntime.retryAfter=performance.now()+2000;setGpuComputeBackend('GPU DEVICE LOST',info?.message||'WebGPU device lost')}});
   try{await verifyGpuComputeDevice(device);await verifyGpuPipelineSet();setGpuComputeBackend('WEBGPU '+gpuDeviceMode(device)+' FULL VERIFIED · WG'+gpuFilterRuntime.workgroupSize)}catch(testError){gpuFilterRuntime.lastError='verify ['+(gpuFilterRuntime.lastShaderKind||'self-test')+']: '+String(testError?.message||testError);setGpuComputeBackend('WEBGPU COMPUTE FAIL',gpuFilterRuntime.lastError);throw testError}
   return device;
  }catch(e){
   gpuFilterRuntime.device=null;gpuFilterRuntime.adapter=null;gpuFilterRuntime.sharedRendererDevice=false;gpuFilterRuntime.retryAfter=performance.now()+5000;
   setGpuComputeBackend('CPU COMPUTE · GPU ERROR',e?.message||e);
   console.warn('WebGPU compute unavailable for this attempt; exact CPU compute path active. GPU will be retried.',e);
   return null;
  }finally{gpuFilterRuntime.initPromise=null}
 })();
 return gpuFilterRuntime.initPromise;
}
export async function gpuFilterPipeline(kind){
 const device=await ensureGpuFilterDevice();if(!device)return null;
 if(gpuFilterRuntime.pipelines.has(kind))return gpuFilterRuntime.pipelines.get(kind);
 gpuFilterRuntime.lastShaderKind=kind;
 const source=normalizeVrlWgsl(gpuFilterShader(kind,gpuFilterRuntime.workgroupSize)),module=device.createShaderModule({code:source,label:'VRL '+kind+' compute'});
 if(typeof module.getCompilationInfo==='function'){
  const info=await module.getCompilationInfo(),errors=(info.messages||[]).filter(m=>m.type==='error');
  if(errors.length)throw new Error('WGSL '+kind+': '+errors.map(m=>m.message).join(' | '));
 }
 const desc={layout:'auto',compute:{module,entryPoint:'main'},label:'VRL '+kind};
 const pipeline=await gpuValidationScope(device,'pipeline '+kind,async()=>device.createComputePipelineAsync?await device.createComputePipelineAsync(desc):device.createComputePipeline(desc));
 gpuFilterRuntime.pipelines.set(kind,pipeline);return pipeline;
}
export async function verifyGpuPipelineSet(){
 for(const kind of GPU_PREWARM_KINDS){
  gpuFilterRuntime.lastShaderKind=kind;
  await gpuFilterPipeline(kind);
 }
 gpuFilterRuntime.lastShaderKind='';
 return true;
}
export function gpuSmallBuffer(device,data){
 const buffer=device.createBuffer({size:Math.max(32,Math.ceil(data.byteLength/4)*4),usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});
 device.queue.writeBuffer(buffer,0,data);return buffer;
}
export function createGpuResidentFloat3Attribute(device,vertexCount,label){
 const renderer=sceneState?.renderer,backend=renderer?.backend;
 if(sceneState?.backend!=='WEBGPU'||backend?.device!==device||typeof backend.set!=='function')return null;
 try{
  const attribute=new THREE.Float32BufferAttribute(new Float32Array(vertexCount*3),3);attribute.name=label;
  const buffer=device.createBuffer({label,size:Math.max(4,attribute.array.byteLength),usage:GPUBufferUsage.STORAGE|GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST});
  backend.set(attribute,{buffer});return{attribute,buffer};
 }catch(e){console.warn('GPU-resident attribute allocation failed.',e);return null}
}
export function destroyGpuResidentAttribute(entry){
 if(!entry)return;
 const backend=sceneState?.renderer?.backend;
 try{if(backend?.get(entry.attribute)?.buffer===entry.buffer&&typeof backend.destroyAttribute==='function')backend.destroyAttribute(entry.attribute);else entry.buffer?.destroy?.()}catch{try{entry.buffer?.destroy?.()}catch{}}
}
export function finishGpuResidentTemps(device,cleanup){
 let completion;
 try{completion=device.queue.onSubmittedWorkDone()}catch{cleanup();return Promise.resolve()}
 completion.then(cleanup,cleanup);return completion;
}
export async function runGpuSourceFilters(data,w,h,d,minv,maxv,stages,target,segments=null,faceContext=null){
 const device=await ensureGpuFilterDevice();if(!device||!gpuStagesSupported(stages))return null;
 const bytes=data.byteLength,n=data.length;
 if(bytes>device.limits.maxStorageBufferBindingSize)return null;
 const aw=acquireGpuWorkBuffer(device,bytes),bw=acquireGpuWorkBuffer(device,bytes),a=aw.buffer,b=bw.buffer;device.queue.writeBuffer(a,0,data);
 const small=[];let encoder=device.createCommandEncoder({label:'VRL filter chunk'});let current=a,next=b;
 const dispatch=async(kind,extraU32=[],paramsF32=[])=>{
  const pipeline=await gpuFilterPipeline(kind);if(!pipeline)throw new Error('GPU pipeline unavailable: '+kind);
  const meta=new Uint32Array(8);meta[0]=w;meta[1]=h;meta[2]=d;meta[3]=n;for(let i=0;i<extraU32.length&&i<4;i++)meta[4+i]=extraU32[i]>>>0;
  const params=new Float32Array(8);for(let i=0;i<paramsF32.length&&i<8;i++)params[i]=paramsF32[i];
  const mb=gpuSmallBuffer(device,meta),pb=gpuSmallBuffer(device,params);small.push(mb,pb);
  const bind=pipeline.getBindGroupLayout(0);
  const group=device.createBindGroup({layout:bind,entries:[
   {binding:0,resource:{buffer:current}},{binding:1,resource:{buffer:next}},{binding:2,resource:{buffer:mb}},{binding:3,resource:{buffer:pb}}
  ]});
  const pass=encoder.beginComputePass();pass.setPipeline(pipeline);pass.setBindGroup(0,group);pass.dispatchWorkgroups(Math.ceil(n/gpuFilterRuntime.workgroupSize));pass.end();
  const t=current;current=next;next=t;
 };
 for(const stage of stages){
  const p=stage.params;
  if(stage.key==='gaussian'){
   if(p.mode==='median'){
    for(let round=0;round<Math.max(1,Math.round(p.passes));round++)await dispatch('median',[],[p.strength]);
   }else{
    for(let round=0;round<Math.max(1,Math.round(p.passes));round++)for(let axis=0;axis<3;axis++)await dispatch('gaussian',[axis],[p.strength]);
   }
  }else if(stage.key==='sigmoid')await dispatch('sigmoid',[],[minv,maxv,p.strength,p.center]);
  else if(stage.key==='spikeHole')await dispatch('spikeHole',[],[minv,maxv,p.strength,p.threshold]);
  else if(stage.key==='anisotropic')for(let iter=0;iter<Math.max(1,Math.round(p.iterations));iter++)await dispatch('anisotropic',[],[minv,maxv,p.strength]);
  else if(stage.key==='tv')for(let iter=0;iter<Math.max(1,Math.round(p.iterations));iter++)await dispatch('tv',[],[minv,maxv,p.weight]);
  else if(stage.key==='unsharp')await dispatch('unsharp',[Math.max(1,Math.round(p.radius))],[minv,maxv,p.amount,p.threshold]);
  else if(stage.key==='bilateral'){
   const radius=Math.max(1,Math.min(3,Math.ceil(p.spatialSigma*1.5)));
   for(let pass=0;pass<Math.max(1,Math.round(p.passes));pass++)await dispatch('bilateral',[radius],[minv,maxv,p.strength,p.spatialSigma,p.intensitySigma]);
  }else if(stage.key==='nlm')await dispatch('nlm',[Math.max(1,Math.round(p.searchRadius)),Math.max(0,Math.round(p.patchRadius))],[minv,maxv,p.strength]);
  else return null;
 }
 if(segments?.length&&faceContext?.analysisRuns){
  const targetCount=target.width*target.height*target.depth,meta=new Uint32Array(12);
  meta[0]=w;meta[1]=h;meta[2]=d;meta[3]=target.x;meta[4]=target.y;meta[5]=target.z;meta[6]=target.width;meta[7]=target.height;meta[8]=target.depth;meta[9]=targetCount;
  const thresholds=new Float32Array([segments[0].seg.min,segments[0].seg.max,0,0]),mb=gpuSmallBuffer(device,meta),tb=gpuSmallBuffer(device,thresholds),counter=device.createBuffer({size:4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST});small.push(mb,tb);device.queue.writeBuffer(counter,0,new Uint32Array([0]));
  const countPipeline=await gpuFilterPipeline('analysisRunCount'),countGroup=device.createBindGroup({layout:countPipeline.getBindGroupLayout(0),entries:[
   {binding:0,resource:{buffer:current}},{binding:2,resource:{buffer:mb}},{binding:3,resource:{buffer:tb}},{binding:4,resource:{buffer:counter}}
  ]});
  const countPass=encoder.beginComputePass();countPass.setPipeline(countPipeline);countPass.setBindGroup(0,countGroup);countPass.dispatchWorkgroups(Math.ceil(targetCount/gpuFilterRuntime.workgroupSize));countPass.end();
  const countRead=device.createBuffer({size:4,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});encoder.copyBufferToBuffer(counter,0,countRead,0,4);device.queue.submit([encoder.finish()]);
  await countRead.mapAsync(GPUMapMode.READ);const runCount=new Uint32Array(countRead.getMappedRange().slice(0))[0];countRead.unmap();countRead.destroy();
  if(!runCount){releaseGpuWorkBuffer(a,aw.size);releaseGpuWorkBuffer(b,bw.size);counter.destroy();for(const buf of small)buf.destroy();setGpuComputeBackend('WEBGPU ANALYSIS RLE');return{analysisRuns:true,items:new Uint32Array(0),count:0}}
  const recordBytes=runCount*16,maxOut=Math.min(device.limits.maxStorageBufferBindingSize,device.limits.maxBufferSize||device.limits.maxStorageBufferBindingSize);
  if(recordBytes>maxOut){releaseGpuWorkBuffer(a,aw.size);releaseGpuWorkBuffer(b,bw.size);counter.destroy();for(const buf of small)buf.destroy();throw new Error('GPU analysis run output exceeds device buffer limit')}
  const records=device.createBuffer({size:recordBytes,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC}),readback=device.createBuffer({size:recordBytes,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});device.queue.writeBuffer(counter,0,new Uint32Array([0]));
  const writePipeline=await gpuFilterPipeline('analysisRunWrite'),writeGroup=device.createBindGroup({layout:writePipeline.getBindGroupLayout(0),entries:[
   {binding:0,resource:{buffer:current}},{binding:1,resource:{buffer:records}},{binding:2,resource:{buffer:mb}},{binding:3,resource:{buffer:tb}},{binding:4,resource:{buffer:counter}}
  ]}),writeEncoder=device.createCommandEncoder({label:'VRL analysis RLE'});
  const writePass=writeEncoder.beginComputePass();writePass.setPipeline(writePipeline);writePass.setBindGroup(0,writeGroup);writePass.dispatchWorkgroups(Math.ceil(targetCount/gpuFilterRuntime.workgroupSize));writePass.end();writeEncoder.copyBufferToBuffer(records,0,readback,0,recordBytes);device.queue.submit([writeEncoder.finish()]);
  await readback.mapAsync(GPUMapMode.READ);const items=new Uint32Array(readback.getMappedRange().slice(0));readback.unmap();
  releaseGpuWorkBuffer(a,aw.size);releaseGpuWorkBuffer(b,bw.size);counter.destroy();records.destroy();readback.destroy();for(const buf of small)buf.destroy();setGpuComputeBackend('WEBGPU ANALYSIS RLE');return{analysisRuns:true,items,count:runCount};
 }
 if(segments?.length&&faceContext?.mesh){
  const targetCount=target.width*target.height*target.depth,meta=new Uint32Array(24);
  meta[0]=w;meta[1]=h;meta[2]=d;meta[3]=target.x;meta[4]=target.y;meta[5]=target.z;meta[6]=target.width;meta[7]=target.height;meta[8]=target.depth;meta[9]=targetCount;meta[10]=Math.min(segments.length,4);
  meta[11]=faceContext.boxX;meta[12]=faceContext.boxY;meta[13]=faceContext.boxZ;meta[14]=faceContext.globalW;meta[15]=faceContext.globalH;meta[16]=faceContext.globalD;
  const thresholds=new Float32Array(8);for(let i=0;i<meta[10];i++){thresholds[i*2]=segments[i].seg.min;thresholds[i*2+1]=segments[i].seg.max}
  const mb=gpuSmallBuffer(device,meta),tb=gpuSmallBuffer(device,thresholds);small.push(mb,tb);
  const counters=device.createBuffer({size:16,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST});device.queue.writeBuffer(counters,0,new Uint32Array(4));
  const countPipeline=await gpuFilterPipeline('meshCount'),countGroup=device.createBindGroup({layout:countPipeline.getBindGroupLayout(0),entries:[
   {binding:0,resource:{buffer:current}},{binding:2,resource:{buffer:mb}},{binding:3,resource:{buffer:tb}},{binding:4,resource:{buffer:counters}}
  ]});
  const cp=encoder.beginComputePass();cp.setPipeline(countPipeline);cp.setBindGroup(0,countGroup);cp.dispatchWorkgroups(Math.ceil(targetCount/gpuFilterRuntime.workgroupSize));cp.end();
  const countRead=device.createBuffer({size:16,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});encoder.copyBufferToBuffer(counters,0,countRead,0,16);device.queue.submit([encoder.finish()]);
  await countRead.mapAsync(GPUMapMode.READ);const counts=new Uint32Array(countRead.getMappedRange().slice(0));countRead.unmap();countRead.destroy();
  const totalFaces=counts[0]+counts[1]+counts[2]+counts[3],vertexBytes=totalFaces*18*4,maxOut=Math.min(device.limits.maxStorageBufferBindingSize,device.limits.maxBufferSize||device.limits.maxStorageBufferBindingSize);
  if(totalFaces===0){
   releaseGpuWorkBuffer(a,aw.size);releaseGpuWorkBuffer(b,bw.size);counters.destroy();for(const buf of small)buf.destroy();setGpuComputeBackend('WEBGPU FILTER+MESH');return{mesh:true,vertices:new Float32Array(0),counts};
  }
  if(vertexBytes<=maxOut){
   let offset=0;for(let i=0;i<4;i++){meta[17+i]=offset;offset+=counts[i]}device.queue.writeBuffer(mb,0,meta);device.queue.writeBuffer(counters,0,new Uint32Array(4));
   const vertexCount=totalFaces*6,gpuSmooth=surfaceSmoothingActive()&&!strongSurfaceSmoothingActive(),smoothStrength=gpuSmooth?Number(surfaceSmoothStrength.value):0;
   const allowGpuResident=faceContext?.gpuResident!==false;
   let residentPosition=allowGpuResident?createGpuResidentFloat3Attribute(device,vertexCount,'VRL GPU resident position'):null,residentNormal=allowGpuResident&&gpuSmooth?createGpuResidentFloat3Attribute(device,vertexCount,'VRL GPU resident normal'):null;
   let gpuResident=allowGpuResident&&!!residentPosition&&(!gpuSmooth||!!residentNormal);
   if(!gpuResident){destroyGpuResidentAttribute(residentPosition);destroyGpuResidentAttribute(residentNormal);residentPosition=residentNormal=null}
   const output=gpuResident?residentPosition.buffer:device.createBuffer({size:vertexBytes,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC});
   const normalOutput=gpuSmooth?(gpuResident?residentNormal.buffer:device.createBuffer({size:vertexBytes,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC})):null;
   const sx=faceContext.spacingX,sy=faceContext.spacingY,sz=faceContext.spacingZ,px=faceContext.globalW*sx,py=faceContext.globalH*sy,pz=faceContext.globalD*sz,scale=3.3/Math.max(px,py,pz,1);
   const gb=gpuSmallBuffer(device,new Float32Array([sx,sy,sz,scale,px,py,pz,0]));small.push(gb);
   let cornerA=null,cornerB=null,cornerCurrent=null;
   if(gpuSmooth){
    const cornerCount=(target.width+1)*(target.height+1)*(target.depth+1)*meta[10],cornerBytes=cornerCount*16;
    if(cornerBytes>maxOut){
     if(gpuResident){destroyGpuResidentAttribute(residentPosition);destroyGpuResidentAttribute(residentNormal)}else{output.destroy();normalOutput?.destroy()}
     releaseGpuWorkBuffer(a,aw.size);releaseGpuWorkBuffer(b,bw.size);counters.destroy();for(const buf of small)buf.destroy();throw new Error('__GPU_SMOOTH_CAPACITY__')
    }
    cornerA=device.createBuffer({size:Math.max(16,cornerBytes),usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST});
    cornerB=device.createBuffer({size:Math.max(16,cornerBytes),usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST});
    const initPipeline=await gpuFilterPipeline('meshCornerInit'),initGroup=device.createBindGroup({layout:initPipeline.getBindGroupLayout(0),entries:[
     {binding:0,resource:{buffer:current}},{binding:1,resource:{buffer:cornerA}},{binding:2,resource:{buffer:mb}},{binding:3,resource:{buffer:tb}},{binding:5,resource:{buffer:gb}}
    ]});
    await gpuValidationScope(device,'mesh corner init',async()=>{const initEncoder=device.createCommandEncoder({label:'VRL GPU corner init'}),pass=initEncoder.beginComputePass();pass.setPipeline(initPipeline);pass.setBindGroup(0,initGroup);pass.dispatchWorkgroups(Math.ceil(cornerCount/gpuFilterRuntime.workgroupSize));pass.end();device.queue.submit([initEncoder.finish()])});
    const baseStrength=Math.min(smoothStrength,1),lambda=.34*baseStrength,mu=-.36*baseStrength,iterations=Math.max(1,Math.round(smoothStrength<=1?2+smoothStrength*4:smoothStrength<=3?6+(smoothStrength-1)*18:42+(smoothStrength-3)*24));
    const smoothPipeline=await gpuFilterPipeline('meshCornerSmooth'),pbLambda=gpuSmallBuffer(device,new Float32Array([lambda,0,0,0])),pbMu=gpuSmallBuffer(device,new Float32Array([mu,0,0,0]));small.push(pbLambda,pbMu);let srcCorner=cornerA,dstCorner=cornerB;
    for(let k=0;k<iterations;k++)for(const pbSmooth of [pbLambda,pbMu]){
     const smoothGroup=device.createBindGroup({layout:smoothPipeline.getBindGroupLayout(0),entries:[
      {binding:0,resource:{buffer:srcCorner}},{binding:1,resource:{buffer:dstCorner}},{binding:2,resource:{buffer:mb}},{binding:3,resource:{buffer:pbSmooth}}
     ]});
     await gpuValidationScope(device,'mesh smooth pass',async()=>{const smoothEncoder=device.createCommandEncoder({label:'VRL GPU smooth pass'}),pass=smoothEncoder.beginComputePass();pass.setPipeline(smoothPipeline);pass.setBindGroup(0,smoothGroup);pass.dispatchWorkgroups(Math.ceil(cornerCount/gpuFilterRuntime.workgroupSize));pass.end();device.queue.submit([smoothEncoder.finish()])});
     const t=srcCorner;srcCorner=dstCorner;dstCorner=t;
    }
    cornerCurrent=srcCorner;
   }
   const writeEncoder=device.createCommandEncoder({label:gpuSmooth?'VRL GPU mesh write smooth':'VRL GPU mesh vertices'});
   const writeKind=gpuSmooth?'meshWriteSmooth':'meshWrite',writePipeline=await gpuFilterPipeline(writeKind),entries=[
    {binding:0,resource:{buffer:current}},{binding:1,resource:{buffer:output}},{binding:2,resource:{buffer:mb}},{binding:3,resource:{buffer:tb}},{binding:4,resource:{buffer:counters}}
   ];
   entries.push({binding:5,resource:{buffer:gpuSmooth?cornerCurrent:gb}});if(gpuSmooth)entries.push({binding:6,resource:{buffer:normalOutput}});
   const writeGroup=device.createBindGroup({layout:writePipeline.getBindGroupLayout(0),entries}),wp=writeEncoder.beginComputePass();wp.setPipeline(writePipeline);wp.setBindGroup(0,writeGroup);wp.dispatchWorkgroups(Math.ceil(targetCount/gpuFilterRuntime.workgroupSize));wp.end();
   if(gpuResident){
    device.queue.submit([writeEncoder.finish()]);
    const cleanup=()=>{cornerA?.destroy();cornerB?.destroy();releaseGpuWorkBuffer(a,aw.size);releaseGpuWorkBuffer(b,bw.size);counters.destroy();for(const buf of small)buf.destroy()};
    const completion=finishGpuResidentTemps(device,cleanup);
    setGpuComputeBackend(gpuSmooth?'WEBGPU GPU-RESIDENT MESH+SMOOTH':'WEBGPU GPU-RESIDENT MESH');
    return{mesh:true,gpuResident:true,positionAttribute:residentPosition.attribute,normalAttribute:residentNormal?.attribute||null,counts,gpuSmoothed:gpuSmooth,completion};
   }
   const readback=device.createBuffer({size:vertexBytes,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),normalReadback=gpuSmooth?device.createBuffer({size:vertexBytes,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}):null;writeEncoder.copyBufferToBuffer(output,0,readback,0,vertexBytes);if(gpuSmooth)writeEncoder.copyBufferToBuffer(normalOutput,0,normalReadback,0,vertexBytes);device.queue.submit([writeEncoder.finish()]);
   await readback.mapAsync(GPUMapMode.READ);const vertices=new Float32Array(readback.getMappedRange().slice(0));readback.unmap();let normals=null;if(gpuSmooth){await normalReadback.mapAsync(GPUMapMode.READ);normals=new Float32Array(normalReadback.getMappedRange().slice(0));normalReadback.unmap()}
   output.destroy();normalOutput?.destroy();readback.destroy();normalReadback?.destroy();cornerA?.destroy();cornerB?.destroy();releaseGpuWorkBuffer(a,aw.size);releaseGpuWorkBuffer(b,bw.size);counters.destroy();for(const buf of small)buf.destroy();
   setGpuComputeBackend(gpuSmooth?'WEBGPU FILTER+MESH+SMOOTH':'WEBGPU FILTER+MESH');return{mesh:true,vertices,normals,counts,gpuSmoothed:gpuSmooth};
  }
  counters.destroy();
  encoder=device.createCommandEncoder({label:'VRL compact face extraction'});
  // Oversized vertex output falls through to compact-face extraction using the already filtered GPU buffer.
 }
 const targetCount=target.width*target.height*target.depth,compactFaces=!!(segments?.length&&faceContext),targetBytes=targetCount*(compactFaces?8:4);
 const targetBuffer=device.createBuffer({size:Math.max(4,targetBytes),usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC});
 const extractMeta=new Uint32Array(20);extractMeta[0]=w;extractMeta[1]=h;extractMeta[2]=d;extractMeta[3]=target.x;extractMeta[4]=target.y;extractMeta[5]=target.z;extractMeta[6]=target.width;extractMeta[7]=target.height;extractMeta[8]=target.depth;extractMeta[9]=targetCount;
 let extractPipeline,extractGroup,counter=null,counterReadback=null;
 const emb=gpuSmallBuffer(device,extractMeta);small.push(emb);
 if(segments?.length){
  extractMeta[10]=Math.min(segments.length,4);
  if(faceContext){
   extractMeta[11]=faceContext.boxX;extractMeta[12]=faceContext.boxY;extractMeta[13]=faceContext.boxZ;
   extractMeta[14]=faceContext.globalW;extractMeta[15]=faceContext.globalH;extractMeta[16]=faceContext.globalD;
  }
  device.queue.writeBuffer(emb,0,extractMeta);
  const thresholdValues=new Float32Array(8);
  for(let i=0;i<Math.min(segments.length,4);i++){thresholdValues[i*2]=segments[i].seg.min;thresholdValues[i*2+1]=segments[i].seg.max}
  const tb=gpuSmallBuffer(device,thresholdValues);small.push(tb);
  extractPipeline=await gpuFilterPipeline(compactFaces?'faceCompact':'maskExtract');
  const entries=[{binding:0,resource:{buffer:current}},{binding:1,resource:{buffer:targetBuffer}},{binding:2,resource:{buffer:emb}},{binding:3,resource:{buffer:tb}}];
  if(compactFaces){
   counter=device.createBuffer({size:4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST});
   device.queue.writeBuffer(counter,0,new Uint32Array([0]));
   entries.push({binding:4,resource:{buffer:counter}});
  }
  extractGroup=device.createBindGroup({layout:extractPipeline.getBindGroupLayout(0),entries});
 }else{
  extractPipeline=await gpuFilterPipeline('extract');
  extractGroup=device.createBindGroup({layout:extractPipeline.getBindGroupLayout(0),entries:[
   {binding:0,resource:{buffer:current}},{binding:1,resource:{buffer:targetBuffer}},{binding:2,resource:{buffer:emb}}
  ]});
 }
 const ep=encoder.beginComputePass();ep.setPipeline(extractPipeline);ep.setBindGroup(0,extractGroup);ep.dispatchWorkgroups(Math.ceil(targetCount/gpuFilterRuntime.workgroupSize));ep.end();
 if(compactFaces){
  counterReadback=device.createBuffer({size:4,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
  encoder.copyBufferToBuffer(counter,0,counterReadback,0,4);device.queue.submit([encoder.finish()]);
  await counterReadback.mapAsync(GPUMapMode.READ);const count=Math.min(targetCount,new Uint32Array(counterReadback.getMappedRange().slice(0))[0]);counterReadback.unmap();
  let items=new Uint32Array(0);
  if(count){
   const itemBytes=count*8,readback=device.createBuffer({size:itemBytes,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),copyEncoder=device.createCommandEncoder({label:'VRL compact face readback'});
   copyEncoder.copyBufferToBuffer(targetBuffer,0,readback,0,itemBytes);device.queue.submit([copyEncoder.finish()]);
   await readback.mapAsync(GPUMapMode.READ);items=new Uint32Array(readback.getMappedRange().slice(0));readback.unmap();readback.destroy();
  }
  releaseGpuWorkBuffer(a,aw.size);releaseGpuWorkBuffer(b,bw.size);targetBuffer.destroy();counter.destroy();counterReadback.destroy();for(const buf of small)buf.destroy();
  setGpuComputeBackend('WEBGPU FILTER+COMPACT FACES');return{compact:true,items};
 }
 const readback=device.createBuffer({size:targetBytes,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
 encoder.copyBufferToBuffer(targetBuffer,0,readback,0,targetBytes);device.queue.submit([encoder.finish()]);
 await readback.mapAsync(GPUMapMode.READ);
 const copy=readback.getMappedRange().slice(0),result=segments?.length?new Uint32Array(copy):new Float32Array(copy);readback.unmap();
 releaseGpuWorkBuffer(a,aw.size);releaseGpuWorkBuffer(b,bw.size);targetBuffer.destroy();readback.destroy();for(const buf of small)buf.destroy();
 setGpuComputeBackend(segments?.length?'WEBGPU FILTER+MASK':'WEBGPU COMPUTE');return result;
}
