import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.186.0/build/three.webgpu.js';
import dicomParser from 'https://esm.sh/dicom-parser@1.8.21';

const UNCOMPRESSED_TS=new Set(['1.2.840.10008.1.2','1.2.840.10008.1.2.1','1.2.840.10008.1.2.2']);
const safeWgsl=source=>source.replace(/\bmeta\b/g,'vrlMeta').replace(/\bactive\b/g,'vrlActive').replace(/\btarget\b/g,'vrlTarget');

async function rawPixelBytes(meta){
 if(meta.bits!==16||meta.samples!==1)throw new Error('GPU volume requires single-channel 16-bit DICOM');
 if(!UNCOMPRESSED_TS.has(meta.ts))throw new Error('GPU volume currently requires uncompressed DICOM');
 const bytesNeeded=meta.rows*meta.columns*2;
 if(meta.pixelOffset!=null){
  const bytes=new Uint8Array(await meta.file.slice(meta.pixelOffset,meta.pixelOffset+bytesNeeded).arrayBuffer());
  if(bytes.byteLength<bytesNeeded)throw new Error('Pixel Data is shorter than expected');
  return bytes;
 }
 const all=new Uint8Array(await meta.file.arrayBuffer()),ds=dicomParser.parseDicom(all),el=ds.elements.x7fe00010;
 if(!el)throw new Error('Pixel Data missing');
 return all.slice(el.dataOffset,el.dataOffset+bytesNeeded);
}

async function packedRgSlice(meta){
 const src=await rawPixelBytes(meta),little=meta.ts!=='1.2.840.10008.1.2.2';
 const signed=!!meta.signed,bitsStored=Math.max(1,Math.min(16,meta.bitsStored||16)),highBit=Number.isFinite(meta.highBit)?meta.highBit:bitsStored-1,lowBit=Math.max(0,highBit-bitsStored+1);
 const fastUnsigned=little&&!signed&&lowBit===0;
 if(fastUnsigned)return src;
 const out=new Uint8Array(src.byteLength),view=new DataView(src.buffer,src.byteOffset,src.byteLength),mask=bitsStored===16?0xffff:(1<<bitsStored)-1,signBit=1<<(bitsStored-1);
 for(let i=0;i<meta.rows*meta.columns;i++){
  let word=view.getUint16(i*2,little);
  if(lowBit)word>>=lowBit;
  word&=mask;
  let encoded;
  if(signed){
   const value=(word&signBit)?word-(bitsStored===16?65536:(1<<bitsStored)):word;
   encoded=(value+32768)&0xffff;
  }else encoded=word;
  out[i*2]=encoded&255;out[i*2+1]=encoded>>>8;
 }
 return out;
}

