// VR view (build 336 prototype). WebXR immersive-vr with WebGL2: Quest has no
// XRGPUBinding, WebGL2 + XRWebGLLayer reached 90 fps there (owner, build 335).
// Only drawing and controller input are VR-specific. The data is the same as
// the WebGPU volume: gpuVolumeTarget() (filters applied when the 3D view has
// them), volumeTexturePlan / reduceSliceArea / packedRgSlice / packCtSlice for
// the rg8-packed u16 texture, segmentState for thresholds and colours. The
// fragment shader is a GLSL port of volumeShader() (medical-volume.js): same
// segment test, 6-step hit refinement, gradient normal and shading constants.
// Not shown yet: processed edits, cuts, section view, MPR planes.
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.186.0/build/three.module.js';
import { volumeTexturePlan, reduceSliceArea, packedRgSlice, packCtSlice, gpuRunsForTexture } from './medical-volume.js?v=20260930-build349';
import { gpuVolumeTarget, gpuVolumeEditDescriptors } from './gpu-volume-data.js?v=20260930-build349';
import { SEGMENT_PRESET_ORDER, segmentState } from './segments.js?v=20260930-build349';
import { tr } from './i18n.js?v=20260930-build349';
import { wc, ww } from './ui-shell.js?v=20260930-build349';

const BG=new THREE.Color(0.035,0.045,0.05);
const BRICK=8;
// 512 per side, like the default 3D plan (owner: 30 fps flat view at 512)
const VR_TARGET_SIDE=512;

export async function vrSupported(mode='immersive-vr'){
 try{return !!navigator.xr&&await navigator.xr.isSessionSupported(mode)}catch{return false}
}

const vertexShader=`
uniform vec3 halfExt;
out vec3 vPos;
out vec3 vOrigin;
void main(){
 vPos=position*halfExt;
 vOrigin=(inverse(modelMatrix)*vec4(cameraPosition,1.0)).xyz;
 gl_Position=projectionMatrix*modelViewMatrix*vec4(vPos,1.0);
}`;

const fragmentShader=`
precision highp float;
precision highp sampler3D;
uniform sampler3D vol;
uniform sampler3D bricks;
uniform vec3 halfExt;
uniform vec3 texDims;
uniform vec3 brickDims;
uniform float stepSize;
// diagnostics (build 339/341): 0 normal, 1 box only (no marching), 2 loop
// count heat map (blue = few iterations, red = 1024 or more), 3 no shading at
// hits (no refinement, no gradient), 4 no empty-space skipping
uniform int diag;
uniform vec3 calib; // slope, intercept, signedBias
uniform vec4 segA[4]; // min, max, opacity, enabled
uniform vec4 segC[4]; // rgb, w=1: simple display (no refinement, no gradient)
// hand-held section (build 344), object space: the kept side is
// dot(cutPlane.xyz,p) >= cutPlane.w (the far side from the eye). cutOn clips
// the volume; sliceOpacity > 0 draws the oblique CT slice on the plane,
// resampled every frame from sliceVol (the 512 data) with the app's window
// processed segments / edits (build 348): the same keep/exclude runs the
// WebGPU volume uses (gpuVolumeEditDescriptors), rasterised to one byte per
// voxel; bit s = voxel allowed for segment s, only for segments in editMask
uniform int editMask;
uniform sampler3D editTex;
uniform vec4 cutPlane;
uniform int cutOn;
uniform float sliceOpacity;
uniform vec2 sliceWindow; // center, width
uniform sampler3D sliceVol;
in vec3 vPos;
in vec3 vOrigin;
out highp vec4 outColor;
vec2 hitBox(vec3 o,vec3 d){
 vec3 inv=1.0/d;vec3 a=(-halfExt-o)*inv;vec3 b=(halfExt-o)*inv;
 vec3 lo=min(a,b);vec3 hi=max(a,b);
 return vec2(max(lo.x,max(lo.y,lo.z)),min(hi.x,min(hi.y,hi.z)));
}
vec3 texCoord(vec3 p){return vec3(p.x/(2.0*halfExt.x)+0.5,0.5-p.y/(2.0*halfExt.y),p.z/(2.0*halfExt.z)+0.5);}
float huAt(vec3 tc0){
 vec3 tc=clamp(tc0,vec3(0.0),vec3(0.999999));
 vec2 q=texture(vol,tc).rg*255.0;
 return (q.x+q.y*256.0-calib.z)*calib.x+calib.y;
}
bool editAllows(int s,vec3 tc){
 if(((editMask>>s)&1)==0)return true;
 int bits=int(texture(editTex,clamp(tc,vec3(0.0),vec3(0.999999))).r*255.0+0.5);
 return ((bits>>s)&1)==1;
}
int segmentIndexAt(vec3 tc){
 float v=huAt(tc);
 for(int s=0;s<4;s++){vec4 a=segA[s];if(a.w>0.5&&v>=a.x&&v<=a.y&&editAllows(s,tc))return s;}
 return -1;
}
bool brickMayContain(vec3 tc){
 vec2 mm=texture(bricks,clamp(tc,vec3(0.0),vec3(0.999999))).rg;
 for(int s=0;s<4;s++){vec4 a=segA[s];if(a.w>0.5&&a.y>=mm.x&&a.x<=mm.y)return true;}
 return false;
}
// distance along dir (object space) to leave the current brick
float brickExit(vec3 tc,vec3 dir){
 vec3 dtc=vec3(dir.x/(2.0*halfExt.x),-dir.y/(2.0*halfExt.y),dir.z/(2.0*halfExt.z));
 vec3 cell=floor(clamp(tc,vec3(0.0),vec3(0.999999))*brickDims);
 float best=1e20;
 for(int i=0;i<3;i++){
  if(abs(dtc[i])>1e-8){
   float edge=(dtc[i]>0.0?cell[i]+1.0:cell[i])/brickDims[i];
   float dt=(edge-tc[i])/dtc[i];
   if(dt>1e-7)best=min(best,dt);
  }
 }
 return best;
}
float sliceGray(vec3 p){
 vec2 q=texture(sliceVol,clamp(texCoord(p),vec3(0.0),vec3(0.999999))).rg*255.0;
 float hu=(q.x+q.y*256.0-calib.z)*calib.x+calib.y;
 return clamp((hu-(sliceWindow.x-0.5*sliceWindow.y))/max(sliceWindow.y,1e-3),0.0,1.0);
}
vec3 gradientAt(vec3 tc){
 vec3 d=1.0/max(texDims,vec3(1.0));
 float gx=huAt(tc+vec3(d.x,0.0,0.0))-huAt(tc-vec3(d.x,0.0,0.0));
 float gy=huAt(tc+vec3(0.0,d.y,0.0))-huAt(tc-vec3(0.0,d.y,0.0));
 float gz=huAt(tc+vec3(0.0,0.0,d.z))-huAt(tc-vec3(0.0,0.0,d.z));
 vec3 voxel=2.0*halfExt/max(texDims,vec3(1.0));
 vec3 g=vec3(gx/max(voxel.x,1e-6),-gy/max(voxel.y,1e-6),gz/max(voxel.z,1e-6));
 float l=length(g);return l<1e-6?vec3(0.0,0.0,1.0):g/l;
}
void main(){
 vec3 o=vOrigin;vec3 dir=normalize(vPos-vOrigin);
 vec2 bounds=hitBox(o,dir);
 if(bounds.x>bounds.y)discard;
 if(diag==1){outColor=vec4(0.2,0.35,0.5,1.0);return;}
 float t=max(bounds.x,0.0);float endT=bounds.y;float step=max(stepSize,1e-5);
 float planeT=-1.0;
 if(cutOn>0||sliceOpacity>0.0){
  float side=dot(cutPlane.xyz,o)-cutPlane.w;float slope=dot(cutPlane.xyz,dir);
  if(abs(slope)>1e-8){
   float cross=-side/slope;
   if(cross>=t-1e-6&&cross<=endT+1e-6)planeT=cross;
   if(cutOn>0){if(slope>0.0)t=max(t,cross);else endT=min(endT,cross);}
  }else if(cutOn>0&&side<0.0)discard;
  if(cutOn>0&&t>endT+1e-6&&planeT<0.0)discard;
 }
 bool sliceDone=sliceOpacity<=0.0||planeT<0.0;
 float previousT=t;int lastIndex=-1;vec4 acc=vec4(0.0);int iters=0;
 for(int iter=0;iter<4096;iter++){
  if(t>endT||acc.a>0.985)break;
  iters++;
  if(!sliceDone&&planeT<=t+step){
   // the slice lies before the next sample: composite it in depth order
   float g=sliceGray(o+dir*planeT);
   float contribution=(1.0-acc.a)*sliceOpacity;acc=vec4(acc.rgb+vec3(g)*contribution,acc.a+contribution);
   sliceDone=true;
  }
  vec3 p=o+dir*t;vec3 tc0=texCoord(p);
  bool canSample=diag==4||brickMayContain(tc0);
  float nextT=t+step;
  if(!canSample){nextT=t+max(brickExit(tc0,dir)+step*0.05,step);lastIndex=-1;}
  else{
   int idx=segmentIndexAt(tc0);
   if(idx!=lastIndex){
    if(idx>=0){
     float lo=previousT;float hi=t;bool simple=diag==3||segC[idx].w>0.5;
     if(!simple)for(int r=0;r<6;r++){float mid=(lo+hi)*0.5;if(segmentIndexAt(texCoord(o+dir*mid))==idx)hi=mid;else lo=mid;}
     vec3 hp=o+dir*hi;vec3 tc=texCoord(hp);
     vec3 n=simple?-dir:gradientAt(tc);
     vec3 viewDir=normalize(o-hp);vec3 lightDir=normalize(viewDir+vec3(0.35,0.5,0.25));
     float diffuse=0.28+0.72*abs(dot(n,lightDir));
     float spec=pow(max(dot(n,normalize(lightDir+viewDir)),0.0),20.0)*0.18;
     float alpha=clamp(segA[idx].z,0.03,1.0);
     vec3 lit=segC[idx].rgb*diffuse+vec3(spec);
     float contribution=(1.0-acc.a)*alpha;acc=vec4(acc.rgb+lit*contribution,acc.a+contribution);
    }
    lastIndex=idx;
   }
  }
  previousT=t;t=nextT;
 }
 if(!sliceDone&&acc.a<=0.985){
  float g=sliceGray(o+dir*planeT);
  float contribution=(1.0-acc.a)*sliceOpacity;acc=vec4(acc.rgb+vec3(g)*contribution,acc.a+contribution);
 }
 if(diag==2){float h=clamp(float(iters)/1024.0,0.0,1.0);outColor=vec4(h,1.0-abs(h*2.0-1.0),1.0-h,1.0);return;}
 if(acc.a<0.004)discard;
 // premultiplied, blended over the VR background (raw colour like the
 // WebGPU canvas: no colour-space conversion)
 outColor=acc;
}`;

