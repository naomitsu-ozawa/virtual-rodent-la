// Extracted verbatim from app.js by tools/extract-module.mjs.
// Depends only on the imports below; never imports from app.js (no cycles).
import { gpuStagesSupported, runGpuSourceFilters, gpuFilterRuntime, setGpuComputeBackend } from './gpu-compute.js?v=20260927-build271';
import { sourceVolume, filterOrder } from './state.js?v=20260927-build271';
import { ww, spikeHoleStrength, spikeHoleThreshold, nlmStrength, nlmSearchRadius, nlmPatchRadius, anisotropicStrength, anisotropicIterations, smoothingType, gaussianStrength, spatialPasses, sigmoidStrength, sigmoidCenter, bilateralStrength, bilateralSpatial, bilateralIntensity, bilateralPasses, tvWeight, tvIterations, unsharpRadius, unsharpAmount, unsharpThreshold } from './ui-shell.js?v=20260927-build271';
import { frameYield, isIPhoneRuntime, isIPadRuntime, isDesktopMac } from './utils.js?v=20260927-build271';
import { isNativeDicomTransferSyntax } from './dicom.js?v=20260927-build271';
import { decodeSourceSlice, sourceSliceCache } from './volume-io.js?v=20260927-build271';
import { cacheKey } from './gpu-volume-cache.js?v=20260927-build271';
export const memoryFilterPreviewCache={map:new Map(),bytes:0};
export const filterState={spikeHole:false,nlm:false,anisotropic:false,gaussian:false,sigmoid:false,bilateral:false,tv:false,unsharp:false};
export function sourceSliceCacheLimit(){return isIPhoneRuntime()?64*1024*1024:isIPadRuntime()?192*1024*1024:256*1024*1024}
export async function getCachedSourceSlice(meta){
 const hit=sourceSliceCache.map.get(meta);
 if(hit){sourceSliceCache.map.delete(meta);sourceSliceCache.map.set(meta,hit);return hit}
 const data=await decodeSourceSlice(meta);sourceSliceCache.map.set(meta,data);sourceSliceCache.bytes+=data.byteLength;
 const limit=sourceSliceCacheLimit();
 while(sourceSliceCache.bytes>limit&&sourceSliceCache.map.size>1){
  const key=sourceSliceCache.map.keys().next().value,item=sourceSliceCache.map.get(key);sourceSliceCache.map.delete(key);sourceSliceCache.bytes-=item.byteLength;
 }
 return data;
}
export const sourceFilterRuntime={revision:0,workers:[],queue:[],nextId:0,cache:new Map(),cacheBytes:0};
export function sourceFilterWorkerMain(){
 function gaussian(input,w,h,d,p){const n=input.length,s=p.strength,r=Math.max(1,Math.round(p.passes));let a=new Float32Array(input),b=new Float32Array(n);for(let rr=0;rr<r;rr++)for(const [dx,dy,dz] of [[1,0,0],[0,1,0],[0,0,1]]){for(let z=0;z<d;z++)for(let y=0;y<h;y++){const row=z*h*w+y*w;for(let x=0;x<w;x++){const i=row+x,x0=Math.max(0,x-dx),x1=Math.min(w-1,x+dx),y0=Math.max(0,y-dy),y1=Math.min(h-1,y+dy),z0=Math.max(0,z-dz),z1=Math.min(d-1,z+dz),i0=z0*h*w+y0*w+x0,i1=z1*h*w+y1*w+x1,blur=(a[i0]+2*a[i]+a[i1])*.25;b[i]=a[i]*(1-s)+blur*s}}const t=a;a=b;b=t}return a}
 function median(input,w,h,d,p){const n=input.length,s=p.strength,r=Math.max(1,Math.round(p.passes)),vals=new Float32Array(7);let a=new Float32Array(input),b=new Float32Array(n);for(let rr=0;rr<r;rr++){b.set(a);for(let z=1;z<d-1;z++)for(let y=1;y<h-1;y++){const row=z*h*w+y*w;for(let x=1;x<w-1;x++){const i=row+x;vals[0]=a[i];vals[1]=a[i-1];vals[2]=a[i+1];vals[3]=a[i-w];vals[4]=a[i+w];vals[5]=a[i-w*h];vals[6]=a[i+w*h];for(let q=1;q<7;q++){const v=vals[q];let j=q-1;while(j>=0&&vals[j]>v){vals[j+1]=vals[j];j--}vals[j+1]=v}b[i]=a[i]*(1-s)+vals[3]*s}}const t=a;a=b;b=t}return a}
 function spike(input,w,h,d,min,max,p){const out=new Float32Array(input),s=p.strength,range=Math.max(1,max-min),th=range*p.threshold,guard=th*(.55+.35*s),blend=.20+.75*s;for(let z=1;z<d-1;z++)for(let y=1;y<h-1;y++){const row=z*h*w+y*w;for(let x=1;x<w-1;x++){const i=row+x,c=input[i],a=input[i-1],b=input[i+1],c0=input[i-w],d0=input[i+w],e=input[i-w*h],f=input[i+w*h],mean=(a+b+c0+d0+e+f)/6,spread=Math.max(a,b,c0,d0,e,f)-Math.min(a,b,c0,d0,e,f),diff=c-mean;if(spread<=guard&&Math.abs(diff)>th){const target=mean+Math.sign(diff)*th*.08;out[i]=c*(1-blend)+target*blend}}}return out}
 function nlm(input,w,h,d,min,max,p){const out=new Float32Array(input.length),range=Math.max(1,max-min),hp=range*(.018+.11*p.strength),h2=hp*hp,sr=Math.max(1,Math.round(p.searchRadius)),pr=Math.max(0,Math.round(p.patchRadius)),offs=[];for(let dz=-sr;dz<=sr;dz++)for(let dy=-sr;dy<=sr;dy++)for(let dx=-sr;dx<=sr;dx++)if(dx||dy||dz)offs.push([dx,dy,dz]);const patch=[[0,0,0]];for(let r=1;r<=pr;r++)patch.push([r,0,0],[-r,0,0],[0,r,0],[0,-r,0],[0,0,r],[0,0,-r]);const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v)),sample=(x,y,z)=>input[clamp(z,0,d-1)*h*w+clamp(y,0,h-1)*w+clamp(x,0,w-1)];for(let z=0;z<d;z++)for(let y=0;y<h;y++)for(let x=0;x<w;x++){const center=input[z*h*w+y*w+x];let weighted=center,ws=1;for(const [dx,dy,dz] of offs){const nx=x+dx,ny=y+dy,nz=z+dz;if(nx<0||ny<0||nz<0||nx>=w||ny>=h||nz>=d)continue;let dist=0;for(const [px,py,pz] of patch){const dv=sample(x+px,y+py,z+pz)-sample(nx+px,ny+py,nz+pz);dist+=dv*dv}dist/=patch.length;const weight=Math.exp(-dist/Math.max(h2,1e-6));weighted+=weight*input[nz*h*w+ny*w+nx];ws+=weight}out[z*h*w+y*w+x]=weighted/ws}return out}
 function anisotropic(input,w,h,d,min,max,p){const n=input.length,range=Math.max(1,max-min),k=range*(.025+.09*p.strength),k2=k*k,lambda=.06+.14*p.strength,it=Math.max(1,Math.round(p.iterations));let a=new Float32Array(input),b=new Float32Array(n);for(let iter=0;iter<it;iter++){b.set(a);for(let z=1;z<d-1;z++)for(let y=1;y<h-1;y++){const row=z*h*w+y*w;for(let x=1;x<w-1;x++){const i=row+x,c=a[i];let flux=0;for(const nv of [a[i-1],a[i+1],a[i-w],a[i+w],a[i-w*h],a[i+w*h]]){const diff=nv-c;flux+=Math.exp(-(diff*diff)/Math.max(k2,1e-6))*diff}b[i]=c+lambda*flux}}const t=a;a=b;b=t}return a}
 function bilateral(input,w,h,d,min,max,p){const n=input.length,range=Math.max(1,max-min),s=p.strength,ss=p.spatialSigma,is=Math.max(1e-6,p.intensitySigma*range),passes=Math.max(1,Math.round(p.passes)),r=Math.max(1,Math.min(3,Math.ceil(ss*1.5))),sp2=2*ss*ss,int2=2*is*is,offs=[];for(let dz=-r;dz<=r;dz++)for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++)offs.push([dx,dy,dz,Math.exp(-(dx*dx+dy*dy+dz*dz)/sp2)]);let a=new Float32Array(input),b=new Float32Array(n);for(let pass=0;pass<passes;pass++){for(let z=0;z<d;z++)for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=z*h*w+y*w+x,center=a[i];let sum=0,ws=0;for(const [dx,dy,dz,sw] of offs){const xx=x+dx,yy=y+dy,zz=z+dz;if(xx<0||yy<0||zz<0||xx>=w||yy>=h||zz>=d)continue;const j=zz*h*w+yy*w+xx,dv=a[j]-center,ww=sw*Math.exp(-(dv*dv)/int2);sum+=a[j]*ww;ws+=ww}const filtered=ws?sum/ws:center;b[i]=center*(1-s)+filtered*s}const t=a;a=b;b=t}return a}
 function tv(input,w,h,d,min,max,p){const n=input.length,range=Math.max(1,max-min),it=Math.max(1,Math.round(p.iterations)),lambda=Math.min(.18,.02+p.weight*.45),eps=range*1e-4;let a=new Float32Array(input),b=new Float32Array(n);for(let iter=0;iter<it;iter++){b.set(a);for(let z=1;z<d-1;z++)for(let y=1;y<h-1;y++){const row=z*h*w+y*w;for(let x=1;x<w-1;x++){const i=row+x,c=a[i];let flux=0;for(const nv of [a[i-1],a[i+1],a[i-w],a[i+w],a[i-w*h],a[i+w*h]]){const diff=nv-c;flux+=diff/Math.sqrt(diff*diff+eps*eps)}b[i]=c+lambda*flux}}const t=a;a=b;b=t}return a}
 function box(input,w,h,d,radius){const out=new Float32Array(input.length),r=Math.max(1,Math.round(radius));for(let z=0;z<d;z++)for(let y=0;y<h;y++)for(let x=0;x<w;x++){let sum=0,count=0;for(let dz=-r;dz<=r;dz++){const zz=z+dz;if(zz<0||zz>=d)continue;for(let dy=-r;dy<=r;dy++){const yy=y+dy;if(yy<0||yy>=h)continue;for(let dx=-r;dx<=r;dx++){const xx=x+dx;if(xx<0||xx>=w)continue;sum+=input[zz*h*w+yy*w+xx];count++}}}out[z*h*w+y*w+x]=sum/Math.max(1,count)}return out}
 function unsharp(input,w,h,d,min,max,p){const blur=box(input,w,h,d,p.radius),out=new Float32Array(input.length),range=Math.max(1,max-min),th=p.threshold*range;for(let i=0;i<input.length;i++){const detail=input[i]-blur[i];out[i]=Math.abs(detail)>=th?input[i]+p.amount*detail:input[i]}return out}
 function sigmoid(input,min,max,p){const out=new Float32Array(input.length),range=Math.max(1,max-min),gain=2+p.strength*10,cv=Math.max(min,Math.min(max,p.center)),center=(cv-min)/range,lo=1/(1+Math.exp(gain*center)),hi=1/(1+Math.exp(-gain*(1-center))),norm=Math.max(1e-6,hi-lo);for(let i=0;i<input.length;i++){const x=Math.max(0,Math.min(1,(input[i]-min)/range)),y=(1/(1+Math.exp(-gain*(x-center)))-lo)/norm;out[i]=min+Math.max(0,Math.min(1,y))*range}return out}
 function stage(input,w,h,d,min,max,s){const p=s.params;if(s.key==='spikeHole')return spike(input,w,h,d,min,max,p);if(s.key==='nlm')return nlm(input,w,h,d,min,max,p);if(s.key==='anisotropic')return anisotropic(input,w,h,d,min,max,p);if(s.key==='gaussian')return p.mode==='median'?median(input,w,h,d,p):gaussian(input,w,h,d,p);if(s.key==='sigmoid')return sigmoid(input,min,max,p);if(s.key==='bilateral')return bilateral(input,w,h,d,min,max,p);if(s.key==='tv')return tv(input,w,h,d,min,max,p);if(s.key==='unsharp')return unsharp(input,w,h,d,min,max,p);return input}
 function extract(data,w,h,t){const out=new Float32Array(t.width*t.height*t.depth);let q=0;for(let z=0;z<t.depth;z++)for(let y=0;y<t.height;y++){const src=((t.z+z)*h+(t.y+y))*w+t.x;out.set(data.subarray(src,src+t.width),q);q+=t.width}return out}
 onmessage=e=>{const m=e.data||{};if(m.type!=='process')return;try{let data=new Float32Array(m.buffer);for(const s of m.stages)data=stage(data,m.w,m.h,m.d,m.min,m.max,s);const out=extract(data,m.w,m.h,m.target);postMessage({id:m.id,buffer:out.buffer},[out.buffer])}catch(error){postMessage({id:m.id,error:String(error?.message||error)})}};
}
export function sourceFilterStages(){
 return filterOrder.filter(key=>filterState[key]).map(key=>{
  let params={};
  if(key==='spikeHole')params={strength:+spikeHoleStrength.value,threshold:+spikeHoleThreshold.value};
  else if(key==='nlm')params={strength:+nlmStrength.value,searchRadius:+nlmSearchRadius.value,patchRadius:+nlmPatchRadius.value};
  else if(key==='anisotropic')params={strength:+anisotropicStrength.value,iterations:+anisotropicIterations.value};
  else if(key==='gaussian')params={mode:smoothingType.value,strength:+gaussianStrength.value,passes:+spatialPasses.value};
  else if(key==='sigmoid')params={strength:+sigmoidStrength.value,center:+sigmoidCenter.value};
  else if(key==='bilateral')params={strength:+bilateralStrength.value,spatialSigma:+bilateralSpatial.value,intensitySigma:+bilateralIntensity.value,passes:+bilateralPasses.value};
  else if(key==='tv')params={weight:+tvWeight.value,iterations:+tvIterations.value};
  else if(key==='unsharp')params={radius:+unsharpRadius.value,amount:+unsharpAmount.value,threshold:+unsharpThreshold.value};
  return{key,params};
 });
}
export function sourceFilterHalo(stages){
 let halo=0;
 for(const s of stages){
  if(s.key==='spikeHole')halo+=1;
  else if(s.key==='nlm')halo+=Math.max(1,Math.round(s.params.searchRadius))+Math.max(0,Math.round(s.params.patchRadius));
  else if(s.key==='anisotropic')halo+=Math.max(1,Math.round(s.params.iterations));
  else if(s.key==='gaussian')halo+=Math.max(1,Math.round(s.params.passes));
  else if(s.key==='bilateral')halo+=Math.max(1,Math.min(3,Math.ceil(s.params.spatialSigma*1.5)))*Math.max(1,Math.round(s.params.passes));
  else if(s.key==='tv')halo+=Math.max(1,Math.round(s.params.iterations));
  else if(s.key==='unsharp')halo+=Math.max(1,Math.round(s.params.radius));
 }
 return halo;
}
export function sourceFilterSignature(stages=sourceFilterStages()){return JSON.stringify(stages)}
export function sourceFilterCacheLimit(){
 const touch=navigator.maxTouchPoints>0;return touch?48*1024*1024:128*1024*1024;
}
export function sourceFilterCacheGet(key){
 const hit=sourceFilterRuntime.cache.get(key);if(!hit)return null;
 sourceFilterRuntime.cache.delete(key);sourceFilterRuntime.cache.set(key,hit);return hit;
}
export function sourceFilterCacheSet(key,data){
 const copy=data;
 sourceFilterRuntime.cache.set(key,copy);sourceFilterRuntime.cacheBytes+=copy.byteLength;
 const limit=sourceFilterCacheLimit();
 while(sourceFilterRuntime.cacheBytes>limit&&sourceFilterRuntime.cache.size>1){
  const first=sourceFilterRuntime.cache.keys().next().value,item=sourceFilterRuntime.cache.get(first);
  sourceFilterRuntime.cache.delete(first);sourceFilterRuntime.cacheBytes-=item.byteLength;
 }
}
export function createSourceFilterSlot(){
 const source='('+sourceFilterWorkerMain.toString()+')()',url=URL.createObjectURL(new Blob([source],{type:'text/javascript'})),worker=new Worker(url);setTimeout(()=>URL.revokeObjectURL(url),1000);
 const slot={worker,busy:false,current:null};
 worker.onmessage=e=>{const task=slot.current;if(!task)return;slot.current=null;slot.busy=false;if(e.data?.error)task.reject(new Error(e.data.error));else task.resolve(new Float32Array(e.data.buffer));pumpSourceFilterWorkers()};
 worker.onerror=e=>{const task=slot.current;slot.current=null;slot.busy=false;if(task)task.reject(new Error(e.message||'Source filter worker failed'));pumpSourceFilterWorkers()};
 return slot;
}
export function ensureSourceFilterWorkers(){
 if(sourceFilterRuntime.workers.length)return;
 const count=navigator.maxTouchPoints>0?1:Math.min(2,Math.max(1,(navigator.hardwareConcurrency||2)-1));
 for(let i=0;i<count;i++)sourceFilterRuntime.workers.push(createSourceFilterSlot());
}
export function pumpSourceFilterWorkers(){
 ensureSourceFilterWorkers();
 for(const slot of sourceFilterRuntime.workers){
  if(slot.busy)continue;const task=sourceFilterRuntime.queue.shift();if(!task)break;
  slot.busy=true;slot.current=task;
  const m=task.message;slot.worker.postMessage(m,[m.buffer]);
 }
}
export function runSourceFilterWorker(message,key){
 ensureSourceFilterWorkers();
 for(let i=sourceFilterRuntime.queue.length-1;i>=0;i--)if(sourceFilterRuntime.queue[i].key===key){sourceFilterRuntime.queue[i].reject(new Error('__SUPERSEDED__'));sourceFilterRuntime.queue.splice(i,1)}
 return new Promise((resolve,reject)=>{sourceFilterRuntime.queue.push({message,key,resolve,reject});pumpSourceFilterWorkers()});
}
export async function readSourceSubregion(meta,x0,y0,width,height,preferFullSliceCache=false){
 const bpp=meta.bits===8?1:meta.bits===16?2:0;if(!bpp)throw new Error('Unsupported BitsAllocated='+meta.bits);
 if(preferFullSliceCache||!isNativeDicomTransferSyntax(meta.ts)){
  const full=await getCachedSourceSlice(meta),out=new Float32Array(width*height);let q=0;
  for(let y=0;y<height;y++){out.set(full.subarray((y0+y)*meta.columns+x0,(y0+y)*meta.columns+x0+width),q);q+=width}
  return out;
 }
 if(meta.pixelOffset==null){
  const full=await decodeSourceSlice(meta),out=new Float32Array(width*height);let q=0;
  for(let y=0;y<height;y++){out.set(full.subarray((y0+y)*meta.columns+x0,(y0+y)*meta.columns+x0+width),q);q+=width}
  return out;
 }
 const firstPixel=y0*meta.columns+x0,lastPixel=(y0+height-1)*meta.columns+x0+width,start=meta.pixelOffset+firstPixel*bpp,end=meta.pixelOffset+lastPixel*bpp;
 const bytes=new Uint8Array(await meta.file.slice(start,end).arrayBuffer()),view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),little=meta.ts!=='1.2.840.10008.1.2.2',out=new Float32Array(width*height);
 let q=0;
 for(let y=0;y<height;y++){
  const rowBase=y*meta.columns*bpp;
  for(let x=0;x<width;x++){
   const off=rowBase+x*bpp;let raw;
   if(meta.bits===8){raw=bytes[off];if(meta.signed&&raw>127)raw-=256}
   else raw=meta.signed?view.getInt16(off,little):view.getUint16(off,little);
   out[q++]=raw*meta.slope+meta.intercept;
  }
 }
 return out;
}
export async function readSourceRegion(series,box,revision,preferFullSliceCache=false){
 const out=new Float32Array(box.width*box.height*box.depth),plane=box.width*box.height;
 for(let z=0;z<box.depth;z++){
  if(revision!==sourceFilterRuntime.revision)throw new Error('__SUPERSEDED__');
  const part=await readSourceSubregion(series.slices[box.z+z],box.x,box.y,box.width,box.height,preferFullSliceCache);out.set(part,z*plane);
  if((z&1)===1)await frameYield();
 }
 return out;
}
export async function processSourceRegion(series,target,stages,key,revision,preferFullSliceCache=false){
 if(!stages.length)throw new Error('No source filters');
 const halo=sourceFilterHalo(stages),x0=Math.max(0,target.x-halo),y0=Math.max(0,target.y-halo),z0=Math.max(0,target.z-halo),x1=Math.min(series.columns,target.x+target.width+halo),y1=Math.min(series.rows,target.y+target.height+halo),z1=Math.min(series.slices.length,target.z+target.depth+halo);
 const box={x:x0,y:y0,z:z0,width:x1-x0,height:y1-y0,depth:z1-z0},data=await readSourceRegion(series,box,revision,preferFullSliceCache);
 if(revision!==sourceFilterRuntime.revision)throw new Error('__SUPERSEDED__');
 const localTarget={x:target.x-x0,y:target.y-y0,z:target.z-z0,width:target.width,height:target.height,depth:target.depth};
 if(gpuStagesSupported(stages)){
  try{
   const gpuResult=await runGpuSourceFilters(data,box.width,box.height,box.depth,sourceVolume.min,sourceVolume.max,stages,localTarget);
   if(gpuResult){
    if(revision!==sourceFilterRuntime.revision)throw new Error('__SUPERSEDED__');
    return gpuResult;
   }
  }catch(e){
   gpuFilterRuntime.lastError='filter: '+String(e?.message||e);if(!gpuFilterRuntime.warned){console.warn('WebGPU filter execution failed; using CPU worker.',e);gpuFilterRuntime.warned=true}
  }
 }
 setGpuComputeBackend(gpuFilterRuntime.lastError?'CPU WORKER · GPU FAIL':'CPU WORKER',gpuFilterRuntime.lastError);
 const message={type:'process',id:++sourceFilterRuntime.nextId,buffer:data.buffer,w:box.width,h:box.height,d:box.depth,min:sourceVolume.min,max:sourceVolume.max,stages,target:localTarget};
 const result=await runSourceFilterWorker(message,key);
 if(revision!==sourceFilterRuntime.revision)throw new Error('__SUPERSEDED__');return result;
}
export function sourceTileBudget(){
 if(navigator.maxTouchPoints>0)return 8*1024*1024;
 if(isDesktopMac()&&gpuFilterRuntime.device){const cap=Number(gpuFilterRuntime.device.limits?.maxStorageBufferBindingSize)||128*1024*1024;return Math.max(16*1024*1024,Math.min(32*1024*1024,Math.floor(cap*.25)))}
 return 16*1024*1024;
}
export function fitSourceTile(a,b,fixed,halo,startA,startB){
 let ca=Math.max(1,Math.min(a,startA)),cb=Math.max(1,Math.min(b,startB)),budget=sourceTileBudget();
 const bytes=()=>Math.min(a,ca+2*halo)*Math.min(b,cb+2*halo)*Math.max(1,fixed+2*halo)*4;
 while(bytes()>budget&&(ca>16||cb>16)){if(ca>=cb&&ca>16)ca=Math.max(16,Math.floor(ca/2));else if(cb>16)cb=Math.max(16,Math.floor(cb/2));else break}
 return[ca,cb];
}
export async function getFilteredSourcePlaneValues(p,idx,series,keyPrefix='mpr',requestRevision=null){
 const stages=sourceFilterStages();if(!stages.length)return null;const stale=()=>requestRevision!=null&&requestRevision!==planeRenderRevision[p];if(stale())throw new Error('__SUPERSEDED__');
 const signature=sourceFilterSignature(stages),cacheKey=signature+'|'+p+'|'+idx,hit=sourceFilterCacheGet(cacheKey);if(hit)return hit;
 const revision=sourceFilterRuntime.revision,w=series.columns,h=series.rows,d=series.slices.length,halo=sourceFilterHalo(stages);
 let out;
 if(p==='axial'){
  out=new Float32Array(w*h);const [tx,ty]=fitSourceTile(w,h,1,halo,512,192);
  for(let y=0;y<h;y+=ty)for(let x=0;x<w;x+=tx){
   if(revision!==sourceFilterRuntime.revision||stale())throw new Error('__SUPERSEDED__');
   const tw=Math.min(tx,w-x),th=Math.min(ty,h-y),tile=await processSourceRegion(series,{x,y,z:idx,width:tw,height:th,depth:1},stages,keyPrefix+':axial',revision,true);
   for(let yy=0;yy<th;yy++)out.set(tile.subarray(yy*tw,(yy+1)*tw),(y+yy)*w+x);
  }
 }else if(p==='coronal'){
  out=new Float32Array(w*d);const [tx,tz]=fitSourceTile(w,d,1,halo,512,32);
  for(let z=0;z<d;z+=tz)for(let x=0;x<w;x+=tx){
   if(revision!==sourceFilterRuntime.revision||stale())throw new Error('__SUPERSEDED__');
   const tw=Math.min(tx,w-x),td=Math.min(tz,d-z),tile=await processSourceRegion(series,{x,y:idx,z,width:tw,height:1,depth:td},stages,keyPrefix+':coronal',revision);
   for(let zz=0;zz<td;zz++)out.set(tile.subarray(zz*tw,(zz+1)*tw),(d-1-(z+zz))*w+x);
  }
 }else{
  out=new Float32Array(h*d);const [ty,tz]=fitSourceTile(h,d,1,halo,512,32);
  for(let z=0;z<d;z+=tz)for(let y=0;y<h;y+=ty){
   if(revision!==sourceFilterRuntime.revision||stale())throw new Error('__SUPERSEDED__');
   const th=Math.min(ty,h-y),td=Math.min(tz,d-z),tile=await processSourceRegion(series,{x:idx,y,z,width:1,height:th,depth:td},stages,keyPrefix+':sagittal',revision);
   for(let zz=0;zz<td;zz++)for(let yy=0;yy<th;yy++)out[(d-1-(z+zz))*h+y+yy]=tile[zz*th+yy];
  }
 }
 if(revision!==sourceFilterRuntime.revision||stale())throw new Error('__SUPERSEDED__');sourceFilterCacheSet(cacheKey,out);return out;
}
export async function getFilteredSourceAxialBlock(zStart,coreDepth,series,keyPrefix='3d-block'){
 const stages=sourceFilterStages();if(!stages.length)return null;
 const revision=sourceFilterRuntime.revision,w=series.columns,h=series.rows,d=series.slices.length,halo=sourceFilterHalo(stages),outDepth=Math.min(d-zStart,coreDepth+(zStart+coreDepth<d?1:0));
 const out=new Float32Array(w*h*outDepth),[tx,ty]=fitSourceTile(w,h,outDepth,halo,384,128);
 for(let y=0;y<h;y+=ty)for(let x=0;x<w;x+=tx){
  if(revision!==sourceFilterRuntime.revision)throw new Error('__SUPERSEDED__');
  const tw=Math.min(tx,w-x),th=Math.min(ty,h-y),tile=await processSourceRegion(series,{x,y,z:zStart,width:tw,height:th,depth:outDepth},stages,keyPrefix+':'+zStart,revision,true);
  for(let zz=0;zz<outDepth;zz++)for(let yy=0;yy<th;yy++){
   const src=(zz*th+yy)*tw,dst=(zz*h+y+yy)*w+x;
   out.set(tile.subarray(src,src+tw),dst);
  }
 }
 if(revision!==sourceFilterRuntime.revision)throw new Error('__SUPERSEDED__');
 return{data:out,depth:outDepth,coreDepth:Math.min(coreDepth,d-zStart)};
}
export function readMemoryRegion(v,box){
 const out=new Float32Array(box.width*box.height*box.depth),src=v.data,w=v.columns,h=v.rows;let q=0;
 for(let z=0;z<box.depth;z++)for(let y=0;y<box.height;y++){
  const off=((box.z+z)*h+(box.y+y))*w+box.x;
  out.set(src.subarray(off,off+box.width),q);q+=box.width;
 }
 return out;
}
export async function processMemoryRegion(v,target,stages){
 const halo=sourceFilterHalo(stages),x0=Math.max(0,target.x-halo),y0=Math.max(0,target.y-halo),z0=Math.max(0,target.z-halo),x1=Math.min(v.columns,target.x+target.width+halo),y1=Math.min(v.rows,target.y+target.height+halo),z1=Math.min(v.slices,target.z+target.depth+halo);
 const box={x:x0,y:y0,z:z0,width:x1-x0,height:y1-y0,depth:z1-z0},data=readMemoryRegion(v,box),local={x:target.x-x0,y:target.y-y0,z:target.z-z0,width:target.width,height:target.height,depth:target.depth};
 const result=await runGpuSourceFilters(data,box.width,box.height,box.depth,v.min,v.max,stages,local);
 if(!(result instanceof Float32Array))throw new Error('__GPU_UNAVAILABLE__');
 return result;
}
export function memoryPreviewCacheLimit(){return navigator.maxTouchPoints>0?24*1024*1024:64*1024*1024}
export function memoryFilterPreviewGet(key){
 const hit=memoryFilterPreviewCache.map.get(key);if(!hit)return null;
 memoryFilterPreviewCache.map.delete(key);memoryFilterPreviewCache.map.set(key,hit);return hit;
}
export function memoryFilterPreviewSet(key,data){
 const old=memoryFilterPreviewCache.map.get(key);if(old){memoryFilterPreviewCache.bytes-=old.byteLength;memoryFilterPreviewCache.map.delete(key)}
 memoryFilterPreviewCache.map.set(key,data);memoryFilterPreviewCache.bytes+=data.byteLength;
 const limit=memoryPreviewCacheLimit();
 while(memoryFilterPreviewCache.bytes>limit&&memoryFilterPreviewCache.map.size>1){
  const first=memoryFilterPreviewCache.map.keys().next().value,item=memoryFilterPreviewCache.map.get(first);memoryFilterPreviewCache.map.delete(first);memoryFilterPreviewCache.bytes-=item.byteLength;
 }
}
export async function getFilteredMemoryPlaneValues(p,idx,v,requestRevision){
 const stages=sourceFilterStages();if(!stages.length)return null;
 const signature=sourceFilterSignature(stages),cacheKey=signature+'|'+p+'|'+idx,hit=memoryFilterPreviewGet(cacheKey);if(hit)return hit;
 const stale=()=>requestRevision!==planeRenderRevision[p],w=v.columns,h=v.rows,d=v.slices,halo=sourceFilterHalo(stages);let out;
 if(p==='axial'){
  out=new Float32Array(w*h);const [tx,ty]=fitSourceTile(w,h,1,halo,512,192);
  for(let y=0;y<h;y+=ty)for(let x=0;x<w;x+=tx){
   if(stale())throw new Error('__SUPERSEDED__');const tw=Math.min(tx,w-x),th=Math.min(ty,h-y),tile=await processMemoryRegion(v,{x,y,z:idx,width:tw,height:th,depth:1},stages);
   for(let yy=0;yy<th;yy++)out.set(tile.subarray(yy*tw,(yy+1)*tw),(y+yy)*w+x);
  }
 }else if(p==='coronal'){
  out=new Float32Array(w*d);const [tx,tz]=fitSourceTile(w,d,1,halo,512,32);
  for(let z=0;z<d;z+=tz)for(let x=0;x<w;x+=tx){
   if(stale())throw new Error('__SUPERSEDED__');const tw=Math.min(tx,w-x),td=Math.min(tz,d-z),tile=await processMemoryRegion(v,{x,y:idx,z,width:tw,height:1,depth:td},stages);
   for(let zz=0;zz<td;zz++)out.set(tile.subarray(zz*tw,(zz+1)*tw),(d-1-(z+zz))*w+x);
  }
 }else{
  out=new Float32Array(h*d);const [ty,tz]=fitSourceTile(h,d,1,halo,512,32);
  for(let z=0;z<d;z+=tz)for(let y=0;y<h;y+=ty){
   if(stale())throw new Error('__SUPERSEDED__');const th=Math.min(ty,h-y),td=Math.min(tz,d-z),tile=await processMemoryRegion(v,{x:idx,y,z,width:1,height:th,depth:td},stages);
   for(let zz=0;zz<td;zz++)for(let yy=0;yy<th;yy++)out[(d-1-(z+zz))*h+y+yy]=tile[zz*th+yy];
  }
 }
 if(stale())throw new Error('__SUPERSEDED__');memoryFilterPreviewSet(cacheKey,out);return out;
}
export const planeRenderRevision={axial:0,coronal:0,sagittal:0};
export function currentFilterSignature(){const stages=sourceFilterStages();return stages.length?sourceFilterSignature(stages):''}