function volumeShader(){
 return `
struct Uniforms{
 camOrigin:vec4<f32>,
 camRightTan:vec4<f32>,
 camUpAspect:vec4<f32>,
 camForward:vec4<f32>,
 halfStep:vec4<f32>,
 dimsSlope:vec4<f32>,
 calibration:vec4<f32>,
 viewport:vec4<f32>,
 segments:array<vec4<f32>,8>
};
@group(0) @binding(0) var<uniform> u:Uniforms;
@group(0) @binding(1) var volumeTex:texture_3d<f32>;
@group(0) @binding(3) var<storage,read> brickMinMax:array<vec2<f32>>;

struct VOut{@builtin(position) position:vec4<f32>};
@vertex fn vs(@builtin(vertex_index) i:u32)->VOut{
 var p=array<vec2<f32>,3>(vec2<f32>(-1.0,-1.0),vec2<f32>(3.0,-1.0),vec2<f32>(-1.0,3.0));
 var o:VOut;o.position=vec4<f32>(p[i],0.0,1.0);return o;
}
fn hitBox(orig:vec3<f32>,dir:vec3<f32>,halfBox:vec3<f32>)->vec2<f32>{
 let inv=1.0/dir;
 let a=(-halfBox-orig)*inv;let b=(halfBox-orig)*inv;
 let lo=min(a,b);let hi=max(a,b);
 return vec2<f32>(max(lo.x,max(lo.y,lo.z)),min(hi.x,min(hi.y,hi.z)));
}
fn texCoord(p:vec3<f32>)->vec3<f32>{
 return vec3<f32>(p.x/(2.0*u.halfStep.x)+0.5,0.5-p.y/(2.0*u.halfStep.y),p.z/(2.0*u.halfStep.z)+0.5);
}
fn huAt(tc0:vec3<f32>)->f32{
 let dims=vec3<u32>(u32(u.dimsSlope.x),u32(u.dimsSlope.y),u32(u.dimsSlope.z));
 let tc=clamp(tc0,vec3<f32>(0.0),vec3<f32>(0.999999));
 let p=min(vec3<u32>(tc*vec3<f32>(dims)),dims-vec3<u32>(1u));
 let q=textureLoad(volumeTex,vec3<i32>(p),0).rg*255.0;
 let raw=q.x+q.y*256.0-u.calibration.y;
 return raw*u.dimsSlope.w+u.calibration.x;
}
fn segmentIndex(v:f32)->i32{
 for(var s:u32=0u;s<4u;s=s+1u){
  let a=u.segments[s*2u];
  if(a.w>0.5&&v>=a.x&&v<=a.y){return i32(s);}
 }
 return -1;
}
fn brickMayContain(p:vec3<f32>)->bool{
 let tc=clamp(texCoord(p),vec3<f32>(0.0),vec3<f32>(0.999999)),dims=max(u.dimsSlope.xyz,vec3<f32>(1.0)),bs=max(u.viewport.w,1.0);
 let voxel=vec3<u32>(tc*dims),bx=voxel.x/u32(bs),by=voxel.y/u32(bs),bz=voxel.z/u32(bs),bcx=u32(u.calibration.z),bcy=u32(u.calibration.w);
 let mm=brickMinMax[bz*bcx*bcy+by*bcx+bx];
 for(var s:u32=0u;s<4u;s=s+1u){let a=u.segments[s*2u];if(a.w>0.5&&a.y>=mm.x&&a.x<=mm.y){return true;}}
 return false;
}
fn brickExitDistance(p:vec3<f32>,dir:vec3<f32>)->f32{
 let tc=clamp(texCoord(p),vec3<f32>(0.0),vec3<f32>(0.999999)),dims=max(u.dimsSlope.xyz,vec3<f32>(1.0)),bs=max(u.viewport.w,1.0),voxel=vec3<u32>(tc*dims);
 let b=voxel/u32(bs),voxelSize=2.0*u.halfStep.xyz/dims;var best=1e20;
 if(abs(dir.x)>1e-8){let edge=select(f32(b.x*u32(bs)),min(f32((b.x+1u)*u32(bs)),dims.x),dir.x>0.0);let q=-u.halfStep.x+edge*voxelSize.x;let dt=(q-p.x)/dir.x;if(dt>1e-7){best=min(best,dt);}}
 if(abs(dir.y)>1e-8){let edge=select(f32(b.y*u32(bs)),min(f32((b.y+1u)*u32(bs)),dims.y),dir.y<0.0);let q=u.halfStep.y-edge*voxelSize.y;let dt=(q-p.y)/dir.y;if(dt>1e-7){best=min(best,dt);}}
 if(abs(dir.z)>1e-8){let edge=select(f32(b.z*u32(bs)),min(f32((b.z+1u)*u32(bs)),dims.z),dir.z>0.0);let q=-u.halfStep.z+edge*voxelSize.z;let dt=(q-p.z)/dir.z;if(dt>1e-7){best=min(best,dt);}}
 return best;
}
fn gradientAt(tc:vec3<f32>)->vec3<f32>{
 let d=vec3<f32>(1.0/max(u.dimsSlope.x,1.0),1.0/max(u.dimsSlope.y,1.0),1.0/max(u.dimsSlope.z,1.0));
 let gx=huAt(tc+vec3<f32>(d.x,0.0,0.0))-huAt(tc-vec3<f32>(d.x,0.0,0.0));
 let gy=huAt(tc+vec3<f32>(0.0,d.y,0.0))-huAt(tc-vec3<f32>(0.0,d.y,0.0));
 let gz=huAt(tc+vec3<f32>(0.0,0.0,d.z))-huAt(tc-vec3<f32>(0.0,0.0,d.z));
 let voxel=2.0*u.halfStep.xyz/max(u.dimsSlope.xyz,vec3<f32>(1.0));
 let g=vec3<f32>(gx/max(voxel.x,1e-6),-gy/max(voxel.y,1e-6),gz/max(voxel.z,1e-6));
 let l=length(g);if(l<1e-6){return vec3<f32>(0.0,0.0,1.0);}return g/l;
}
@fragment fn fs(@builtin(position) frag:vec4<f32>)->@location(0) vec4<f32>{
 let ndc=vec2<f32>(frag.x/max(u.viewport.x,1.0)*2.0-1.0,1.0-frag.y/max(u.viewport.y,1.0)*2.0);
 let dir=normalize(u.camForward.xyz+u.camRightTan.xyz*(ndc.x*u.camRightTan.w*u.camUpAspect.w)+u.camUpAspect.xyz*(ndc.y*u.camRightTan.w));
 let bounds=hitBox(u.camOrigin.xyz,dir,u.halfStep.xyz);
 if(bounds.x>bounds.y){return vec4<f32>(0.035,0.045,0.05,1.0);}
 var t=max(bounds.x,0.0);let endT=bounds.y;let step=max(u.halfStep.w,0.00001);
 var previousT=t;var lastIndex:i32=-1;var acc=vec4<f32>(0.0);
 for(var iter:u32=0u;iter<4096u;iter=iter+1u){
  if(t>endT||acc.a>0.985){break;}
  let p=u.camOrigin.xyz+dir*t;if(!brickMayContain(p)){let skip=brickExitDistance(p,dir);previousT=t;t+=max(skip+step*0.05,step);lastIndex=-1;continue;}let value=huAt(texCoord(p));let idx=segmentIndex(value);
  if(idx!=lastIndex){
   if(idx>=0){
    var lo=previousT;var hi=t;
    for(var r:u32=0u;r<5u;r=r+1u){
     let mid=(lo+hi)*0.5;let mi=segmentIndex(huAt(texCoord(u.camOrigin.xyz+dir*mid)));
     if(mi==idx){hi=mid;}else{lo=mid;}
    }
    let hp=u.camOrigin.xyz+dir*hi,tc=texCoord(hp),n=gradientAt(tc);
    let viewDir=normalize(u.camOrigin.xyz-hp),lightDir=normalize(viewDir+vec3<f32>(0.35,0.5,0.25));
    let diffuse=0.28+0.72*abs(dot(n,lightDir));
    let spec=pow(max(dot(n,normalize(lightDir+viewDir)),0.0),20.0)*0.18;
    let a=u.segments[u32(idx)*2u],col=u.segments[u32(idx)*2u+1u].rgb;
    let alpha=clamp(a.z,0.03,1.0),lit=col*diffuse+vec3<f32>(spec);
    acc.rgb+=(1.0-acc.a)*lit*alpha;acc.a+=(1.0-acc.a)*alpha;
   }
   lastIndex=idx;
  }
  previousT=t;t+=step;
 }
 let bg=vec3<f32>(0.035,0.045,0.05);
 return vec4<f32>(acc.rgb+bg*(1.0-acc.a),1.0);
}`;
}

