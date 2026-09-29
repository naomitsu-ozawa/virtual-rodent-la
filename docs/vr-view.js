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
import { volumeTexturePlan, reduceSliceArea, packedRgSlice, packCtSlice } from './medical-volume.js?v=20260929-build336';
import { gpuVolumeTarget } from './gpu-volume-data.js?v=20260929-build336';
import { SEGMENT_PRESET_ORDER, segmentState } from './segments.js?v=20260929-build336';

const BG=new THREE.Color(0.035,0.045,0.05);
const BRICK=8;
// 512 per side, like the default 3D plan (owner: 30 fps flat view at 512)
const VR_TARGET_SIDE=512;

export async function vrSupported(){
 try{return !!navigator.xr&&await navigator.xr.isSessionSupported('immersive-vr')}catch{return false}
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
uniform vec3 calib; // slope, intercept, signedBias
uniform vec4 segA[4]; // min, max, opacity, enabled
uniform vec3 segC[4];
uniform vec3 bgColor;
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
int segmentIndexAt(vec3 tc){
 float v=huAt(tc);
 for(int s=0;s<4;s++){vec4 a=segA[s];if(a.w>0.5&&v>=a.x&&v<=a.y)return s;}
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
 float t=max(bounds.x,0.0);float endT=bounds.y;float step=max(stepSize,1e-5);
 float previousT=t;int lastIndex=-1;vec4 acc=vec4(0.0);
 for(int iter=0;iter<4096;iter++){
  if(t>endT||acc.a>0.985)break;
  vec3 p=o+dir*t;vec3 tc0=texCoord(p);
  bool canSample=brickMayContain(tc0);
  float nextT=t+step;
  if(!canSample){nextT=t+max(brickExit(tc0,dir)+step*0.05,step);lastIndex=-1;}
  else{
   int idx=segmentIndexAt(tc0);
   if(idx!=lastIndex){
    if(idx>=0){
     float lo=previousT;float hi=t;
     for(int r=0;r<6;r++){float mid=(lo+hi)*0.5;if(segmentIndexAt(texCoord(o+dir*mid))==idx)hi=mid;else lo=mid;}
     vec3 hp=o+dir*hi;vec3 tc=texCoord(hp);
     vec3 n=gradientAt(tc);
     vec3 viewDir=normalize(o-hp);vec3 lightDir=normalize(viewDir+vec3(0.35,0.5,0.25));
     float diffuse=0.28+0.72*abs(dot(n,lightDir));
     float spec=pow(max(dot(n,normalize(lightDir+viewDir)),0.0),20.0)*0.18;
     float alpha=clamp(segA[idx].z,0.03,1.0);
     vec3 lit=segC[idx]*diffuse+vec3(spec);
     float contribution=(1.0-acc.a)*alpha;acc=vec4(acc.rgb+lit*contribution,acc.a+contribution);
    }
    lastIndex=idx;
   }
  }
  previousT=t;t=nextT;
 }
 if(acc.a<0.004)discard;
 // raw colour like the WebGPU canvas (no colour-space conversion)
 outColor=vec4(acc.rgb+bgColor*(1.0-acc.a),1.0);
}`;

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
 // brick min/max in HU; one voxel of overlap so trilinear samples at a
 // brick edge are covered
 const bx=Math.ceil(tw/BRICK),by=Math.ceil(th/BRICK),bz=Math.ceil(td/BRICK),mm=new Float32Array(bx*by*bz*2);
 const slope=first.slope||1,intercept=first.intercept||0,bias=signed?32768:0;
 for(let k=0;k<bz;k++)for(let j=0;j<by;j++)for(let i=0;i<bx;i++){
  let lo=65535,hi=0;
  const z0=Math.max(0,k*BRICK-1),z1=Math.min(td,(k+1)*BRICK+1),y0=Math.max(0,j*BRICK-1),y1=Math.min(th,(j+1)*BRICK+1),x0=Math.max(0,i*BRICK-1),x1=Math.min(tw,(i+1)*BRICK+1);
  for(let z=z0;z<z1;z++)for(let y=y0;y<y1;y++){let o=(z*th+y)*tw*2+x0*2;for(let x=x0;x<x1;x++,o+=2){const w=data[o]|(data[o+1]<<8);if(w<lo)lo=w;if(w>hi)hi=w}}
  const b=((k*by+j)*bx+i)*2,a=(lo-bias)*slope+intercept,c=(hi-bias)*slope+intercept;mm[b]=Math.min(a,c);mm[b+1]=Math.max(a,c);
 }
 const px=s.columns*s.spacingX,py=s.rows*s.spacingY,pz=s.slices.length*s.spacingZ,maxP=Math.max(px,py,pz,1),scale=3.3/maxP;
 const halfExt=[px*scale*.5,py*scale*.5,pz*scale*.5],step=Math.max(1e-5,Math.min(px/tw,py/th,pz/td)*scale*.85);
 return{data,dims:[tw,th,td],bricks:mm,brickDims:[bx,by,bz],halfExt,step,calibration:[slope,intercept,bias],filtered};
}

function makePanel(){
 const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;
 const ctx=canvas.getContext('2d'),tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;
 const mesh=new THREE.Mesh(new THREE.PlaneGeometry(0.4,0.1),new THREE.MeshBasicMaterial({map:tex,transparent:true}));
 const set=lines=>{ctx.clearRect(0,0,512,128);ctx.fillStyle='rgba(0,0,0,.65)';ctx.fillRect(0,0,512,128);ctx.fillStyle='#fff';ctx.font='28px system-ui,sans-serif';lines.forEach((l,i)=>ctx.fillText(l,16,44+i*40));tex.needsUpdate=true};
 return{mesh,set,dispose(){tex.dispose();mesh.geometry.dispose();mesh.material.dispose()}};
}

let running=null;
export async function startVrView({language='ja'}={}){
 if(running)return;
 const ja=language==='ja';
 const renderer=new THREE.WebGLRenderer({antialias:false,alpha:false});
 renderer.setPixelRatio(1);renderer.setSize(8,8,false);renderer.xr.enabled=true;renderer.xr.setReferenceSpaceType('local-floor');
 Object.assign(renderer.domElement.style,{position:'fixed',left:'0',top:'0',width:'1px',height:'1px',opacity:'0',pointerEvents:'none'});
 document.body.appendChild(renderer.domElement);
 // requestSession must run inside the click; the texture is built afterwards
 // while the headset shows progress
 let session;
 try{session=await navigator.xr.requestSession('immersive-vr',{optionalFeatures:['local-floor']})}
 catch(e){renderer.dispose();renderer.domElement.remove();throw e}
 running={session};
 const scene=new THREE.Scene();scene.background=BG.clone();
 const camera=new THREE.PerspectiveCamera(70,1,0.01,50);
 const panel=makePanel();panel.mesh.position.set(0,1.55,-0.8);scene.add(panel.mesh);
 panel.set([ja?'VRボリューム準備中…':'Preparing VR volume…']);
 const holder=new THREE.Group();holder.position.set(0,1.3,-0.6);scene.add(holder);
 let mesh=null,material=null,volTex=null,brickTex=null;
 const controllers=[0,1].map(i=>{const c=renderer.xr.getController(i);scene.add(c);
  const ray=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3(0,0,-0.08)]),new THREE.LineBasicMaterial({color:0x88ccff}));c.add(ray);return c});
 // grab: one hand moves/rotates (holder follows the controller); two hands
 // scale by the change in hand distance
 const grabbing=new Set();let twoHand=null;const tmpA=new THREE.Vector3(),tmpB=new THREE.Vector3();
 const handDist=()=>{controllers[0].getWorldPosition(tmpA);controllers[1].getWorldPosition(tmpB);return tmpA.distanceTo(tmpB)};
 const regrab=()=>{
  scene.attach(holder);twoHand=null;
  if(grabbing.size===2)twoHand={d0:Math.max(handDist(),1e-3),s0:holder.scale.x};
  else if(grabbing.size===1)[...grabbing][0].attach(holder);
 };
 for(const c of controllers){
  const down=()=>{grabbing.add(c);regrab()},up=()=>{grabbing.delete(c);regrab()};
  c.addEventListener('squeezestart',down);c.addEventListener('squeezeend',up);
  c.addEventListener('selectstart',down);c.addEventListener('selectend',up);
 }
 renderer.xr.setFramebufferScaleFactor?.(1);
 await renderer.xr.setSession(session);
 let frames=0,fpsAt=performance.now(),fps=0,info='';
 const color=new THREE.Color();
 renderer.setAnimationLoop(()=>{
  if(twoHand){const s=Math.min(20,Math.max(0.05,twoHand.s0*handDist()/twoHand.d0));holder.scale.setScalar(s)}
  if(material){
   for(let i=0;i<4;i++){
    const seg=segmentState[SEGMENT_PRESET_ORDER[i]];
    material.uniforms.segA.value[i].set(seg?.min||0,seg?.max||0,seg?.opacity??1,seg?.active&&seg?.enabled?1:0);
    color.set(seg?.color||'#ffffff');material.uniforms.segC.value[i].set(color.r,color.g,color.b);
   }
  }
  renderer.render(scene,camera);
  frames++;const now=performance.now();
  if(now-fpsAt>=1000){fps=frames*1000/(now-fpsAt);frames=0;fpsAt=now;if(mesh)panel.set([fps.toFixed(0)+' fps',info])}
 });
 const cleanup=()=>{
  renderer.setAnimationLoop(null);
  volTex?.dispose();brickTex?.dispose();material?.dispose();mesh?.geometry.dispose();panel.dispose();
  renderer.dispose();renderer.domElement.remove();running=null;
 };
 session.addEventListener('end',cleanup,{once:true});
 try{
  const gl=renderer.getContext(),maxDim=gl.getParameter(gl.MAX_3D_TEXTURE_SIZE)||2048;
  const vd=await buildVolumeData(maxDim,(a,b)=>panel.set([(ja?'VRボリューム準備中… ':'Preparing VR volume… ')+a+' / '+b]));
  if(!running)return;
  volTex=new THREE.Data3DTexture(vd.data,...vd.dims);volTex.format=THREE.RGFormat;volTex.type=THREE.UnsignedByteType;
  volTex.minFilter=volTex.magFilter=THREE.LinearFilter;volTex.unpackAlignment=1;volTex.needsUpdate=true;
  brickTex=new THREE.Data3DTexture(vd.bricks,...vd.brickDims);brickTex.format=THREE.RGFormat;brickTex.type=THREE.FloatType;
  brickTex.minFilter=brickTex.magFilter=THREE.NearestFilter;brickTex.unpackAlignment=1;brickTex.needsUpdate=true;
  material=new THREE.ShaderMaterial({glslVersion:THREE.GLSL3,vertexShader,fragmentShader,side:THREE.BackSide,toneMapped:false,
   uniforms:{vol:{value:volTex},bricks:{value:brickTex},halfExt:{value:new THREE.Vector3(...vd.halfExt)},texDims:{value:new THREE.Vector3(...vd.dims)},brickDims:{value:new THREE.Vector3(...vd.brickDims)},
    stepSize:{value:vd.step},calib:{value:new THREE.Vector3(...vd.calibration)},segA:{value:[0,1,2,3].map(()=>new THREE.Vector4())},segC:{value:[0,1,2,3].map(()=>new THREE.Vector3())},bgColor:{value:BG.clone()}}});
  // BackSide: rays start at the eye when the head is inside the box
  mesh=new THREE.Mesh(new THREE.BoxGeometry(2,2,2),material);mesh.frustumCulled=false;
  // app units (longest side 3.3) -> 0.3 m in VR
  holder.scale.setScalar(0.3/3.3);holder.add(mesh);
  info=vd.dims.join('×')+(vd.filtered?(ja?' フィルター適用':' filtered'):'');
  panel.set([ja?'グリップかトリガーでつかむ／両手で拡大縮小':'Grip or trigger to grab / both hands to scale',info]);
 }catch(e){
  console.error(e);panel.set([(ja?'VR準備に失敗: ':'VR failed: ')+String(e.message||e).slice(0,40)]);
 }
}