// brick min/max in HU; one voxel of overlap so trilinear samples at a
// brick edge are covered
function computeBricks(data,[tw,th,td],[slope,intercept,bias]){
 const bx=Math.ceil(tw/BRICK),by=Math.ceil(th/BRICK),bz=Math.ceil(td/BRICK),mm=new Float32Array(bx*by*bz*2);
 for(let k=0;k<bz;k++)for(let j=0;j<by;j++)for(let i=0;i<bx;i++){
  let lo=65535,hi=0;
  const z0=Math.max(0,k*BRICK-1),z1=Math.min(td,(k+1)*BRICK+1),y0=Math.max(0,j*BRICK-1),y1=Math.min(th,(j+1)*BRICK+1),x0=Math.max(0,i*BRICK-1),x1=Math.min(tw,(i+1)*BRICK+1);
  for(let z=z0;z<z1;z++)for(let y=y0;y<y1;y++){let o=(z*th+y)*tw*2+x0*2;for(let x=x0;x<x1;x++,o+=2){const w=data[o]|(data[o+1]<<8);if(w<lo)lo=w;if(w>hi)hi=w}}
  const b=((k*by+j)*bx+i)*2,a=(lo-bias)*slope+intercept,c=(hi-bias)*slope+intercept;mm[b]=Math.min(a,c);mm[b+1]=Math.max(a,c);
 }
 return{bricks:mm,brickDims:[bx,by,bz]};
}
// half-size copy (2×2×2 average). Build 341 measured texture reads of 512³
// as the main per-ray cost; owner: 256³ comfortable and fine to observe, so
// it is the VR default (build 342), 512³ stays selectable
function halveVolume(vd){
 const [w,h,d]=vd.dims,tw=Math.max(1,w>>1),th=Math.max(1,h>>1),td=Math.max(1,d>>1),src=vd.data,out=new Uint8Array(tw*th*td*2);
 for(let z=0;z<td;z++)for(let y=0;y<th;y++)for(let x=0;x<tw;x++){
  let acc=0;
  for(let dz=0;dz<2;dz++)for(let dy=0;dy<2;dy++){const o=(((z*2+dz)*h+(y*2+dy))*w+x*2)*2;acc+=(src[o]|(src[o+1]<<8))+(src[o+2]|(src[o+3]<<8))}
  const v=Math.round(acc/8),o=((z*th+y)*tw+x)*2;out[o]=v&255;out[o+1]=v>>8;
 }
 return{...vd,data:out,dims:[tw,th,td],...computeBricks(out,[tw,th,td],vd.calibration)};
}

// processed-segment mask on the VR texture grid (dims): the WebGPU edit runs
// mapped with the same gpuRunsForTexture (exclude runs dilated by one on a
// reduced grid, as the WebGPU volume does)
function buildEditMask(dims){
 const v=gpuVolumeTarget();if(!v)return{activeMask:0,data:null};
 const descs=gpuVolumeEditDescriptors(),[w,h,d]=dims,sourceDims=[v.columns,v.rows,v.slices],reduced=w!==v.columns||h!==v.rows||d!==v.slices;
 let activeMask=0,data=null;
 SEGMENT_PRESET_ORDER.slice(0,4).forEach((key,si)=>{
  const desc=descs[key];if(!desc?.runs)return;
  const runs=gpuRunsForTexture(desc.runs,sourceDims,dims,{dilate:reduced&&desc.mode==='exclude'?1:0});
  data||=new Uint8Array(w*h*d);const bit=1<<si;activeMask|=bit;
  if(desc.mode==='exclude')for(let i=0;i<data.length;i++)data[i]|=bit;
  for(let z=0;z<d;z++){const rec=runs?.[z];if(!rec?.length)continue;
   for(let i=0;i<rec.length;i+=3){const o=(z*h+rec[i])*w;
    if(desc.mode==='keep')for(let x=rec[i+1];x<=rec[i+2];x++)data[o+x]|=bit;
    else for(let x=rec[i+1];x<=rec[i+2];x++)data[o+x]&=~bit;
   }
  }
 });
 return{activeMask,data};
}
// rg8-packed u16 texture of the current volume, built with the same plan,
// area reduction and packing as the WebGPU upload, plus per-brick HU min/max
async function buildVolumeData(maxDim,onProgress){
 const v=gpuVolumeTarget(),s=v?.series;
 if(!v?.sourceBacked||!s)throw new Error('VR: open a DICOM series first');
 const plan=volumeTexturePlan(v,0,maxDim,VR_TARGET_SIDE),[tw,th,td]=plan.dims,first=s.slices[0],signed=!!first.signed;
 const filtered=!!(v.filterSignature&&typeof v.sliceData==='function');
 const sliceBytes=filtered?async z=>packCtSlice(await v.sliceData(z),first):z=>packedRgSlice(s.slices[z]);
 const data=new Uint8Array(tw*th*td*2),sliceSize=tw*th*2;
 const spans=(n,t)=>{const a=new Uint32Array(t+1);for(let i=0;i<=t;i++)a[i]=Math.min(n,Math.round(i*n/t));for(let i=0;i<t;i++)if(a[i+1]<=a[i])a[i+1]=Math.min(n,a[i]+1);return a};
 const xs=spans(s.columns,tw),ys=spans(s.rows,th),rowSum=new Float64Array(tw),rowCnt=new Uint32Array(tw);
 const zMap=new Uint32Array(td);for(let z=0;z<td;z++)zMap[z]=td<=1?0:Math.round(z*(s.slices.length-1)/(td-1));
 for(let z=0;z<td;z++){
  const packed=await sliceBytes(plan.reduced?zMap[z]:z),out=data.subarray(z*sliceSize,(z+1)*sliceSize);
  if(plan.reduced)reduceSliceArea(packed,s.columns,xs,ys,tw,th,tw*2,out,rowSum,rowCnt);else out.set(packed.subarray(0,sliceSize));
  if((z&15)===15||z===td-1){onProgress?.(z+1,td);await new Promise(r=>setTimeout(r,0))}
 }
 const slope=first.slope||1,intercept=first.intercept||0,bias=signed?32768:0,calibration=[slope,intercept,bias];
 const {bricks:mm,brickDims}=computeBricks(data,[tw,th,td],calibration);
 const px=s.columns*s.spacingX,py=s.rows*s.spacingY,pz=s.slices.length*s.spacingZ,maxP=Math.max(px,py,pz,1),scale=3.3/maxP;
 const halfExt=[px*scale*.5,py*scale*.5,pz*scale*.5],step=Math.max(1e-5,Math.min(px/tw,py/th,pz/td)*scale*.85);
 return{data,dims:[tw,th,td],bricks:mm,brickDims,halfExt,step,calibration,filtered};
}