function brickShader(){
 return `
@group(0) @binding(0) var volumeTex:texture_3d<f32>;
@group(0) @binding(1) var<storage,read> meta:array<u32>;
@group(0) @binding(2) var<storage,read> params:array<f32>;
@group(0) @binding(3) var<storage,read_write> outMinMax:array<vec2<f32>>;
fn huAt(x:u32,y:u32,z:u32)->f32{
 let q=textureLoad(volumeTex,vec3<i32>(i32(x),i32(y),i32(z)),0).rg*255.0;
 return (q.x+q.y*256.0-params[2])*params[0]+params[1];
}
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid:vec3<u32>){
 let bxCount=meta[3];let byCount=meta[4];let bzCount=meta[5];let total=bxCount*byCount*bzCount;let i=gid.x;if(i>=total){return;}
 let bx=i%bxCount;let by=(i/bxCount)%byCount;let bz=i/(bxCount*byCount);let bs=meta[6];
 let x0=bx*bs;let y0=by*bs;let z0=bz*bs;let x1=min(x0+bs,meta[0]);let y1=min(y0+bs,meta[1]);let z1=min(z0+bs,meta[2]);
 var lo=1e30;var hi=-1e30;
 for(var z=z0;z<z1;z=z+1u){for(var y=y0;y<y1;y=y+1u){for(var x=x0;x<x1;x=x+1u){let v=huAt(x,y,z);lo=min(lo,v);hi=max(hi,v);}}}
 outMinMax[i]=vec2<f32>(lo,hi);
}`;
}

