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
import { volumeTexturePlan, reduceSliceArea, packedRgSlice, packCtSlice } from './medical-volume.js?v=20260929-build338';
import { gpuVolumeTarget } from './gpu-volume-data.js?v=20260929-build338';
import { SEGMENT_PRESET_ORDER, segmentState } from './segments.js?v=20260929-build338';
import { tr } from './i18n.js?v=20260929-build338';

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
 // premultiplied, blended over the VR background (raw colour like the
 // WebGPU canvas: no colour-space conversion)
 outColor=acc;
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

// VR settings kept per browser (resolution only applies when a session starts)
const SETTINGS_KEY='vrl-vr-settings';
const DEFAULTS={quality:0,vres:2,foveation:2,rate:0};
function loadSettings(){try{return{...DEFAULTS,...JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}')}}catch{return{...DEFAULTS}}}
function saveSettings(v){try{localStorage.setItem(SETTINGS_KEY,JSON.stringify(v))}catch{}}
// VRES: the ray-marched volume is drawn into an offscreen target this much
// smaller per axis and scaled up where the volume box covers the view. Owner,
// build 337: fps fell from 30 to 16 when the volume was enlarged, so the cost
// follows the covered pixels.
const VRES=[1,0.7,0.5],STEP=[1,1.5,2],FOVEATION=[0,0.5,1];

// upscales the offscreen volume image; drawn with the volume box so only the
// covered pixels are touched
const compositeVertex=`
uniform vec3 halfExt;
void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position*halfExt,1.0);}`;
const compositeFragment=`
precision highp float;
uniform sampler2D img;
uniform vec2 invSize; // 1 / XR framebuffer size
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

// canvas-drawn menu; the controller ray (trigger) presses its buttons
function makeMenu(ja){
 const W=1024,H=720,canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;
 const ctx=canvas.getContext('2d'),tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;
 const mesh=new THREE.Mesh(new THREE.PlaneGeometry(0.56,0.56*H/W),new THREE.MeshBasicMaterial({map:tex,transparent:true,toneMapped:false}));
 let buttons=[],hover=-1,lines=[],draw=()=>{};
 const render=()=>{
  ctx.clearRect(0,0,W,H);ctx.fillStyle='rgba(12,18,24,.88)';ctx.beginPath();ctx.roundRect(0,0,W,H,28);ctx.fill();
  ctx.fillStyle='#fff';ctx.font='bold 40px system-ui,sans-serif';ctx.fillText('Virtual Rodent Lab VR',32,60);
  ctx.font='28px system-ui,sans-serif';ctx.fillStyle='#cfe3f0';lines.forEach((l,i)=>ctx.fillText(l,32,100+i*36));
  buttons.forEach((bt,i)=>{
   ctx.fillStyle=bt.on?(bt.color||'#2d6cdf'):(i===hover?'#3a4652':'#26313b');ctx.beginPath();ctx.roundRect(bt.x,bt.y,bt.w,bt.h,14);ctx.fill();
   if(bt.color&&!bt.on){ctx.strokeStyle=bt.color;ctx.lineWidth=4;ctx.stroke()}
   if(i===hover){ctx.strokeStyle='#fff';ctx.lineWidth=3;ctx.stroke()}
   ctx.fillStyle='#fff';ctx.font='28px system-ui,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(bt.label,bt.x+bt.w/2,bt.y+bt.h/2);ctx.textAlign='left';ctx.textBaseline='alphabetic';
  });
  tex.needsUpdate=true;
 };
 return{mesh,
  setLines(l){lines=l;render()},
  setButtons(b){buttons=b;render()},
  refresh(){draw();render()},
  onDraw(f){draw=f},
  hit(uv){const x=uv.x*W,y=(1-uv.y)*H;return buttons.findIndex(b=>b.action&&x>=b.x&&x<=b.x+b.w&&y>=b.y&&y<=b.y+b.h)},
  setHover(i){if(i!==hover){hover=i;render()}},
  press(i){buttons[i]?.action?.();draw();render()},
  dispose(){tex.dispose();mesh.geometry.dispose();mesh.material.dispose()}};
}

let running=null;
export async function startVrView({language='ja'}={}){
 if(running)return;
 const ja=language==='ja',settings=loadSettings();
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
 const background=makeBackground();scene.add(background);
 const camera=new THREE.PerspectiveCamera(70,1,0.01,50);
 const menu=makeMenu(ja);menu.mesh.position.set(-0.5,1.3,-0.55);menu.mesh.rotation.set(-0.15,0.6,0);scene.add(menu.mesh);
 menu.setLines([ja?'VRボリューム準備中…':'Preparing VR volume…']);
 const HOME=new THREE.Vector3(0,1.3,-0.6);
 const holder=new THREE.Group();holder.position.copy(HOME);scene.add(holder);
 let mesh=null,material=null,volTex=null,brickTex=null,compMaterial=null,rayMesh=null,lowTarget=null;const volScene=new THREE.Scene();volScene.matrixWorldAutoUpdate=false;let baseStep=0.002,baseScale=0.3/3.3;
 const hidden=new Set();
 // controller rays: short when idle, long and bright when pointing at the menu
 const raycaster=new THREE.Raycaster(),tmpM=new THREE.Matrix4();
 const controllers=[0,1].map(i=>{const c=renderer.xr.getController(i);scene.add(c);
  const ray=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3(0,0,-1)]),new THREE.LineBasicMaterial({color:0x88ccff}));ray.scale.z=0.08;c.add(ray);c.userData.ray=ray;return c});
 const menuHit=c=>{tmpM.identity().extractRotation(c.matrixWorld);raycaster.ray.origin.setFromMatrixPosition(c.matrixWorld);raycaster.ray.direction.set(0,0,-1).applyMatrix4(tmpM);return raycaster.intersectObject(menu.mesh,false)[0]||null};
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
  const down=()=>{grabbing.add(c);regrab()},up=()=>{if(grabbing.delete(c))regrab()};
  c.addEventListener('squeezestart',down);c.addEventListener('squeezeend',up);
  // trigger: presses a menu button when pointing at the menu, else grabs
  c.addEventListener('selectstart',()=>{const h=menuHit(c);if(h){const i=menu.hit(h.uv);if(i>=0)menu.press(i);return}down()});
  c.addEventListener('selectend',up);
 }
 const rates=[...(session.supportedFrameRates||[])].filter(r=>r>=60).sort((a,b)=>a-b);
 const applyQuality=()=>{
  if(material)material.uniforms.stepSize.value=baseStep*(STEP[settings.quality]??1);
  renderer.xr.setFoveation?.(FOVEATION[settings.foveation]??1);
  if(rates.length&&session.updateTargetFrameRate)session.updateTargetFrameRate(rates[Math.min(settings.rate,rates.length-1)]).catch(()=>{});
  saveSettings(settings);
 };
 // fps per setting, so the owner can report which combination is smooth
 let frames=0,fpsAt=performance.now(),fps=0,info='';
 const L=ja?{q:'描画の細かさ',qv:['標準','粗め','最粗'],f:'周辺の簡略化',fv:['なし','中','強'],r:'ボリューム解像度',hz:'リフレッシュレート',seg:'表示',reset:'位置を戻す',exit:'終了',help:'グリップ/トリガーでつかむ・両手で拡大縮小'}
  :{q:'Detail',qv:['Normal','Coarse','Coarsest'],f:'Foveation',fv:['Off','Mid','High'],r:'Volume resolution',hz:'Refresh rate',seg:'Show',reset:'Reset position',exit:'Exit',help:'Grip/trigger to grab, both hands to scale'};
 menu.onDraw(()=>{
  const b=[],row=(y,label,values,key,resetFps=true)=>{values.forEach((v,i)=>b.push({x:32+i*200,y,w:188,h:64,label:v,on:settings[key]===i,action:()=>{settings[key]=i;applyQuality();if(resetFps){frames=0;fpsAt=performance.now()}}}));b.push({x:640,y,w:360,h:64,label,on:false})};
  // row labels are drawn as inert buttons on the right
  row(180,L.r,VRES.map(r=>Math.round(r*100)+'%'),'vres');row(260,L.q,L.qv,'quality');row(340,L.f,L.fv,'foveation');if(rates.length>1)row(420,L.hz,rates.slice(0,3).map(r=>r+' Hz'),'rate');
  SEGMENT_PRESET_ORDER.forEach((key,i)=>{const seg=segmentState[key];if(!seg?.active)return;b.push({x:32+i*240,y:520,w:228,h:64,label:tr(key),color:seg.color||'#888',on:!hidden.has(key),action:()=>{hidden.has(key)?hidden.delete(key):hidden.add(key)}})});
  b.push({x:32,y:620,w:300,h:70,label:L.reset,action:()=>{scene.attach(holder);grabbing.clear();twoHand=null;holder.position.copy(HOME);holder.quaternion.identity();holder.scale.setScalar(baseScale)}});
  b.push({x:700,y:620,w:300,h:70,label:L.exit,color:'#b33',on:true,action:()=>session.end()});
  menu.setButtons(b);
 });
 await renderer.xr.setSession(session);
 applyQuality();menu.refresh();
 const color=new THREE.Color();
 renderer.setAnimationLoop(()=>{
  if(twoHand){const s=Math.min(20,Math.max(0.05,twoHand.s0*handDist()/twoHand.d0));holder.scale.setScalar(s)}
  let hover=-1;
  for(const c of controllers){const h=menuHit(c),ray=c.userData.ray;if(h){ray.scale.z=h.distance;ray.material.color.setHex(0xffffff);const i=menu.hit(h.uv);if(i>=0)hover=i}else{ray.scale.z=0.08;ray.material.color.setHex(0x88ccff)}}
  menu.setHover(hover);
  if(material){
   for(let i=0;i<4;i++){
    const key=SEGMENT_PRESET_ORDER[i],seg=segmentState[key];
    material.uniforms.segA.value[i].set(seg?.min||0,seg?.max||0,seg?.opacity??1,seg?.active&&seg?.enabled&&!hidden.has(key)?1:0);
    color.set(seg?.color||'#ffffff');material.uniforms.segC.value[i].set(color.r,color.g,color.b);
   }
  }
  const f=VRES[settings.vres]??1;
  if(mesh){
   if(f<1){
    // own pass per eye into the small target, then the composite material
    // on the same box upscales it inside the main XR render
    const xrTarget=renderer.getRenderTarget(),w=xrTarget?.width||1,h=xrTarget?.height||1;
    renderer.xr.updateCamera(camera);const xrCam=renderer.xr.getCamera();
    const tw=Math.max(1,Math.ceil(w*f)),th=Math.max(1,Math.ceil(h*f));
    if(!lowTarget)lowTarget=new THREE.WebGLRenderTarget(tw,th,{depthBuffer:false,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter});
    else if(lowTarget.width!==tw||lowTarget.height!==th)lowTarget.setSize(tw,th);
    scene.updateMatrixWorld();rayMesh.matrixWorld.copy(mesh.matrixWorld);
    renderer.xr.enabled=false;renderer.setRenderTarget(lowTarget);
    renderer.setClearColor(0x000000,0);lowTarget.scissorTest=false;renderer.clear(true,false,false);
    for(const sub of xrCam.cameras){
     const v=sub.viewport,x=Math.floor(v.x*f),y=Math.floor(v.y*f),vw=Math.ceil(v.z*f),vh=Math.ceil(v.w*f);
     lowTarget.viewport.set(x,y,vw,vh);lowTarget.scissor.set(x,y,vw,vh);lowTarget.scissorTest=true;
     renderer.setRenderTarget(lowTarget);renderer.render(volScene,sub);
    }
    lowTarget.scissorTest=false;renderer.setRenderTarget(xrTarget);renderer.xr.enabled=true;renderer.setClearColor(BG,1);
    compMaterial.uniforms.img.value=lowTarget.texture;compMaterial.uniforms.invSize.value.set(1/w,1/h);
    mesh.material=compMaterial;
   }else mesh.material=material;
  }
  renderer.render(scene,camera);
  frames++;const now=performance.now();
  if(now-fpsAt>=1000){fps=frames*1000/(now-fpsAt);frames=0;fpsAt=now;if(mesh)menu.setLines([fps.toFixed(0)+' fps · '+info,L.help])}
 });
 const cleanup=()=>{
  renderer.setAnimationLoop(null);
  volTex?.dispose();brickTex?.dispose();material?.dispose();compMaterial?.dispose();lowTarget?.dispose();mesh?.geometry.dispose();menu.dispose();
  background.traverse(o=>{o.geometry?.dispose();o.material?.dispose()});
  renderer.dispose();renderer.domElement.remove();running=null;
 };
 session.addEventListener('end',cleanup,{once:true});
 try{
  const gl=renderer.getContext(),maxDim=gl.getParameter(gl.MAX_3D_TEXTURE_SIZE)||2048;
  const vd=await buildVolumeData(maxDim,(a,b)=>menu.setLines([(ja?'VRボリューム準備中… ':'Preparing VR volume… ')+a+' / '+b]));
  if(!running)return;
  volTex=new THREE.Data3DTexture(vd.data,...vd.dims);volTex.format=THREE.RGFormat;volTex.type=THREE.UnsignedByteType;
  volTex.minFilter=volTex.magFilter=THREE.LinearFilter;volTex.unpackAlignment=1;volTex.needsUpdate=true;
  brickTex=new THREE.Data3DTexture(vd.bricks,...vd.brickDims);brickTex.format=THREE.RGFormat;brickTex.type=THREE.FloatType;
  brickTex.minFilter=brickTex.magFilter=THREE.NearestFilter;brickTex.unpackAlignment=1;brickTex.needsUpdate=true;
  material=new THREE.ShaderMaterial({glslVersion:THREE.GLSL3,vertexShader,fragmentShader,side:THREE.BackSide,toneMapped:false,
   uniforms:{vol:{value:volTex},bricks:{value:brickTex},halfExt:{value:new THREE.Vector3(...vd.halfExt)},texDims:{value:new THREE.Vector3(...vd.dims)},brickDims:{value:new THREE.Vector3(...vd.brickDims)},
    stepSize:{value:vd.step},calib:{value:new THREE.Vector3(...vd.calibration)},segA:{value:[0,1,2,3].map(()=>new THREE.Vector4())},segC:{value:[0,1,2,3].map(()=>new THREE.Vector3())}}});
  material.transparent=true;material.depthWrite=false;material.blending=THREE.CustomBlending;material.blendSrc=THREE.OneFactor;material.blendDst=THREE.OneMinusSrcAlphaFactor;
  // BackSide: rays start at the eye when the head is inside the box
  mesh=new THREE.Mesh(new THREE.BoxGeometry(2,2,2),material);mesh.frustumCulled=false;
  // app units (longest side 3.3) -> 0.3 m in VR
  compMaterial=new THREE.ShaderMaterial({glslVersion:THREE.GLSL3,vertexShader:compositeVertex,fragmentShader:compositeFragment,side:THREE.BackSide,toneMapped:false,depthWrite:false,transparent:true,
   blending:THREE.CustomBlending,blendSrc:THREE.OneFactor,blendDst:THREE.OneMinusSrcAlphaFactor,uniforms:{img:{value:null},invSize:{value:new THREE.Vector2(1,1)},halfExt:{value:new THREE.Vector3(...vd.halfExt)}}});
  // the offscreen target is cleared to 0 and written with plain premultiplied
  // colour (no blending needed inside the volume pass)
  rayMesh=new THREE.Mesh(mesh.geometry,material.clone());rayMesh.material.uniforms=material.uniforms;rayMesh.material.blending=THREE.NoBlending;rayMesh.material.transparent=false;
  rayMesh.matrixAutoUpdate=false;rayMesh.matrixWorldAutoUpdate=false;rayMesh.frustumCulled=false;volScene.add(rayMesh);
  mesh.renderOrder=1;holder.scale.setScalar(baseScale);holder.add(mesh);baseStep=vd.step;applyQuality();
  info=vd.dims.join('×')+(vd.filtered?(ja?' フィルター適用':' filtered'):'');
  menu.setLines([info,L.help]);
 }catch(e){
  console.error(e);menu.setLines([(ja?'VR準備に失敗: ':'VR failed: ')+String(e.message||e).slice(0,40)]);
 }
}