// VR settings kept per browser (resolution only applies when a session starts)
const SETTINGS_KEY='vrl-vr-settings-3';
// menuMode 0 follows the head lazily, 1 stays where it is; secHold 0 grip
// picks the section up near the frame, 1 trigger fixes / picks it up
const DEFAULTS={menuMode:0,secHold:0,cut:1,sliceOpacity:0.6,data:1,quality:0,vres:0,foveation:2,rate:0};
function loadSettings(){try{return{...DEFAULTS,...JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}')}}catch{return{...DEFAULTS}}}
function saveSettings(v){try{localStorage.setItem(SETTINGS_KEY,JSON.stringify(v))}catch{}}
// VRES: the ray-marched volume is drawn into an offscreen target this much
// smaller per axis and scaled up where the volume box covers the view. Owner,
// build 337: fps fell from 30 to 16 when the volume was enlarged, so the cost
// follows the covered pixels.
// 0 = auto (build 340). Owner, build 339: box only keeps 90 fps, marching
// drops to 15 when the volume fills the view, 100 % is slower than 50 %: the
// cost follows the marched pixels, so auto keeps the frame time by lowering
// the resolution while the volume is large and raising it when small.
const VRES=[0,1,0.7,0.5],AUTO_MIN=0.25,AUTO_MAX=0.8,STEP=[1,1.5,2],FOVEATION=[0,0.5,1];

// upscales the offscreen volume image; drawn with the volume box so only the
// covered pixels are touched
const compositeVertex=`
uniform vec3 halfExt;
void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position*halfExt,1.0);}`;
const compositeFragment=`
precision highp float;
uniform sampler2D img;
uniform vec2 invSize; // resolution factor / offscreen target size
out highp vec4 outColor;
void main(){outColor=texture(img,gl_FragCoord.xy*invSize);}`;

// background: a dark gradient dome and a floor grid (a few triangles, no
// cost next to the ray marching)
function makeBackground(){
 const g=new THREE.Group();
 const dome=new THREE.Mesh(new THREE.SphereGeometry(30,32,16),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,toneMapped:false,
  vertexShader:'varying float h;void main(){h=normalize(position).y;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
  fragmentShader:'varying float h;void main(){vec3 lo=vec3(0.035,0.045,0.05);vec3 hi=vec3(0.10,0.14,0.20);gl_FragColor=vec4(mix(lo,hi,smoothstep(-0.1,0.8,h)),1.0);}'}));
 const grid=new THREE.GridHelper(12,24,0x3a5a70,0x1e2e3a);grid.material.transparent=true;grid.material.opacity=0.55;grid.renderOrder=-1;
 g.add(dome,grid);return g;
}