function volumePickShader(){
 return `
struct Uniforms{
 camOrigin:vec4<f32>,camRightTan:vec4<f32>,camUpAspect:vec4<f32>,camForward:vec4<f32>,
 halfStep:vec4<f32>,dimsSlope:vec4<f32>,calibration:vec4<f32>,viewport:vec4<f32>,segments:array<vec4<f32>,8>
};
@group(0) @binding(0) var<uniform> u:Uniforms;
@group(0) @binding(1) var volumeTex:texture_3d<f32>;
@group(0) @binding(3) var<storage,read> pick:array<f32>;
@group(0) @binding(4) var<storage,read_write> result:array<u32>;
fn hitBox(orig:vec3<f32>,dir:vec3<f32>,halfBox:vec3<f32>)->vec2<f32>{
 let inv=1.0/dir;let a=(-halfBox-orig)*inv;let b=(halfBox-orig)*inv;let lo=min(a,b);let hi=max(a,b);
 return vec2<f32>(max(lo.x,max(lo.y,lo.z)),min(hi.x,min(hi.y,hi.z)));
}
fn texCoord(p:vec3<f32>)->vec3<f32>{return vec3<f32>(p.x/(2.0*u.halfStep.x)+0.5,0.5-p.y/(2.0*u.halfStep.y),p.z/(2.0*u.halfStep.z)+0.5);}
fn huAt(tc0:vec3<f32>)->f32{
 let dims=vec3<u32>(u32(u.dimsSlope.x),u32(u.dimsSlope.y),u32(u.dimsSlope.z));
 let tc=clamp(tc0,vec3<f32>(0.0),vec3<f32>(0.999999));
 let p=min(vec3<u32>(tc*vec3<f32>(dims)),dims-vec3<u32>(1u));
 let q=textureLoad(volumeTex,vec3<i32>(p),0).rg*255.0;
 return (q.x+q.y*256.0-u.calibration.y)*u.dimsSlope.w+u.calibration.x;
}
fn segmentIndex(v:f32)->i32{
 for(var s:u32=0u;s<4u;s=s+1u){let a=u.segments[s*2u];if(a.w>0.5&&v>=a.x&&v<=a.y){return i32(s);}}return -1;
}
@compute @workgroup_size(1)
fn main(){
 result[0]=0u;result[1]=0u;result[2]=0u;result[3]=0u;
 let ndc=vec2<f32>(pick[0]/max(u.viewport.x,1.0)*2.0-1.0,1.0-pick[1]/max(u.viewport.y,1.0)*2.0);
 let dir=normalize(u.camForward.xyz+u.camRightTan.xyz*(ndc.x*u.camRightTan.w*u.camUpAspect.w)+u.camUpAspect.xyz*(ndc.y*u.camRightTan.w));
 let bounds=hitBox(u.camOrigin.xyz,dir,u.halfStep.xyz);if(bounds.x>bounds.y){return;}
 var t=max(bounds.x,0.0);let endT=bounds.y;let step=max(u.halfStep.w,0.00001);var previousT=t;
 for(var iter:u32=0u;iter<4096u;iter=iter+1u){
  if(t>endT){return;}let idx=segmentIndex(huAt(texCoord(u.camOrigin.xyz+dir*t)));
  if(idx>=0){
   var lo=previousT;var hi=t;
   for(var r:u32=0u;r<5u;r=r+1u){let mid=(lo+hi)*0.5;if(segmentIndex(huAt(texCoord(u.camOrigin.xyz+dir*mid)))==idx){hi=mid;}else{lo=mid;}}
   let tc=clamp(texCoord(u.camOrigin.xyz+dir*hi),vec3<f32>(0.0),vec3<f32>(0.999999));
   result[0]=min(u32(tc.x*u.dimsSlope.x),u32(u.dimsSlope.x)-1u);
   result[1]=min(u32(tc.y*u.dimsSlope.y),u32(u.dimsSlope.y)-1u);
   result[2]=min(u32(tc.z*u.dimsSlope.z),u32(u.dimsSlope.z)-1u);
   result[3]=u32(idx)+1u;return;
  }
  previousT=t;t+=step;
 }
}`;
}

