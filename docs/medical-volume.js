import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.186.0/build/three.webgpu.js';
import dicomParser from 'https://esm.sh/dicom-parser@1.8.21';

const UNCOMPRESSED_TS=new Set(['1.2.840.10008.1.2','1.2.840.10008.1.2.1','1.2.840.10008.1.2.2']);

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
@group(0) @binding(2) var volumeSampler:sampler;

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
 let tc=clamp(tc0,vec3<f32>(0.0),vec3<f32>(1.0));
 let q=textureSampleLevel(volumeTex,volumeSampler,tc,0.0).rg*255.0;
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
  let p=u.camOrigin.xyz+dir*t;let value=huAt(texCoord(p));let idx=segmentIndex(value);
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

export class MedicalVolumeRenderer{
 constructor({device,host,rendererCanvas,onProgress,onStatus}){
  this.device=device;this.host=host;this.rendererCanvas=rendererCanvas;this.onProgress=onProgress||(()=>{});this.onStatus=onStatus||(()=>{});
  this.canvas=document.createElement('canvas');this.canvas.className='gpu-medical-volume-canvas';
  Object.assign(this.canvas.style,{position:'absolute',inset:'0',width:'100%',height:'100%',display:'none',pointerEvents:'none',zIndex:'1'});
  this.host.style.position='relative';this.host.appendChild(this.canvas);
  this.context=this.canvas.getContext('webgpu');this.format=navigator.gpu.getPreferredCanvasFormat();
  this.context.configure({device:this.device,format:this.format,alphaMode:'opaque'});
  this.uniformBuffer=this.device.createBuffer({size:256,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
  this.sampler=this.device.createSampler({magFilter:'linear',minFilter:'linear',addressModeU:'clamp-to-edge',addressModeV:'clamp-to-edge',addressModeW:'clamp-to-edge'});
  const module=this.device.createShaderModule({label:'VRL medical volume raycast',code:volumeShader()});
  this.pipeline=this.device.createRenderPipeline({label:'VRL medical volume raycast',layout:'auto',vertex:{module,entryPoint:'vs'},fragment:{module,entryPoint:'fs',targets:[{format:this.format}]},primitive:{topology:'triangle-list'}});
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
  this.bindGroup=this.device.createBindGroup({layout:this.pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:this.uniformBuffer}},{binding:1,resource:this.texture.createView({dimension:'3d'})},{binding:2,resource:this.sampler}]});
  this.onStatus('WEBGPU VOLUME READY');
 }
 setActive(active){
  this.active=!!active;this.canvas.style.display=this.active?'block':'none';
  if(this.rendererCanvas)this.rendererCanvas.style.opacity=this.active?'0':'1';
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
  put(5,this.volume.columns,this.volume.rows,this.volume.slices,this.calibration.slope);put(6,this.calibration.intercept,this.calibration.signedBias,4,0);put(7,this.canvas.width,this.canvas.height,0,0);
  for(let s=0;s<4;s++){
   const key=segmentOrder[s],seg=segmentState[key],enabled=seg?.active&&seg?.enabled?1:0,color=new THREE.Color(seg?.color||'#ffffff');
   put(8+s*2,seg?.min||0,seg?.max||0,seg?.opacity??1,enabled);put(9+s*2,color.r,color.g,color.b,1);
  }
  this.device.queue.writeBuffer(this.uniformBuffer,0,data);
  const encoder=this.device.createCommandEncoder({label:'VRL volume frame'}),view=this.context.getCurrentTexture().createView(),pass=encoder.beginRenderPass({colorAttachments:[{view,clearValue:{r:.035,g:.045,b:.05,a:1},loadOp:'clear',storeOp:'store'}]});
  pass.setPipeline(this.pipeline);pass.setBindGroup(0,this.bindGroup);pass.draw(3);pass.end();this.device.queue.submit([encoder.finish()]);
 }
 resetData(){this.setActive(false);this.texture?.destroy?.();this.texture=null;this.bindGroup=null;this.seriesId=null;this.volume=null}
 destroy(){this.resetData();this.uniformBuffer?.destroy?.();this.canvas.remove()}
}