// Canvas-drawn menu (build 345). Beginner-first layout: header (title, follow
// or fixed, close), tabs, one status line, then the tab's widgets. Widgets:
// {type:'button',x,y,w,h,label,on,color,action}, {type:'label',x,y,text},
// {type:'slider',x,y,w,h,value(0..1),text,set(v)}. The trigger presses a
// button or drags a slider while held.
const MENU_W=1024,MENU_H=820;
function makeMenu(){
 const W=MENU_W,H=MENU_H,canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;
 const ctx=canvas.getContext('2d'),tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;
 const mesh=new THREE.Mesh(new THREE.PlaneGeometry(0.5,0.5*H/W),new THREE.MeshBasicMaterial({map:tex,transparent:true,toneMapped:false}));
 let widgets=[],hover=-1,draw=()=>[],dirty=true;
 const render=()=>{
  ctx.clearRect(0,0,W,H);ctx.fillStyle='rgba(14,20,27,.94)';ctx.beginPath();ctx.roundRect(0,0,W,H,30);ctx.fill();
  ctx.textBaseline='middle';
  widgets.forEach((w,i)=>{
   if(w.type==='label'){ctx.fillStyle=w.color||'#cfe3f0';ctx.font=(w.bold?'bold ':'')+(w.size||30)+'px system-ui,sans-serif';ctx.textAlign='left';ctx.fillText(w.text,w.x,w.y);return}
   if(w.type==='slider'){
    ctx.fillStyle='#26313b';ctx.beginPath();ctx.roundRect(w.x,w.y+w.h/2-10,w.w,20,10);ctx.fill();
    ctx.fillStyle='#2d6cdf';ctx.beginPath();ctx.roundRect(w.x,w.y+w.h/2-10,Math.max(20,w.w*w.value),20,10);ctx.fill();
    const kx=w.x+w.w*w.value;ctx.fillStyle=i===hover?'#fff':'#dfe8f0';ctx.beginPath();ctx.arc(kx,w.y+w.h/2,26,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#fff';ctx.font='30px system-ui,sans-serif';ctx.textAlign='left';ctx.fillText(w.text,w.x+w.w+30,w.y+w.h/2);return;
   }
   ctx.fillStyle=w.on?(w.color||'#2d6cdf'):(i===hover?'#3a4652':'#26313b');ctx.beginPath();ctx.roundRect(w.x,w.y,w.w,w.h,16);ctx.fill();
   if(w.color&&!w.on){ctx.strokeStyle=w.color;ctx.lineWidth=4;ctx.stroke()}
   if(i===hover){ctx.strokeStyle='#fff';ctx.lineWidth=4;ctx.stroke()}
   // dark text on a light fill (e.g. the bone colour)
   let fg='#fff';if(w.on&&w.color){const c=new THREE.Color(w.color);if(0.2126*c.r+0.7152*c.g+0.0722*c.b>0.6)fg='#111'}
   ctx.fillStyle=fg;ctx.font=(w.size||30)+'px system-ui,sans-serif';ctx.textAlign='center';ctx.fillText(w.label,w.x+w.w/2,w.y+w.h/2+1);
  });
  ctx.textAlign='left';ctx.textBaseline='alphabetic';tex.needsUpdate=true;dirty=false;
 };
 const at=uv=>({x:uv.x*W,y:(1-uv.y)*H});
 return{mesh,
  refresh(){widgets=draw();dirty=true},
  flush(){if(dirty)render()},
  onDraw(f){draw=f},
  hit(uv){const p=at(uv);return widgets.findIndex(w=>(w.action||w.set)&&p.x>=w.x-(w.type==='slider'?26:0)&&p.x<=w.x+w.w+(w.type==='slider'?26:0)&&p.y>=w.y&&p.y<=w.y+w.h)},
  widget(i){return widgets[i]},
  setHover(i){if(i!==hover){hover=i;dirty=true}},
  press(i){const w=widgets[i];if(!w?.action)return false;w.action();widgets=draw();dirty=true;return true},
  drag(i,uv){const w=widgets[i];if(!w?.set)return;const v=Math.min(1,Math.max(0,(at(uv).x-w.x)/w.w));w.set(v);widgets=draw();dirty=true},
  dispose(){tex.dispose();mesh.geometry.dispose();mesh.material.dispose()}};
}
// small tag on the left controller while the menu is closed (open it by
// pointing at it); a plain textured plane
function makeBadge(text){
 const canvas=document.createElement('canvas');canvas.width=256;canvas.height=96;const ctx=canvas.getContext('2d');
 ctx.fillStyle='rgba(45,108,223,.95)';ctx.beginPath();ctx.roundRect(0,0,256,96,24);ctx.fill();ctx.fillStyle='#fff';ctx.font='bold 40px system-ui,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,128,50);
 const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;
 const mesh=new THREE.Mesh(new THREE.PlaneGeometry(0.08,0.03),new THREE.MeshBasicMaterial({map:tex,transparent:true,toneMapped:false}));
 mesh.position.set(0,0.05,0.02);mesh.rotation.x=-0.6;mesh.userData.dispose=()=>{tex.dispose();mesh.geometry.dispose();mesh.material.dispose()};
 return mesh;
}

// screenshots of the left eye (build 345): kept until the page offers them
// for saving after the session (a download from inside the headset view is
// not reliable)
const shots=[];
function showShotsPanel(ja){
 if(!shots.length)return;
 document.getElementById('vr-shots-panel')?.remove();
 const panel=document.createElement('div');panel.id='vr-shots-panel';
 Object.assign(panel.style,{position:'fixed',right:'16px',bottom:'16px',zIndex:'9999',background:'#111a',backdropFilter:'blur(6px)',color:'#fff',padding:'12px',borderRadius:'12px',maxWidth:'min(92vw,560px)',maxHeight:'70vh',overflow:'auto',font:'14px system-ui,sans-serif'});
 const head=document.createElement('div');head.style.cssText='display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:8px';
 head.innerHTML='<strong></strong><button type="button"></button>';head.querySelector('strong').textContent=(ja?'VRのスクリーンショット ':'VR screenshots ')+shots.length;
 const close=head.querySelector('button');close.textContent=ja?'閉じる':'Close';close.onclick=()=>panel.remove();panel.append(head);
 const grid=document.createElement('div');grid.style.cssText='display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px';
 for(const s of shots){const a=document.createElement('a');a.href=s.url;a.download=s.name;a.title=s.name;a.style.cssText='color:#9cf;text-decoration:none';
  const img=document.createElement('img');img.src=s.url;img.style.cssText='width:100%;border-radius:8px;display:block;background:#000';
  const cap=document.createElement('div');cap.textContent=(ja?'保存 ':'Save ')+s.name.slice(-10,-4);a.append(img,cap);grid.append(a)}
 panel.append(grid);document.body.append(panel);
}

let running=null;
// mode 'vr': own background; 'ar' (build 343): immersive-ar passthrough on
// Quest, no background drawn and the clear is transparent
export async function startVrView({language='ja',mode='vr'}={}){
 if(running)return;
 const ja=language==='ja',settings=loadSettings();settings.diag=0;
 const ar=mode==='ar',renderer=new THREE.WebGLRenderer({antialias:false,alpha:ar,preserveDrawingBuffer:false});
 renderer.setPixelRatio(1);renderer.setSize(8,8,false);renderer.xr.enabled=true;renderer.xr.setReferenceSpaceType('local-floor');
 Object.assign(renderer.domElement.style,{position:'fixed',left:'0',top:'0',width:'1px',height:'1px',opacity:'0',pointerEvents:'none'});
 document.body.appendChild(renderer.domElement);
 // requestSession must run inside the click; the texture is built afterwards
 // while the headset shows progress
 let session;
 try{session=await navigator.xr.requestSession(ar?'immersive-ar':'immersive-vr',{optionalFeatures:['local-floor']})}
 catch(e){renderer.dispose();renderer.domElement.remove();throw e}
 running={session};
 const scene=new THREE.Scene();scene.background=ar?null:BG.clone();
 const background=makeBackground();if(ar){background.visible=false;renderer.setClearColor(0x000000,0)}else scene.add(background);
 const camera=new THREE.PerspectiveCamera(70,1,0.01,50);
 const L=ja?{title:'Virtual Rodent Lab',tabs:['表示','断面','画質','詳細'],follow:'ついて来る',fixed:'固定',menuPos:'メニューの位置',menuKey:'A/Xボタン：メニューを閉じる／開く（閉じると左手に「メニュー」の札）',close:'閉じる',badge:'メニュー',
   seg:'セグメント',segModes:['通常','簡易','非表示'],noSeg:'表示中のセグメントがありません（アプリで閾値を設定）',home:'正面に戻す',reloadEdits:'加工を再読み込み',reloaded:'アプリの加工結果を読み込みました',shot:'スクリーンショット',exit:'終了',
   sec:'断面',offOn:['オフ','オン'],hold:'持ち方',holdModes:['グリップ','トリガー'],cut:'切り取り',cutModes:['オフ','手前','片側'],flip:'向きを反転',cutHelp:'片側：矢印の側を消します（見る位置を変えても同じ側）',sl:'スライス不透明度',
   secHelp:['枠の近く（白くなる）でグリップを押している間だけ持てます','枠の近く（白くなる）でトリガーを押している間だけ持てます'],secOff:'「オン」かB/Yボタンで断面を出します',
   r:'ボリューム解像度',auto:'自動',dt:'データ',q:'描画の細かさ',qv:['標準','粗め','最粗'],f:'周辺の簡略化',fv:['なし','中','強'],hz:'リフレッシュレート',diag:'診断',dv:['通常','箱のみ','ループ数','陰影なし','スキップなし'],
   stHeld:'断面：手で持っています',stFixed:'断面：固定中',stNone:'グリップでつかむ・両手で拡大縮小',preparing:'VRボリューム準備中… ',failed:'VR準備に失敗: ',shotDone:'スクリーンショットを撮りました（終了後にページで保存）',filtered:' フィルター適用'}
  :{title:'Virtual Rodent Lab',tabs:['View','Section','Quality','Details'],follow:'Follow',fixed:'Fixed',menuPos:'Menu position',menuKey:'A/X: close / open the menu (closed: a Menu tag on the left hand)',close:'Close',badge:'Menu',
   seg:'Segments',segModes:['Normal','Simple','Hidden'],noSeg:'No segment shown (set thresholds in the app)',home:'Bring to front',reloadEdits:'Reload processing',reloaded:'Processed segments reloaded from the app',shot:'Screenshot',exit:'Exit',
   sec:'Section',offOn:['Off','On'],hold:'Hold with',holdModes:['Grip','Trigger'],cut:'Clip',cutModes:['Off','Near side','One side'],flip:'Flip side',cutHelp:'One side: the arrow side is removed (stays when you move)',sl:'Slice opacity',
   secHelp:['Hold grip near the frame (turns white) to move it','Hold the trigger near the frame (turns white) to move it'],secOff:'Turn it on here or press B/Y',
   r:'Volume resolution',auto:'Auto',dt:'Data',q:'Detail',qv:['Normal','Coarse','Coarsest'],f:'Foveation',fv:['Off','Mid','High'],hz:'Refresh rate',diag:'Diagnostics',dv:['Normal','Box only','Loop count','No shading','No skipping'],
   stHeld:'Section: held in hand',stFixed:'Section: fixed',stNone:'Grip to grab, both hands to scale',preparing:'Preparing VR volume… ',failed:'VR failed: ',shotDone:'Screenshot taken (save it on the page after exit)',filtered:' filtered'};
 const menu=makeMenu();scene.add(menu.mesh);
 const ui={tab:0,open:true,status:L.preparing,fpsLine:'',sizeLine:'',flash:'',flashUntil:0};
 const holder=new THREE.Group();holder.position.set(0,1.3,-0.6);scene.add(holder);
 let refreshEdits=()=>{},disposeEdits=()=>{},useData=()=>{},disposeExtra=()=>{},mesh=null,material=null,volTex=null,brickTex=null,compMaterial=null,rayMesh=null,lowTarget=null;const volScene=new THREE.Scene();volScene.matrixWorldAutoUpdate=false;let baseStep=0.002,baseScale=0.3/3.3,info='';
 // per segment in VR only: 0 normal, 1 simple (for segments not being
 // looked at; owner, build 341), 2 hidden
 const segMode={};
 // controllers: ray, input source (handedness, gamepad), haptics
 const raycaster=new THREE.Raycaster(),tmpM=new THREE.Matrix4();
 const controllers=[0,1].map(i=>{const c=renderer.xr.getController(i);scene.add(c);
  const ray=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3(0,0,-1)]),new THREE.LineBasicMaterial({color:0x88ccff}));ray.scale.z=0.08;c.add(ray);c.userData.ray=ray;return c});
 const pulse=(c,v=0.35,ms=18)=>{try{c.userData.source?.gamepad?.hapticActuators?.[0]?.pulse?.(v,ms)}catch{}};
 const badge=makeBadge(L.badge);badge.visible=false;
 const leftHand=()=>controllers.find(c=>c.userData.source?.handedness==='left')||controllers[0];
 const setRay=c=>{tmpM.identity().extractRotation(c.matrixWorld);raycaster.ray.origin.setFromMatrixPosition(c.matrixWorld);raycaster.ray.direction.set(0,0,-1).applyMatrix4(tmpM)};
 const menuHit=c=>{if(!ui.open)return null;setRay(c);return raycaster.intersectObject(menu.mesh,false)[0]||null};
 const badgeHit=c=>{if(ui.open||!badge.parent||badge.parent===c)return null;setRay(c);return raycaster.intersectObject(badge,false)[0]||null};
 // head pose (world) from the XR camera
 const head=new THREE.Vector3(),headFwd=new THREE.Vector3(),headLeft=new THREE.Vector3(),tmpQh=new THREE.Quaternion();
 const readHead=()=>{renderer.xr.updateCamera(camera);const cam=renderer.xr.getCamera();cam.getWorldPosition(head);cam.getWorldQuaternion(tmpQh);headFwd.set(0,0,-1).applyQuaternion(tmpQh);headFwd.y=0;if(headFwd.lengthSq()<1e-6)headFwd.set(0,0,-1);headFwd.normalize();headLeft.set(headFwd.z,0,-headFwd.x)};
 // menu placement: in front, a little left and below eye level so it does
 // not cover the volume; follow mode moves it back when the head turns away
 const menuTarget=new THREE.Vector3();let menuMoving=false,menuPlaced=false;
 const computeMenuTarget=()=>menuTarget.copy(head).addScaledVector(headFwd,0.62).addScaledVector(headLeft,0.3).add(new THREE.Vector3(0,-0.16,0));
 const placeMenuNow=()=>{readHead();computeMenuTarget();menu.mesh.position.copy(menuTarget);menu.mesh.lookAt(head);menuPlaced=true;menuMoving=false};
 const setMenuOpen=open=>{ui.open=open;menu.mesh.visible=open;if(open){badge.removeFromParent();placeMenuNow()}else leftHand().add(badge);badge.visible=!open;menu.refresh()};
 const bringVolumeFront=()=>{readHead();scene.attach(holder);grabbing.clear();twoHand=null;holder.position.copy(head).addScaledVector(headFwd,0.55).add(new THREE.Vector3(0,-0.12,0));holder.quaternion.identity();holder.scale.setScalar(baseScale)};
 // grab: one hand moves/rotates (holder follows the controller); two hands
 // scale by the change in hand distance
 const grabbing=new Set();let twoHand=null;const tmpA=new THREE.Vector3(),tmpB=new THREE.Vector3();
 const handDist=()=>{controllers[0].getWorldPosition(tmpA);controllers[1].getWorldPosition(tmpB);return tmpA.distanceTo(tmpB)};
 const regrab=()=>{
  scene.attach(holder);twoHand=null;
  if(grabbing.size===2)twoHand={d0:Math.max(handDist(),1e-3),s0:holder.scale.x};
  else if(grabbing.size===1)[...grabbing][0].attach(holder);
 };
 // hand-held section (build 344–347): a square frame, local X = plane normal
 // (held like a blade). Like the volume, it is held only while the chosen
 // button (grip or trigger, a setting) is pressed near the frame; on release
 // it stays fixed in the volume. B/Y toggles.
 const section={on:false,held:null},planeObj=new THREE.Group();
 const frameMat=new THREE.LineBasicMaterial({color:0xffcc44});
 {const h=0.12,g=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,-h,-h),new THREE.Vector3(0,h,-h),new THREE.Vector3(0,h,h),new THREE.Vector3(0,-h,h)]);planeObj.add(new THREE.LineLoop(g,frameMat))}
 // one-side mode (build 346): section.side picks the kept half along the
 // frame's local X (kept: side*X >= 0); the arrow points at the removed half
 section.side=1;
 const arrow=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0),new THREE.Vector3(0.09,0,0),new THREE.Vector3(0.09,0,0),new THREE.Vector3(0.065,0.02,0),new THREE.Vector3(0.09,0,0),new THREE.Vector3(0.065,-0.02,0)]),frameMat);
 arrow.visible=false;planeObj.add(arrow);
 // side that removes the viewer's half right now (what 'near' shows)
 const chooseSide=()=>{readHead();scene.updateMatrixWorld();planeObj.getWorldPosition(tmpA);tmpB.set(1,0,0).transformDirection(planeObj.matrixWorld);section.side=tmpB.dot(tmpA.subVectors(head,tmpA))>0?-1:1};
 const takePlane=c=>{c.attach(planeObj);section.held=c;pulse(c);menu.refresh()};
 const fixPlane=()=>{const c=section.held;holder.attach(planeObj);section.held=null;if(c)pulse(c,0.2);menu.refresh()};
 const nearPlane=c=>{c.getWorldPosition(tmpA);planeObj.getWorldPosition(tmpB);return tmpA.distanceTo(tmpB)<0.2};
 const setSection=(on,c=controllers[1]||controllers[0])=>{
  section.on=on;
  if(on){
   {
    // appears fixed through the volume centre, facing the viewer
    readHead();scene.add(planeObj);holder.getWorldPosition(planeObj.position);tmpA.subVectors(head,planeObj.position).normalize();
    planeObj.quaternion.setFromUnitVectors(new THREE.Vector3(1,0,0),tmpA);planeObj.scale.setScalar(1);holder.attach(planeObj);section.held=null;
   }
  }else{planeObj.removeFromParent();section.held=null}
  if(on)chooseSide();
  menu.refresh();
 };
 let dragging=null,shotRequested=false;
 for(const c of controllers){
  c.addEventListener('connected',e=>{c.userData.source=e.data;if(!ui.open&&c.userData.source?.handedness==='left')c.add(badge)});
  c.addEventListener('disconnected',()=>{c.userData.source=null});
  c.addEventListener('squeezestart',()=>{
   if(section.on&&settings.secHold===0&&!section.held&&nearPlane(c)){takePlane(c);return}
   grabbing.add(c);regrab();
  });
  c.addEventListener('squeezeend',()=>{
   if(section.held===c&&settings.secHold===0){fixPlane();return}
   if(grabbing.delete(c))regrab();
  });
  // trigger: menu first (button or slider drag), then the menu tag, then the
  // section in trigger mode
  c.addEventListener('selectstart',()=>{
   const h=menuHit(c);
   if(h){const i=menu.hit(h.uv);if(i<0)return;const w=menu.widget(i);if(w.set){dragging={c,i};menu.drag(i,h.uv)}else menu.press(i);pulse(c);return}
   if(badgeHit(c)){setMenuOpen(true);pulse(c);return}
   if(section.on&&settings.secHold===1&&!section.held&&nearPlane(c))takePlane(c);
  });
  c.addEventListener('selectend',()=>{if(dragging?.c===c){dragging=null;saveSettings(settings)}if(section.held===c&&settings.secHold===1)fixPlane()});
 }
 const rates=[...(session.supportedFrameRates||[])].filter(r=>r>=60).sort((a,b)=>a-b);
 const targetRate=()=>session.frameRate||(rates.length?rates[Math.min(settings.rate,rates.length-1)]:72);
 let autoF=0.5,autoFrames=0,autoAt=performance.now();
 let frames=0,fpsAt=performance.now(),fps=0;
 const applyQuality=()=>{
  if(material){material.uniforms.stepSize.value=baseStep*(STEP[settings.quality]??1);material.uniforms.diag.value=settings.diag|0;useData(settings.data|0)}
  renderer.xr.setFoveation?.(FOVEATION[settings.foveation]??1);
  if(rates.length&&session.updateTargetFrameRate)session.updateTargetFrameRate(rates[Math.min(settings.rate,rates.length-1)]).catch(()=>{});
  saveSettings(settings);frames=0;fpsAt=performance.now();
 };
 menu.onDraw(()=>{
  const w=[],X=40,btn=(x,y,wd,label,on,action,extra={})=>w.push({type:'button',x,y,w:wd,h:72,label,on,action,...extra});
  const label=(x,y,text,extra={})=>w.push({type:'label',x,y,text,...extra});
  // choice row: name on the left, equal buttons on the right
  const CX=330,choice=(y,text,options,value,set)=>{label(X,y+36,text);const bw=Math.min(220,(MENU_W-X-CX-(options.length-1)*12)/options.length);options.forEach((o,i)=>btn(CX+i*(bw+12),y,bw,o.label,o.value===value,()=>{set(o.value)}))};
  // header
  label(X,52,L.title,{bold:true,size:36,color:'#fff'});
  btn(780,18,200,L.close,false,()=>setMenuOpen(false),{size:28});
  btn(450,18,310,L.reloadEdits,false,()=>{refreshEdits(true);ui.flash=L.reloaded;ui.flashUntil=performance.now()+2500},{size:28});
  // tabs
  L.tabs.forEach((t,i)=>btn(X+i*240,110,226,t+(i===1&&section.on?' ●':''),ui.tab===i,()=>{ui.tab=i}));
  const status=ui.flash&&performance.now()<ui.flashUntil?ui.flash:ui.status;
  label(X,228,status,{color:'#ffd27a'});
  const y0=270;
  if(ui.tab===0){
   const active=SEGMENT_PRESET_ORDER.filter(k=>segmentState[k]?.active);
   if(!active.length)label(X,y0+40,L.noSeg);
   active.forEach((key,i)=>{const seg=segmentState[key],y=y0+i*76,m=segMode[key]|0;label(X,y+36,tr(key),{color:seg.color||'#fff',bold:true});
    L.segModes.forEach((t,j)=>btn(250+j*250,y,236,t,m===j,()=>{segMode[key]=j},{color:j===0?seg.color:undefined}))});
   const yb=MENU_H-110;
   label(X,yb-140,L.menuKey,{size:26,color:'#9fb3c3'});
   btn(X,yb,300,L.home,false,()=>{bringVolumeFront();placeMenuNow()});btn(X+320,yb,320,L.shot,false,()=>{shotRequested=true});btn(MENU_W-X-260,yb,260,L.exit,true,()=>session.end(),{color:'#b33'});
   choice(yb-100,L.menuPos,[{label:L.follow,value:0},{label:L.fixed,value:1}],settings.menuMode,v=>{settings.menuMode=v;saveSettings(settings)});
  }else if(ui.tab===1){
   choice(y0,L.sec,[{label:L.offOn[0],value:false},{label:L.offOn[1],value:true}],section.on,v=>{if(v!==section.on)setSection(v)});
   choice(y0+90,L.hold,L.holdModes.map((t,i)=>({label:t,value:i})),settings.secHold,v=>{if(section.held)fixPlane();settings.secHold=v;saveSettings(settings)});
   choice(y0+180,L.cut,L.cutModes.map((t,i)=>({label:t,value:i})),settings.cut|0,v=>{if(v===2&&settings.cut!==2&&section.on)chooseSide();settings.cut=v;saveSettings(settings)});
   label(X,y0+306,L.sl);
   w.push({type:'slider',x:CX+26,y:y0+270,w:470,h:72,value:settings.sliceOpacity,text:Math.round(settings.sliceOpacity*100)+'%',set:v=>{settings.sliceOpacity=Math.round(v*20)/20}});
   label(X,y0+390,section.on?L.secHelp[settings.secHold]:L.secOff,{size:28});
   if(settings.cut===2){label(X,y0+430,L.cutHelp,{size:26,color:'#9fb3c3'});btn(X,y0+460,260,L.flip,false,()=>{section.side=-section.side})}
  }else if(ui.tab===2){
   choice(y0,L.r,VRES.map((r,i)=>({label:r?Math.round(r*100)+'%':L.auto,value:i})),settings.vres,v=>{settings.vres=v;applyQuality()});
   choice(y0+90,L.dt,[{label:'256³',value:1},{label:'512³',value:0}],settings.data,v=>{settings.data=v;applyQuality()});
   choice(y0+180,L.q,L.qv.map((t,i)=>({label:t,value:i})),settings.quality,v=>{settings.quality=v;applyQuality()});
   choice(y0+270,L.f,L.fv.map((t,i)=>({label:t,value:i})),settings.foveation,v=>{settings.foveation=v;applyQuality()});
   if(rates.length>1)choice(y0+360,L.hz,rates.slice(0,4).map((r,i)=>({label:r+' Hz',value:i})),settings.rate,v=>{settings.rate=v;applyQuality()});
  }else{
   label(X,y0+10,ui.fpsLine,{size:28});label(X,y0+50,ui.sizeLine,{size:28});
   choice(y0+100,L.diag,L.dv.slice(0,3).map((t,i)=>({label:t,value:i})),settings.diag,v=>{settings.diag=v;applyQuality()});
   choice(y0+190,'',L.dv.slice(3).map((t,i)=>({label:t,value:i+3})),settings.diag,v=>{settings.diag=v;applyQuality()});
  }
  return w;
 });
 await renderer.xr.setSession(session);
 applyQuality();menu.refresh();
 const color=new THREE.Color(),tmpP=new THREE.Vector3(),tmpQ=new THREE.Vector3(),tmpN=new THREE.Vector3(),tmpE=new THREE.Vector3(),tmpD=new THREE.Vector3();
 // GPU time per pass (EXT_disjoint_timer_query_webgl2, when offered) and JS
 // time per frame, averaged over the fps window
 const gl=renderer.getContext(),timerExt=gl.getExtension('EXT_disjoint_timer_query_webgl2');
 const pending=[],sums={vol:0,main:0,js:0},counts={vol:0,main:0,js:0};let sizes='';
 const timed=(kind,fn)=>{
  if(!timerExt||pending.length>12){fn();return}
  const q=gl.createQuery();gl.beginQuery(timerExt.TIME_ELAPSED_EXT,q);fn();gl.endQuery(timerExt.TIME_ELAPSED_EXT);pending.push({q,kind});
 };
 const pollTimers=()=>{
  while(pending.length){
   const {q,kind}=pending[0];
   if(!gl.getQueryParameter(q,gl.QUERY_RESULT_AVAILABLE))break;
   pending.shift();
   if(!gl.getParameter(timerExt.GPU_DISJOINT_EXT)){sums[kind]+=gl.getQueryParameter(q,gl.QUERY_RESULT)/1e6;counts[kind]++}
   gl.deleteQuery(q);
  }
 };
 const avg=k=>counts[k]?(sums[k]/counts[k]).toFixed(1):'–';
 // screenshot: the left eye's view rendered again at full resolution into
 // an offscreen target (menu and controller rays hidden), read back as PNG
 const takeScreenshot=()=>{
  const sub=renderer.xr.getCamera().cameras[0];if(!sub||!mesh)return;
  const v=sub.viewport,W=1600,H=Math.max(1,Math.round(W*v.w/Math.max(1,v.z)));
  const rt=new THREE.WebGLRenderTarget(W,H),prev=renderer.getRenderTarget(),hidden=[menu.mesh,badge,...controllers.map(c=>c.userData.ray)].filter(o=>o.visible);
  hidden.forEach(o=>{o.visible=false});const matBefore=mesh.material;mesh.material=material;
  renderer.xr.enabled=false;renderer.setRenderTarget(rt);renderer.setClearColor(ar?0x000000:BG,ar?0:1);renderer.clear();renderer.render(scene,sub);
  const px=new Uint8Array(W*H*4);renderer.readRenderTargetPixels(rt,0,0,W,H,px);
  renderer.setRenderTarget(prev);renderer.xr.enabled=true;mesh.material=matBefore;hidden.forEach(o=>{o.visible=true});rt.dispose();
  const cv=document.createElement('canvas');cv.width=W;cv.height=H;const cx=cv.getContext('2d'),img=cx.createImageData(W,H);
  for(let y=0;y<H;y++)img.data.set(px.subarray((H-1-y)*W*4,(H-y)*W*4),y*W*4);
  cx.putImageData(img,0,0);
  const d=new Date(),pad=n=>String(n).padStart(2,'0'),name='vrl-'+(ar?'ar':'vr')+'-'+d.getFullYear()+pad(d.getMonth()+1)+pad(d.getDate())+'-'+pad(d.getHours())+pad(d.getMinutes())+pad(d.getSeconds())+'.png';
  cv.toBlob(b=>{if(b)shots.push({name,url:URL.createObjectURL(b)})},'image/png');
  ui.flash=L.shotDone+' ('+(shots.length+1)+')';ui.flashUntil=performance.now()+3000;menu.refresh();for(const c of controllers)pulse(c,0.5,40);
 };
 renderer.setAnimationLoop(()=>{
  const js0=performance.now();if(timerExt)pollTimers();
  readHead();
  if(!menuPlaced)placeMenuNow();
  // lazy follow: move back in front once the head has turned well away
  if(ui.open&&settings.menuMode===0){
   computeMenuTarget();tmpD.subVectors(menu.mesh.position,head);tmpD.y=0;
   const ang=tmpD.lengthSq()>1e-6?tmpD.normalize().angleTo(tmpE.subVectors(menuTarget,head).setY(0).normalize()):0;
   if(ang>0.6||menu.mesh.position.distanceTo(menuTarget)>0.45)menuMoving=true;
   if(menuMoving&&!dragging){menu.mesh.position.lerp(menuTarget,0.08);menu.mesh.lookAt(head);if(menu.mesh.position.distanceTo(menuTarget)<0.01)menuMoving=false}
  }
  if(twoHand){const s=Math.min(20,Math.max(0.05,twoHand.s0*handDist()/twoHand.d0));holder.scale.setScalar(s)}
  let hover=-1;
  for(const c of controllers){
   const h=menuHit(c),bh=h?null:badgeHit(c),ray=c.userData.ray;
   if(h||bh){ray.scale.z=(h||bh).distance;ray.material.color.setHex(0xffffff);if(h){const i=menu.hit(h.uv);if(i>=0)hover=i}}
   else{ray.scale.z=0.08;ray.material.color.setHex(0x88ccff)}
   if(dragging?.c===c){setRay(c);const hh=raycaster.intersectObject(menu.mesh,false)[0];if(hh)menu.drag(dragging.i,hh.uv)}
   // xr-standard buttons: 4 = A/X toggles the menu, 5 = B/Y the section
   const bt=c.userData.source?.gamepad?.buttons;
   const a=!!bt?.[4]?.pressed;if(a&&!c.userData.aDown)setMenuOpen(!ui.open);c.userData.aDown=a;
   const b=!!bt?.[5]?.pressed;if(b&&!c.userData.bDown)setSection(!section.on,c);c.userData.bDown=b;
  }
  menu.setHover(hover);
  // section frame colour: yellow held, cyan fixed, white when a grip would take it
  if(section.on)frameMat.color.setHex(section.held?0xffcc44:controllers.some(nearPlane)?0xffffff:0x44ddff);
  const st=section.on?(section.held?L.stHeld:L.stFixed):L.stNone;
  if(mesh&&st!==ui.status){ui.status=st;menu.refresh()}
  if(material){
   const u=material.uniforms;
   if(section.on){
    // plane in the volume's object space. 'near': the normal is flipped so
    // the eye is on the removed side; 'one side': the side chosen when it
    // was set (section.side) stays removed wherever the viewer goes
    scene.updateMatrixWorld();planeObj.getWorldPosition(tmpP);tmpN.set(1,0,0).transformDirection(planeObj.matrixWorld);
    tmpQ.copy(tmpP).add(tmpN);mesh.worldToLocal(tmpP);mesh.worldToLocal(tmpQ);tmpN.subVectors(tmpQ,tmpP).normalize();
    tmpE.copy(head);mesh.worldToLocal(tmpE);if(settings.cut===2){if(section.side<0)tmpN.negate()}else if(tmpN.dot(tmpE)-tmpN.dot(tmpP)>0)tmpN.negate();
    arrow.visible=settings.cut===2;arrow.scale.x=-section.side;
    u.cutPlane.value.set(tmpN.x,tmpN.y,tmpN.z,tmpN.dot(tmpP));
   }
   u.cutOn.value=section.on&&settings.cut?1:0;u.sliceOpacity.value=section.on?settings.sliceOpacity:0;
   u.sliceWindow.value.set(+wc.value||0,Math.max(1,+ww.value||1));
   for(let i=0;i<4;i++){
    const key=SEGMENT_PRESET_ORDER[i],seg=segmentState[key];
    u.segA.value[i].set(seg?.min||0,seg?.max||0,seg?.opacity??1,seg?.active&&seg?.enabled&&segMode[key]!==2?1:0);
    color.set(seg?.color||'#ffffff');u.segC.value[i].set(color.r,color.g,color.b,segMode[key]===1?1:0);
   }
  }
  // auto: frame interval from the XR loop, checked twice a second
  const auto=!VRES[settings.vres];
  if(auto){
   autoFrames++;const nowA=performance.now();
   if(nowA-autoAt>=500){
    const interval=(nowA-autoAt)/autoFrames,budget=1000/(targetRate()||72);
    if(interval>budget*1.12)autoF=Math.max(AUTO_MIN,autoF*Math.min(0.92,Math.sqrt(budget/interval)));
    else if(interval<budget*1.04)autoF=Math.min(AUTO_MAX,autoF*1.06);
    autoFrames=0;autoAt=nowA;
   }
  }
  const f=auto?autoF:(VRES[settings.vres]??1);
  if(mesh){
   if(f<1){
    // own pass per eye into the small target, then the composite material
    // on the same box upscales it inside the main XR render
    const xrTarget=renderer.getRenderTarget(),w=xrTarget?.width||1,h=xrTarget?.height||1;
    renderer.xr.updateCamera(camera);const xrCam=renderer.xr.getCamera();
    // auto: one target at the largest factor, only the viewports shrink
    const fmax=auto?AUTO_MAX:f,tw=Math.max(1,Math.ceil(w*fmax)),th=Math.max(1,Math.ceil(h*fmax));
    if(!lowTarget)lowTarget=new THREE.WebGLRenderTarget(tw,th,{depthBuffer:false,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter});
    else if(lowTarget.width!==tw||lowTarget.height!==th)lowTarget.setSize(tw,th);
    scene.updateMatrixWorld();rayMesh.matrixWorld.copy(mesh.matrixWorld);
    renderer.xr.enabled=false;renderer.setRenderTarget(lowTarget);
    renderer.setClearColor(0x000000,0);lowTarget.scissorTest=false;renderer.clear(true,false,false);
    timed('vol',()=>{for(const sub of xrCam.cameras){
     const v=sub.viewport,x=Math.floor(v.x*f),y=Math.floor(v.y*f),vw=Math.ceil(v.z*f),vh=Math.ceil(v.w*f);
     lowTarget.viewport.set(x,y,vw,vh);lowTarget.scissor.set(x,y,vw,vh);lowTarget.scissorTest=true;
     renderer.setRenderTarget(lowTarget);renderer.render(volScene,sub);
    }});
    sizes=(ja?'縮小描画 ':'low ')+Math.round(f*100)+'% '+Math.ceil(w*f)+'×'+Math.ceil(h*f)+' / XR '+w+'×'+h+' ('+xrCam.cameras.length+(ja?'眼':' eyes')+')';
    lowTarget.scissorTest=false;renderer.setRenderTarget(xrTarget);renderer.xr.enabled=true;renderer.setClearColor(ar?0x000000:BG,ar?0:1);
    compMaterial.uniforms.img.value=lowTarget.texture;compMaterial.uniforms.invSize.value.set(f/tw,f/th);
    mesh.material=compMaterial;
   }else{mesh.material=material;const t=renderer.getRenderTarget();sizes=(ja?'直接描画 ':'direct ')+'XR '+(t?.width||0)+'×'+(t?.height||0)}
  }
  menu.flush();
  sums.js+=performance.now()-js0;counts.js++;
  timed('main',()=>renderer.render(scene,camera));
  if(shotRequested){shotRequested=false;try{takeScreenshot()}catch(e){console.error(e)}}
  frames++;const now=performance.now();
  if(now-fpsAt>=1000){
   fps=frames*1000/(now-fpsAt);frames=0;fpsAt=now;
   ui.fpsLine=fps.toFixed(0)+' fps · '+(ja?'ボリューム ':'volume ')+avg('vol')+' ms · '+(ja?'本描画 ':'main ')+avg('main')+' ms · JS '+avg('js')+' ms'+(timerExt?'':(ja?'（GPU計測なし）':' (no GPU timer)'));
   ui.sizeLine=sizes+' · ×'+holder.scale.x.toFixed(2)+' · '+info;
   if(ui.tab===3||ui.flash)menu.refresh();
   if(ui.flash&&now>ui.flashUntil)ui.flash='';
   for(const k in sums){sums[k]=0;counts[k]=0}
  }
 });
 const cleanup=()=>{
  renderer.setAnimationLoop(null);
  volTex?.dispose();brickTex?.dispose();disposeExtra();disposeEdits();material?.dispose();compMaterial?.dispose();lowTarget?.dispose();mesh?.geometry.dispose();menu.dispose();badge.userData.dispose();
  background.traverse(o=>{o.geometry?.dispose();o.material?.dispose()});
  renderer.dispose();renderer.domElement.remove();running=null;
  showShotsPanel(ja);
 };
 session.addEventListener('end',cleanup,{once:true});
 try{
  const gl=renderer.getContext(),maxDim=gl.getParameter(gl.MAX_3D_TEXTURE_SIZE)||2048;
  const vd=await buildVolumeData(maxDim,(a,b)=>{ui.status=L.preparing+a+' / '+b;menu.refresh()});
  if(!running)return;
  const makeTextures=d=>{
   const v=new THREE.Data3DTexture(d.data,...d.dims);v.format=THREE.RGFormat;v.type=THREE.UnsignedByteType;
   v.minFilter=v.magFilter=THREE.LinearFilter;v.unpackAlignment=1;v.needsUpdate=true;
   const b=new THREE.Data3DTexture(d.bricks,...d.brickDims);b.format=THREE.RGFormat;b.type=THREE.FloatType;
   b.minFilter=b.magFilter=THREE.NearestFilter;b.unpackAlignment=1;b.needsUpdate=true;
   return{v,b,dims:d.dims,brickDims:d.brickDims};
  };
  const full=makeTextures(vd);let half=null;volTex=full.v;brickTex=full.b;
  // 512 / 256 data (256 made on first use, kept for the session)
  useData=i=>{
   const t=i===1?(half||=makeTextures(halveVolume(vd))):full;
   material.uniforms.vol.value=t.v;material.uniforms.bricks.value=t.b;material.uniforms.texDims.value.set(...t.dims);material.uniforms.brickDims.value.set(...t.brickDims);
   info=t.dims.join('×')+(vd.filtered?L.filtered:'');
   refreshEdits();
  };
  // processed segments: built at start and when the data grid changes;
  // edits made in the app during VR are taken with 加工を再読み込み (build 349:
  // the once-a-second check of build 348 is gone, owner saw flicker)
  const dummyEdit=new THREE.Data3DTexture(new Uint8Array(1),1,1,1);dummyEdit.format=THREE.RedFormat;dummyEdit.needsUpdate=true;
  let editTex=null,editKey='';
  refreshEdits=(force=false)=>{
   if(!material)return;
   const dims=material.uniforms.texDims.value.toArray().map(Math.round),key=dims.join('x');
   if(!force&&key===editKey)return;editKey=key;
   let m;try{m=buildEditMask(dims)}catch(e){console.error(e);m={activeMask:0,data:null}}
   editTex?.dispose();editTex=null;
   if(m.activeMask&&m.data){editTex=new THREE.Data3DTexture(m.data,...dims);editTex.format=THREE.RedFormat;editTex.type=THREE.UnsignedByteType;editTex.minFilter=editTex.magFilter=THREE.NearestFilter;editTex.unpackAlignment=1;editTex.needsUpdate=true}
   material.uniforms.editMask.value=m.activeMask|0;material.uniforms.editTex.value=editTex||dummyEdit;
  };
  disposeEdits=()=>{editTex?.dispose();dummyEdit.dispose()};
  disposeExtra=()=>{half?.v.dispose();half?.b.dispose()};
  material=new THREE.ShaderMaterial({glslVersion:THREE.GLSL3,vertexShader,fragmentShader,side:THREE.BackSide,toneMapped:false,
   uniforms:{vol:{value:volTex},bricks:{value:brickTex},halfExt:{value:new THREE.Vector3(...vd.halfExt)},texDims:{value:new THREE.Vector3(...vd.dims)},brickDims:{value:new THREE.Vector3(...vd.brickDims)},
    stepSize:{value:vd.step},diag:{value:0},calib:{value:new THREE.Vector3(...vd.calibration)},segA:{value:[0,1,2,3].map(()=>new THREE.Vector4())},segC:{value:[0,1,2,3].map(()=>new THREE.Vector4())},
    cutPlane:{value:new THREE.Vector4(0,0,1,0)},cutOn:{value:0},sliceOpacity:{value:0},sliceWindow:{value:new THREE.Vector2(0,1)},sliceVol:{value:full.v},editMask:{value:0},editTex:{value:null}}});
  material.transparent=true;material.depthWrite=false;material.blending=THREE.CustomBlending;material.blendSrc=THREE.OneFactor;material.blendDst=THREE.OneMinusSrcAlphaFactor;
  // BackSide: rays start at the eye when the head is inside the box
  mesh=new THREE.Mesh(new THREE.BoxGeometry(2,2,2),material);mesh.frustumCulled=false;
  compMaterial=new THREE.ShaderMaterial({glslVersion:THREE.GLSL3,vertexShader:compositeVertex,fragmentShader:compositeFragment,side:THREE.BackSide,toneMapped:false,depthWrite:false,transparent:true,
   blending:THREE.CustomBlending,blendSrc:THREE.OneFactor,blendDst:THREE.OneMinusSrcAlphaFactor,uniforms:{img:{value:null},invSize:{value:new THREE.Vector2(1,1)},halfExt:{value:new THREE.Vector3(...vd.halfExt)}}});
  // the offscreen target is cleared to 0 and written with plain premultiplied
  // colour (no blending needed inside the volume pass)
  rayMesh=new THREE.Mesh(mesh.geometry,material.clone());rayMesh.material.uniforms=material.uniforms;rayMesh.material.blending=THREE.NoBlending;rayMesh.material.transparent=false;
  rayMesh.matrixAutoUpdate=false;rayMesh.matrixWorldAutoUpdate=false;rayMesh.frustumCulled=false;volScene.add(rayMesh);
  // app units (longest side 3.3) -> 0.3 m in VR, placed in front of the head
  mesh.renderOrder=1;holder.add(mesh);baseStep=vd.step;applyQuality();bringVolumeFront();
  ui.status=L.stNone;menu.refresh();
 }catch(e){
  console.error(e);ui.status=L.failed+String(e.message||e).slice(0,40);menu.refresh();
 }
}