export class MedicalVolumeRenderer{
 constructor({device,host,rendererCanvas,onProgress,onStatus}){
  this.device=device;this.host=host;this.rendererCanvas=rendererCanvas;this.onProgress=onProgress||(()=>{});this.onStatus=onStatus||(()=>{});
  this.canvas=document.createElement('canvas');this.canvas.className='gpu-medical-volume-canvas';
  Object.assign(this.canvas.style,{position:'absolute',inset:'0',width:'100%',height:'100%',display:'none',pointerEvents:'none',zIndex:'0'});
  this.host.style.position='relative';this.host.appendChild(this.canvas);
  this.context=this.canvas.getContext('webgpu');this.format=navigator.gpu.getPreferredCanvasFormat();
  this.context.configure({device:this.device,format:this.format,alphaMode:'opaque'});
  this.uniformBuffer=this.device.createBuffer({size:256,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
  this.sampler=this.device.createSampler({magFilter:'linear',minFilter:'linear',addressModeU:'clamp-to-edge',addressModeV:'clamp-to-edge',addressModeW:'clamp-to-edge'});
  const module=this.device.createShaderModule({label:'VRL medical volume raycast',code:safeWgsl(volumeShader())});
  this.pipeline=this.device.createRenderPipeline({label:'VRL medical volume raycast',layout:'auto',vertex:{module,entryPoint:'vs'},fragment:{module,entryPoint:'fs',targets:[{format:this.format}]},primitive:{topology:'triangle-list'}});
  const pickModule=this.device.createShaderModule({label:'VRL medical volume pick',code:safeWgsl(volumePickShader())});this.pickPipeline=this.device.createComputePipeline({label:'VRL medical volume pick',layout:'auto',compute:{module:pickModule,entryPoint:'main'}});this.pickBuffer=this.device.createBuffer({size:16,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});this.pickOutput=this.device.createBuffer({size:16,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST});
  const brickModule=this.device.createShaderModule({label:'VRL volume minmax bricks',code:safeWgsl(brickShader())});this.brickPipeline=this.device.createComputePipeline({label:'VRL volume minmax bricks',layout:'auto',compute:{module:brickModule,entryPoint:'main'}});this.brickBuffer=null;this.brickDims=[1,1,1];this.brickSize=8;
  this.texture=null;this.bindGroup=null;this.seriesId=null;this.active=false;this.halfExtents=[1,1,1];this.step=0.002;this.calibration={slope:1,intercept:0,signedBias:0};this.volume=null;
 }
 support(v){
  const s=v?.series;if(!v?.sourceBacked||!s)return{ok:false,reason:'GPU volume currently targets source-backed DICOM'};
  if(!this.device||!this.context)return{ok:false,reason:'WebGPU device unavailable'};
  if(!s.slices.length||s.slices.some(m=>m.bits!==16||m.samples!==1||!UNCOMPRESSED_TS.has(m.ts)))return{ok:false,reason:'16-bit uncompressed single-channel DICOM required'};
  if(s.slices.some(m=>m.rows!==s.rows||m.columns!==s.columns))return{ok:false,reason:'Inconsistent DICOM matrix'};
  const first=s.slices[0],slope=first.slope,intercept=first.intercept,signed=!!first.signed;
  if(s.slices.some(m=>Math.abs(m.slope-slope)>1e-9||Math.abs(m.intercept-intercept)>1e-6||!!m.signed!==signed))return{ok:false,reason:'Per-slice calibration differs'};
  const lim=this.device.limits.maxTextureDimension3D;
  if(s.columns>lim||s.rows>lim||s.slices.length>lim)return{ok:false,reason:'Volume exceeds maxTextureDimension3D '+lim};
  return{ok:true};
 }
 async ensure(v){
  const support=this.support(v);if(!support.ok)throw new Error(support.reason);
  const s=v.series;if(this.seriesId===s.id&&this.texture){this.volume=v;return}
  this.resetData();this.volume=v;this.onStatus('WEBGPU VOLUME UPLOAD');
  const first=s.slices[0],signed=!!first.signed;let texture,popped=false;
  this.device.pushErrorScope?.('validation');
  try{
   texture=this.device.createTexture({label:'VRL DICOM volume',size:{width:s.columns,height:s.rows,depthOrArrayLayers:s.slices.length},dimension:'3d',format:'rg8unorm',usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST});
   for(let z=0;z<s.slices.length;z++){
    const packed=await packedRgSlice(s.slices[z]);
    this.device.queue.writeTexture({texture,origin:{x:0,y:0,z}},packed,{bytesPerRow:s.columns*2,rowsPerImage:s.rows},{width:s.columns,height:s.rows,depthOrArrayLayers:1});
    if((z&31)===31||z===s.slices.length-1){
     this.onProgress(z+1,s.slices.length);
     try{await this.device.queue.onSubmittedWorkDone()}catch{}
     await new Promise(requestAnimationFrame);
    }
   }
   const validation=await this.device.popErrorScope?.();popped=true;if(validation)throw new Error(validation.message);
  }catch(e){
   if(!popped){try{await this.device.popErrorScope?.()}catch{}}
   texture?.destroy?.();throw e;
  }
  const px=s.columns*s.spacingX,py=s.rows*s.spacingY,pz=s.slices.length*s.spacingZ,maxP=Math.max(px,py,pz,1),scale=3.3/maxP;
  this.halfExtents=[px*scale*.5,py*scale*.5,pz*scale*.5];this.step=Math.max(1e-5,Math.min(s.spacingX,s.spacingY,s.spacingZ)*scale*.85);
  this.calibration={slope:first.slope,intercept:first.intercept,signedBias:signed?32768:0};this.texture=texture;this.seriesId=s.id;
  const bs=this.brickSize,bx=Math.ceil(s.columns/bs),by=Math.ceil(s.rows/bs),bz=Math.ceil(s.slices.length/bs),brickCount=bx*by*bz;this.brickDims=[bx,by,bz];
  this.brickBuffer=this.device.createBuffer({label:'VRL volume minmax bricks',size:Math.max(8,brickCount*8),usage:GPUBufferUsage.STORAGE});
  const meta=smallStorage(this.device,new Uint32Array([s.columns,s.rows,s.slices.length,bx,by,bz,bs,0])),params=smallStorage(this.device,new Float32Array([first.slope,first.intercept,signed?32768:0,0]));
  const brickGroup=this.device.createBindGroup({layout:this.brickPipeline.getBindGroupLayout(0),entries:[{binding:0,resource:this.texture.createView({dimension:'3d'})},{binding:1,resource:{buffer:meta}},{binding:2,resource:{buffer:params}},{binding:3,resource:{buffer:this.brickBuffer}}]}),brickEncoder=this.device.createCommandEncoder({label:'VRL volume minmax bricks'}),brickPass=brickEncoder.beginComputePass();brickPass.setPipeline(this.brickPipeline);brickPass.setBindGroup(0,brickGroup);brickPass.dispatchWorkgroups(Math.ceil(brickCount/64));brickPass.end();this.device.queue.submit([brickEncoder.finish()]);await this.device.queue.onSubmittedWorkDone();meta.destroy();params.destroy();
  this.bindGroup=this.device.createBindGroup({layout:this.pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:this.uniformBuffer}},{binding:1,resource:this.texture.createView({dimension:'3d'})},{binding:3,resource:{buffer:this.brickBuffer}}]});
  this.onStatus('WEBGPU VOLUME READY');
 }
 setActive(active){
  this.active=!!active;this.canvas.style.display=this.active?'block':'none';
 }
 resize(){
  const ratio=Math.min(window.devicePixelRatio||1,1.5),w=Math.max(1,Math.floor(this.host.clientWidth*ratio)),h=Math.max(1,Math.floor(this.host.clientHeight*ratio));
  if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h}
 }
 render(camera,obj,segmentState,segmentOrder){
  if(!this.active||!this.texture||!this.bindGroup||!obj)return;
  this.resize();camera.updateMatrixWorld(true);obj.updateMatrixWorld(true);
  const inv=obj.matrixWorld.clone().invert(),origin=camera.getWorldPosition(new THREE.Vector3()).applyMatrix4(inv),q=camera.getWorldQuaternion(new THREE.Quaternion());
  const right=new THREE.Vector3(1,0,0).applyQuaternion(q).transformDirection(inv),up=new THREE.Vector3(0,1,0).applyQuaternion(q).transformDirection(inv),forward=new THREE.Vector3(0,0,-1).applyQuaternion(q).transformDirection(inv);
  const data=new Float32Array(64),put=(slot,a,b,c,d)=>{const i=slot*4;data[i]=a;data[i+1]=b;data[i+2]=c;data[i+3]=d};
  put(0,origin.x,origin.y,origin.z,0);put(1,right.x,right.y,right.z,Math.tan(THREE.MathUtils.degToRad(camera.fov*.5)));put(2,up.x,up.y,up.z,camera.aspect);put(3,forward.x,forward.y,forward.z,0);
  put(4,this.halfExtents[0],this.halfExtents[1],this.halfExtents[2],this.step);
  put(5,this.volume.columns,this.volume.rows,this.volume.slices,this.calibration.slope);put(6,this.calibration.intercept,this.calibration.signedBias,this.brickDims[0],this.brickDims[1]);put(7,this.canvas.width,this.canvas.height,this.brickDims[2],this.brickSize);
  for(let s=0;s<4;s++){
   const key=segmentOrder[s],seg=segmentState[key],enabled=seg?.active&&seg?.enabled?1:0,color=new THREE.Color(seg?.color||'#ffffff');
   put(8+s*2,seg?.min||0,seg?.max||0,seg?.opacity??1,enabled);put(9+s*2,color.r,color.g,color.b,1);
  }
  this.device.queue.writeBuffer(this.uniformBuffer,0,data);
  const encoder=this.device.createCommandEncoder({label:'VRL volume frame'}),view=this.context.getCurrentTexture().createView(),pass=encoder.beginRenderPass({colorAttachments:[{view,clearValue:{r:.035,g:.045,b:.05,a:1},loadOp:'clear',storeOp:'store'}]});
  pass.setPipeline(this.pipeline);pass.setBindGroup(0,this.bindGroup);pass.draw(3);pass.end();this.device.queue.submit([encoder.finish()]);
 }
 async pick(clientX,clientY,camera,obj,segmentState,segmentOrder){
  if(!this.active||!this.texture||!this.bindGroup||!obj)return null;
  this.render(camera,obj,segmentState,segmentOrder);
  const rect=this.rendererCanvas.getBoundingClientRect(),x=(clientX-rect.left)/Math.max(rect.width,1)*this.canvas.width,y=(clientY-rect.top)/Math.max(rect.height,1)*this.canvas.height;
  this.device.queue.writeBuffer(this.pickBuffer,0,new Float32Array([x,y,0,0]));this.device.queue.writeBuffer(this.pickOutput,0,new Uint32Array(4));
  const group=this.device.createBindGroup({layout:this.pickPipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:this.uniformBuffer}},{binding:1,resource:this.texture.createView({dimension:'3d'})},{binding:3,resource:{buffer:this.pickBuffer}},{binding:4,resource:{buffer:this.pickOutput}}]});
  const read=this.device.createBuffer({size:16,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),encoder=this.device.createCommandEncoder({label:'VRL volume pick'}),pass=encoder.beginComputePass();pass.setPipeline(this.pickPipeline);pass.setBindGroup(0,group);pass.dispatchWorkgroups(1);pass.end();encoder.copyBufferToBuffer(this.pickOutput,0,read,0,16);this.device.queue.submit([encoder.finish()]);
  await read.mapAsync(GPUMapMode.READ);const out=new Uint32Array(read.getMappedRange().slice(0));read.unmap();read.destroy();if(!out[3])return null;
  const index=out[3]-1;return{x:out[0],y:out[1],z:out[2],key:segmentOrder[index]};
 }
 resetData(){this.setActive(false);this.texture?.destroy?.();this.brickBuffer?.destroy?.();this.texture=null;this.brickBuffer=null;this.bindGroup=null;this.seriesId=null;this.volume=null}
 destroy(){this.resetData();this.uniformBuffer?.destroy?.();this.pickBuffer?.destroy?.();this.pickOutput?.destroy?.();this.canvas.remove()}
}


