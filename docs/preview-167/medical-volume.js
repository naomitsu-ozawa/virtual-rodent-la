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
 segments:array<vec4<f32>,8>,
 mprIndices:vec4<f32>,
 mprVisible:vec4<f32>,
 mprWindow:vec4<f32>,
 section:vec4<f32>,
 sectionCap:vec4<f32>
};
@group(0) @binding(0) var<uniform> u:Uniforms;
@group(0) @binding(1) var volumeTex:texture_3d<f32>;
@group(0) @binding(2) var<storage,read> editRows:array<u32>;
@group(0) @binding(3) var<storage,read> brickMinMax:array<vec2<f32>>;
@group(0) @binding(5) var<storage,read> editIntervals:array<u32>;
@group(0) @binding(6) var<storage,read> previewRows:array<u32>;
@group(0) @binding(7) var<storage,read> previewIntervals:array<u32>;
@group(0) @binding(8) var<storage,read> appliedCutRows:array<u32>;
@group(0) @binding(9) var<storage,read> appliedCutIntervals:array<u32>;

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
fn editAllows(seg:u32,tc0:vec3<f32>)->bool{
 let activeMask=editRows[0];if((activeMask&(1u<<seg))==0u){return true;}
 let keepMask=editRows[1];
 let dims=vec3<u32>(u32(u.dimsSlope.x),u32(u.dimsSlope.y),u32(u.dimsSlope.z));
 let tc=clamp(tc0,vec3<f32>(0.0),vec3<f32>(0.999999));
 let p=min(vec3<u32>(tc*vec3<f32>(dims)),dims-vec3<u32>(1u));
 let rowCount=dims.y*dims.z;
 let base=2u+seg*(rowCount+1u);
 let row=p.z*dims.y+p.y;
 let start=editRows[base+row];
 let finish=editRows[base+row+1u];
 var inside=false;
 for(var i=start;i<finish;i=i+1u){
  let packed=editIntervals[i];
  let x0=packed&65535u;
  let x1=packed>>16u;
  if(p.x<x0){break;}if(p.x<=x1){inside=true;break;}
 }
 let keep=(keepMask&(1u<<seg))!=0u;return select(!inside,inside,keep);
}
fn previewContains(seg:u32,tc0:vec3<f32>)->bool{
 let target=previewRows[0];if(target==0u||target!=seg+1u){return false;}
 let dims=vec3<u32>(u32(u.dimsSlope.x),u32(u.dimsSlope.y),u32(u.dimsSlope.z));
 let tc=clamp(tc0,vec3<f32>(0.0),vec3<f32>(0.999999));
 let p=min(vec3<u32>(tc*vec3<f32>(dims)),dims-vec3<u32>(1u));
 let row=p.z*dims.y+p.y;
 let start=previewRows[1u+row];
 let finish=previewRows[2u+row];
 for(var i=start;i<finish;i=i+1u){
  let packed=previewIntervals[i];
  let x0=packed&65535u;
  let x1=packed>>16u;
  if(p.x<x0){break;}
  if(p.x<=x1){return true;}
 }
 return false;
}
fn appliedCutContains(seg:u32,tc0:vec3<f32>)->bool{
 let activeMask=appliedCutRows[0];
 if((activeMask&(1u<<seg))==0u){return false;}
 let dims=vec3<u32>(u32(u.dimsSlope.x),u32(u.dimsSlope.y),u32(u.dimsSlope.z));
 let tc=clamp(tc0,vec3<f32>(0.0),vec3<f32>(0.999999));
 let p=min(vec3<u32>(tc*vec3<f32>(dims)),dims-vec3<u32>(1u));
 let rowCount=dims.y*dims.z;
 let base=1u+seg*(rowCount+1u);
 let row=p.z*dims.y+p.y;
 let start=appliedCutRows[base+row];
 let finish=appliedCutRows[base+row+1u];
 for(var i=start;i<finish;i=i+1u){
  let packed=appliedCutIntervals[i];
  let x0=packed&65535u;
  let x1=packed>>16u;
  if(p.x<x0){break;}
  if(p.x<=x1){return true;}
 }
 return false;
}
fn appliedCutNormal(seg:u32,tc0:vec3<f32>)->vec3<f32>{
 let dims=max(u.dimsSlope.xyz,vec3<f32>(1.0));
 let d=vec3<f32>(1.0/dims.x,1.0/dims.y,1.0/dims.z);
 let gx=select(0.0,1.0,appliedCutContains(seg,tc0+vec3<f32>(d.x,0.0,0.0)))-select(0.0,1.0,appliedCutContains(seg,tc0-vec3<f32>(d.x,0.0,0.0)));
 let gy=select(0.0,1.0,appliedCutContains(seg,tc0+vec3<f32>(0.0,d.y,0.0)))-select(0.0,1.0,appliedCutContains(seg,tc0-vec3<f32>(0.0,d.y,0.0)));
 let gz=select(0.0,1.0,appliedCutContains(seg,tc0+vec3<f32>(0.0,0.0,d.z)))-select(0.0,1.0,appliedCutContains(seg,tc0-vec3<f32>(0.0,0.0,d.z)));
 let voxel=2.0*u.halfStep.xyz/dims;
 let g=vec3<f32>(gx/max(voxel.x,1e-6),-gy/max(voxel.y,1e-6),gz/max(voxel.z,1e-6));
 let l=length(g);
 if(l<1e-6){return vec3<f32>(0.0,0.0,1.0);}
 return g/l;
}
fn rawSegmentIndexAt(tc0:vec3<f32>)->i32{
 let tc=clamp(tc0,vec3<f32>(0.0),vec3<f32>(0.999999));
 let v=huAt(tc);
 for(var s:u32=0u;s<4u;s=s+1u){
  let a=u.segments[s*2u];
  if(a.w>0.5&&v>=a.x&&v<=a.y){return i32(s);}
 }
 return -1;
}
fn segmentIndexAt(tc0:vec3<f32>)->i32{
 let tc=clamp(tc0,vec3<f32>(0.0),vec3<f32>(0.999999));
 let v=huAt(tc);
 for(var s:u32=0u;s<4u;s=s+1u){
  let a=u.segments[s*2u];
  if(a.w>0.5&&v>=a.x&&v<=a.y&&editAllows(s,tc)){return i32(s);}
 }
 return -1;
}
fn capSegmentIndex(tc0:vec3<f32>)->i32{
 let tc=clamp(tc0,vec3<f32>(0.0),vec3<f32>(0.999999));
 var idx=segmentIndexAt(tc);if(idx>=0){return idx;}
 let dims=max(u.dimsSlope.xyz,vec3<f32>(1.0));
 var axis=vec3<f32>(0.0,0.0,1.0);
 if(u.section.x>1.5&&u.section.x<2.5){axis=vec3<f32>(0.0,1.0,0.0);}
 if(u.section.x>=2.5){axis=vec3<f32>(1.0,0.0,0.0);}
 let voxelStep=axis/dims;
 for(var r:i32=1;r<=2;r=r+1){
  let d=voxelStep*f32(r);
  idx=segmentIndexAt(clamp(tc+d,vec3<f32>(0.0),vec3<f32>(0.999999)));if(idx>=0){return idx;}
  idx=segmentIndexAt(clamp(tc-d,vec3<f32>(0.0),vec3<f32>(0.999999)));if(idx>=0){return idx;}
 }
 return -1;
}
fn brickMayContain(p:vec3<f32>)->bool{
 let tc=clamp(texCoord(p),vec3<f32>(0.0),vec3<f32>(0.999999));let dims=max(u.dimsSlope.xyz,vec3<f32>(1.0));let bs=max(u.viewport.w,1.0);
 let voxel=vec3<u32>(tc*dims);let bx=voxel.x/u32(bs);let by=voxel.y/u32(bs);let bz=voxel.z/u32(bs);let bcx=u32(u.calibration.z);let bcy=u32(u.calibration.w);
 let mm=brickMinMax[bz*bcx*bcy+by*bcx+bx];
 for(var s:u32=0u;s<4u;s=s+1u){let a=u.segments[s*2u];if(a.w>0.5&&a.y>=mm.x&&a.x<=mm.y){return true;}}
 return false;
}
fn brickExitDistance(p:vec3<f32>,dir:vec3<f32>)->f32{
 let tc=clamp(texCoord(p),vec3<f32>(0.0),vec3<f32>(0.999999));let dims=max(u.dimsSlope.xyz,vec3<f32>(1.0));let bs=max(u.viewport.w,1.0);let voxel=vec3<u32>(tc*dims);
 let b=voxel/u32(bs);let voxelSize=2.0*u.halfStep.xyz/dims;var best=1e20;
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
 var t=max(bounds.x,0.0);var endT=bounds.y;let step=max(u.halfStep.w,0.00001);var capT=1e30;
 if(u.section.x>0.5){
  var originAxis=u.camOrigin.z;var dirAxis=dir.z;
  if(u.section.x>1.5&&u.section.x<2.5){originAxis=u.camOrigin.y;dirAxis=dir.y;}
  if(u.section.x>=2.5){originAxis=u.camOrigin.x;dirAxis=dir.x;}
  let side=u.section.z*(originAxis-u.section.y);let slope=u.section.z*dirAxis;
  if(abs(slope)<1e-8){
   if(side<0.0){return vec4<f32>(0.035,0.045,0.05,1.0);}
  }else{
   let cross=-side/slope;
   if(cross>=max(bounds.x,0.0)-1e-7&&cross<=bounds.y+1e-7){capT=cross;}
   if(slope>0.0){t=max(t,cross);}else{endT=min(endT,cross);}
   if(t>endT){return vec4<f32>(0.035,0.045,0.05,1.0);}
  }
 }
 var axialT=1e30;var coronalT=1e30;var sagittalT=1e30;
 if(u.mprVisible.x>0.5&&abs(dir.z)>1e-8){
  let z=((u.mprIndices.x+0.5)/max(u.dimsSlope.z,1.0)*2.0-1.0)*u.halfStep.z;
  let q=(z-u.camOrigin.z)/dir.z;if(q>=t&&q<=endT){axialT=q;}
 }
 if(u.mprVisible.y>0.5&&abs(dir.y)>1e-8){
  let y=(1.0-(u.mprIndices.y+0.5)/max(u.dimsSlope.y,1.0)*2.0)*u.halfStep.y;
  let q=(y-u.camOrigin.y)/dir.y;if(q>=t&&q<=endT){coronalT=q;}
 }
 if(u.mprVisible.z>0.5&&abs(dir.x)>1e-8){
  let x=((u.mprIndices.z+0.5)/max(u.dimsSlope.x,1.0)*2.0-1.0)*u.halfStep.x;
  let q=(x-u.camOrigin.x)/dir.x;if(q>=t&&q<=endT){sagittalT=q;}
 }
 var previousT=t;var lastIndex:i32=-1;var acc=vec4<f32>(0.0);
 for(var iter:u32=0u;iter<4096u;iter=iter+1u){
  if(t>endT||acc.a>0.985){break;}
  let p=u.camOrigin.xyz+dir*t;
  let canSample=brickMayContain(p);
  var nextT=t+step;
  if(!canSample){let skip=brickExitDistance(p,dir);nextT=t+max(skip+step*0.05,step);}
  var capDrawn=false;
  if(capT>=t-1e-7&&capT<=nextT+1e-7){
   if(u.sectionCap.x>0.5){
    let cp=u.camOrigin.xyz+dir*capT;let ctc=texCoord(cp);let capIndex=capSegmentIndex(ctc);
    if(capIndex>=0){
     var capColor=mix(u.segments[u32(capIndex)*2u+1u].rgb,vec3<f32>(1.0),0.22);
     if(u.sectionCap.z>0.5){
      var huv=vec2<f32>(ctc.x,ctc.y);
      if(u.section.x>1.5&&u.section.x<2.5){huv=vec2<f32>(ctc.x,ctc.z);}
      if(u.section.x>=2.5){huv=vec2<f32>(ctc.y,ctc.z);}
      let stripe=abs(fract((huv.x+huv.y)*max(u.sectionCap.w,1.0))-0.5);
      if(stripe<0.14){capColor*=0.26;}
     }
     let ca=clamp(u.sectionCap.y,0.0,1.0);let contribution=(1.0-acc.a)*ca;
     acc=vec4<f32>(acc.rgb+capColor*contribution,acc.a+contribution);capDrawn=true;
    }
   }
   capT=1e30;
  }
  if(canSample&&!capDrawn){
   let tc0=texCoord(p);
   let rawIdx=rawSegmentIndexAt(tc0);
   var appliedCutIdx:i32=-1;
   var cutSampleT=t;
   if(rawIdx>=0&&appliedCutContains(u32(rawIdx),tc0)){appliedCutIdx=rawIdx;}
   if(appliedCutIdx<0){
    let earlyT=t+(nextT-t)*0.25;
    let earlyTc=texCoord(u.camOrigin.xyz+dir*earlyT);
    let earlyRaw=rawSegmentIndexAt(earlyTc);
    if(earlyRaw>=0&&appliedCutContains(u32(earlyRaw),earlyTc)){appliedCutIdx=earlyRaw;cutSampleT=earlyT;}
   }
   if(appliedCutIdx<0){
    let midT=t+(nextT-t)*0.5;
    let midTc=texCoord(u.camOrigin.xyz+dir*midT);
    let midRaw=rawSegmentIndexAt(midTc);
    if(midRaw>=0&&appliedCutContains(u32(midRaw),midTc)){appliedCutIdx=midRaw;cutSampleT=midT;}
   }
   if(appliedCutIdx<0){
    let lateT=t+(nextT-t)*0.75;
    let lateTc=texCoord(u.camOrigin.xyz+dir*lateT);
    let lateRaw=rawSegmentIndexAt(lateTc);
    if(lateRaw>=0&&appliedCutContains(u32(lateRaw),lateTc)){appliedCutIdx=lateRaw;cutSampleT=lateT;}
   }

   let idx=segmentIndexAt(tc0);
   if(appliedCutIdx>=0&&lastIndex==appliedCutIdx){
    var cutLo=previousT;
    var cutHi=cutSampleT;
    for(var cr:u32=0u;cr<7u;cr=cr+1u){
     let mid=(cutLo+cutHi)*0.5;
     let mtc=texCoord(u.camOrigin.xyz+dir*mid);
     let mraw=rawSegmentIndexAt(mtc);
     let mcut=mraw==appliedCutIdx&&appliedCutContains(u32(appliedCutIdx),mtc);
     if(mcut){cutHi=mid;}else{cutLo=mid;}
    }
    let cseg=u32(appliedCutIdx);
    let cp=u.camOrigin.xyz+dir*cutHi;
    let ctc=texCoord(cp);
    let cn=appliedCutNormal(cseg,ctc);
    let viewDir=normalize(u.camOrigin.xyz-cp);
    let lightDir=normalize(viewDir+vec3<f32>(0.35,0.5,0.25));
    let diffuse=0.28+0.72*abs(dot(cn,lightDir));
    let spec=pow(max(dot(cn,normalize(lightDir+viewDir)),0.0),20.0)*0.18;
    let a=u.segments[cseg*2u];
    let capColor=u.segments[cseg*2u+1u].rgb;
    let capAlpha=clamp(a.z,0.03,1.0);
    let capLit=capColor*diffuse+vec3<f32>(spec);
    let capContribution=(1.0-acc.a)*capAlpha;
    acc=vec4<f32>(acc.rgb+capLit*capContribution,acc.a+capContribution);
    lastIndex=-1;
   }else if(idx!=lastIndex){
    if(idx>=0){
     var lo=previousT;var hi=t;
     for(var r:u32=0u;r<5u;r=r+1u){
      let mid=(lo+hi)*0.5;let mi=segmentIndexAt(texCoord(u.camOrigin.xyz+dir*mid));
      if(mi==idx){hi=mid;}else{lo=mid;}
     }
     let hp=u.camOrigin.xyz+dir*hi;let tc=texCoord(hp);
     let prevTc=texCoord(u.camOrigin.xyz+dir*previousT);
     let prevRaw=rawSegmentIndexAt(prevTc);
     let fromAppliedCut=lastIndex<0&&prevRaw==idx&&appliedCutContains(u32(idx),prevTc);
     var n=gradientAt(tc);
     if(fromAppliedCut){n=appliedCutNormal(u32(idx),prevTc);}
     let viewDir=normalize(u.camOrigin.xyz-hp);let lightDir=normalize(viewDir+vec3<f32>(0.35,0.5,0.25));
     let diffuse=0.28+0.72*abs(dot(n,lightDir));
     let spec=pow(max(dot(n,normalize(lightDir+viewDir)),0.0),20.0)*0.18;
     let a=u.segments[u32(idx)*2u];
     let isCutPreview=previewContains(u32(idx),tc);
     var col=u.segments[u32(idx)*2u+1u].rgb;
     var alpha=clamp(a.z,0.03,1.0);
     var lit=col*diffuse+vec3<f32>(spec);
     if(isCutPreview){
      col=vec3<f32>(1.0,0.16,0.055);
      alpha=max(alpha,0.94);
      lit=col*0.92+vec3<f32>(0.12,0.015,0.0);
     }
     let contribution=(1.0-acc.a)*alpha;acc=vec4<f32>(acc.rgb+lit*contribution,acc.a+contribution);
    }
    lastIndex=idx;
   }
  }else if(!canSample){lastIndex=-1;}

  for(var pi:u32=0u;pi<3u;pi=pi+1u){
   var pt=1e30;var which:i32=-1;
   if(axialT>=t-1e-7&&axialT<=nextT+1e-7&&axialT<pt){pt=axialT;which=0;}
   if(coronalT>=t-1e-7&&coronalT<=nextT+1e-7&&coronalT<pt){pt=coronalT;which=1;}
   if(sagittalT>=t-1e-7&&sagittalT<=nextT+1e-7&&sagittalT<pt){pt=sagittalT;which=2;}
   if(which<0){break;}
   let planePoint=u.camOrigin.xyz+dir*pt;let planeValue=huAt(texCoord(planePoint));
   let ww=max(u.mprWindow.y,1.0);let low=u.mprWindow.x-ww*0.5;let g=clamp((planeValue-low)/ww,0.0,1.0);
   var planeColor=vec3<f32>(g);
   let isSectionPlane=u.section.x>0.5&&i32(round(u.section.x))-1==which;
   if(!isSectionPlane){
    for(var s:u32=0u;s<4u;s=s+1u){
     let a=u.segments[s*2u];
     if(a.w>0.5&&planeValue>=a.x&&planeValue<=a.y){
      let tint=u.segments[s*2u+1u].rgb;let ta=min(0.75,clamp(a.z,0.0,1.0)*0.65);
      planeColor=mix(planeColor,tint,ta);
     }
    }
   }
   let pa=clamp(u.mprIndices.w,0.0,1.0);let contribution=(1.0-acc.a)*pa;
   acc=vec4<f32>(acc.rgb+planeColor*contribution,acc.a+contribution);
   if(which==0){axialT=1e30;}else if(which==1){coronalT=1e30;}else{sagittalT=1e30;}
  }

  previousT=t;t=nextT;
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
@group(0) @binding(2) var<storage,read> editRows:array<u32>;
@group(0) @binding(3) var<storage,read> pick:array<f32>;
@group(0) @binding(4) var<storage,read_write> result:array<u32>;
@group(0) @binding(5) var<storage,read> editIntervals:array<u32>;
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
fn editAllows(seg:u32,tc0:vec3<f32>)->bool{
 let activeMask=editRows[0];if((activeMask&(1u<<seg))==0u){return true;}
 let keepMask=editRows[1];
 let dims=vec3<u32>(u32(u.dimsSlope.x),u32(u.dimsSlope.y),u32(u.dimsSlope.z));
 let tc=clamp(tc0,vec3<f32>(0.0),vec3<f32>(0.999999));
 let p=min(vec3<u32>(tc*vec3<f32>(dims)),dims-vec3<u32>(1u));
 let rowCount=dims.y*dims.z;
 let base=2u+seg*(rowCount+1u);
 let row=p.z*dims.y+p.y;
 let start=editRows[base+row];
 let finish=editRows[base+row+1u];
 var inside=false;
 for(var k=start;k<finish;k=k+1u){
  let packed=editIntervals[k];
  let x0=packed&65535u;
  let x1=packed>>16u;
  if(p.x<x0){break;}
  if(p.x<=x1){inside=true;break;}
 }
 let keep=(keepMask&(1u<<seg))!=0u;return select(!inside,inside,keep);
}
fn segmentIndexAt(tc0:vec3<f32>,preferred:i32)->i32{
 let tc=clamp(tc0,vec3<f32>(0.0),vec3<f32>(0.999999));
 let v=huAt(tc);
 if(preferred>=0){
  let s=u32(preferred);
  let a=u.segments[s*2u];
  if(a.w>0.5&&v>=a.x&&v<=a.y&&editAllows(s,tc)){return preferred;}
  return -1;
 }
 for(var s:u32=0u;s<4u;s=s+1u){let a=u.segments[s*2u];if(a.w>0.5&&v>=a.x&&v<=a.y&&editAllows(s,tc)){return i32(s);}}
 return -1;
}
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid:vec3<u32>){
 let i=gid.x;
 let count=u32(pick[0]);
 if(i>=count){return;}
 let ib=4u+i*4u;
 let ob=i*4u;
 result[ob]=0u;result[ob+1u]=0u;result[ob+2u]=0u;result[ob+3u]=0u;
 let preferred=i32(round(pick[ib+2u]))-1;
 let ndc=vec2<f32>(pick[ib]/max(u.viewport.x,1.0)*2.0-1.0,1.0-pick[ib+1u]/max(u.viewport.y,1.0)*2.0);
 let dir=normalize(u.camForward.xyz+u.camRightTan.xyz*(ndc.x*u.camRightTan.w*u.camUpAspect.w)+u.camUpAspect.xyz*(ndc.y*u.camRightTan.w));
 let bounds=hitBox(u.camOrigin.xyz,dir,u.halfStep.xyz);if(bounds.x>bounds.y){return;}
 var t=max(bounds.x,0.0);let endT=bounds.y;let step=max(u.halfStep.w,0.00001);var previousT=t;
 for(var iter:u32=0u;iter<4096u;iter=iter+1u){
  if(t>endT){return;}let tc0=texCoord(u.camOrigin.xyz+dir*t);let idx=segmentIndexAt(tc0,preferred);
  if(idx>=0){
   var lo=previousT;var hi=t;
   for(var r:u32=0u;r<5u;r=r+1u){let mid=(lo+hi)*0.5;if(segmentIndexAt(texCoord(u.camOrigin.xyz+dir*mid),preferred)==idx){hi=mid;}else{lo=mid;}}
   let tc=clamp(texCoord(u.camOrigin.xyz+dir*hi),vec3<f32>(0.0),vec3<f32>(0.999999));
   result[ob]=min(u32(tc.x*u.dimsSlope.x),u32(u.dimsSlope.x)-1u);
   result[ob+1u]=min(u32(tc.y*u.dimsSlope.y),u32(u.dimsSlope.y)-1u);
   result[ob+2u]=min(u32(tc.z*u.dimsSlope.z),u32(u.dimsSlope.z)-1u);
   result[ob+3u]=u32(idx)+1u;return;
  }
  previousT=t;t+=step;
 }
}`;
}

function mprPlaneShader(){
 return `
struct MprParams{
 dims:vec4<u32>,
 plane:vec4<u32>,
 calibration:vec4<f32>
};
@group(0) @binding(0) var<uniform> p:MprParams;
@group(0) @binding(1) var volumeTex:texture_3d<f32>;
@group(0) @binding(2) var<storage,read_write> outValues:array<f32>;
fn huAt(x:u32,y:u32,z:u32)->f32{
 let q=textureLoad(volumeTex,vec3<i32>(i32(x),i32(y),i32(z)),0).rg*255.0;
 let raw=q.x+q.y*256.0-p.calibration.z;
 return raw*p.calibration.x+p.calibration.y;
}
@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid:vec3<u32>){
 let i=gid.x;
 let kind=p.plane.x;let index=p.plane.y;let outW=p.plane.z;let outH=p.plane.w;
 if(i>=outW*outH){return;}
 let ox=i%outW;let oy=i/outW;
 let sx=min(p.dims.x-1u,(ox*p.dims.x)/outW);
 let sy=min(p.dims.y-1u,(oy*p.dims.y)/outH);
 let sz=min(p.dims.z-1u,(oy*p.dims.z)/outH);
 var x:u32;var y:u32;var z:u32;
 if(kind==0u){
  x=sx;y=sy;z=index;
 }else if(kind==1u){
  x=sx;y=index;z=p.dims.z-1u-sz;
 }else{
  x=index;y=min(p.dims.y-1u,(ox*p.dims.y)/outW);z=p.dims.z-1u-sz;
 }
 outValues[i]=huAt(x,y,z);
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
  this.uniformBuffer=this.device.createBuffer({size:336,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
  this.sampler=this.device.createSampler({magFilter:'linear',minFilter:'linear',addressModeU:'clamp-to-edge',addressModeV:'clamp-to-edge',addressModeW:'clamp-to-edge'});
  const module=this.device.createShaderModule({label:'VRL medical volume raycast',code:safeWgsl(volumeShader())});
  this.pipeline=this.device.createRenderPipeline({label:'VRL medical volume raycast',layout:'auto',vertex:{module,entryPoint:'vs'},fragment:{module,entryPoint:'fs',targets:[{format:this.format}]},primitive:{topology:'triangle-list'}});
  const pickModule=this.device.createShaderModule({label:'VRL medical volume pick',code:safeWgsl(volumePickShader())});this.pickPipeline=this.device.createComputePipeline({label:'VRL medical volume pick',layout:'auto',compute:{module:pickModule,entryPoint:'main'}});this.pickBuffer=null;this.pickOutput=null;this.pickCapacity=0;
  const brickModule=this.device.createShaderModule({label:'VRL volume minmax bricks',code:safeWgsl(brickShader())});this.brickPipeline=this.device.createComputePipeline({label:'VRL volume minmax bricks',layout:'auto',compute:{module:brickModule,entryPoint:'main'}});this.brickBuffer=null;this.brickDims=[1,1,1];this.brickSize=8;
  const mprModule=this.device.createShaderModule({label:'VRL resident volume MPR',code:safeWgsl(mprPlaneShader())});this.mprPipeline=this.device.createComputePipeline({label:'VRL resident volume MPR',layout:'auto',compute:{module:mprModule,entryPoint:'main'}});this.mprUniformBuffer=this.device.createBuffer({size:48,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
  this.editRowsBuffer=null;this.editIntervalsBuffer=null;this.editSignature='';this.clearEditRuns();
  this.previewRowsBuffer=null;this.previewIntervalsBuffer=null;this.previewSignature='';this.clearPreviewRuns();
  this.appliedCutRowsBuffer=null;this.appliedCutIntervalsBuffer=null;this.appliedCutSignature='';this.clearAppliedCutRuns();
  this.texture=null;this.bindGroup=null;this.seriesId=null;this.bricksReady=false;this.previewVolume=null;this.previewPlaneBuffers={coronal:null,sagittal:null};this.active=false;this.halfExtents=[1,1,1];this.step=0.002;this.calibration={slope:1,intercept:0,signedBias:0};this.volume=null;
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
 async ensure(v,{prepareBricks=true,previewSide=0}={}){
  const support=this.support(v);if(!support.ok)throw new Error(support.reason);
  const s=v.series;
  if(this.seriesId===s.id&&this.texture){
   this.volume=v;if(prepareBricks)await this.ensureBricks();return;
  }
  this.resetData();this.volume=v;this.onStatus('WEBGPU VOLUME UPLOAD');
  const first=s.slices[0],signed=!!first.signed;let texture,popped=false;
  let preview=null,previewSourceZ=null,previewX=null,previewY=null;
  const previewMax=Math.max(0,Math.floor(previewSide||0));
  if(previewMax>0){
   const ratio=Math.min(1,previewMax/Math.max(s.columns,s.rows,s.slices.length)),pw=Math.max(1,Math.round(s.columns*ratio)),ph=Math.max(1,Math.round(s.rows*ratio)),pd=Math.max(1,Math.round(s.slices.length*ratio));
   try{
    preview={data:new Uint16Array(pw*ph*pd),dims:[pw,ph,pd],sourceDims:[s.columns,s.rows,s.slices.length]};
    previewSourceZ=new Int32Array(s.slices.length);previewSourceZ.fill(-1);
    previewX=new Uint32Array(pw);previewY=new Uint32Array(ph);
    for(let x=0;x<pw;x++)previewX[x]=pw<=1?0:Math.round(x*(s.columns-1)/(pw-1));
    for(let y=0;y<ph;y++)previewY[y]=ph<=1?0:Math.round(y*(s.rows-1)/(ph-1));
    for(let z=0;z<pd;z++){const src=pd<=1?0:Math.round(z*(s.slices.length-1)/(pd-1));previewSourceZ[src]=z}
   }catch{preview=null;previewSourceZ=previewX=previewY=null}
  }
  this.device.pushErrorScope?.('validation');
  try{
   texture=this.device.createTexture({label:'VRL DICOM volume',size:{width:s.columns,height:s.rows,depthOrArrayLayers:s.slices.length},dimension:'3d',format:'rg8unorm',usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST});
   for(let z=0;z<s.slices.length;z++){
    const packed=await packedRgSlice(s.slices[z]);
    this.device.queue.writeTexture({texture,origin:{x:0,y:0,z}},packed,{bytesPerRow:s.columns*2,rowsPerImage:s.rows},{width:s.columns,height:s.rows,depthOrArrayLayers:1});
    if(preview&&previewSourceZ){
     const pz=previewSourceZ[z];
     if(pz>=0){
      const [pw,ph]=preview.dims,base=pz*pw*ph;
      for(let py=0;py<ph;py++){
       const sy=previewY[py],srcRow=sy*s.columns*2,dstRow=base+py*pw;
       for(let px=0;px<pw;px++){const off=srcRow+previewX[px]*2;preview.data[dstRow+px]=packed[off]|(packed[off+1]<<8)}
      }
     }
    }
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
  this.calibration={slope:first.slope,intercept:first.intercept,signedBias:signed?32768:0};this.texture=texture;this.seriesId=s.id;this.bricksReady=false;this.previewVolume=preview;this.previewPlaneBuffers={coronal:null,sagittal:null};
  if(prepareBricks)await this.ensureBricks();else this.onStatus('WEBGPU VOLUME RESIDENT');
 }
 async ensureBricks(){
  if(this.bricksReady)return;
  const s=this.volume?.series;if(!s||!this.texture)throw new Error('GPU volume texture is not resident');
  const first=s.slices[0],signed=!!first.signed,bs=this.brickSize,bx=Math.ceil(s.columns/bs),by=Math.ceil(s.rows/bs),bz=Math.ceil(s.slices.length/bs),brickCount=bx*by*bz;this.brickDims=[bx,by,bz];
  this.brickBuffer?.destroy?.();this.brickBuffer=this.device.createBuffer({label:'VRL volume minmax bricks',size:Math.max(8,brickCount*8),usage:GPUBufferUsage.STORAGE});
  const meta=smallStorage(this.device,new Uint32Array([s.columns,s.rows,s.slices.length,bx,by,bz,bs,0])),params=smallStorage(this.device,new Float32Array([first.slope,first.intercept,signed?32768:0,0]));
  try{
   const brickGroup=this.device.createBindGroup({layout:this.brickPipeline.getBindGroupLayout(0),entries:[{binding:0,resource:this.texture.createView({dimension:'3d'})},{binding:1,resource:{buffer:meta}},{binding:2,resource:{buffer:params}},{binding:3,resource:{buffer:this.brickBuffer}}]}),brickEncoder=this.device.createCommandEncoder({label:'VRL volume minmax bricks'}),brickPass=brickEncoder.beginComputePass();
   brickPass.setPipeline(this.brickPipeline);brickPass.setBindGroup(0,brickGroup);brickPass.dispatchWorkgroups(Math.ceil(brickCount/64));brickPass.end();this.device.queue.submit([brickEncoder.finish()]);await this.device.queue.onSubmittedWorkDone();
  }finally{meta.destroy();params.destroy()}
  this.rebuildBindGroup();
  this.bricksReady=true;this.onStatus('WEBGPU VOLUME READY');
 }
 rebuildBindGroup(){
  if(!this.texture||!this.brickBuffer||!this.editRowsBuffer||!this.editIntervalsBuffer||!this.previewRowsBuffer||!this.previewIntervalsBuffer||!this.appliedCutRowsBuffer||!this.appliedCutIntervalsBuffer){this.bindGroup=null;return}
  this.bindGroup=this.device.createBindGroup({layout:this.pipeline.getBindGroupLayout(0),entries:[
   {binding:0,resource:{buffer:this.uniformBuffer}},{binding:1,resource:this.texture.createView({dimension:'3d'})},
   {binding:2,resource:{buffer:this.editRowsBuffer}},{binding:3,resource:{buffer:this.brickBuffer}},{binding:5,resource:{buffer:this.editIntervalsBuffer}},
   {binding:6,resource:{buffer:this.previewRowsBuffer}},{binding:7,resource:{buffer:this.previewIntervalsBuffer}},
   {binding:8,resource:{buffer:this.appliedCutRowsBuffer}},{binding:9,resource:{buffer:this.appliedCutIntervalsBuffer}}
  ]});
 }
 clearEditRuns(){
  this.editRowsBuffer?.destroy?.();this.editIntervalsBuffer?.destroy?.();
  this.editRowsBuffer=this.device.createBuffer({label:'VRL edit rows empty',size:8,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});
  this.editIntervalsBuffer=this.device.createBuffer({label:'VRL edit intervals empty',size:4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});
  this.device.queue.writeBuffer(this.editRowsBuffer,0,new Uint32Array([0,0]));this.device.queue.writeBuffer(this.editIntervalsBuffer,0,new Uint32Array([0]));
  this.editSignature='';if(this.texture&&this.brickBuffer)this.rebuildBindGroup();
 }
 clearPreviewRuns(){
  this.previewRowsBuffer?.destroy?.();this.previewIntervalsBuffer?.destroy?.();
  this.previewRowsBuffer=this.device.createBuffer({label:'VRL cut preview rows empty',size:8,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});
  this.previewIntervalsBuffer=this.device.createBuffer({label:'VRL cut preview intervals empty',size:4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});
  this.device.queue.writeBuffer(this.previewRowsBuffer,0,new Uint32Array([0,0]));this.device.queue.writeBuffer(this.previewIntervalsBuffer,0,new Uint32Array([0]));
  this.previewSignature='';if(this.texture&&this.brickBuffer&&this.editRowsBuffer&&this.editIntervalsBuffer)this.rebuildBindGroup();
 }
 setPreviewRuns(key,runs,segmentOrder,v){
  const seg=segmentOrder?.indexOf?.(key)??-1;
  if(!v||seg<0||!runs){this.clearPreviewRuns();return}
  const w=v.columns,h=v.rows,d=v.slices;if(w>65535)throw new Error('GPU cut preview RLE requires width <= 65535');
  const rowCount=h*d;let total=0;
  for(let z=0;z<d;z++)total+=(runs[z]?.length||0)/3;
  if(!total){this.clearPreviewRuns();return}
  const rows=new Uint32Array(2+rowCount),intervals=new Uint32Array(total);rows[0]=seg+1;let cursor=0,rowIndex=0;
  for(let z=0;z<d;z++){
   const rec=runs[z]||null;let ri=0;
   for(let y=0;y<h;y++,rowIndex++){
    rows[1+rowIndex]=cursor;
    while(rec&&ri<rec.length&&rec[ri]===y){
     const x0=rec[ri+1],x1=rec[ri+2];intervals[cursor++]=((x1&65535)<<16)|(x0&65535);ri+=3;
    }
   }
  }
  rows[1+rowCount]=cursor;
  const maxBinding=this.device.limits.maxStorageBufferBindingSize;
  if(rows.byteLength>maxBinding||intervals.byteLength>maxBinding)throw new Error('GPU cut preview RLE exceeds storage buffer limit');
  const rowsBuffer=this.device.createBuffer({label:'VRL cut preview row index',size:rows.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});
  const intervalsBuffer=this.device.createBuffer({label:'VRL cut preview intervals',size:intervals.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});
  this.device.queue.writeBuffer(rowsBuffer,0,rows);this.device.queue.writeBuffer(intervalsBuffer,0,intervals);
  this.previewRowsBuffer?.destroy?.();this.previewIntervalsBuffer?.destroy?.();this.previewRowsBuffer=rowsBuffer;this.previewIntervalsBuffer=intervalsBuffer;
  this.previewSignature=key+':'+cursor;this.rebuildBindGroup();
 }
 clearAppliedCutRuns(){
  this.appliedCutRowsBuffer?.destroy?.();this.appliedCutIntervalsBuffer?.destroy?.();
  this.appliedCutRowsBuffer=this.device.createBuffer({label:'VRL applied cut rows empty',size:8,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});
  this.appliedCutIntervalsBuffer=this.device.createBuffer({label:'VRL applied cut intervals empty',size:4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});
  this.device.queue.writeBuffer(this.appliedCutRowsBuffer,0,new Uint32Array([0,0]));
  this.device.queue.writeBuffer(this.appliedCutIntervalsBuffer,0,new Uint32Array([0]));
  this.appliedCutSignature='';
  if(this.texture&&this.brickBuffer&&this.editRowsBuffer&&this.editIntervalsBuffer&&this.previewRowsBuffer&&this.previewIntervalsBuffer)this.rebuildBindGroup();
 }
 setAppliedCutRuns(edits,segmentOrder,v){
  if(!v||!segmentOrder?.length){this.clearAppliedCutRuns();return}
  const w=v.columns,h=v.rows,d=v.slices;
  if(w>65535)throw new Error('GPU applied cut RLE requires width <= 65535');
  const rowCount=h*d;
  const descs=segmentOrder.slice(0,4).map(key=>edits?.[key]||null);
  let activeMask=0;
  let total=0;
  for(let s=0;s<descs.length;s++){
   const runs=descs[s]?.cutRuns;
   if(!runs)continue;
   let count=0;
   for(let z=0;z<d;z++)count+=(runs[z]?.length||0)/3;
   if(count){activeMask|=(1<<s);total+=count;}
  }
  if(!activeMask){this.clearAppliedCutRuns();return}
  const offsets=new Uint32Array(1+4*(rowCount+1));
  const intervals=new Uint32Array(Math.max(1,total));
  offsets[0]=activeMask;
  let cursor=0;
  for(let s=0;s<4;s++){
   const runs=descs[s]?.cutRuns||null;
   const base=1+s*(rowCount+1);
   let rowIndex=0;
   for(let z=0;z<d;z++){
    const rec=runs?.[z]||null;
    let ri=0;
    for(let y=0;y<h;y++,rowIndex++){
     offsets[base+rowIndex]=cursor;
     while(rec&&ri<rec.length&&rec[ri]===y){
      const x0=rec[ri+1];
      const x1=rec[ri+2];
      intervals[cursor++]=((x1&65535)<<16)|(x0&65535);
      ri+=3;
     }
    }
   }
   offsets[base+rowCount]=cursor;
  }
  const maxBinding=this.device.limits.maxStorageBufferBindingSize;
  if(offsets.byteLength>maxBinding||intervals.byteLength>maxBinding)throw new Error('GPU applied cut RLE exceeds storage buffer limit');
  const rowsBuffer=this.device.createBuffer({label:'VRL applied cut row index',size:offsets.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});
  const intervalsBuffer=this.device.createBuffer({label:'VRL applied cut intervals',size:intervals.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});
  this.device.queue.writeBuffer(rowsBuffer,0,offsets);
  this.device.queue.writeBuffer(intervalsBuffer,0,intervals);
  this.appliedCutRowsBuffer?.destroy?.();this.appliedCutIntervalsBuffer?.destroy?.();
  this.appliedCutRowsBuffer=rowsBuffer;
  this.appliedCutIntervalsBuffer=intervalsBuffer;
  this.appliedCutSignature=String(activeMask)+':'+String(cursor);
  this.rebuildBindGroup();
 }
 setEditRuns(edits,segmentOrder,v){
  if(!v||!segmentOrder?.length){this.clearEditRuns();this.clearAppliedCutRuns();return}
  this.setAppliedCutRuns(edits,segmentOrder,v);
  const w=v.columns,h=v.rows,d=v.slices;if(w>65535)throw new Error('GPU edit RLE requires width <= 65535');
  const rowCount=h*d,descs=segmentOrder.slice(0,4).map(key=>edits?.[key]||null);
  let activeMask=0,keepMask=0,total=0;
  for(let s=0;s<descs.length;s++){const desc=descs[s];if(!desc)continue;activeMask|=(1<<s);if(desc.mode==='keep')keepMask|=(1<<s);for(let z=0;z<d;z++)total+=(desc.runs?.[z]?.length||0)/3}
  if(!activeMask){this.clearEditRuns();return}
  const offsets=new Uint32Array(2+4*(rowCount+1)),intervals=new Uint32Array(Math.max(1,total));offsets[0]=activeMask;offsets[1]=keepMask;let cursor=0;
  for(let s=0;s<4;s++){
   const desc=descs[s],base=2+s*(rowCount+1);let rowIndex=0;
   for(let z=0;z<d;z++){
    const rec=desc?.runs?.[z]||null;let ri=0;
    for(let y=0;y<h;y++,rowIndex++){
     offsets[base+rowIndex]=cursor;
     while(rec&&ri<rec.length&&rec[ri]===y){const x0=rec[ri+1],x1=rec[ri+2];intervals[cursor++]=((x1&65535)<<16)|(x0&65535);ri+=3}
    }
   }
   offsets[base+rowCount]=cursor;
  }
  const maxBinding=this.device.limits.maxStorageBufferBindingSize;
  if(offsets.byteLength>maxBinding||intervals.byteLength>maxBinding)throw new Error('GPU edit RLE exceeds storage buffer limit');
  const rowsBuffer=this.device.createBuffer({label:'VRL edit row index',size:offsets.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});
  const intervalsBuffer=this.device.createBuffer({label:'VRL edit intervals',size:intervals.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});
  this.device.queue.writeBuffer(rowsBuffer,0,offsets);this.device.queue.writeBuffer(intervalsBuffer,0,intervals);
  this.editRowsBuffer?.destroy?.();this.editIntervalsBuffer?.destroy?.();this.editRowsBuffer=rowsBuffer;this.editIntervalsBuffer=intervalsBuffer;this.editSignature=String(activeMask)+':'+String(keepMask)+':'+String(cursor);this.rebuildBindGroup();
 }
 ensurePickCapacity(count){
  if(count<=this.pickCapacity&&this.pickBuffer&&this.pickOutput)return;
  let cap=1;while(cap<count)cap<<=1;this.pickBuffer?.destroy?.();this.pickOutput?.destroy?.();
  this.pickBuffer=this.device.createBuffer({label:'VRL volume batch picks',size:(cap+1)*16,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});
  this.pickOutput=this.device.createBuffer({label:'VRL volume batch pick output',size:cap*16,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST});this.pickCapacity=cap;
 }
 hasResident(v){
  return !!(this.texture&&v?.series&&this.seriesId===v.series.id);
 }
 hasPreview(v){
  return !!(this.previewVolume&&this.hasResident(v));
 }
 previewPlane(v,plane,index){
  if(!this.hasPreview(v))return null;
  const preview=this.previewVolume,[pw,ph,pd]=preview.dims,[w,h,d]=preview.sourceDims,data=preview.data,map=(value,srcN,dstN)=>dstN<=1?0:Math.max(0,Math.min(dstN-1,Math.round(value*(dstN-1)/Math.max(srcN-1,1))));
  if(plane==='axial'){
   const pz=map(index,d,pd),n=pw*ph;return{values:data.subarray(pz*n,(pz+1)*n),dims:[pw,ph],encoded:true,calibration:this.calibration};
  }
  if(plane==='coronal'){
   const py=map(index,h,ph),n=pw*pd;let out=this.previewPlaneBuffers.coronal;
   if(!out||out.length!==n)out=this.previewPlaneBuffers.coronal=new Uint16Array(n);
   for(let oy=0;oy<pd;oy++){const pz=pd-1-oy,src=pz*pw*ph+py*pw,dst=oy*pw;out.set(data.subarray(src,src+pw),dst)}
   return{values:out,dims:[pw,pd],encoded:true,calibration:this.calibration};
  }
  if(plane==='sagittal'){
   const px=map(index,w,pw),n=ph*pd;let out=this.previewPlaneBuffers.sagittal;
   if(!out||out.length!==n)out=this.previewPlaneBuffers.sagittal=new Uint16Array(n);
   let q=0;for(let oy=0;oy<pd;oy++){const pz=pd-1-oy,base=pz*pw*ph;for(let py=0;py<ph;py++)out[q++]=data[base+py*pw+px]}
   return{values:out,dims:[ph,pd],encoded:true,calibration:this.calibration};
  }
  return null;
 }
 extractPlane(v,plane,index,{maxSide=0}={}){
  const run=async()=>{
   if(!this.hasResident(v))return null;
   const w=v.columns,h=v.rows,d=v.slices,kind=plane==='axial'?0:plane==='coronal'?1:plane==='sagittal'?2:-1;
   if(kind<0)throw new Error('Unsupported MPR plane: '+plane);
   const maxIndex=kind===0?d-1:kind===1?h-1:w-1;if(index<0||index>maxIndex)throw new Error('MPR plane index out of range');
   const fullW=kind===0?w:kind===1?w:h,fullH=kind===0?h:d;
   let outW=fullW,outH=fullH;
   if(maxSide>0&&Math.max(fullW,fullH)>maxSide){
    const ratio=maxSide/Math.max(fullW,fullH);outW=Math.max(1,Math.round(fullW*ratio));outH=Math.max(1,Math.round(fullH*ratio));
   }
   const count=outW*outH,bytes=count*4;
   if(bytes>(this.device.limits.maxStorageBufferBindingSize||bytes))return null;
   const paramsBytes=new ArrayBuffer(48),u32=new Uint32Array(paramsBytes),f32=new Float32Array(paramsBytes);
   u32.set([w,h,d,0,kind,index,outW,outH],0);f32.set([this.calibration.slope,this.calibration.intercept,this.calibration.signedBias,0],8);
   const uniform=this.device.createBuffer({label:'VRL resident MPR params',size:48,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
   this.device.queue.writeBuffer(uniform,0,paramsBytes);
   const output=this.device.createBuffer({label:'VRL resident MPR output',size:Math.max(4,bytes),usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC}),read=this.device.createBuffer({label:'VRL resident MPR readback',size:Math.max(4,bytes),usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
   try{
    const group=this.device.createBindGroup({layout:this.mprPipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:uniform}},{binding:1,resource:this.texture.createView({dimension:'3d'})},{binding:2,resource:{buffer:output}}]}),encoder=this.device.createCommandEncoder({label:'VRL resident MPR extract'}),pass=encoder.beginComputePass();
    pass.setPipeline(this.mprPipeline);pass.setBindGroup(0,group);pass.dispatchWorkgroups(Math.ceil(count/256));pass.end();encoder.copyBufferToBuffer(output,0,read,0,bytes);this.device.queue.submit([encoder.finish()]);
    await read.mapAsync(GPUMapMode.READ);const values=new Float32Array(read.getMappedRange().slice(0,bytes));read.unmap();return{values,dims:[outW,outH],fullDims:[fullW,fullH]};
   }finally{
    try{if(read.mapState==='mapped')read.unmap()}catch{}uniform.destroy();output.destroy();read.destroy();
   }
  };
  return run();
 }
 setActive(active){
  this.active=!!active;this.canvas.style.display=this.active?'block':'none';
 }
 resize(){
  const ratio=Math.min(window.devicePixelRatio||1,1.5),w=Math.max(1,Math.floor(this.host.clientWidth*ratio)),h=Math.max(1,Math.floor(this.host.clientHeight*ratio));
  if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h}
 }
 render(camera,obj,segmentState,segmentOrder,mpr={}){
  if(!this.active||!this.texture||!this.bindGroup||!obj)return;
  this.resize();camera.updateMatrixWorld(true);obj.updateMatrixWorld(true);
  const inv=obj.matrixWorld.clone().invert(),origin=camera.getWorldPosition(new THREE.Vector3()).applyMatrix4(inv),q=camera.getWorldQuaternion(new THREE.Quaternion());
  const right=new THREE.Vector3(1,0,0).applyQuaternion(q).transformDirection(inv),up=new THREE.Vector3(0,1,0).applyQuaternion(q).transformDirection(inv),forward=new THREE.Vector3(0,0,-1).applyQuaternion(q).transformDirection(inv);
  const data=new Float32Array(84),put=(slot,a,b,c,d)=>{const i=slot*4;data[i]=a;data[i+1]=b;data[i+2]=c;data[i+3]=d};
  put(0,origin.x,origin.y,origin.z,0);put(1,right.x,right.y,right.z,Math.tan(THREE.MathUtils.degToRad(camera.fov*.5)));put(2,up.x,up.y,up.z,camera.aspect);put(3,forward.x,forward.y,forward.z,0);
  put(4,this.halfExtents[0],this.halfExtents[1],this.halfExtents[2],this.step);
  put(5,this.volume.columns,this.volume.rows,this.volume.slices,this.calibration.slope);put(6,this.calibration.intercept,this.calibration.signedBias,this.brickDims[0],this.brickDims[1]);put(7,this.canvas.width,this.canvas.height,this.brickDims[2],this.brickSize);
  for(let s=0;s<4;s++){
   const key=segmentOrder[s],seg=segmentState[key],enabled=seg?.active&&seg?.enabled?1:0,color=new THREE.Color(seg?.color||'#ffffff');
   put(8+s*2,seg?.min||0,seg?.max||0,seg?.opacity??1,enabled);put(9+s*2,color.r,color.g,color.b,1);
  }
  const indices=mpr.indices||[0,0,0],visible=mpr.visible||[0,0,0];
  put(16,+indices[0]||0,+indices[1]||0,+indices[2]||0,Number.isFinite(+mpr.opacity)?Math.max(0,Math.min(1,+mpr.opacity)):0);
  put(17,visible[0]?1:0,visible[1]?1:0,visible[2]?1:0,0);
  put(18,Number.isFinite(+mpr.windowCenter)?+mpr.windowCenter:0,Math.max(1,Number.isFinite(+mpr.windowWidth)?+mpr.windowWidth:1),0,0);
  const section=mpr.section||{},plane=section.plane,active=section.active&&plane,mode=plane==='axial'?1:plane==='coronal'?2:plane==='sagittal'?3:0;
  let coord=0;
  if(active&&this.volume){
   const idx=Number.isFinite(+section.index)?+section.index:0,w=this.volume.columns,h=this.volume.rows,d=this.volume.slices;
   if(mode===1)coord=((idx+.5)/Math.max(d,1)*2-1)*this.halfExtents[2];
   else if(mode===2)coord=(1-(idx+.5)/Math.max(h,1)*2)*this.halfExtents[1];
   else if(mode===3)coord=((idx+.5)/Math.max(w,1)*2-1)*this.halfExtents[0];
  }
  put(19,active?mode:0,coord,section.reverse?-1:1,0);
  put(20,section.capEnabled?1:0,Number.isFinite(+section.capOpacity)?Math.max(0,Math.min(1,+section.capOpacity)):.85,section.hatch?1:0,28);
  this.device.queue.writeBuffer(this.uniformBuffer,0,data);
  const encoder=this.device.createCommandEncoder({label:'VRL volume frame'}),view=this.context.getCurrentTexture().createView(),pass=encoder.beginRenderPass({colorAttachments:[{view,clearValue:{r:.035,g:.045,b:.05,a:1},loadOp:'clear',storeOp:'store'}]});
  pass.setPipeline(this.pipeline);pass.setBindGroup(0,this.bindGroup);pass.draw(3);pass.end();this.device.queue.submit([encoder.finish()]);
 }
 async pickMany(points,camera,obj,segmentState,segmentOrder,preferredKey=null){
  if(!this.active||!this.texture||!this.bindGroup||!obj||!points?.length)return points?.map(()=>null)||[];
  this.render(camera,obj,segmentState,segmentOrder);const count=points.length;this.ensurePickCapacity(count);
  const rect=this.rendererCanvas.getBoundingClientRect(),data=new Float32Array((count+1)*4);data[0]=count;
  const preferred=preferredKey?segmentOrder.indexOf(preferredKey):-1;
  for(let i=0;i<count;i++){const p=points[i],base=(i+1)*4;data[base]=(p.clientX-rect.left)/Math.max(rect.width,1)*this.canvas.width;data[base+1]=(p.clientY-rect.top)/Math.max(rect.height,1)*this.canvas.height;data[base+2]=preferred>=0?preferred+1:0}
  this.device.queue.writeBuffer(this.pickBuffer,0,data);
  const zero=new Uint32Array(count*4);this.device.queue.writeBuffer(this.pickOutput,0,zero);
  const group=this.device.createBindGroup({layout:this.pickPipeline.getBindGroupLayout(0),entries:[
   {binding:0,resource:{buffer:this.uniformBuffer}},{binding:1,resource:this.texture.createView({dimension:'3d'})},{binding:2,resource:{buffer:this.editRowsBuffer}},
   {binding:3,resource:{buffer:this.pickBuffer}},{binding:4,resource:{buffer:this.pickOutput}},{binding:5,resource:{buffer:this.editIntervalsBuffer}}
  ]});
  const bytes=count*16,read=this.device.createBuffer({size:bytes,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),encoder=this.device.createCommandEncoder({label:'VRL volume batch pick'}),pass=encoder.beginComputePass();
  pass.setPipeline(this.pickPipeline);pass.setBindGroup(0,group);pass.dispatchWorkgroups(Math.ceil(count/64));pass.end();encoder.copyBufferToBuffer(this.pickOutput,0,read,0,bytes);this.device.queue.submit([encoder.finish()]);
  await read.mapAsync(GPUMapMode.READ);const out=new Uint32Array(read.getMappedRange().slice(0));read.unmap();read.destroy();
  const result=new Array(count);
  for(let i=0;i<count;i++){const b=i*4,index=out[b+3];result[i]=index?{x:out[b],y:out[b+1],z:out[b+2],key:segmentOrder[index-1]}:null}
  return result;
 }
 async pick(clientX,clientY,camera,obj,segmentState,segmentOrder,preferredKey=null){
  const result=await this.pickMany([{clientX,clientY}],camera,obj,segmentState,segmentOrder,preferredKey);return result[0]||null;
 }
 resetData(){this.setActive(false);this.texture?.destroy?.();this.brickBuffer?.destroy?.();this.texture=null;this.brickBuffer=null;this.bindGroup=null;this.seriesId=null;this.bricksReady=false;this.previewVolume=null;this.previewPlaneBuffers={coronal:null,sagittal:null};this.volume=null;this.clearEditRuns();this.clearPreviewRuns();this.clearAppliedCutRuns()}
 destroy(){this.resetData();this.uniformBuffer?.destroy?.();this.pickBuffer?.destroy?.();this.pickOutput?.destroy?.();this.editRowsBuffer?.destroy?.();this.editIntervalsBuffer?.destroy?.();this.previewRowsBuffer?.destroy?.();this.previewIntervalsBuffer?.destroy?.();this.appliedCutRowsBuffer?.destroy?.();this.appliedCutIntervalsBuffer?.destroy?.();this.mprUniformBuffer?.destroy?.();this.canvas.remove()}
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