const runPipelineCache=new WeakMap();
function runPipeline(device){
 let pipeline=runPipelineCache.get(device);if(pipeline)return pipeline;
 const module=device.createShaderModule({label:'VRL raw DICOM analysis RLE',code:safeWgsl(`
struct Counter{value:atomic<u32>};
@group(0) @binding(0) var volumeTex:texture_3d<f32>;
@group(0) @binding(1) var<storage,read> meta:array<u32>;
@group(0) @binding(2) var<storage,read> params:array<f32>;
@group(0) @binding(3) var<storage,read_write> records:array<u32>;
@group(0) @binding(4) var<storage,read_write> counter:Counter;
fn valueAt(x:u32,y:u32,z:u32)->f32{
 let q=textureLoad(volumeTex,vec3<i32>(i32(x),i32(y),i32(z)),0).rg*255.0;
 let raw=q.x+q.y*256.0-params[4];return raw*params[2]+params[3];
}
fn inside(x:u32,y:u32,z:u32)->bool{let v=valueAt(x,y,z);return v>=params[0]&&v<=params[1];}
@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid:vec3<u32>){
 let w=meta[0];let h=meta[1];let d=meta[2];let n=w*h*d;let i=gid.x;if(i>=n){return;}
 let x=i%w;let y=(i/w)%h;let z=i/(w*h);if(!inside(x,y,z)){return;}if(x>0u&&inside(x-1u,y,z)){return;}
 var x1=x;loop{if(x1+1u>=w||!inside(x1+1u,y,z)){break;}x1++;}
 let slot=atomicAdd(&counter.value,1u)*4u;records[slot]=z;records[slot+1u]=y;records[slot+2u]=x;records[slot+3u]=x1;
}`)});
 pipeline=device.createComputePipeline({label:'VRL raw DICOM analysis RLE',layout:'auto',compute:{module,entryPoint:'main'}});runPipelineCache.set(device,pipeline);return pipeline;
}
function smallStorage(device,data){
 const buffer=device.createBuffer({size:Math.max(16,Math.ceil(data.byteLength/4)*4),usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});device.queue.writeBuffer(buffer,0,data);return buffer;
}
export async function extractSourceThresholdRuns(device,series,zStart,depth,seg){
 const coreDepth=Math.min(depth,series.slices.length-zStart),w=series.columns,h=series.rows,first=series.slices[zStart];
 if(coreDepth<=0)return{items:new Uint32Array(0),coreDepth:0};
 if(first.bits!==16||first.samples!==1||!UNCOMPRESSED_TS.has(first.ts))return null;
 if(series.slices.slice(zStart,zStart+coreDepth).some(m=>m.rows!==h||m.columns!==w||m.bits!==16||m.samples!==1||!UNCOMPRESSED_TS.has(m.ts)||Math.abs(m.slope-first.slope)>1e-9||Math.abs(m.intercept-first.intercept)>1e-6||!!m.signed!==!!first.signed))return null;
 const texture=device.createTexture({label:'VRL analysis DICOM block',size:{width:w,height:h,depthOrArrayLayers:coreDepth},dimension:'3d',format:'rg8unorm',usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST});
 try{
  for(let z=0;z<coreDepth;z++){
   const packed=await packedRgSlice(series.slices[zStart+z]);device.queue.writeTexture({texture,origin:{x:0,y:0,z}},packed,{bytesPerRow:w*2,rowsPerImage:h},{width:w,height:h,depthOrArrayLayers:1});
  }
  const maxRuns=Math.ceil(w/2)*h*coreDepth,recordBytes=Math.max(16,maxRuns*16);
  if(recordBytes>device.limits.maxStorageBufferBindingSize)return null;
  const records=device.createBuffer({size:recordBytes,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC}),counter=device.createBuffer({size:4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST});
  const meta=smallStorage(device,new Uint32Array([w,h,coreDepth,0])),params=smallStorage(device,new Float32Array([seg.min,seg.max,first.slope,first.intercept,first.signed?32768:0,0,0,0]));device.queue.writeBuffer(counter,0,new Uint32Array([0]));
  const pipeline=runPipeline(device),group=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:texture.createView({dimension:'3d'})},{binding:1,resource:{buffer:meta}},{binding:2,resource:{buffer:params}},{binding:3,resource:{buffer:records}},{binding:4,resource:{buffer:counter}}]});
  const counterRead=device.createBuffer({size:4,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),encoder=device.createCommandEncoder({label:'VRL raw DICOM analysis RLE'}),pass=encoder.beginComputePass();pass.setPipeline(pipeline);pass.setBindGroup(0,group);pass.dispatchWorkgroups(Math.ceil(w*h*coreDepth/256));pass.end();encoder.copyBufferToBuffer(counter,0,counterRead,0,4);device.queue.submit([encoder.finish()]);
  await counterRead.mapAsync(GPUMapMode.READ);const count=Math.min(maxRuns,new Uint32Array(counterRead.getMappedRange().slice(0))[0]);counterRead.unmap();counterRead.destroy();
  let items=new Uint32Array(0);
  if(count){
   const bytes=count*16,read=device.createBuffer({size:bytes,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),copy=device.createCommandEncoder({label:'VRL analysis RLE readback'});copy.copyBufferToBuffer(records,0,read,0,bytes);device.queue.submit([copy.finish()]);
   await read.mapAsync(GPUMapMode.READ);items=new Uint32Array(read.getMappedRange().slice(0));read.unmap();read.destroy();
  }
  records.destroy();counter.destroy();meta.destroy();params.destroy();return{items,coreDepth};
 }finally{texture.destroy()}
}
