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
import { volumeTexturePlan, reduceSliceArea, packedRgSlice, packCtSlice, gpuRunsForTexture } from './medical-volume.js?v=20261006-build469';
import { gpuVolumeTarget, gpuVolumeEditDescriptors } from './gpu-volume-data.js?v=20261006-build469';
import { SEGMENT_PRESET_ORDER, segmentState, segmentEditState, segmentSourceSignature } from './segments.js?v=20261006-build469';
import { sceneState, analysisRegions, activeSeries } from './state.js?v=20261006-build469';
import { datasetFingerprint } from './project-file.js?v=20261006-build469';
import { sectionRayHit, recordVrPoint, resolveTrigger, createStickGate, deleteSelected, undoDelete, pointIsHidden } from './vr-point.js?v=20261006-build469';
import { createVrPointMarkers } from './vr-point-markers.js?v=20261006-build469';
import { buildClsData } from './point-cls.js?v=20261006-build469';
import { createHiddenClsManager } from './hidden-cls-state.js?v=20261006-build469';
import { getComments, onCommentsChange, commentMatchesSeries, removeComment, restoreComment } from './comments.js?v=20261006-build469';
import { buildDistanceBytes, combineClassificationDistance } from './distance-field.js?v=20261006-build469';
import { marchClassificationHitInfo } from './vr-pick.js?v=20261006-build469';
import { setBusySlot, reportBusyProgress } from './progress-modal.js?v=20261006-build469';
import { tr } from './i18n.js?v=20261006-build469';
import { APP_BUILD } from './version.js?v=20261006-build469';
import { wc, ww } from './ui-shell.js?v=20261006-build469';

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
// processed segments / edits (build 348/350): the same keep/exclude runs the
// WebGPU volume uses (gpuVolumeEditDescriptors), rasterised to RGBA, channel s
// = 1 where segment s is allowed (only for segments in editMask). Linear
// filtering + 0.5 gives a smooth boundary instead of voxel steps (diagnostic
// switch in 詳細: smooth / nearest / off)
uniform int editMask;
// build 459: segments decided by their mask alone (Closing / hole filling can add voxels outside the HU range)
uniform int editMaskOnly;
uniform sampler3D editTex;
// up to 4 sections (build 360): planeCount planes, bit i of planeCut = plane
// i clips (its removed half is dot(n,p) < w); every plane shows its slice,
// composited in depth order inside the kept interval
uniform vec4 cutPlanes[4];
uniform int planeCount;
uniform int planeCut;
uniform float sliceOpacity;
// build 357: capOn paints the cut face flat in the segment colour (lit by the
// plane normal, as the app's section cap); sliceTint > 0 colours the slice
// where a visible segment is (same test as the volume, mask included)
uniform int capOn;
uniform float sliceTint;
uniform vec2 sliceWindow; // center, width
uniform float sliceAir; // build 407: HU at or below which the slice is transparent
// build 368: surface search 1 = fast (2 secant guesses + 1 bisection on the
// interpolated value), 0 = exact (6 bisections)
uniform int refine;
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
// analysis results (build 409): colour index per voxel (0 none, 1..14 = regionC), read only where a colour is
// chosen (surface hit, cut face, slice tint), never per step; the hit is sampled a little inside the surface.
// Compiled only with VRL_REGIONS (a session without results runs the shader as before: the branch alone cost
// about 14 % on SwiftShader)
#ifdef VRL_REGIONS
uniform sampler3D regionTex;
uniform vec3 regionC[14];
// build 437 (owner: fat hidden, the soft-tissue border still coloured): a colour applies only to a surface of a segment
// its results belong to (bit s of regionSeg[colour] for segment s); the colour is read 0.75 voxel inside the hit on the
// 256³ grid, so next to a fat result a soft-tissue surface used to take the fat result's colour
uniform int regionSeg[14];
vec3 regionColor(vec3 p,vec3 base,int s){
 int i=int(texture(regionTex,clamp(texCoord(p),vec3(0.0),vec3(0.999999))).r*255.0+0.5);
 return i>0&&i<=14&&((regionSeg[i-1]>>s)&1)==1?regionC[i-1]:base;
}
#else
vec3 regionColor(vec3 p,vec3 base,int s){return base;}
#endif
float huAt(vec3 tc0){
 vec3 tc=clamp(tc0,vec3(0.0),vec3(0.999999));
 vec2 q=texture(vol,tc).rg*255.0;
 return (q.x+q.y*256.0-calib.z)*calib.x+calib.y;
}
bool editAllows(int s,vec3 tc){
 if(((editMask>>s)&1)==0)return true;
 return texture(editTex,clamp(tc,vec3(0.0),vec3(0.999999)))[s]>=0.5;
}
// precomputed classification (build 356): per segment, 0.5 + (HU distance
// inside its range)/2048, folded with the processing mask, one byte each.
// The trilinear value crosses 0.5 where the HU crosses the threshold (linear
// map), so one fetch replaces HU decode + range test + mask fetch.
uniform int useCls;
uniform sampler3D clsTex;
uniform ivec4 clsChan; // channel of each segment (-1: none); only active segments are stored
// distance field (build 369): per segment channel (same layout as clsTex) a
// lower bound, in voxels, of the distance to the voxels around that
// segment's surface (distance-field.js). With useDist > 0 the ray jumps
// (d - 2) voxels whenever the smallest enabled distance d is at least 3
// (sphere tracing: no surface can lie inside the jump), and samples at the
// fine step only near surfaces. voxelMin = object-space size of the smallest
// voxel side of that grid. Nearest sampling.
uniform sampler3D distTex;
uniform int useDist;
uniform int distInCls; // build 384: the combined distance field (min over the shown segments) is the classification texture's alpha: one fetch per step
uniform float voxelMin;
float distAt(vec3 tc){
 vec4 q=texture(distTex,clamp(tc,vec3(0.0),vec3(0.999999)))*255.0;float m=255.0;
 for(int s=0;s<4;s++){int c=clsChan[s];if(c>=0&&segA[s].w>0.5)m=min(m,q[c]);}
 return m;
}
// the value the last segmentIndexAt sampled (build 368): HU, or the
// classification vector; the surface search reuses it as the outside sample
float gHu=0.0;vec4 gQ=vec4(0.0);
int segmentIndexFromQ(vec4 q){
 gQ=q;
 for(int s=0;s<4;s++){int c=clsChan[s];if(c>=0&&segA[s].w>0.5&&q[c]>=0.5)return s;}
 return -1;
}
int segmentIndexAt(vec3 tc){
 if(useCls>0){
  return segmentIndexFromQ(texture(clsTex,clamp(tc,vec3(0.0),vec3(0.999999))));
 }
 float v=huAt(tc);gHu=v;
 for(int s=0;s<4;s++){vec4 a=segA[s];if(a.w>0.5&&(((editMaskOnly>>s)&1)==1||(v>=a.x&&v<=a.y))&&editAllows(s,tc))return s;}
 return -1;
}
// signed distance-like value of segment s at the last sample: >= 0 inside
float segValue(int s);
// the largest enabled-segment value at the last sample (negative when the sample is in no segment)
float maxSegValue(){float m=-1e9;for(int s=0;s<4;s++)if(segA[s].w>0.5)m=max(m,segValue(s));return m;}
float segValue(int s){if(useCls>0){int c=clsChan[s];return c>=0?gQ[c]-0.5:-1.0;}vec4 a=segA[s];return gHu<a.x?gHu-a.x:a.y-gHu;}
// build 368: 0 = no enabled segment in the brick, 1 = mixed, 2+s = every
// sample in the brick is segment s (range holds the brick's min..max, no
// earlier enabled segment overlaps, no processing mask on s): a ray already
// inside s crosses it without sampling. Bricks carry one voxel of overlap.
int brickClass(vec3 tc){
 vec2 mm=texture(bricks,clamp(tc,vec3(0.0),vec3(0.999999))).rg;
 for(int s=0;s<4;s++){vec4 a=segA[s];if(a.w>0.5&&(((editMaskOnly>>s)&1)==1||(a.y>=mm.x&&a.x<=mm.y))){if(mm.x>=a.x&&mm.y<=a.y&&((editMask>>s)&1)==0)return 2+s;return 1;}}
 return 0;
}
bool brickMayContain(vec3 tc){return brickClass(tc)>0;}
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
float sliceHU(vec3 p){
 vec2 q=texture(sliceVol,clamp(texCoord(p),vec3(0.0),vec3(0.999999))).rg*255.0;
 return (q.x+q.y*256.0-calib.z)*calib.x+calib.y;
}
float sliceGray(vec3 p){
 return clamp((sliceHU(p)-(sliceWindow.x-0.5*sliceWindow.y))/max(sliceWindow.y,1e-3),0.0,1.0);
}
// build 403 / 407 (owner): the slice is transparent at or below sliceAir HU (air by default; raise it to hide fat
// as well), before any tint; it reaches the set opacity 10 HU above the threshold
vec4 sliceColor(vec3 p){
 float hu=sliceHU(p),a=smoothstep(sliceAir,sliceAir+10.0,hu);
 if(a<=0.0)return vec4(0.0);
 float g=clamp((hu-(sliceWindow.x-0.5*sliceWindow.y))/max(sliceWindow.y,1e-3),0.0,1.0);
 if(sliceTint>0.0){int si=segmentIndexAt(texCoord(p));if(si>=0)return vec4(mix(vec3(g),regionColor(p,segC[si].rgb,si),sliceTint),a);}
 return vec4(vec3(g),a);
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
 float capT=-1.0;int capPlane=-1;float sliceT[4];int nSlice=0;
 float crossT[4];bool crossOk[4];
 for(int i=0;i<4;i++){
  crossOk[i]=false;crossT[i]=0.0;if(i>=planeCount)continue;
  vec4 pl=cutPlanes[i];float side=dot(pl.xyz,o)-pl.w;float slope=dot(pl.xyz,dir);bool clip=((planeCut>>i)&1)==1;
  if(abs(slope)>1e-8){
   float cross=-side/slope;crossT[i]=cross;crossOk[i]=true;
   if(clip){if(slope>0.0){if(cross>t){t=cross;capT=cross;capPlane=i;}}else endT=min(endT,cross);}
  }else if(clip&&side<0.0)discard;
 }
 if(t>endT+1e-6)discard;
 if(capOn==0||capT>endT){capT=-1.0;capPlane=-1;}
 // slices inside the kept interval, sorted front to back
 if(sliceOpacity>0.0){
  for(int i=0;i<4;i++){if(crossOk[i]&&crossT[i]>=t-1e-5&&crossT[i]<=endT+1e-5){sliceT[nSlice]=crossT[i];nSlice++;}}
  for(int i=1;i<4;i++){if(i>=nSlice)break;float k=sliceT[i];int j=i-1;while(j>=0&&sliceT[j]>k){sliceT[j+1]=sliceT[j];j--;}sliceT[j+1]=k;}
 }
 int nextSlice=0;
 float previousT=t;int lastIndex=-1;vec4 acc=vec4(0.0);int iters=0;
 // build 368: brickEnd = t where the current non-empty brick is left; the
 // brick min/max is fetched once per brick instead of once per sample
 float brickEnd=-1.0;int uniformSeg=-1;bool prevValid=false;float prevF=0.0;float lastDd=99.0;float distInc=ceil(1.5*ceil(step/max(voxelMin,1e-6)));
#ifndef VRL_NO_GENERAL
 if(distInCls>0&&useCls>0&&diag!=4){
#else
 // build 393: variant without the general loop (compiled when the combined field is in use)
 {
#endif
  // build 386: tight loop for the combined-field path. Same arithmetic as the general loop below
  // without its per-step slice / cap / brick / uniform-brick bookkeeping, the segment work done on the fetched vector and the
  // surface search testing the fetched classification directly (pixel-identical; practice data 609 -> 177 ms on SwiftShader)
  // build 387: a hit that ends the ray (opaque segment) is searched and shaded after the loop, so the search does not run
  // inside the divergent march; semi-transparent hits are handled inline as before. Same arithmetic, same order.
  int hitIdx=-1;float hitLo=0.0;float hitHi=0.0;float hitF0=0.0;float hitF1=0.0;bool hitIso=false;
  // per-ray constant: enabled channels as a mask (1 enabled, 0 not)
  vec4 enM=vec4(0.0);for(int s=0;s<4;s++){int c=clsChan[s];if(c>=0&&segA[s].w>0.5)enM[c]=1.0;}
  // build 389: rays with a slice or a cut face use a second copy of the march with those events (the same code in one
  // loop made SwiftShader's compiled loop twice as slow for every ray, so the two stay separate)
#ifndef VRL_NO_EVENTS
  if(nSlice==0&&capT<0.0){
#endif
  for(int iter=0;iter<4096;iter++){
   if(t>endT||acc.a>0.985)break;
   iters++;
   vec4 q=texture(clsTex,clamp(texCoord(o+dir*t),vec3(0.0),vec3(0.999999)));float dd=q.a*255.0;
   if(dd>=2.7){float nextJ=t+(dd-1.8)*voxelMin;previousT=nextJ-step*0.05;prevValid=false;t=nextJ;continue;}
   vec4 fv=(q-0.5)*enM-(1.0-enM)*1e9;float maxF=max(max(fv.x,fv.y),max(fv.z,fv.w));
   int idx=-1;float curF=-1.0;
   for(int s=0;s<4;s++){int c=clsChan[s];if(c>=0&&fv[c]>=0.0){idx=s;curF=fv[c];break;}}
   gQ=q;
   if(idx!=lastIndex){
    if(idx>=0){
     float lo=previousT;float hi=t;bool simple=diag==3||segC[idx].w>0.5;
     float f1=curF;bool iso=refine==1&&((editMask>>idx)&1)==0&&prevValid&&prevF<0.0;
     float alpha=clamp(segA[idx].z,0.03,1.0);
     if((1.0-acc.a)*alpha+acc.a>0.985&&!simple){hitIdx=idx;hitLo=lo;hitHi=hi;hitF0=prevF;hitF1=f1;hitIso=iso;lastIndex=idx;break;}
     int cIdx=clsChan[idx];
     if(!simple&&iso){float f0=prevF;
      for(int r=0;r<3;r++){float mid=(lo+hi)*0.5;if(r<2&&abs(f1-f0)>1e-6)mid=clamp(lo+(hi-lo)*(-f0/(f1-f0)),lo+(hi-lo)*0.02,hi-(hi-lo)*0.02);
       vec4 qm=texture(clsTex,clamp(texCoord(o+dir*mid),vec3(0.0),vec3(0.999999)));float fm=qm[cIdx]-0.5;bool inside=fm>=0.0;
       for(int s=0;s<4;s++){if(s>=idx)break;int c=clsChan[s];if(c>=0&&segA[s].w>0.5&&qm[c]>=0.5)inside=false;}
       if(inside){hi=mid;f1=fm;}else{lo=mid;f0=fm;}}}
     else if(!simple)for(int r=0;r<6;r++){float mid=(lo+hi)*0.5;vec4 qm=texture(clsTex,clamp(texCoord(o+dir*mid),vec3(0.0),vec3(0.999999)));bool inside=qm[cIdx]>=0.5;
       for(int s=0;s<4;s++){if(s>=idx)break;int c=clsChan[s];if(c>=0&&segA[s].w>0.5&&qm[c]>=0.5)inside=false;}
       if(inside)hi=mid;else lo=mid;}
     vec3 hp=o+dir*hi;vec3 tc=texCoord(hp);
     vec3 n=simple?-dir:gradientAt(tc);
     vec3 viewDir=normalize(o-hp);vec3 lightDir=normalize(viewDir+vec3(0.35,0.5,0.25));
     float diffuse=0.28+0.72*abs(dot(n,lightDir));
     float spec=pow(max(dot(n,normalize(lightDir+viewDir)),0.0),20.0)*0.18;
     vec3 lit=regionColor(hp+dir*(0.75*voxelMin),segC[idx].rgb,idx)*diffuse+vec3(spec);
     float contribution=(1.0-acc.a)*alpha;acc=vec4(acc.rgb+lit*contribution,acc.a+contribution);
    }
    lastIndex=idx;
   }
   prevValid=true;prevF=idx>=0?curF:maxF;
   previousT=t;t+=step;
  }
#ifndef VRL_NO_EVENTS
  }else{
  for(int iter=0;iter<4096;iter++){
   if(t>endT||acc.a>0.985)break;
   iters++;
   // slices and the cut face as in the general loop (same order: slices up to t + step, then the cap, then the sample)
   while(nextSlice<nSlice&&sliceT[nextSlice]<=t+step){
    vec4 sc=sliceColor(o+dir*sliceT[nextSlice]);nextSlice++;
    float contribution=(1.0-acc.a)*sliceOpacity*sc.a;acc=vec4(acc.rgb+sc.rgb*contribution,acc.a+contribution);
   }
   if(capT>=0.0){
    vec3 cp=o+dir*capT;int ci=segmentIndexAt(texCoord(cp));capT=-1.0;
    if(ci>=0){
     vec3 n=cutPlanes[capPlane].xyz;vec3 viewDir=-dir;vec3 lightDir=normalize(viewDir+vec3(0.35,0.5,0.25));
     float diffuse=0.28+0.72*abs(dot(n,lightDir));
     vec3 lit=mix(regionColor(cp,segC[ci].rgb,ci),vec3(1.0),0.22)*diffuse;
     float contribution=(1.0-acc.a)*clamp(segA[ci].z,0.03,1.0);acc=vec4(acc.rgb+lit*contribution,acc.a+contribution);
     lastIndex=ci;previousT=t;t+=step;continue;
    }
   }
   vec4 q=texture(clsTex,clamp(texCoord(o+dir*t),vec3(0.0),vec3(0.999999)));float dd=q.a*255.0;
   if(dd>=2.7){float nextJ=t+(dd-1.8)*voxelMin;previousT=nextJ-step*0.05;prevValid=false;t=nextJ;continue;}
   vec4 fv=(q-0.5)*enM-(1.0-enM)*1e9;float maxF=max(max(fv.x,fv.y),max(fv.z,fv.w));
   int idx=-1;float curF=-1.0;
   for(int s=0;s<4;s++){int c=clsChan[s];if(c>=0&&fv[c]>=0.0){idx=s;curF=fv[c];break;}}
   gQ=q;
   if(idx!=lastIndex){
    if(idx>=0){
     float lo=previousT;float hi=t;bool simple=diag==3||segC[idx].w>0.5;
     float f1=curF;bool iso=refine==1&&((editMask>>idx)&1)==0&&prevValid&&prevF<0.0;
     float alpha=clamp(segA[idx].z,0.03,1.0);
     if((1.0-acc.a)*alpha+acc.a>0.985&&!simple){hitIdx=idx;hitLo=lo;hitHi=hi;hitF0=prevF;hitF1=f1;hitIso=iso;lastIndex=idx;break;}
     int cIdx=clsChan[idx];
     if(!simple&&iso){float f0=prevF;
      for(int r=0;r<3;r++){float mid=(lo+hi)*0.5;if(r<2&&abs(f1-f0)>1e-6)mid=clamp(lo+(hi-lo)*(-f0/(f1-f0)),lo+(hi-lo)*0.02,hi-(hi-lo)*0.02);
       vec4 qm=texture(clsTex,clamp(texCoord(o+dir*mid),vec3(0.0),vec3(0.999999)));float fm=qm[cIdx]-0.5;bool inside=fm>=0.0;
       for(int s=0;s<4;s++){if(s>=idx)break;int c=clsChan[s];if(c>=0&&segA[s].w>0.5&&qm[c]>=0.5)inside=false;}
       if(inside){hi=mid;f1=fm;}else{lo=mid;f0=fm;}}}
     else if(!simple)for(int r=0;r<6;r++){float mid=(lo+hi)*0.5;vec4 qm=texture(clsTex,clamp(texCoord(o+dir*mid),vec3(0.0),vec3(0.999999)));bool inside=qm[cIdx]>=0.5;
       for(int s=0;s<4;s++){if(s>=idx)break;int c=clsChan[s];if(c>=0&&segA[s].w>0.5&&qm[c]>=0.5)inside=false;}
       if(inside)hi=mid;else lo=mid;}
     vec3 hp=o+dir*hi;vec3 tc=texCoord(hp);
     vec3 n=simple?-dir:gradientAt(tc);
     vec3 viewDir=normalize(o-hp);vec3 lightDir=normalize(viewDir+vec3(0.35,0.5,0.25));
     float diffuse=0.28+0.72*abs(dot(n,lightDir));
     float spec=pow(max(dot(n,normalize(lightDir+viewDir)),0.0),20.0)*0.18;
     vec3 lit=regionColor(hp+dir*(0.75*voxelMin),segC[idx].rgb,idx)*diffuse+vec3(spec);
     float contribution=(1.0-acc.a)*alpha;acc=vec4(acc.rgb+lit*contribution,acc.a+contribution);
    }
    lastIndex=idx;
   }
   prevValid=true;prevF=idx>=0?curF:maxF;
   previousT=t;t+=step;
  }
  }
#endif
  if(hitIdx>=0){
   int idx=hitIdx;float lo=hitLo;float hi=hitHi;float f0=hitF0;float f1=hitF1;int cIdx=clsChan[idx];
   if(hitIso){
    for(int r=0;r<3;r++){float mid=(lo+hi)*0.5;if(r<2&&abs(f1-f0)>1e-6)mid=clamp(lo+(hi-lo)*(-f0/(f1-f0)),lo+(hi-lo)*0.02,hi-(hi-lo)*0.02);
     vec4 qm=texture(clsTex,clamp(texCoord(o+dir*mid),vec3(0.0),vec3(0.999999)));float fm=qm[cIdx]-0.5;bool inside=fm>=0.0;
     for(int s=0;s<4;s++){if(s>=idx)break;int c=clsChan[s];if(c>=0&&segA[s].w>0.5&&qm[c]>=0.5)inside=false;}
     if(inside){hi=mid;f1=fm;}else{lo=mid;f0=fm;}}}
   else for(int r=0;r<6;r++){float mid=(lo+hi)*0.5;vec4 qm=texture(clsTex,clamp(texCoord(o+dir*mid),vec3(0.0),vec3(0.999999)));bool inside=qm[cIdx]>=0.5;
     for(int s=0;s<4;s++){if(s>=idx)break;int c=clsChan[s];if(c>=0&&segA[s].w>0.5&&qm[c]>=0.5)inside=false;}
     if(inside)hi=mid;else lo=mid;}
   vec3 hp=o+dir*hi;vec3 tc=texCoord(hp);
   vec3 n=gradientAt(tc);
   vec3 viewDir=normalize(o-hp);vec3 lightDir=normalize(viewDir+vec3(0.35,0.5,0.25));
   float diffuse=0.28+0.72*abs(dot(n,lightDir));
   float spec=pow(max(dot(n,normalize(lightDir+viewDir)),0.0),20.0)*0.18;
   float alpha=clamp(segA[idx].z,0.03,1.0);
   vec3 lit=regionColor(hp+dir*(0.75*voxelMin),segC[idx].rgb,idx)*diffuse+vec3(spec);
   float contribution=(1.0-acc.a)*alpha;acc=vec4(acc.rgb+lit*contribution,acc.a+contribution);
  }
#ifndef VRL_NO_GENERAL
 }else
 for(int iter=0;iter<4096;iter++){
  if(t>endT||acc.a>0.985)break;
  iters++;
  while(nextSlice<nSlice&&sliceT[nextSlice]<=t+step){
   // a slice lies before the next sample: composite it in depth order
   vec4 sc=sliceColor(o+dir*sliceT[nextSlice]);nextSlice++;
   float contribution=(1.0-acc.a)*sliceOpacity*sc.a;acc=vec4(acc.rgb+sc.rgb*contribution,acc.a+contribution);
  }
  if(capT>=0.0){
   // cut face: flat, segment colour lightened, lit by the plane normal
   vec3 cp=o+dir*capT;int ci=segmentIndexAt(texCoord(cp));capT=-1.0;
   if(ci>=0){
    vec3 n=cutPlanes[capPlane].xyz;vec3 viewDir=-dir;vec3 lightDir=normalize(viewDir+vec3(0.35,0.5,0.25));
    float diffuse=0.28+0.72*abs(dot(n,lightDir));
    vec3 lit=mix(regionColor(cp,segC[ci].rgb,ci),vec3(1.0),0.22)*diffuse;
    float contribution=(1.0-acc.a)*clamp(segA[ci].z,0.03,1.0);acc=vec4(acc.rgb+lit*contribution,acc.a+contribution);
    lastIndex=ci;previousT=t;t+=step;continue;
   }
  }
  vec3 p=o+dir*t;vec3 tc0=texCoord(p);
  bool haveQ=false;vec4 qHere=vec4(0.0);
  if(distInCls>0&&useCls>0&&diag!=4){
   // build 384: one fetch serves the jump test (alpha) and the classification below. The alpha is filtered
   // trilinearly: every corner value is a lower bound of the distance to the seeds and the distance is
   // 1-Lipschitz, so the surface is at least dd - 1.74 voxels away; jump dd - 1.8 when that is 0.9 or more
   qHere=texture(clsTex,clamp(tc0,vec3(0.0),vec3(0.999999)));haveQ=true;float dd=qHere.a*255.0;
   if(dd>=2.7){float nextJ=t+(dd-1.8)*voxelMin;previousT=nextJ-step*0.05;prevValid=false;t=nextJ;continue;}
  }
  else if(useDist>0&&diag!=4){
   // build 381: the field is read only when a jump is possible. One step moves the sampled voxel by at most one per
   // axis (chamfer 5 = 1.5 in field units, floor: +2), so after a read of 0 the next value is at most 2 and the read is
   // skipped; the bound grows by distInc per skipped step (steps longer than a voxel: more). Same jumps, same image.
   if(lastDd>=1.0){float dd=distAt(tc0);lastDd=dd;
    if(dd>=3.0){float nextJ=t+(dd-2.0)*voxelMin;previousT=nextJ-step*0.05;prevValid=false;t=nextJ;lastDd=99.0;continue;}
   }else{lastDd+=distInc;}
  }
  bool canSample=diag==4||useDist>0||t<brickEnd;
  if(!canSample){int bc=brickClass(tc0);canSample=bc>0;uniformSeg=bc>=2?bc-2:-1;if(canSample)brickEnd=t+brickExit(tc0,dir);}
  float nextT=t+step;
  if(!canSample){brickEnd=-1.0;prevValid=false;nextT=t+max(brickExit(tc0,dir)+step*0.05,step);lastIndex=-1;}
  else if(diag!=4&&uniformSeg>=0&&uniformSeg==lastIndex&&brickEnd>t+step){
   // inside a uniform brick of the segment the ray is already in: nothing changes until it is left
   nextT=brickEnd+step*0.05;previousT=max(t,brickEnd-step*0.05);prevValid=false;t=nextT;continue;
  }
  else{
   int idx=haveQ?segmentIndexFromQ(qHere):segmentIndexAt(tc0);
   float curF=idx>=0?segValue(idx):-1.0;
   if(idx!=lastIndex){
    if(idx>=0){
     float lo=previousT;float hi=t;bool simple=diag==3||segC[idx].w>0.5;
     // fast search (build 368): the boundary is an iso-value of the sampled
     // field (no processing mask on the segment, previous sample measured and
     // outside): two secant guesses + one bisection instead of six bisections
     float f1=segValue(idx);bool iso=refine==1&&((editMask>>idx)&1)==0&&prevValid&&prevF<0.0;
     if(!simple&&iso){float f0=prevF;
      for(int r=0;r<3;r++){float mid=(lo+hi)*0.5;if(r<2&&abs(f1-f0)>1e-6)mid=clamp(lo+(hi-lo)*(-f0/(f1-f0)),lo+(hi-lo)*0.02,hi-(hi-lo)*0.02);
       bool inside=segmentIndexAt(texCoord(o+dir*mid))==idx;float fm=segValue(idx);if(inside){hi=mid;f1=fm;}else{lo=mid;f0=fm;}}}
     else if(!simple)for(int r=0;r<6;r++){float mid=(lo+hi)*0.5;if(segmentIndexAt(texCoord(o+dir*mid))==idx)hi=mid;else lo=mid;}
     vec3 hp=o+dir*hi;vec3 tc=texCoord(hp);
     vec3 n=simple?-dir:gradientAt(tc);
     vec3 viewDir=normalize(o-hp);vec3 lightDir=normalize(viewDir+vec3(0.35,0.5,0.25));
     float diffuse=0.28+0.72*abs(dot(n,lightDir));
     float spec=pow(max(dot(n,normalize(lightDir+viewDir)),0.0),20.0)*0.18;
     float alpha=clamp(segA[idx].z,0.03,1.0);
     vec3 lit=regionColor(hp+dir*(0.75*voxelMin),segC[idx].rgb,idx)*diffuse+vec3(spec);
     float contribution=(1.0-acc.a)*alpha;acc=vec4(acc.rgb+lit*contribution,acc.a+contribution);
    }
    lastIndex=idx;
   }
   // outside value for the next segment's search: the largest segment value
   // at this sample when no segment holds it (kept negative), else its own
   prevValid=true;prevF=idx>=0?curF:maxSegValue();
  }
  previousT=t;t=nextT;
 }
#else
 }
#endif
 while(nextSlice<nSlice&&acc.a<=0.985){
  vec4 sc=sliceColor(o+dir*sliceT[nextSlice]);nextSlice++;
  float contribution=(1.0-acc.a)*sliceOpacity*sc.a;acc=vec4(acc.rgb+sc.rgb*contribution,acc.a+contribution);
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

// processed-segment mask (RGBA, one channel per segment) on the given grid:
// the WebGPU edit runs mapped with the same gpuRunsForTexture (exclude runs
// dilated by one on a reduced grid, as the WebGPU volume does)
function buildEditMask(dims){
 const v=gpuVolumeTarget();if(!v)return{activeMask:0,data:null};
 const descs=gpuVolumeEditDescriptors(),[w,h,d]=dims,sourceDims=[v.columns,v.rows,v.slices],reduced=w!==v.columns||h!==v.rows||d!==v.slices;
 let activeMask=0,maskOnly=0,data=null;
 SEGMENT_PRESET_ORDER.slice(0,4).forEach((key,si)=>{
  const desc=descs[key];if(!desc?.runs)return;
  const runs=gpuRunsForTexture(desc.runs,sourceDims,dims,{dilate:reduced&&desc.mode==='exclude'?1:0});
  data||=new Uint8Array(w*h*d*4);activeMask|=1<<si;if(desc.maskOnly)maskOnly|=1<<si;
  const on=desc.mode==='exclude'?0:255;
  if(desc.mode==='exclude')for(let i=si;i<data.length;i+=4)data[i]=255;
  for(let z=0;z<d;z++){const rec=runs?.[z];if(!rec?.length)continue;
   for(let i=0;i<rec.length;i+=3){const o=(z*h+rec[i])*w;for(let x=rec[i+1];x<=rec[i+2];x++)data[(o+x)*4+si]=on}
  }
 });
 return{activeMask,maskOnly,data};
}
// rg8-packed u16 texture of the current volume, built with the same plan,
// area reduction and packing as the WebGPU upload, plus per-brick HU min/max
async function buildVolumeData(maxDim,onProgress,{noBricks=false}={}){
 const v=gpuVolumeTarget(),s=v?.series;
 if(!v?.sourceBacked||!s)throw new Error('VR: open a DICOM series first');
 const plan=volumeTexturePlan(v,0,maxDim,VR_TARGET_SIDE),[tw,th,td]=plan.dims,first=s.slices[0],signed=!!first.signed;
 const filtered=!!(v.filterSignature&&typeof v.sliceData==='function');
 const sliceBytes=filtered?async z=>packCtSlice(await v.sliceData(z),first):z=>packedRgSlice(s.slices[z]);
 // build 359: when the 3D view's WebGPU texture holds the same data on the
 // same grid (series, filter signature, plan), copy it instead of reading
 // and filtering the DICOM slices again
 const mv=sceneState?.medicalVolume;let copied=null;
 if(mv?.texture&&typeof mv.readPackedTexture==='function'&&mv.seriesId===s.id&&mv.dataSignature!=='partial'&&(mv.dataSignature||'')===(v.filterSignature||'')&&mv.textureDims?.join()===plan.dims.join()){
  try{copied=await mv.readPackedTexture((a,b)=>onProgress?.(a,b,'gpu'))}catch(e){console.warn('VR: GPU copy failed, reading slices',e);copied=null}
 }
 const data=copied?.data||new Uint8Array(tw*th*td*2),sliceSize=tw*th*2;
 const spans=(n,t)=>{const a=new Uint32Array(t+1);for(let i=0;i<=t;i++)a[i]=Math.min(n,Math.round(i*n/t));for(let i=0;i<t;i++)if(a[i+1]<=a[i])a[i+1]=Math.min(n,a[i]+1);return a};
 const xs=spans(s.columns,tw),ys=spans(s.rows,th),rowSum=new Float64Array(tw),rowCnt=new Uint32Array(tw);
 const zMap=new Uint32Array(td);for(let z=0;z<td;z++)zMap[z]=td<=1?0:Math.round(z*(s.slices.length-1)/(td-1));
 for(let z=0;z<td&&!copied;z++){
  const packed=await sliceBytes(plan.reduced?zMap[z]:z),out=data.subarray(z*sliceSize,(z+1)*sliceSize);
  if(plan.reduced)reduceSliceArea(packed,s.columns,xs,ys,tw,th,tw*2,out,rowSum,rowCnt);else out.set(packed.subarray(0,sliceSize));
  if((z&15)===15||z===td-1){onProgress?.(z+1,td);await new Promise(r=>setTimeout(r,0))}
 }
 const slope=first.slope||1,intercept=first.intercept||0,bias=signed?32768:0,calibration=[slope,intercept,bias];
 const {bricks:mm,brickDims}=noBricks?{bricks:null,brickDims:null}:computeBricks(data,[tw,th,td],calibration);
 const px=s.columns*s.spacingX,py=s.rows*s.spacingY,pz=s.slices.length*s.spacingZ,maxP=Math.max(px,py,pz,1),scale=3.3/maxP;
 const halfExt=[px*scale*.5,py*scale*.5,pz*scale*.5],step=Math.max(1e-5,Math.min(px/tw,py/th,pz/td)*scale*.85);
 return{data,dims:[tw,th,td],bricks:mm,brickDims,halfExt,step,calibration,filtered,source:copied?'gpu':'files'};
}

// VR settings kept per browser (resolution only applies when a session starts)
const SETTINGS_KEY='vrl-vr-settings-5',OLD_KEYS=['vrl-vr-settings-4','vrl-vr-settings-3']; // v5: slice opacity defaults to 70 % (owner, build 362)
// menuMode 0 follows the head lazily, 1 stays where it is; secHold 0 grip
// picks the section up near the frame, 1 trigger fixes / picks it up
const DEFAULTS={cap:1,sliceAir:-500,sliceTint:0.5,menuMode:0,secHold:0,cut:1,sliceOpacity:0.7,data:1,quality:0,vres:0,foveation:2,rate:0,help:1,refine:1,labelSize:0};
// an older key is migrated once, with the slice opacity reset to the new default
function loadSettings(){try{const n=localStorage.getItem(SETTINGS_KEY),o=n==null&&OLD_KEYS.map(k=>localStorage.getItem(k)).find(Boolean);return{...DEFAULTS,...JSON.parse(n||o||'{}'),...(o?{sliceOpacity:DEFAULTS.sliceOpacity}:{})}}catch{return{...DEFAULTS}}}
function saveSettings(v){try{localStorage.setItem(SETTINGS_KEY,JSON.stringify(v))}catch{}}
// VRES: the ray-marched volume is drawn into an offscreen target this much
// smaller per axis and scaled up where the volume box covers the view. Owner,
// build 337: fps fell from 30 to 16 when the volume was enlarged, so the cost
// follows the covered pixels.
// 0 = auto (build 340). Owner, build 339: box only keeps 90 fps, marching
// drops to 15 when the volume fills the view, 100 % is slower than 50 %: the
// cost follows the marched pixels, so auto keeps the frame time by lowering
// the resolution while the volume is large and raising it when small.
// build 370: auto may reach 100 % (was 80 %); the controller follows the GPU
// time of the volume pass when the timer extension is offered
const VRES=[0,1,0.7,0.5],AUTO_MIN=0.25,AUTO_MAX=1,STEP=[1,1.5,2],FOVEATION=[0,0.5,1];
// VR window slider / button step in HU (build 361)
const WIN_STEP=10,AIR_MIN=-1000,AIR_MAX=500;

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
// button or drags a slider while held. Build 365: canvas size and width in
// metres are parameters (the left-hand section panel uses a small one).
const MENU_W=1024,MENU_H=1180;
function makeMenu(W=MENU_W,H=MENU_H,widthM=0.5){
 const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;
 const ctx=canvas.getContext('2d'),tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;
 const mesh=new THREE.Mesh(new THREE.PlaneGeometry(widthM,widthM*H/W),new THREE.MeshBasicMaterial({map:tex,transparent:true,toneMapped:false}));
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
   ctx.fillStyle=w.disabled?'#1a2129':w.on?(w.color||'#2d6cdf'):(i===hover?'#3a4652':'#26313b');ctx.beginPath();ctx.roundRect(w.x,w.y,w.w,w.h,16);ctx.fill();
   if(w.color&&!w.on&&!w.disabled){ctx.strokeStyle=w.color;ctx.lineWidth=4;ctx.stroke()}
   if(i===hover&&!w.disabled){ctx.strokeStyle='#fff';ctx.lineWidth=4;ctx.stroke()}
   // dark text on a light fill (e.g. the bone colour)
   let fg='#fff';if(w.on&&w.color){const c=new THREE.Color(w.color);if(0.2126*c.r+0.7152*c.g+0.0722*c.b>0.6)fg='#111'}
   if(w.disabled)fg='#6b7885';ctx.fillStyle=fg;ctx.font=(w.size||30)+'px system-ui,sans-serif';ctx.textAlign='center';ctx.fillText(w.label,w.x+w.w/2,w.y+w.h/2+1);
  });
  ctx.textAlign='left';ctx.textBaseline='alphabetic';tex.needsUpdate=true;dirty=false;
 };
 const at=uv=>({x:uv.x*W,y:(1-uv.y)*H});
 return{mesh,
  refresh(){widgets=draw();dirty=true},
  flush(){if(dirty)render()},
  onDraw(f){draw=f},
  hit(uv){const p=at(uv);return widgets.findIndex(w=>(w.action||w.set)&&!w.disabled&&p.x>=w.x-(w.type==='slider'?26:0)&&p.x<=w.x+w.w+(w.type==='slider'?26:0)&&p.y>=w.y&&p.y<=w.y+w.h)},
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
let lastBench=null;
function showBenchPanel(ja){
 if(!lastBench)return;
 document.getElementById('vr-bench-panel')?.remove();
 const panel=document.createElement('div');panel.id='vr-bench-panel';
 Object.assign(panel.style,{position:'fixed',left:'16px',bottom:'16px',zIndex:'9999',background:'#111a',backdropFilter:'blur(6px)',color:'#fff',padding:'12px',borderRadius:'12px',maxWidth:'min(92vw,640px)',font:'14px system-ui,sans-serif'});
 const text=[lastBench.head,...lastBench.lines].join('\n');
 const pre=document.createElement('pre');pre.style.cssText='margin:0 0 8px;white-space:pre-wrap;font:13px ui-monospace,monospace';pre.textContent=text;panel.append(pre);
 const row=document.createElement('div');row.style.cssText='display:flex;gap:8px';
 const copy=document.createElement('button');copy.type='button';copy.textContent=ja?'コピー':'Copy';copy.onclick=()=>{navigator.clipboard?.writeText(text).catch(()=>{})};
 const close=document.createElement('button');close.type='button';close.textContent=ja?'閉じる':'Close';close.onclick=()=>panel.remove();
 row.append(copy,close);panel.append(row);document.body.append(panel);
}
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

// ---- preparation before the session (build 358) ----
// Everything the VR view needs from the CPU side is built here, before the
// session starts, and kept for the same data / filter / segments / edits,
// so entering again (or switching VR <-> AR) skips it. requestSession must
// follow a click, so a fresh preparation ends with a start button.
const editIds=new WeakMap();let editIdNext=1;
const idOf=o=>{if(!o)return 0;let i=editIds.get(o);if(!i){i=editIdNext++;editIds.set(o,i)}return i};
export function vrDataKey(){
 const v=gpuVolumeTarget();if(!v?.series)return '';
 const segs=SEGMENT_PRESET_ORDER.map(k=>{const g=segmentState[k]||{},st=segmentEditState[k]||{};
  return [g.active?1:0,g.enabled?1:0,g.min,g.max,g.opening,g.closing,g.holeFill?1:0,g.minComponent,g.surfaceMm,g.thicknessMm,st.revision|0,idOf(st.baseRuns),idOf(st.keepRuns),idOf(st.excludeRuns),segmentSourceSignature(k)].join(',')});
 // build 409: the shown analysis results (colour, voxels) are part of the prepared data
 const regions=shownRegions().map(r=>r.id+':'+r.color+':'+r.voxels).join(',');
 return [v.series.id,v.filterSignature||'',...segs,regions].join('|');
}
// analysis results for VR (build 409): the visible regions; colour index per voxel on the given grid (0 none,
// 1..14 = the distinct colours in list order, at most 14; a later region wins where two overlap), mapped with
// the same gpuRunsForTexture as the edit mask; the list (colour, segments, mm³) is shown read-only in the menu
const shownRegions=()=>analysisRegions.filter(r=>r.visible!==false&&r.runsBySlice&&r.voxels>0);
function buildRegionIndex(dims){
 const v=gpuVolumeTarget(),regions=shownRegions();if(!v||!regions.length)return{data:null,colors:[],segs:[],list:[]};
 // build 423: ids = list position + 1 per voxel (the label of the result the laser points at), up to 255 results
 const [w,h,d]=dims,sourceDims=[v.columns,v.rows,v.slices],colors=[],segs=[],data=new Uint8Array(w*h*d),ids=new Uint8Array(w*h*d),list=[];
 for(const r of regions){
  const c=Number(r.color)>>>0;let k=colors.indexOf(c);if(k<0){if(colors.length>=14)continue;colors.push(c);segs.push(0);k=colors.length-1}
  for(const key of r.segmentKeys||[]){const s=SEGMENT_PRESET_ORDER.indexOf(key);if(s>=0)segs[k]|=1<<s}
  const runs=gpuRunsForTexture(r.runsBySlice,sourceDims,dims,{dilate:0});
  if(list.length>=255)break;const id=list.length+1;
  for(let z=0;z<d;z++){const rec=runs?.[z];if(!rec?.length)continue;for(let i=0;i<rec.length;i+=3){const o=(z*h+rec[i])*w;data.fill(k+1,o+rec[i+1],o+rec[i+2]+1);ids.fill(id,o+rec[i+1],o+rec[i+2]+1)}}
  list.push({color:c,mm3:r.mm3,segmentKeys:[...(r.segmentKeys||[])]});
 }
 return{data:colors.length?data:null,ids:colors.length?ids:null,colors,segs,list};
}
let prepared=null,preparing=null;
// volume + brick textures for one grid (full 512 or the 256 copy)
const makeVolumeTextures=d=>{
 const v=new THREE.Data3DTexture(d.data,...d.dims);v.format=THREE.RGFormat;v.type=THREE.UnsignedByteType;
 v.minFilter=v.magFilter=THREE.LinearFilter;v.unpackAlignment=1;v.needsUpdate=true;
 const b=new THREE.Data3DTexture(d.bricks,...d.brickDims);b.format=THREE.RGFormat;b.type=THREE.FloatType;
 b.minFilter=b.magFilter=THREE.NearestFilter;b.unpackAlignment=1;b.needsUpdate=true;
 return{v,b,dims:d.dims,brickDims:d.brickDims,src:d.data,cls:null,dist:null,combo:null,comboMask:-1};
};
const makeRegionTexture=P=>{const g=P.region;if(!g?.data)return null;const t=new THREE.Data3DTexture(g.data,...g.dims);t.format=THREE.RedFormat;t.type=THREE.UnsignedByteType;t.minFilter=t.magFilter=THREE.NearestFilter;t.unpackAlignment=1;t.needsUpdate=true;return t};
const makeEditTexture=P=>{if(!P.edit.data)return null;const e=new THREE.Data3DTexture(P.edit.data,...P.edit.dims);e.format=THREE.RGBAFormat;e.type=THREE.UnsignedByteType;e.unpackAlignment=1;return e};
const makeComboTexture=(data,dims)=>{const x=new THREE.Data3DTexture(data,...dims);x.format=THREE.RGBAFormat;x.type=THREE.UnsignedByteType;x.minFilter=x.magFilter=THREE.LinearFilter;x.unpackAlignment=1;x.needsUpdate=true;return x};
// shown-segment mask for the combined texture's alpha (segMode 2 = hidden)
const shownMask=()=>{let mask=0;for(let i=0;i<4;i++){const key=SEGMENT_PRESET_ORDER[i],seg=segmentState[key];if(seg?.active&&seg?.enabled&&segMode[key]!==2)mask|=1<<i}return mask};
// build 393: shader variants (preprocessor guards in fragmentShader) sharing one uniforms object:
// combined = without the general loop (used when the combined field is in use), noEvents = also without the slice / cut-face loop (no section)
const materialVariants=base=>{const mk=defs=>{const m=base.clone();m.uniforms=base.uniforms;m.defines={...base.defines,...defs};return m};return{full:base,combined:mk({VRL_NO_GENERAL:''}),noEvents:mk({VRL_NO_GENERAL:'',VRL_NO_EVENTS:''})}};
const rayMaterialOf=m=>{const r=m.clone();r.uniforms=m.uniforms;r.defines={...m.defines};r.blending=THREE.NoBlending;r.transparent=false;return r};
const volumeUniforms=(vd,full,settings)=>({vol:{value:full.v},bricks:{value:full.b},halfExt:{value:new THREE.Vector3(...vd.halfExt)},texDims:{value:new THREE.Vector3(...vd.dims)},brickDims:{value:new THREE.Vector3(...vd.brickDims)},
 stepSize:{value:vd.step},diag:{value:0},calib:{value:new THREE.Vector3(...vd.calibration)},segA:{value:[0,1,2,3].map(()=>new THREE.Vector4())},segC:{value:[0,1,2,3].map(()=>new THREE.Vector4())},
 cutPlanes:{value:[0,1,2,3].map(()=>new THREE.Vector4(0,0,1,0))},planeCount:{value:0},planeCut:{value:0},capOn:{value:1},sliceTint:{value:0.5},sliceOpacity:{value:0},sliceWindow:{value:new THREE.Vector2(0,1)},sliceAir:{value:-500},regionTex:{value:null},regionSeg:{value:new Array(14).fill(0)},regionC:{value:Array.from({length:14},()=>new THREE.Vector3())},sliceVol:{value:full.v},refine:{value:settings.refine|0},useCls:{value:0},clsTex:{value:null},clsChan:{value:new THREE.Vector4(-1,-1,-1,-1)},editMask:{value:0},editMaskOnly:{value:0},editTex:{value:null},useDist:{value:0},distInCls:{value:0},distTex:{value:null},voxelMin:{value:1}});
// ---- GPU preparation before the session (build 393, after the Codex branch's idea) ----
// The renderer (an XR-compatible context), the textures of the grid in use, the
// combined classification + field texture for the shown segments, the edit mask
// and every shader variant are created, uploaded and compiled on the flat page,
// then the GPU is waited for; the session reuses the renderer, so nothing is
// compiled or uploaded on the first frames in the headset.
const segMode={};
let gpuPrepared=null;
export async function prepareVrGpu(P,mode='vr',settings=loadSettings()){
 disposeGpuPrepared();
 const ar=mode==='ar',renderer=new THREE.WebGLRenderer({antialias:false,alpha:ar,preserveDrawingBuffer:false});
 renderer.setPixelRatio(1);renderer.setSize(8,8,false);
 Object.assign(renderer.domElement.style,{position:'fixed',left:'0',top:'0',width:'1px',height:'1px',opacity:'0',pointerEvents:'none'});
 document.body.appendChild(renderer.domElement);
 const gl=renderer.getContext(),t0=performance.now(),times={};
 const assets={key:P.key,mode,renderer,full:null,half:null,edit:null,region:null,warm:[],times};
 try{
  try{await gl.makeXRCompatible?.()}catch(e){console.warn('makeXRCompatible before the session failed (setSession will retry):',e)}
  const vd=P.vd,full=makeVolumeTextures(vd);assets.full=full;
  const half=P.half?makeVolumeTextures(P.half):null;assets.half=half;
  const useHalf=(settings.data|0)===1&&!!half,t=useHalf?half:full;
  if(Math.max(...t.dims)<=256&&P.cls&&P.dist&&!P.cls.chan.some(c=>c>=3)){const mask=shownMask();const data=combineClassificationDistance(P.cls,P.dist,mask);if(data){t.combo=makeComboTexture(data,t.dims);t.comboMask=mask}}
  assets.edit=makeEditTexture(P);assets.region=makeRegionTexture(P);
  for(const x of [full.v,full.b,half?.v,half?.b,t.combo,assets.edit,assets.region].filter(Boolean))renderer.initTexture(x);
  times.upload=performance.now()-t0;const t1=performance.now();
  // compile every program the session can use: the three volume variants, their offscreen (no blending) copies and the composite
  const u=volumeUniforms(vd,full,settings),dummy=new THREE.Data3DTexture(new Uint8Array(4),1,1,1);dummy.format=THREE.RGBAFormat;dummy.needsUpdate=true;
  u.clsTex.value=dummy;u.editTex.value=dummy;u.distTex.value=dummy;u.regionTex.value=dummy;
  const base=new THREE.ShaderMaterial({glslVersion:THREE.GLSL3,vertexShader,fragmentShader,side:THREE.BackSide,toneMapped:false,uniforms:u,defines:P.region?.data?{VRL_REGIONS:''}:{}});
  base.transparent=true;base.depthWrite=false;base.blending=THREE.CustomBlending;base.blendSrc=THREE.OneFactor;base.blendDst=THREE.OneMinusSrcAlphaFactor;
  const vars=materialVariants(base),mats=[vars.full,vars.combined,vars.noEvents,rayMaterialOf(vars.full),rayMaterialOf(vars.combined),rayMaterialOf(vars.noEvents),
   new THREE.ShaderMaterial({glslVersion:THREE.GLSL3,vertexShader:compositeVertex,fragmentShader:compositeFragment,side:THREE.BackSide,toneMapped:false,depthWrite:false,transparent:true,blending:THREE.CustomBlending,blendSrc:THREE.OneFactor,blendDst:THREE.OneMinusSrcAlphaFactor,uniforms:{img:{value:null},invSize:{value:new THREE.Vector2(1,1)},halfExt:{value:new THREE.Vector3(...vd.halfExt)}}})];
  const sc=new THREE.Scene(),geo=new THREE.BoxGeometry(2,2,2),cam=new THREE.PerspectiveCamera();
  for(const m of mats){const mesh=new THREE.Mesh(geo,m);mesh.frustumCulled=false;sc.add(mesh)}
  await renderer.compileAsync(sc,cam);
  geo.dispose();dummy.dispose();assets.warm=mats; // kept alive so the programs stay cached until the session has its own materials
  times.compile=performance.now()-t1;const t2=performance.now();
  // wait for the uploads and compilation to finish on the GPU while still on the page
  const fence=gl.fenceSync?.(gl.SYNC_GPU_COMMANDS_COMPLETE,0);if(fence){gl.flush();const until=performance.now()+30000;
   while(performance.now()<until){const r=gl.clientWaitSync(fence,0,0);if(r===gl.ALREADY_SIGNALED||r===gl.CONDITION_SATISFIED||r===gl.WAIT_FAILED)break;await new Promise(res=>setTimeout(res,5))}gl.deleteSync(fence)}
  times.wait=performance.now()-t2;times.total=performance.now()-t0;
  gpuPrepared=assets;return assets;
 }catch(e){console.warn('GPU preparation before VR failed; the session will prepare on its own.',e);try{renderer.dispose();renderer.domElement.remove()}catch{}return null}
}
export function disposeGpuPrepared(){
 const g=gpuPrepared;if(!g)return;gpuPrepared=null;
 for(const t of [g.full,g.half])if(t){t.v.dispose();t.b.dispose();t.combo?.dispose()}
 g.edit?.dispose();g.region?.dispose();g.warm.forEach(m=>m.dispose());g.renderer.dispose();g.renderer.domElement.remove();
}
export function vrReady(){return !!prepared&&prepared.key===vrDataKey()}
const maxTexture3D=()=>{try{const c=document.createElement('canvas'),g=c.getContext('webgl2');const m=g?.getParameter(g.MAX_3D_TEXTURE_SIZE)||2048;g?.getExtension('WEBGL_lose_context')?.loseContext();return m}catch{return 2048}};
// phases reported as {phase, done, total}; timings (ms) returned with the data
export async function prepareVrData(onProgress=()=>{}){
 const key=vrDataKey();if(!key)throw new Error('VR: open a DICOM series first');
 if(prepared?.key===key)return prepared;
 if(preparing?.key===key)return preparing.promise;
 const promise=(async()=>{
  prepared=null;const times={},tick=async()=>new Promise(r=>setTimeout(r,0));
  let t0=performance.now();
  const vd=await buildVolumeData(maxTexture3D(),(a,b,src)=>onProgress({phase:src==='gpu'?'copy':'read',done:a,total:b}));
  times[vd.source==='gpu'?'copy':'read']=performance.now()-t0;
  onProgress({phase:'half',done:0,total:1});await tick();t0=performance.now();
  const half=Math.max(...vd.dims)>256?halveVolume(vd):null;times.half=performance.now()-t0;
  onProgress({phase:'mask',done:0,total:1});await tick();t0=performance.now();
  const editDims=half?half.dims:vd.dims;let m;try{m=buildEditMask(editDims)}catch(e){console.error(e);m={activeMask:0,data:null}}
  const edit={dims:editDims,data:m.activeMask?m.data:null,active:m.activeMask|0,maskOnly:m.maskOnly|0};times.mask=performance.now()-t0;
  onProgress({phase:'cls',done:0,total:1});await tick();t0=performance.now();
  const small=half||vd,cls=buildClsData(small,vd.calibration,edit,segmentState);times.cls=performance.now()-t0;
  onProgress({phase:'dist',done:0,total:1});await tick();t0=performance.now();
  const dist=cls?await buildDistanceBytes(cls,small.dims,(a,b)=>onProgress({phase:'dist',done:a,total:b})):null;times.dist=performance.now()-t0;
  let region;try{region={dims:editDims,...buildRegionIndex(editDims)}}catch(e){console.error(e);region={dims:editDims,data:null,colors:[],list:[]}}
  return{key,vd,half,edit,cls,dist,region,times};
 })();
 preparing={key,promise};
 try{prepared=await promise;return prepared}finally{if(preparing?.promise===promise)preparing=null}
}
// build 465: classification bytes for the 3D position-comment markers of the PC / iPad view (comment-3d.js), the same data and rule as VR's
// hidden test. Only vd (<= 256 grid, no bricks) -> edit mask -> cls (no distance field / regions); reuses the VR preparation when it is ready
// for the same key. State handling (one build at a time, 250 ms debounce, volume cached per series + filter, failures retried, previous
// result kept while rebuilding) is hidden-cls-state.js. hiddenClsFor(onReady) -> {cls,dims,halfExt} or null; onReady fires when it changed.
const hiddenVolumeKey=()=>{const v=gpuVolumeTarget();return v?.series?v.series.id+'|'+(v.filterSignature||''):''};
const hiddenClsKey=()=>{ // what the bytes depend on: the data, and per segment its range / shown state / edits
 const segs=SEGMENT_PRESET_ORDER.map(k=>{const g=segmentState[k]||{},st=segmentEditState[k]||{};
  return [g.active?1:0,g.enabled?1:0,g.min,g.max,st.revision|0,idOf(st.baseRuns),idOf(st.keepRuns),idOf(st.excludeRuns),segmentSourceSignature(k)].join(',')});
 return [hiddenVolumeKey(),...segs].join('|');
};
const hiddenMgr=createHiddenClsManager({
 volumeKey:hiddenVolumeKey,segKey:hiddenClsKey,
 loadVolume:async()=>{const v=gpuVolumeTarget();if(!v?.sourceBacked||!v.series){const e=new Error('no source-backed volume');e.permanent=true;throw e}return buildVolumeData(256,null,{noBricks:true})},
 buildCls:vd=>{
  const m=buildEditMask(vd.dims),edit={dims:vd.dims,data:m.activeMask?m.data:null,active:m.activeMask|0,maskOnly:m.maskOnly|0};
  return{cls:buildClsData(vd,vd.calibration,edit,segmentState),dims:vd.dims,halfExt:vd.halfExt};
 },
});
export function hiddenClsFor(onReady=()=>{}){
 if(prepared&&prepared.key===vrDataKey()){const P=prepared;return{cls:P.cls,dims:(P.half||P.vd).dims,halfExt:P.vd.halfExt}}
 return hiddenMgr.get(onReady);
}
export function releaseHiddenCls(){hiddenMgr.release()}
// page panel: progress while preparing, then the start button (a click, so
// the session may start)
export function showPreparePanel({language='ja',mode='vr',onStart}){
 const ja=language==='ja';document.getElementById('vr-prepare-panel')?.remove();
 const panel=document.createElement('div');panel.id='vr-prepare-panel';
 Object.assign(panel.style,{position:'fixed',left:'50%',top:'50%',transform:'translate(-50%,-50%)',zIndex:'10000',background:'#141c24f2',color:'#fff',padding:'20px 24px',borderRadius:'14px',width:'min(92vw,440px)',font:'15px system-ui,sans-serif',boxShadow:'0 8px 30px #0008'});
 panel.innerHTML='<strong style="font-size:18px"></strong><div class="ph" style="margin:12px 0 6px;color:#cfe3f0"></div><div style="height:10px;background:#26313b;border-radius:5px;overflow:hidden"><div class="bar" style="height:100%;width:0;background:#2d6cdf"></div></div><div class="tm" style="margin-top:10px;color:#9fb3c3;font-size:13px;white-space:pre-line"></div><div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px"><button type="button" class="cancel"></button><button type="button" class="start" disabled></button></div>';
 const q=c=>panel.querySelector(c),names=ja?{copy:'3D画面から写す',read:'データ読み込み',half:'256³を作成',mask:'加工マスク',cls:'判定用データ',dist:'距離場'}:{copy:'Copy from the 3D view',read:'Reading data',half:'Building 256³',mask:'Processing mask',cls:'Classification',dist:'Distance field'};
 q('strong').textContent=(mode==='ar'?'AR':'VR')+(ja?'の準備':' preparation');q('.cancel').textContent=ja?'閉じる':'Close';q('.start').textContent=mode==='ar'?(ja?'ARを開始':'Start AR'):(ja?'VRを開始':'Start VR');
 Object.assign(q('.start').style,{background:'#2d6cdf',color:'#fff',border:'0',borderRadius:'8px',padding:'10px 18px',fontSize:'16px'});Object.assign(q('.cancel').style,{background:'#26313b',color:'#fff',border:'0',borderRadius:'8px',padding:'10px 14px'});
 const order=['read','half','mask','cls','dist'],allPhases=['copy',...order];
 q('.cancel').onclick=()=>panel.remove();
 q('.start').onclick=()=>{panel.remove();onStart()};
 // build 405: the preparation runs in the central progress modal; the panel shows up when it is ready (timings, start button) or failed
 panel.style.display='none';document.body.append(panel);
 const title=q('strong').textContent,done_=()=>{setBusySlot('vr',false);panel.style.display=''};
 setBusySlot('vr',true,{label:title});
 const report=({phase,done,total})=>{q('.ph').textContent=names[phase]+(phase==='read'||phase==='copy'?' '+done+' / '+total:'');const i=Math.max(0,order.indexOf(phase==='copy'?'read':phase)),f=(i+((phase==='read'||phase==='copy')&&total?done/total:0))/order.length;q('.bar').style.width=Math.round(f*100)+'%';reportBusyProgress('vr',f,1,q('.ph').textContent)};
 prepareVrData(report).then(async p=>{
  try{
  q('.bar').style.width='100%';
  // build 393: upload, compile and wait on the GPU before the session (skipped when already prepared for this data and mode)
  let g=gpuPrepared&&gpuPrepared.key===p.key&&gpuPrepared.mode===mode?gpuPrepared:null;
  if(!g){q('.ph').textContent=ja?'GPU の準備（転送・コンパイル）':'Preparing the GPU (upload, compile)';reportBusyProgress('vr',1,1,q('.ph').textContent);g=await prepareVrGpu(p,mode)}
  q('.ph').textContent=ja?'準備ができました':'Ready';
  const gpuLine=g?.times?((ja?'GPU: ':'GPU: ')+(g.times.total/1000).toFixed(1)+' s'):'';
  q('.tm').textContent=allPhases.filter(k=>p.times[k]!=null).map(k=>names[k]+': '+(p.times[k]/1000).toFixed(1)+' s').concat(gpuLine?[gpuLine]:[]).join('\n');
  }catch(e){console.error(e);done_();q('.ph').textContent=(ja?'準備に失敗: ':'Preparation failed: ')+String(e.message||e);return}
  done_();q('.start').disabled=false;q('.start').focus();
 },e=>{console.error(e);done_();q('.ph').textContent=(ja?'準備に失敗: ':'Preparation failed: ')+String(e.message||e)});
}

let running=null;
// mode 'vr': own background; 'ar' (build 343): immersive-ar passthrough on
// Quest, no background drawn and the clear is transparent
export async function startVrView({language='ja',mode='vr'}={}){
 if(running)return;
 const ja=language==='ja',settings=loadSettings();settings.diag=0;settings.editDiag=0;settings.clsDiag=0;settings.distDiag=0;
 const vrWindow={c:+wc.value||0,w:Math.max(1,+ww.value||1)}; // VR-local CT window (build 361): starts from the app's sliders, not written back
 // build 393: a renderer prepared on the page (textures uploaded, programs compiled) is reused; otherwise a fresh one
 const gpu=gpuPrepared&&gpuPrepared.key===vrDataKey()&&gpuPrepared.mode===mode?gpuPrepared:null;if(gpu)gpuPrepared=null;else disposeGpuPrepared();
 const ar=mode==='ar',renderer=gpu?.renderer||new THREE.WebGLRenderer({antialias:false,alpha:ar,preserveDrawingBuffer:false});
 renderer.setPixelRatio(1);renderer.setSize(8,8,false);renderer.xr.enabled=true;renderer.xr.setReferenceSpaceType('local-floor');
 if(!gpu){Object.assign(renderer.domElement.style,{position:'fixed',left:'0',top:'0',width:'1px',height:'1px',opacity:'0',pointerEvents:'none'});document.body.appendChild(renderer.domElement)}
 const sessionAt=performance.now();let firstDrawMs=-1;
 // requestSession must run inside the click; the texture is built afterwards
 // while the headset shows progress
 let session;
 try{session=await navigator.xr.requestSession(ar?'immersive-ar':'immersive-vr',{optionalFeatures:['local-floor']})}
 catch(e){if(gpu)gpuPrepared=gpu;else{renderer.dispose();renderer.domElement.remove()}throw e}
 running={session};
 const scene=new THREE.Scene();scene.background=ar?null:BG.clone();
 const background=makeBackground();if(ar){background.visible=false;renderer.setClearColor(0x000000,0)}else scene.add(background);
 const camera=new THREE.PerspectiveCamera(70,1,0.01,50);
 const L=ja?{ptT:'位置コメント（VR ポイント）',ptRec:'この位置を記録',ptNeed:'断面を有効にすると記録できます',ptAim:'レーザーを断面に当ててください（ボリュームの内側）',ptDone:'記録しました：',ptHelp:['トリガー：断面にレーザーを当てて記録／点に当てて選択','記録はスティックを離して0.3秒後から（その手のみ）','このボタン：もう一方の手のレーザーが断面にあるとき','「VR ポイント N」で保存（2D画面の一覧に出ます。本文は「編集」で変えられます）'],ptDel:'この点を削除',ptUndo:'元に戻す',ptSel:'選択中の点：',ptNoSel:'点にレーザーを当ててトリガーで選択',ptDeleted:'点を削除しました（「元に戻す」で戻せます）',ptRestored:'点を元に戻しました',ptList:'位置コメント一覧',ptNone:'まだありません',title:'Virtual Rodent Lab',tabs:['表示','断面','スライス','画質','詳細','解析','位置'],anT:'解析結果（体積）',anNone:'解析結果はありません（2D/3D画面の体積解析で作成し、表示中のものがVRに入ります）',anTotal:'合計',anPage:'ページ',lbSize:'ラベルの大きさ',lbSizeV:['小','中','大'],win:'断面に映すCT画像の設定（アプリ側の値は変わりません）',winHelp:'スライダーは10 HU単位、−／＋は10 HUずつ',airL:'透明にするCT値',airHelp:'この値以下のスライスは透明（−500：空気／−50：脂肪まで）',wcL:'ウィンドウ中心',wwL:'ウィンドウ幅',pApp:'アプリの値',pFull:'全範囲',pBone:'骨',pSoft:'軟部',follow:'ついて来る',fixed:'固定',menuPos:'メニューの位置',menuKey:'A/Xボタン：メニューを閉じる／開く（閉じると左手に「メニュー」の札）',menuGrab:'メニューや操作方法の板を指してグリップ＝つかんで移動（位置は固定に）',helpT:'操作方法',helpModes:['非表示','ついて来る','固定'],helpBasic:['グリップ：ボリュームをつかんで動かす','両手でグリップ：拡大・縮小','A／X ボタン：メニューを開く／閉じる','B／Y ボタン：断面を出す（長押しで追加）','メニューを指してグリップ：メニューを移動'],helpSec:['枠を指す・近づけて{h}：断面を動かす','スティック上下：選んだ断面をスクロール','左手の板：軸に合わせる・反転・切る・消す','B／Y：断面の表示／非表示（長押しで追加）','トリガー：断面にレーザーを当てて記録／点に当てて選択','A／X ボタン：メニューを開く／閉じる'],helpMenu:'トリガー：メニューのボタン・スライダー',helpHold:['グリップ','トリガー'],close:'閉じる',badge:'メニュー',
   seg:'セグメント',segModes:['通常','簡易','非表示'],noSeg:'表示中のセグメントがありません（アプリで閾値を設定）',home:'正面に戻す',clsD:'事前計算（診断）',distD:'距離場（診断）',bench:'ベンチ（約 35 秒）',anBench:'解析の重さ（約 12 秒）',benchRun:'ベンチ中 ',benchHelp:'断面を動かし回転させながら、16.5/30 cm × 表示中／骨＋脂肪／骨のみ × 100%／50% の fps。終了後、VR を出た画面に結果が出ます',samples:'サンプル数／画素 ',samplesNote:'（覆う画素の平均、48×48で計測）',refineL:'表面の探索',refineV:['高速','精密'],editD:'加工マスク（診断）',editDv:['なめらか','ボクセル','オフ'],shot:'スクリーンショット',exit:'終了',
   sec:'断面',addPlane:'＋追加',planeN:'断面',clipOn:'切る',clipOff:'切らない',remove:'消す',maxPlanes:'断面は4枚までです',byHelp:'B/Y：短く押す＝表示／非表示、長押し＝断面を追加',scrollHelp:['スティック上下：最後に持った断面（一覧で色付き）を法線方向に動かします','つかむ枠は手の色で光ります（右＝オレンジ・左＝紫、レーザーの枠が優先）'],snapL:'選んだ断面を',snapModes:['軸位','冠状','矢状'],offOn:['オフ','オン'],hold:'持ち方',holdModes:['グリップ','トリガー'],cap:'キャップ',tint:'スライスの色付け',cut:'切り取り',cutModes:['オフ','手前','片側'],flip:'向きを反転',cutHelp:['オフ：切らずにスライスだけ映します','手前：見ている側を消します（向きは自動）','片側：矢印の側を消します。「反転」で入れ替え'],sl:'スライス不透明度',
   handR:'右',handL:'左',secHelp:['光った枠をグリップを押す間だけ持てます（番号の下＝最後に持った手）','光った枠をトリガーを押す間だけ持てます（番号の下＝最後に持った手）'],secOff:'「オン」かB/Yボタンで断面を出します',
   r:'ボリューム解像度',auto:'自動',dt:'データ',q:'描画の細かさ',qv:['標準','粗め','最粗'],f:'周辺の簡略化',fv:['なし','中','強'],hz:'リフレッシュレート',diag:'診断',dv:['通常','箱のみ','ループ数','陰影なし','スキップなし'],
   stHeld:'断面：手で持っています',stFixed:'断面：固定中',stNone:'グリップでつかむ・両手で拡大縮小',preparing:'VRボリューム準備中… ',failed:'VR準備に失敗: ',shotDone:'スクリーンショットを撮りました（終了後にページで保存）',filtered:' フィルター適用'}
  :{ptT:'Position comments (VR points)',ptRec:'Record this place',ptNeed:'Turn a section on to record',ptAim:'Point the laser at a section (inside the volume)',ptDone:'Recorded: ',ptHelp:['Trigger: laser on a section records; laser on a point selects it','Recording works 0.3 s after the thumbstick is released (that hand only)','This button: while the other hand’s laser is on a section','Saved as “VR point N” (shown in the 2D page list, where the text can be edited)'],ptDel:'Delete this point',ptUndo:'Undo',ptSel:'Selected point: ',ptNoSel:'Point the laser at a point and pull the trigger to select',ptDeleted:'Point deleted (Undo brings it back)',ptRestored:'Point restored',ptList:'Position comments',ptNone:'None yet',title:'Virtual Rodent Lab',tabs:['View','Section','Slice','Quality','Details','Analysis','Points'],anT:'Analysis results (volume)',anNone:'No analysis results (made with the volume analysis on the page; the visible ones come into VR)',anTotal:'Total',anPage:'Page',lbSize:'Label size',lbSizeV:['Small','Medium','Large'],win:'The CT image shown on the sections (the app values are not changed)',winHelp:'Sliders step 10 HU; −/＋ move 10 HU',airL:'Transparent at or below',airHelp:'Slice is transparent at or below this value (−500: air, −50: fat too)',wcL:'Window centre',wwL:'Window width',pApp:'App values',pFull:'Full range',pBone:'Bone',pSoft:'Soft tissue',follow:'Follow',fixed:'Fixed',menuPos:'Menu position',menuKey:'A/X: close / open the menu (closed: a Menu tag on the left hand)',menuGrab:'Point at the menu or help board, grip: move it (becomes Fixed)',helpT:'Controls',helpModes:['Hidden','Follow','Fixed'],helpBasic:['Grip: grab and move the volume','Grip with both hands: scale','A / X: open / close the menu','B / Y: show a section (long press: add)','Point at the menu, grip: move it'],helpSec:['Point at / approach a frame, {h}: move it','Thumbstick up / down: scroll the selected plane','Left-hand board: axis, flip, clip, remove','B / Y: show / hide sections (long press: add)','Trigger: laser on a section records a point; on a point selects it','A / X: open / close the menu'],helpMenu:'Trigger: menu buttons and sliders',helpHold:['grip','trigger'],close:'Close',badge:'Menu',
   seg:'Segments',segModes:['Normal','Simple','Hidden'],noSeg:'No segment shown (set thresholds in the app)',home:'Bring to front',clsD:'Precomputed (diag.)',distD:'Distance field (diag.)',bench:'Benchmark (about 35 s)',anBench:'Analysis cost (about 12 s)',benchRun:'benchmark ',benchHelp:'fps while a section sweeps and the volume turns: 16.5/30 cm × shown / bone+fat / bone only × 100% / 50%; the result is shown after leaving VR',samples:'samples / pixel ',samplesNote:' (mean over covered pixels, 48×48 probe)',refineL:'Surface search',refineV:['Fast','Exact'],editD:'Processing mask (diag.)',editDv:['Smooth','Voxel','Off'],shot:'Screenshot',exit:'Exit',
   sec:'Sections',addPlane:'+ Add',planeN:'Plane ',clipOn:'Clips',clipOff:'No clip',remove:'Remove',maxPlanes:'Up to 4 planes',byHelp:'B/Y: press = show / hide, long press = add a plane',scrollHelp:['Thumbstick up / down moves the plane held last (highlighted in the list) on its normal','The frame you will grab glows in the hand colour (right orange, left violet; laser wins)'],snapL:'Selected plane',snapModes:['Axial','Coronal','Sagittal'],offOn:['Off','On'],hold:'Hold with',holdModes:['Grip','Trigger'],cap:'Cap',tint:'Slice colouring',cut:'Clip',cutModes:['Off','Near side','One side'],flip:'Flip side',cutHelp:['Off: nothing is cut, only the slice is shown','Near side: the side you look from is removed (follows you)','One side: the arrow side is removed; Flip swaps it'],sl:'Slice opacity',
   handR:'R',handL:'L',secHelp:['Hold grip while the frame glows (under the number: last hand)','Hold the trigger while the frame glows (under the number: last hand)'],secOff:'Turn it on here or press B/Y',
   r:'Volume resolution',auto:'Auto',dt:'Data',q:'Detail',qv:['Normal','Coarse','Coarsest'],f:'Foveation',fv:['Off','Mid','High'],hz:'Refresh rate',diag:'Diagnostics',dv:['Normal','Box only','Loop count','No shading','No skipping'],
   stHeld:'Section: held in hand',stFixed:'Section: fixed',stNone:'Grip to grab, both hands to scale',preparing:'Preparing VR volume… ',failed:'VR failed: ',shotDone:'Screenshot taken (save it on the page after exit)',filtered:' filtered'};
 const menu=makeMenu();scene.add(menu.mesh);
 const ui={tab:0,open:true,status:L.preparing,fpsLine:'',sizeLine:'',flash:'',flashUntil:0,benchLine:''};
 const holder=new THREE.Group();holder.position.set(0,1.3,-0.6);scene.add(holder);
 let refreshEdits=()=>{},disposeEdits=()=>{},useData=()=>{},disposeExtra=()=>{},refreshCombo=()=>{},comboT=null,comboMask=-1,variants=null,rayVariants=null,mesh=null,material=null,volPick=null,regionList=[],volTex=null,brickTex=null,compMaterial=null,rayMesh=null,lowTarget=null;const volScene=new THREE.Scene();volScene.matrixWorldAutoUpdate=false;let baseStep=0.002,baseScale=0.165/3.3, /* build 383: longest side 16.5 cm (was 30 cm): the owner found the smallest two-hand size much lighter; cost follows the pixels covered (size²) */info='';
 // per segment in VR only: 0 normal, 1 simple (for segments not being
 // looked at; owner, build 341), 2 hidden
 // segMode (normal / simple / hidden per segment) lives at module level since build 393 (shownMask); it persists across sessions
 // VR opacity per segment (build 354): 100 % by default, so rays stop at the
 // first surface; the app's opacity is not used or changed
 const segOpacity={};
 // controllers: ray, input source (handedness, gamepad), haptics
 const raycaster=new THREE.Raycaster(),tmpM=new THREE.Matrix4();
 const controllers=[0,1].map(i=>{const c=renderer.xr.getController(i);scene.add(c);
  const ray=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3(0,0,-1)]),new THREE.LineBasicMaterial({color:0x88ccff}));ray.scale.z=0.08;c.add(ray);c.userData.ray=ray;c.userData.gate=createStickGate();return c});
 // build 398 (owner: laser pointers in two colours): right hand red, left hand blue, used by the ray, its end dot,
 // the guide line and the glow of the frame that hand points at or holds
 const HAND_COLORS={right:0xff7a3d,left:0x7c6cff},handColor=c=>HAND_COLORS[c.userData.source?.handedness]??0xdddddd;
 const dotGeo=new THREE.SphereGeometry(0.004,12,8);
 for(const c of controllers){
  c.userData.ray.material.transparent=true;
  const dot=new THREE.Mesh(dotGeo,new THREE.MeshBasicMaterial({color:0xffffff,toneMapped:false}));dot.visible=false;scene.add(dot);c.userData.dot=dot;
  // build 397: guide line from a hand to the frame its button would take when that frame is picked by nearness (a ray pick shows the ray)
  const g=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]),new THREE.LineBasicMaterial({color:0xffffff}));g.frustumCulled=false;g.visible=false;scene.add(g);c.userData.guide=g;
 }
 const pulse=(c,v=0.35,ms=18)=>{try{c.userData.source?.gamepad?.hapticActuators?.[0]?.pulse?.(v,ms)}catch{}};
 const badge=makeBadge(L.badge);badge.visible=false;
 const leftHand=()=>controllers.find(c=>c.userData.source?.handedness==='left')||controllers[0];
 const setRay=c=>{tmpM.identity().extractRotation(c.matrixWorld);raycaster.ray.origin.setFromMatrixPosition(c.matrixWorld);raycaster.ray.direction.set(0,0,-1).applyMatrix4(tmpM)};
 const menuHit=c=>{if(!ui.open)return null;setRay(c);return raycaster.intersectObject(menu.mesh,false)[0]||null};
 const badgeHit=c=>{if(ui.open||!badge.parent||badge.parent===c)return null;setRay(c);return raycaster.intersectObject(badge,false)[0]||null};
 // section panel (build 365): quick plane actions on the left hand (above the menu tag), shown while sections are on; the other hand's ray presses it
 // build 403 (owner): 10 cm to the left of the hand, so it no longer covers the volume while the left hand works on it
 const panel=makeMenu(640,232,0.17);panel.mesh.position.set(-0.10,0.10,0.03);panel.mesh.rotation.x=-0.6;panel.mesh.visible=false;leftHand().add(panel.mesh);
 const panelHit=c=>{if(!panel.mesh.visible||!panel.mesh.parent||panel.mesh.parent===c)return null;setRay(c);return raycaster.intersectObject(panel.mesh,false)[0]||null};
 // head pose (world) from the XR camera
 const head=new THREE.Vector3(),headFwd=new THREE.Vector3(),headLeft=new THREE.Vector3(),tmpQh=new THREE.Quaternion();
 const readHead=()=>{renderer.xr.updateCamera(camera);const cam=renderer.xr.getCamera();cam.getWorldPosition(head);cam.getWorldQuaternion(tmpQh);headFwd.set(0,0,-1).applyQuaternion(tmpQh);headFwd.y=0;if(headFwd.lengthSq()<1e-6)headFwd.set(0,0,-1);headFwd.normalize();headLeft.set(headFwd.z,0,-headFwd.x)};
 // menu placement: in front, a little left and below eye level so it does
 // not cover the volume; follow mode moves it back when the head turns away
 const menuTarget=new THREE.Vector3();let menuMoving=false,menuPlaced=false;
 const computeMenuTarget=()=>menuTarget.copy(head).addScaledVector(headFwd,0.62).addScaledVector(headLeft,0.3).add(new THREE.Vector3(0,-0.16,0));
 const placeMenuNow=()=>{readHead();computeMenuTarget();menu.mesh.position.copy(menuTarget);menu.mesh.lookAt(head);menuPlaced=true;menuMoving=false};
 // help board (build 367): the controls for the current state, front-right,
 // mirrored from the menu; follows lazily, or fixed, or hidden (settings.help);
 // no widgets, but the grip moves it like the menu
 const help=makeMenu(820,560,0.32);help.mesh.visible=false;scene.add(help.mesh);
 const helpTarget=new THREE.Vector3();let helpMoving=false,helpPlaced=false,helpHeld=null,helpKey='';
 const computeHelpTarget=()=>helpTarget.copy(head).addScaledVector(headFwd,0.62).addScaledVector(headLeft,-0.34).add(new THREE.Vector3(0,-0.16,0));
 const placeHelpNow=()=>{readHead();computeHelpTarget();help.mesh.position.copy(helpTarget);help.mesh.lookAt(head);helpPlaced=true;helpMoving=false};
 const helpHit=c=>{if(!help.mesh.visible||help.mesh.parent===c)return null;setRay(c);return raycaster.intersectObject(help.mesh,false)[0]||null};
 // build 404 (owner: the left-hand panel could not be pressed with the menu behind it): the nearest of the menu, the
 // menu tag, the section panel and the help board along the ray wins (was a fixed order, menu first); {menu,badge,panel,help}
 const boardHits=c=>{const all=[['menu',menuHit(c)],['badge',badgeHit(c)],['panel',panelHit(c)],['help',helpHit(c)]];let best=null;
  for(const [k,x] of all)if(x&&(!best||x.distance<best[1].distance))best=[k,x];
  const o={menu:null,badge:null,panel:null,help:null};if(best)o[best[0]]=best[1];return o};
 help.onDraw(()=>{
  const w=[],lines=section.on?L.helpSec.map(t=>t.replace('{h}',L.helpHold[settings.secHold|0])):L.helpBasic.slice();
  if(ui.open)lines[lines.length-1]=L.helpMenu;
  w.push({type:'label',x:36,y:60,text:L.helpT,bold:true,size:36,color:'#fff'});
  lines.forEach((t,i)=>w.push({type:'label',x:36,y:140+i*78,text:'・'+t,size:30}));
  return w;
 });
 // build 366: the XR camera sits at the origin (floor height) until the first
 // viewer pose arrives; since build 358 the data is ready before that, so the
 // volume and menu were placed on the floor. Both now wait for a pose in the
 // loop; 詳細 shows the frame numbers and head height for a device check
 const poseOk=()=>{try{const f=renderer.xr.getFrame(),rs=renderer.xr.getReferenceSpace();return !!(f&&rs&&f.getViewerPose(rs))}catch{return false}};
 let frameNo=0,poseAt=0,placePending=false;ui.placeLine='';
 // menu grab (build 366): grip while pointing at the menu moves it with the hand; released, it stays there (position becomes fixed)
 let menuHeld=null;
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
 // hand-held sections (build 344–360): up to 4 square frames, local X =
 // plane normal (held like a blade). A frame is held only while the chosen
 // button (grip or trigger) is pressed near it; on release it stays fixed in
 // the volume. B/Y short press shows / hides the sections, long press adds
 // one. Each plane: clip or not, side (one-side mode), own frame colour.
 // build 400 (owner: a smarter palette): soft gold, sky, rose, mint for the planes; the hands use vivid orange / indigo outside that set
 const PLANE_COLORS=[0xf2d27a,0x8ec5ff,0xf5a3c7,0x9be3b0],MAX_PLANES=4,LONG_PRESS=600;
 // thumbstick scroll (build 364): world m/s along the selected plane's normal at full deflection
 const SCROLL_SPEED=0.05;
 // selection (build 364): selected = the plane the thumbstick moves (build 400: no double frame; the list button shows it)
 // build 396: each hand holds its own plane (c.userData.heldPlane), so two planes can be moved at once
 const section={on:false,selected:null},planes=[];
 const square=(h)=>new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,-h,-h),new THREE.Vector3(0,h,-h),new THREE.Vector3(0,h,h),new THREE.Vector3(0,-h,h)]);
 // handle corner per plane index (build 364): (+y,+z), (+y,−z), (−y,−z), (−y,+z)
 const HANDLE_CORNERS=[[1,1],[1,-1],[-1,-1],[-1,1]],HANDLE=0.034;
 const makePlane=(color,cut)=>{
  const obj=new THREE.Group(),mat=new THREE.LineBasicMaterial({color}),h=0.12;
  obj.add(new THREE.LineLoop(square(h),mat));
  // glow (build 398; 3 mm since build 400): a band over the frame in the colour of the hand that points at or holds it
  const go=h+0.0015,gi=h-0.0015,gs=new THREE.Shape([new THREE.Vector2(-go,-go),new THREE.Vector2(go,-go),new THREE.Vector2(go,go),new THREE.Vector2(-go,go)]);
  gs.holes.push(new THREE.Path([new THREE.Vector2(-gi,-gi),new THREE.Vector2(-gi,gi),new THREE.Vector2(gi,gi),new THREE.Vector2(gi,-gi)]));
  const glow=new THREE.Mesh(new THREE.ShapeGeometry(gs),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0.95,side:THREE.DoubleSide,depthWrite:false,toneMapped:false}));glow.rotation.y=Math.PI/2;glow.visible=false;obj.add(glow);
  // ray pick (build 364): invisible quad over the frame, normal = local X; the raycaster ignores visible, DoubleSide so it is hit from both faces
  const hit=new THREE.Mesh(new THREE.PlaneGeometry(2*h,2*h),new THREE.MeshBasicMaterial({visible:false,side:THREE.DoubleSide}));hit.rotation.y=Math.PI/2;obj.add(hit);
  // handle (build 364): small square outside a corner with the plane's number (menu 断面1..4), drawn by refreshHandles
  const canvas=document.createElement('canvas');canvas.width=96;canvas.height=96;const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;
  const handle=new THREE.Mesh(new THREE.PlaneGeometry(HANDLE,HANDLE),new THREE.MeshBasicMaterial({map:tex,transparent:true,toneMapped:false,side:THREE.DoubleSide,depthTest:false}));
  handle.rotation.y=Math.PI/2;handle.renderOrder=3;handle.userData.ctx=canvas.getContext('2d');obj.add(handle);
  // one-side mode (build 346): side picks the kept half along local X; the
  // arrow points at the removed half
  const arrow=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0),new THREE.Vector3(0.09,0,0),new THREE.Vector3(0.09,0,0),new THREE.Vector3(0.065,0.02,0),new THREE.Vector3(0.09,0,0),new THREE.Vector3(0.065,-0.02,0)]),mat);
  arrow.visible=false;obj.add(arrow);
  return{obj,mat,arrow,glow,hit,handle,h,color,cut,side:1,hand:null};
 };
 const disposePlane=pl=>{pl.obj.removeFromParent();pl.obj.traverse(o=>{o.geometry?.dispose()});pl.mat.dispose();pl.hit.material.dispose();pl.glow.material.dispose();pl.handle.material.map.dispose();pl.handle.material.dispose()};
 // number + corner of every handle from the plane's index (after add / remove, not per frame)
 // build 397: under the number, the hand that holds or last held the plane (右 / 左)
 const drawHandle=(pl,i)=>{
  const hd=pl.handle,ctx=hd.userData.ctx,hand=pl.hand==='right'?L.handR:pl.hand==='left'?L.handL:'';
  ctx.clearRect(0,0,96,96);ctx.fillStyle='#'+pl.color.toString(16).padStart(6,'0');ctx.beginPath();ctx.roundRect(0,0,96,96,18);ctx.fill();
  ctx.fillStyle='#111';ctx.textAlign='center';ctx.textBaseline='middle';
  if(hand){ctx.font='bold 54px system-ui,sans-serif';ctx.fillText(String(i+1),48,32);ctx.fillStyle='#'+HAND_COLORS[pl.hand].toString(16).padStart(6,'0');ctx.beginPath();ctx.arc(48,74,20,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff';ctx.font='bold 28px system-ui,sans-serif';ctx.fillText(hand,48,76)}
  else{ctx.font='bold 64px system-ui,sans-serif';ctx.fillText(String(i+1),48,52)}
  hd.material.map.needsUpdate=true;
 };
 const refreshHandles=()=>planes.forEach((pl,i)=>{
  const o=pl.h+0.01+HANDLE/2,[sy,sz]=HANDLE_CORNERS[i%4];drawHandle(pl,i);pl.handle.position.set(0,sy*o,sz*o);
 });
 // side that removes the viewer's half right now (what 'near' shows)
 const chooseSide=pl=>{readHead();scene.updateMatrixWorld();pl.obj.getWorldPosition(tmpA);tmpB.set(1,0,0).transformDirection(pl.obj.matrixWorld);pl.side=tmpB.dot(tmpA.subVectors(head,tmpA))>0?-1:1};
 const takePlane=(pl,c)=>{c.attach(pl.obj);c.userData.heldPlane=pl;c.userData.target=null;section.selected=pl;const hand=c.userData.source?.handedness||null;if(hand!==pl.hand){pl.hand=hand;drawHandle(pl,planes.indexOf(pl))}pulse(c);menu.refresh()};
 const fixPlane=c=>{const pl=c.userData.heldPlane;if(!pl)return;holder.attach(pl.obj);c.userData.heldPlane=null;pulse(c,0.2);menu.refresh()};
 const fixAll=()=>controllers.forEach(fixPlane);
 const heldPlanes=()=>new Set(controllers.map(c=>c.userData.heldPlane).filter(Boolean));
 const planeDist=(pl,c)=>{c.getWorldPosition(tmpA);pl.obj.getWorldPosition(tmpB);return tmpA.distanceTo(tmpB)};
 const nearestPlane=c=>{if(!section.on)return null;const hp=heldPlanes();let best=null,bd=0.2;for(const pl of planes){if(hp.has(pl))continue;const d=planeDist(pl,c);if(d<bd){bd=d;best=pl}}return best};
 // ray pick (build 364): the frame the ray points at can be grabbed from a distance; nearest hit or null
 const rayPlane=c=>{if(!section.on||!planes.length)return null;const hp=heldPlanes(),free=planes.filter(p=>!hp.has(p));if(!free.length)return null;setRay(c);const x=raycaster.intersectObjects(free.map(p=>p.hit),false)[0];if(!x)return null;const pl=planes.find(p=>p.hit===x.object);return pl?{pl,distance:x.distance}:null};
 // volume hit (build 402, owner: the pointer should hit the 3D object too): first voxel of a shown segment on the
 // kept side of the clipping planes (vr-pick.js); world distance or null. Frames and boards are tested first;
 // without classification bytes there is no hit.
 const tmpVo=new THREE.Vector3(),tmpVq=new THREE.Vector3();
 // build 424: diagnostics for the analysis cost bench (owner: VR mode with results very heavy): diagAn.noRegion draws with
 // the shader variants without VRL_REGIONS, diagAn.noLabels skips the laser's volume march and the labels
 const diagAn={noRegion:false,noLabels:false};
 // VR position points (Issue #88, stage 3; vr-point.js): vrHalfExt / vrDims / vrFp are set when the data is ready (null before)
 let vrHalfExt=null,vrDims=null,vrFp=null;const vpMarkers=createVrPointMarkers(THREE,scene);
 // where this controller's laser meets a section (the first one it meets inside the volume): {distance (world m), voxel, plane} or null;
 // the section planes are the shader's uniforms (volume object space, all sections shown; cutBits: the clipping ones)
 const sectionPointOf=c=>{
  if(!section.on||bench.noSection||!material||!mesh?.parent||!vrHalfExt||!vrDims)return null;
  const u=material.uniforms,n=u.planeCount.value;if(!n)return null;
  setRay(c);const o=tmpVo.copy(raycaster.ray.origin),q=tmpVq.copy(o).add(raycaster.ray.direction);mesh.worldToLocal(o);mesh.worldToLocal(q);q.sub(o);
  const r=sectionRayHit(o,q,{halfExt:vrHalfExt,dims:vrDims,planes:u.cutPlanes.value,count:n,cutBits:u.planeCut.value});
  return r?{distance:r.t,voxel:r.voxel,plane:r.plane}:null;
 };
 // record the place a laser points at on a section as "VR ポイント N" (a position comment). own: that hand's trigger (its own laser; the caller has
 // already checked the priority and the thumbstick gate); null: the menu button, any controller whose laser is on a section (the pressing one
 // points at the menu). Nothing is recorded without a section or when no laser meets one inside the volume (never a clamped or guessed place).
 const flashMsg=(t,ms=2500)=>{ui.flash=t;ui.flashUntil=performance.now()+ms;menu.refresh()};
 const pulseTwice=c=>{pulse(c,0.35,18);setTimeout(()=>pulse(c,0.35,18),90)};
 // selected point (a comment id, or null) and the last deletion (for the undo), both only for this VR session
 let vpSel=null,vpDeleted=null;
 const recordPoint=own=>{
  if(!section.on){flashMsg(L.ptNeed);if(own)pulse(own,0.15,30);return null}
  const src=own?(own.userData.secHit?own:null):controllers.find(x=>x.userData.secHit),hit=src?.userData.secHit;
  if(!hit||!vrFp){flashMsg(L.ptAim);if(own)pulse(own,0.15,30);return null}
  const rec=recordVrPoint({voxel:hit.voxel,series:vrFp,language:ja?'ja':'en'});
  if(!rec){flashMsg(L.ptAim);return null}
  vpDeleted=null;pulse(src,0.5,20);flashMsg(L.ptDone+rec.text+' · i '+hit.voxel.i+' · j '+hit.voxel.j+' · k '+hit.voxel.k,4000);return rec;
 };
 const selectPoint=(c,id)=>{vpSel=vpSel===id?null:id;pulseTwice(c);menu.refresh()};
 const commentStore={getComments,removeComment,restoreComment};
 const deleteSelectedPoint=()=>{
  const d=deleteSelected(vpSel,commentStore);if(!d)return false;
  vpDeleted=d;vpSel=null;flashMsg(L.ptDeleted);return true;
 };
 const undoDeletePoint=()=>{const d=vpDeleted;if(!d)return false;vpDeleted=null;if(undoDelete(d,commentStore)){vpSel=d.c.id;flashMsg(L.ptRestored);return true}menu.refresh();return false};
 // hidden behind tissue: refreshed about 10 times a second (not every frame); the rule is vr-point.js pointIsHidden. The head is the middle of both eyes.
 let vpHidden=new Set(),vpHiddenAt=0;const tmpEyeL=new THREE.Vector3(),tmpEyeR=new THREE.Vector3(),tmpHp=new THREE.Vector3();
 const updateHidden=now=>{
  vpHiddenAt=now;
  const vp=volPick,pts=vpMarkers.centres();
  if(!vp||!mesh?.parent||!material||!pts.length){if(vpHidden.size)vpHidden=new Set();return}
  const mask=shownMask(),chs=[];for(let i=0;i<4;i++)if(mask>>i&1&&vp.cls.chan[i]>=0)chs.push(vp.cls.chan[i]);
  const cams=renderer.xr.getCamera().cameras;
  if(cams&&cams.length>=2){cams[0].getWorldPosition(tmpEyeL);cams[1].getWorldPosition(tmpEyeR);tmpEyeL.add(tmpEyeR).multiplyScalar(0.5)}else tmpEyeL.copy(head);
  mesh.worldToLocal(tmpEyeL);
  const u=material.uniforms,opt={cls:vp.cls,dims:vp.dims,halfExt:vp.halfExt,chs,planes:u.cutPlanes.value,count:u.planeCount.value,cut:u.planeCut.value},next=new Set();
  for(const p of pts){tmpHp.copy(p.world);mesh.worldToLocal(tmpHp);if(pointIsHidden(tmpHp,tmpEyeL,opt))next.add(p.id)}
  vpHidden=next;
 };
 const unsubComments=onCommentsChange(()=>{if(vpSel&&!getComments().some(c=>c.id===vpSel))vpSel=null;if(ui.tab===6)menu.refresh()});
 const volumeHit=c=>{if(c)setRay(c);return volumeHitRay()};
 const volumeHitRay=()=>{
  const vp=volPick;if(!vp||!mesh?.parent||!material||diagAn.noLabels)return null;
  const mask=shownMask(),chs=[];for(let i=0;i<4;i++)if(mask>>i&1&&vp.cls.chan[i]>=0)chs.push(vp.cls.chan[i]);if(!chs.length)return null;
  const o=tmpVo.copy(raycaster.ray.origin),q=tmpVq.copy(o).add(raycaster.ray.direction);mesh.worldToLocal(o);mesh.worldToLocal(q);q.sub(o);
  const u=material.uniforms,hi=marchClassificationHitInfo(o,q,vp.halfExt,vp.dims,vp.cls,chs,u.cutPlanes.value,u.planeCount.value,u.planeCut.value);
  if(!hi)return null;
  // build 423: what was hit — the segment (channel → segment) and the result at that voxel (list position, 0 = none)
  const si=vp.cls.chan.indexOf(hi.ch),[w,h]=vp.dims,id=vp.ids?vp.ids[hi.x+w*(hi.y+h*hi.z)]:0;
  return{distance:hi.t,key:SEGMENT_PRESET_ORDER[si]||'',id,local:new THREE.Vector3(o.x+q.x*hi.t,o.y+q.y*hi.t,o.z+q.z*hi.t)};
 };
 // result labels (build 423, owner): while the 解析 tab is open or no section is shown, the laser on the volume shows a
 // faint label of what it points at (result: colour, number as in the 解析 tab, segment, mm³; else the segment name and
 // 解析結果なし); the trigger pins / unpins the label of a result at that point. Labels stay at their point in the volume
 // (re-placed every frame), face the viewer, and are linked to the point by a thin line.
 const LABEL_W=0.12,LABEL_H=0.036,pins=new Map(),tmpLb=new THREE.Vector3();
 // build 426 (owner: smaller labels, size in the settings): 小 / 中 / 大 = 50 / 70 / 100 % of the 12 cm label (大 = up to 425)
 // build 427 (owner: 小 is right; the pointing label at the hand): default 小; the pointing label is a chip above its own
 // controller (never over the volume, always at reading distance), framed in that hand's laser colour, same size setting
 const LABEL_SIZES=[0.5,0.7,1],labelScale=()=>LABEL_SIZES[settings.labelSize]??LABEL_SIZES[0];
 // build 429 (owner: above the hand it keeps covering the volume): at the root of the laser instead — just in front of the
 // ray origin and under the ray (target-ray space: −z along the ray), below the menu badge (y 0.05) and the section panel
 const HAND_CHIP={left:[0,-0.03,-0.03],right:[0,-0.03,-0.03]};
 const hoverLabelOf=c=>c.userData.hoverLabel||=Object.assign(makeLabel(),{hand:c});
 const labelMode=()=>(ui.open&&ui.tab===5)||!section.on;
 const makeLabel=()=>{
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=154;const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;
  const m=new THREE.Mesh(new THREE.PlaneGeometry(LABEL_W,LABEL_H),new THREE.MeshBasicMaterial({map:tex,transparent:true,toneMapped:false,depthTest:false}));m.renderOrder=5;m.visible=false;
  const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]),new THREE.LineBasicMaterial({color:0xffffff,transparent:true,depthTest:false}));line.frustumCulled=false;line.renderOrder=5;line.visible=false;
  scene.add(m);scene.add(line);return{m,line,ctx:canvas.getContext('2d'),tex,key:null,anchor:new THREE.Vector3(),world:new THREE.Vector3()};
 };
 const drawLabel=(lb,hit,faint)=>{
  const r=hit.id?regionList[hit.id-1]:null,seg=tr(hit.key)||hit.key,hc=lb.hand?handColor(lb.hand):0,key=(r?hit.id:'n'+hit.key)+(faint?'f':'p')+hc;if(lb.key===key)return;lb.key=key;
  const ctx=lb.ctx;ctx.clearRect(0,0,512,154);ctx.fillStyle='rgba(17,23,27,0.92)';ctx.beginPath();ctx.roundRect(4,4,504,146,26);ctx.fill();
  if(lb.hand){ctx.strokeStyle='#'+hc.toString(16).padStart(6,'0');ctx.lineWidth=6;ctx.stroke()}
  ctx.textBaseline='middle';ctx.fillStyle='#eef5f8';
  if(r){const hex='#'+r.color.toString(16).padStart(6,'0');ctx.fillStyle=hex;ctx.beginPath();ctx.arc(62,77,34,0,Math.PI*2);ctx.fill();
   ctx.fillStyle='#eef5f8';ctx.font='bold 44px system-ui,sans-serif';ctx.fillText(hit.id+'. '+r.segmentKeys.map(k=>tr(k)).join('+'),118,50);ctx.font='40px system-ui,sans-serif';ctx.fillText(r.mm3.toFixed(2)+' mm³',118,108)}
  else{ctx.font='bold 44px system-ui,sans-serif';ctx.fillText(seg,34,50);ctx.font='38px system-ui,sans-serif';ctx.fillStyle='#9fb3c3';ctx.fillText(ja?'解析結果なし':'no analysis result',34,108)}
  lb.tex.needsUpdate=true;lb.m.material.opacity=faint?0.85:1;lb.line.material.opacity=0.9;lb.faint=faint;
 };
 const placeLabel=lb=>{
  const k=labelScale();lb.m.scale.setScalar(k);
  if(lb.hand){const o=HAND_CHIP[lb.hand.userData.source?.handedness]||HAND_CHIP.right;lb.m.position.set(o[0],o[1],o[2]);lb.hand.updateWorldMatrix(true,false);lb.hand.localToWorld(lb.m.position);lb.m.lookAt(head);lb.m.visible=true;lb.line.visible=false;return}
  lb.world.copy(lb.anchor);mesh.localToWorld(lb.world);
  tmpLb.subVectors(head,lb.world).normalize();lb.m.position.copy(lb.world).addScaledVector(tmpLb,0.012);lb.m.position.y+=k*0.045;lb.m.lookAt(head);
  const a=lb.line.geometry.attributes.position;a.setXYZ(0,lb.world.x,lb.world.y,lb.world.z);a.setXYZ(1,lb.m.position.x,lb.m.position.y-k*LABEL_H/2,lb.m.position.z);a.needsUpdate=true;
  lb.m.visible=true;lb.line.visible=true;
 };
 const hideLabel=lb=>{if(lb){lb.m.visible=lb.line.visible=false}};
 const togglePin=(c,hit)=>{
  if(!hit?.id)return false;const old=pins.get(hit.id);
  if(old){pins.delete(hit.id);old.m.removeFromParent();old.line.removeFromParent();old.tex.dispose();old.m.material.dispose();old.m.geometry.dispose();old.line.geometry.dispose();old.line.material.dispose();pulse(c,0.2);return true}
  const lb=makeLabel();lb.anchor.copy(hit.local);drawLabel(lb,hit,false);pins.set(hit.id,lb);pulse(c);return true;
 };
 // new plane: through the volume centre (first) or in front of the hand
 // (added ones), facing the viewer, fixed in the volume
 // build 401 (owner: planes are added to cut): every new plane clips; the bench keeps its old rule (only a first plane clips)
 const addPlane=(c=null,cut=true)=>{
  if(planes.length>=MAX_PLANES)return null;
  const used=new Set(planes.map(p=>p.color)),color=PLANE_COLORS.find(x=>!used.has(x))??PLANE_COLORS[0];
  const pl=makePlane(color,cut);planes.push(pl);
  readHead();scene.add(pl.obj);
  if(c){c.getWorldPosition(pl.obj.position);tmpB.set(0,0,-1).transformDirection(c.matrixWorld);pl.obj.position.addScaledVector(tmpB,0.12)}
  else holder.getWorldPosition(pl.obj.position);
  tmpA.subVectors(head,pl.obj.position).normalize();pl.obj.quaternion.setFromUnitVectors(new THREE.Vector3(1,0,0),tmpA);pl.obj.scale.setScalar(1);
  holder.attach(pl.obj);chooseSide(pl);section.on=true;section.selected=pl;planes.forEach(p=>{p.obj.visible=true});refreshHandles();menu.refresh();return pl;
 };
 const removePlane=pl=>{for(const c of controllers){if(c.userData.heldPlane===pl)c.userData.heldPlane=null;if(c.userData.target===pl)c.userData.target=null}const i=planes.indexOf(pl);if(i>=0)planes.splice(i,1);disposePlane(pl);if(section.selected===pl)section.selected=planes[planes.length-1]||null;if(!planes.length)section.on=false;refreshHandles();menu.refresh()};
 // snap (build 365): the selected plane onto a volume axis, frame edges along the other two axes.
 // axis 0 axial (normal = volume z), 1 coronal (y), 2 sagittal (x); holder space = volume object space.
 // The normal keeps its sign (removed side unchanged), position unchanged, up = volume y (coronal: z)
 const AXES=[new THREE.Vector3(0,0,1),new THREE.Vector3(0,1,0),new THREE.Vector3(1,0,0)],tmpQa=new THREE.Quaternion(),tmpQb=new THREE.Quaternion(),tmpNh=new THREE.Vector3();
 const normalInHolder=(pl,out)=>{pl.obj.getWorldQuaternion(tmpQa);holder.getWorldQuaternion(tmpQb);return out.set(1,0,0).applyQuaternion(tmpQa).applyQuaternion(tmpQb.invert())};
 const snapPlane=(pl,axis)=>{
  if(!pl)return;scene.updateMatrixWorld();
  const n=AXES[axis].clone();if(n.dot(normalInHolder(pl,tmpNh))<0)n.negate();
  const u=axis===1?new THREE.Vector3(0,0,1):new THREE.Vector3(0,1,0),w=new THREE.Vector3().crossVectors(n,u);
  const qh=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(n,u,w));
  // holder space -> the plane's parent (holder when fixed, the controller while held)
  (pl.obj.parent||holder).getWorldQuaternion(tmpQa).invert();holder.getWorldQuaternion(tmpQb);
  pl.obj.quaternion.copy(tmpQa.multiply(tmpQb).multiply(qh));menu.refresh();
 };
 // axis the plane's normal lies on (within about 1°), else -1: the snap buttons' on state
 const planeAxis=pl=>{if(!pl)return -1;const n=normalInHolder(pl,tmpNh);for(let i=0;i<3;i++)if(Math.abs(n.dot(AXES[i]))>0.9998)return i;return -1};
 const setSection=on=>{
  if(on&&!planes.length){addPlane();return}
  section.on=on;if(!on)fixAll();planes.forEach(p=>{p.obj.visible=on});menu.refresh();
 };
 // long-press progress ring shown on the pressing controller
 const ringGeo=new THREE.BufferGeometry().setFromPoints(Array.from({length:33},(_,i)=>new THREE.Vector3(Math.cos(i/32*Math.PI*2)*0.025,Math.sin(i/32*Math.PI*2)*0.025,0)));
 const ring=new THREE.Line(ringGeo,new THREE.LineBasicMaterial({color:0xffffff}));ring.position.set(0,0.035,0.02);ring.rotation.x=-0.6;ring.visible=false;
 let dragging=null,shotRequested=false;
 for(const c of controllers){
  c.addEventListener('connected',e=>{c.userData.source=e.data;if(c.userData.source?.handedness==='left'){if(!ui.open)c.add(badge);c.add(panel.mesh)}});
  c.addEventListener('disconnected',()=>{fixPlane(c);c.userData.source=null});
  c.addEventListener('squeezestart',()=>{
   if(ui.open&&!menuHeld&&boardHits(c).menu){c.attach(menu.mesh);menuHeld=c;menuMoving=false;settings.menuMode=1;saveSettings(settings);pulse(c);menu.refresh();return}
   if(!helpHeld&&c.userData.helpHit){c.attach(help.mesh);helpHeld=c;helpMoving=false;settings.help=2;saveSettings(settings);pulse(c);menu.refresh();return}
   if(settings.secHold===0&&!c.userData.heldPlane){const pl=c.userData.target;if(pl){takePlane(pl,c);return}}
   grabbing.add(c);regrab();
  });
  c.addEventListener('squeezeend',()=>{
   if(menuHeld===c){scene.attach(menu.mesh);menuHeld=null;readHead();menu.mesh.lookAt(head);pulse(c,0.2);return}
   if(helpHeld===c){scene.attach(help.mesh);helpHeld=null;readHead();help.mesh.lookAt(head);pulse(c,0.2);return}
   if(c.userData.heldPlane&&settings.secHold===0){fixPlane(c);return}
   if(grabbing.delete(c))regrab();
  });
  // trigger: menu first (button or slider drag), then the menu tag, then the
  // section panel (build 365), then the section in trigger mode (near, else
  // the one the ray points at; build 364)
  // build 464: priority of this hand's trigger — menu / UI panels, then a section's handle or this hand's selected target, then an existing
  // point (select it), then the face of a section (record; only while this hand's thumbstick is at rest, see createStickGate).
  c.addEventListener('selectstart',()=>{
   const bd=boardHits(c),h=bd.menu,pi=bd.panel?panel.hit(bd.panel.uv):-1;
   const kind=resolveTrigger({ui:!!h||!!bd.badge||pi>=0,handle:!!(c.userData.heldPlane||c.userData.target),point:c.userData.ptHit?.id??null,section:!!c.userData.secHit&&section.on&&!labelMode()});
   if(kind==='ui'){
    if(h){const i=menu.hit(h.uv);if(i<0)return;const w=menu.widget(i);if(w.set){dragging={c,i};menu.drag(i,h.uv)}else menu.press(i);pulse(c);return}
    if(bd.badge){setMenuOpen(true);pulse(c);return}
    panel.press(pi);pulse(c);return;
   }
   if(kind==='handle'){if(settings.secHold===1&&!c.userData.heldPlane&&section.on){const pl=c.userData.target;if(pl)takePlane(pl,c)}return}
   if(kind==='point'){selectPoint(c,c.userData.ptHit.id);return}
   if(kind==='section'){if(c.userData.gate.canRecord(performance.now()))recordPoint(c);return}
   // build 423: a result label is pinned / unpinned where the laser meets the volume
   if(labelMode()&&c.userData.volHit&&togglePin(c,c.userData.volHit))return;
  });
  c.addEventListener('selectend',()=>{if(dragging?.c===c){dragging=null;saveSettings(settings)}if(c.userData.heldPlane&&settings.secHold===1)fixPlane(c)});
 }
 const rates=[...(session.supportedFrameRates||[])].filter(r=>r>=60).sort((a,b)=>a-b);
 const targetRate=()=>session.frameRate||(rates.length?rates[Math.min(settings.rate,rates.length-1)]:72);
 let autoF=1,autoFrames=0,autoAt=performance.now(); // build 395: starts at 100 % (72 fps there at the default size since build 387) and only drops when the frames say so
 let frames=0,fpsAt=performance.now(),fps=0;
 // build 385: benchmark — 12 phases (3 sizes × shown segments / bone only × 100 % / 50 %), 0.8 s settle + 2 s count each;
 // the state is restored afterwards and the result goes to the 画質 tab, the console, localStorage (vrl-vr-bench) and a
 // panel on the page after the session
 const bench={active:false,phases:[],i:-1,at:0,measureAt:0,frames:0,results:[],saved:null,noSection:false,tempPlane:null,plane:null,planeBase:null,t0:0};
 const shownLabel=modes=>SEGMENT_PRESET_ORDER.filter(k=>segmentState[k]?.active&&segmentState[k]?.enabled&&(modes[k]|0)!==2).map(k=>tr(k)).join('+')||'-';
 // build 424: analysis cost bench — four phases at the current size, resolution and view (0.8 s settle + 2 s count each):
 // as is / no result colours / no laser march and labels / neither; with labels on, both hands' rays are replaced by a
 // ray from the head to the volume centre so a label is drawn and placed every frame as when pointing at the volume
 const anBench={active:false,i:-1,at:0,measureAt:0,frames:0,results:[],phases:[{noRegion:false,noLabels:false},{noRegion:true,noLabels:false},{noRegion:false,noLabels:true},{noRegion:true,noLabels:true}]};
 const startAnBench=()=>{if(anBench.active||bench.active||!mesh)return;anBench.results=[];anBench.i=-1;anBench.active=true;anBenchNext()};
 const anBenchNext=()=>{anBench.i++;if(anBench.i>=anBench.phases.length){anBenchFinish();return}Object.assign(diagAn,anBench.phases[anBench.i]);anBench.at=performance.now();anBench.measureAt=0;anBench.frames=0;ui.benchLine=L.benchRun+(anBench.i+1)+' / '+anBench.phases.length;menu.refresh()};
 const anBenchTick=()=>{
  if(!anBench.active)return;const now=performance.now();
  if(!diagAn.noLabels){readHead();holder.getWorldPosition(tmpLb);raycaster.ray.origin.copy(head);raycaster.ray.direction.subVectors(tmpLb,head).normalize();
   for(const c of controllers){const hit=volumeHitRay();if(hit){const lb=hoverLabelOf(c);drawLabel(lb,hit,true);lb.anchor.copy(hit.local);placeLabel(lb)}}}
  if(!anBench.measureAt){if(now-anBench.at>=800){anBench.measureAt=now;anBench.frames=0}return}
  anBench.frames++;if(now-anBench.measureAt>=2000){anBench.results.push(anBench.frames*1000/(now-anBench.measureAt));anBenchNext()}
 };
 const anBenchFinish=()=>{
  anBench.active=false;diagAn.noRegion=false;diagAn.noLabels=false;const f=i=>anBench.results[i]!=null?Math.round(anBench.results[i]):'-';
  const line=(ja?'解析の重さ: そのまま ':'analysis cost: as is ')+f(0)+(ja?' / 結果の色なし ':' / no result colours ')+f(1)+(ja?' / 札・レーザー判定なし ':' / no labels or laser march ')+f(2)+(ja?' / 両方なし ':' / neither ')+f(3)+' fps · '+(ja?'結果 ':'results ')+regionList.length+(material?.defines?.VRL_REGIONS!==undefined?' (VRL_REGIONS)':'')+' · '+(ja?'札 ':'pins ')+pins.size+' · '+(holder.scale.x*3.3*100).toFixed(1)+' cm · '+(VRES[settings.vres]?Math.round(VRES[settings.vres]*100)+'%':L.auto);
  const headLine=(ja?'VR 解析ベンチ build ':'VR analysis bench build ')+APP_BUILD+' · '+targetRate()+' Hz';
  lastBench={head:headLine,lines:[line],when:Date.now()};try{localStorage.setItem('vrl-vr-bench',JSON.stringify(lastBench))}catch{}
  console.log('[VR analysis bench]',headLine,line);ui.benchLine=line;menu.refresh();
 };
 const startBench=()=>{
  if(bench.active||!mesh)return;
  fixAll(); // build 396: the bench moves the plane in the volume's space
  // build 391 (owner: the bench must emulate real use): every phase runs with a section plane sweeping through the
  // volume and the volume slowly turning; segment sets: as shown, bone + fat, bone only
  const canShow=k=>!!(segmentState[k]?.active&&segmentState[k]?.enabled);
  bench.phases=[];for(const s of [0.165,0.3])for(const g of ['cur','bonefat','bone'])for(const r of [1,3]){if(g==='bonefat'&&!(canShow('bone')&&canShow('fat')))continue;bench.phases.push({s,g,r,sec:1})}
  bench.tempPlane=planes.length<MAX_PLANES?addPlane(null,planes.length===0):null;bench.plane=bench.tempPlane||planes[0];bench.planeBase=bench.plane.obj.position.clone();bench.noSection=false;bench.t0=performance.now();
  bench.saved={scale:holder.scale.x,vres:settings.vres,segMode:{...segMode},pos:holder.position.clone(),quat:holder.quaternion.clone()};
  bench.results=[];bench.i=-1;bench.active=true;nextBenchPhase();
 };
 const nextBenchPhase=()=>{
  bench.i++;if(bench.i>=bench.phases.length){finishBench();return}
  const ph=bench.phases[bench.i];
  bringVolumeFront();holder.scale.setScalar(ph.s/3.3);bench.noSection=!ph.sec;
  for(const key of SEGMENT_PRESET_ORDER){const sv=bench.saved.segMode[key]|0;segMode[key]=ph.g==='cur'?sv:(ph.g==='bone'?(key==='bone'?(sv===2?0:sv):2):((key==='bone'||key==='fat')?(sv===2?0:sv):2))}
  settings.vres=ph.r;applyQuality();
  bench.at=performance.now();bench.measureAt=0;bench.frames=0;
  ui.benchLine=L.benchRun+(bench.i+1)+' / '+bench.phases.length;menu.refresh();
 };
 const benchTick=()=>{
  if(!bench.active)return;const now=performance.now();
  // motion: the volume turns at 0.5 rad/s, the plane sweeps ±0.5 of the volume along its normal at 0.4 Hz
  const tt=(now-bench.t0)/1000;holder.quaternion.copy(bench.saved.quat);holder.rotateY(0.5*tt);
  if(bench.plane){tmpB.set(1,0,0).applyQuaternion(bench.plane.obj.quaternion);bench.plane.obj.position.copy(bench.planeBase).addScaledVector(tmpB,0.5*Math.sin(2*Math.PI*0.4*tt))}
  if(!bench.measureAt){if(now-bench.at>=800){bench.measureAt=now;bench.frames=0}return}
  bench.frames++;
  if(now-bench.measureAt>=2000){const ph=bench.phases[bench.i];bench.results.push({...ph,fps:bench.frames*1000/(now-bench.measureAt)});nextBenchPhase()}
 };
 const finishBench=()=>{
  const sv=bench.saved;bench.active=false;bench.noSection=false;if(bench.plane&&!bench.tempPlane)bench.plane.obj.position.copy(bench.planeBase);if(bench.tempPlane){removePlane(bench.tempPlane);bench.tempPlane=null}bench.plane=null;
  Object.assign(segMode,sv.segMode);settings.vres=sv.vres;applyQuality();
  holder.position.copy(sv.pos);holder.quaternion.copy(sv.quat);holder.scale.setScalar(sv.scale);
  const cur=shownLabel(sv.segMode),rate=targetRate(),f=(s,g,r)=>{const x=bench.results.find(e=>e.s===s&&e.g===g&&e.r===r);return x?Math.round(x.fps):'-'};
  const lines=[];for(const sz of [0.165,0.3])lines.push((sz*100).toFixed(1).replace('.0','')+' cm '+(ja?'断面を動かしながら: ':'moving section: ')+cur+' 100% '+f(sz,'cur',1)+' / 50% '+f(sz,'cur',3)+' · '+tr('bone')+'+'+tr('fat')+' 100% '+f(sz,'bonefat',1)+' / 50% '+f(sz,'bonefat',3)+' · '+tr('bone')+' 100% '+f(sz,'bone',1)+' / 50% '+f(sz,'bone',3)+' fps');
  const head=(ja?'VR ベンチ build ':'VR benchmark build ')+APP_BUILD+' · '+rate+' Hz · '+(ja?'自動解像度の既定サイズ ':'default size ')+(baseScale*3.3*100).toFixed(1)+' cm';
  lastBench={head,lines,when:Date.now()};
  try{localStorage.setItem('vrl-vr-bench',JSON.stringify(lastBench))}catch{}
  console.log('[VR bench]',head,lines);
  ui.benchLine=lines.join(' | ');menu.refresh();
 };
 const applyQuality=()=>{
  if(material){material.uniforms.stepSize.value=baseStep*(STEP[settings.quality]??1);material.uniforms.diag.value=settings.diag|0;material.uniforms.refine.value=settings.refine|0;useData(settings.data|0)}
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
  // tabs
  // build 409: six tabs (解析 added) share the width
  {const tw=(MENU_W-2*X)/L.tabs.length;L.tabs.forEach((t,i)=>btn(X+i*tw,110,tw-12,t+(i===1&&section.on?' ●':''),ui.tab===i,()=>{ui.tab=i},{size:28}))}
  const status=ui.flash&&performance.now()<ui.flashUntil?ui.flash:ui.status;
  label(X,228,status,{color:'#ffd27a'});
  const y0=270;
  if(ui.tab===0){
   const active=SEGMENT_PRESET_ORDER.filter(k=>segmentState[k]?.active);
   if(!active.length)label(X,y0+40,L.noSeg);
   // name + VR opacity, display mode, opacity slider (VR only; starts at 100 %)
   active.forEach((key,i)=>{const seg=segmentState[key],y=y0+i*76,m=segMode[key]|0,op=segOpacity[key]??1;label(X,y+36,tr(key)+' '+Math.round(op*100)+'%',{color:seg.color||'#fff',bold:true,size:28});
    L.segModes.forEach((t,j)=>btn(250+j*160,y,150,t,m===j,()=>{segMode[key]=j},{color:j===0?seg.color:undefined,size:28}));
    w.push({type:'slider',x:760,y,w:210,h:72,value:op,text:'',set:v=>{segOpacity[key]=Math.max(0.05,Math.round(v*20)/20)}})});
   const yb=MENU_H-110;
   // build 365: 持ち方 moved here from the 断面 tab (room for the snap row)
   choice(yb-370,L.helpT,L.helpModes.map((t,i)=>({label:t,value:i})),settings.help|0,v=>{settings.help=v;saveSettings(settings);if(v===1)helpMoving=true});
   choice(yb-280,L.hold,L.holdModes.map((t,i)=>({label:t,value:i})),settings.secHold,v=>{fixAll();settings.secHold=v;saveSettings(settings)});
   choice(yb-190,L.menuPos,[{label:L.follow,value:0},{label:L.fixed,value:1}],settings.menuMode,v=>{settings.menuMode=v;saveSettings(settings)});
   label(X,yb-96,L.menuKey,{size:26,color:'#9fb3c3'});label(X,yb-60,L.menuGrab,{size:26,color:'#9fb3c3'});
   btn(X,yb,300,L.home,false,()=>{bringVolumeFront();placeMenuNow();placeHelpNow()});btn(X+320,yb,320,L.shot,false,()=>{shotRequested=true});btn(MENU_W-X-260,yb,260,L.exit,true,()=>session.end(),{color:'#b33'});
  }else if(ui.tab===1){
   choice(y0,L.sec,[{label:L.offOn[0],value:false},{label:L.offOn[1],value:true}],section.on,v=>{if(v!==section.on)setSection(v)});
   if(planes.length<MAX_PLANES)btn(800,y0,184,L.addPlane,false,()=>{addPlane()},{size:26});
   // one row per plane: colour name, clip on/off, flip (one-side), remove
   planes.forEach((pl,i)=>{const y=y0+86+i*76,col='#'+pl.color.toString(16).padStart(6,'0');
    // build 364: the name is a button that selects the plane (thumbstick target)
    btn(X,y,190,L.planeN+(i+1),pl===section.selected,()=>{section.selected=pl},{color:col,size:26});
    btn(250,y,190,pl.cut?L.clipOn:L.clipOff,pl.cut,()=>{pl.cut=!pl.cut;if(pl.cut&&settings.cut===2)chooseSide(pl)},{color:col,size:26});
    if(settings.cut===2&&pl.cut)btn(452,y,170,L.flip,false,()=>{pl.side=-pl.side},{size:26});
    btn(640,y,150,L.remove,false,()=>removePlane(pl),{size:26});
   });
   const yb2=y0+86+MAX_PLANES*76;
   // snap (build 365): the selected plane onto axial / coronal / sagittal
   label(X,yb2+36,L.snapL);
   const sp=section.selected;if(sp)L.snapModes.forEach((t,i)=>btn(CX+i*152,yb2,140,t,planeAxis(sp)===i,()=>snapPlane(sp,i),{size:26}));
   // clip mode with a one-line explanation (build 363: the flip button was
   // not found; the slice sliders moved to the スライス tab)
   choice(yb2+90,L.cut,L.cutModes.map((t,i)=>({label:t,value:i})),settings.cut|0,v=>{if(v===2&&settings.cut!==2)planes.forEach(chooseSide);settings.cut=v;saveSettings(settings)});
   label(X,yb2+190,L.cutHelp[settings.cut|0]||'',{size:26,color:'#9fb3c3'});
   choice(yb2+220,L.cap,[{label:L.offOn[0],value:0},{label:L.offOn[1],value:1}],settings.cap?1:0,v=>{settings.cap=v;saveSettings(settings)});
   label(X,yb2+340,section.on?L.secHelp[settings.secHold]:L.secOff,{size:26});
   label(X,yb2+376,L.byHelp,{size:24,color:'#9fb3c3'});
   label(X,yb2+412,L.scrollHelp[0],{size:24,color:'#9fb3c3'});label(X,yb2+446,L.scrollHelp[1],{size:24,color:'#9fb3c3'});
  }else if(ui.tab===2){
   // VR-local window: slider 0..1 over the app's slider range, presets set it as given
   const cr=[+wc.min,+wc.max],[cMin,cMax]=Number.isFinite(cr[0])&&Number.isFinite(cr[1])&&cr[0]<cr[1]?cr:[-2000,4000],wMax=Number.isFinite(+ww.max)&&+ww.max>1?+ww.max:8000,cl=(v,a,b)=>Math.min(b,Math.max(a,v));
   label(X,y0+10,L.win,{size:26,color:'#9fb3c3'});
   label(X,y0+86,L.sl);w.push({type:'slider',x:CX+26,y:y0+50,w:300,h:72,value:settings.sliceOpacity,text:Math.round(settings.sliceOpacity*100)+'%',set:v=>{settings.sliceOpacity=Math.round(v*20)/20}});
   label(X,y0+176,L.tint);w.push({type:'slider',x:CX+26,y:y0+140,w:300,h:72,value:settings.sliceTint,text:settings.sliceTint?Math.round(settings.sliceTint*100)+'%':L.offOn[0],set:v=>{settings.sliceTint=Math.round(v*20)/20}});
   const row=(y,text,key,lo,hi)=>{label(X,y+36,text);const floor=key==='w'?1:-Infinity;w.push({type:'slider',x:CX+26,y,w:300,h:72,value:cl((vrWindow[key]-lo)/(hi-lo),0,1),text:String(Math.round(vrWindow[key])),set:v=>{vrWindow[key]=Math.max(floor,Math.round((lo+v*(hi-lo))/WIN_STEP)*WIN_STEP)}});
    btn(800,y,70,'−',false,()=>{vrWindow[key]=Math.max(floor,cl(vrWindow[key]-WIN_STEP,lo,hi))},{size:30});btn(890,y,70,'＋',false,()=>{vrWindow[key]=Math.max(floor,cl(vrWindow[key]+WIN_STEP,lo,hi))},{size:30})};
   row(y0+250,L.wcL,'c',cMin,cMax);row(y0+340,L.wwL,'w',1,wMax);
   [[L.pApp,+wc.value||0,Math.max(1,+ww.value||1)],[L.pFull,Math.round((cMin+cMax)/2),Math.max(1,Math.round(cMax-cMin))],[L.pBone,500,2000],[L.pSoft,40,400]].forEach(([t,c,wd],i)=>btn(X+i*244,y0+440,232,t,vrWindow.c===c&&vrWindow.w===wd,()=>{vrWindow.c=c;vrWindow.w=wd},{size:28}));
   label(X,y0+550,L.winHelp,{size:24,color:'#9fb3c3'});
   // build 407 (owner): CT value at or below which the slice is transparent (−500: air; raise it to hide fat too)
   {const lo=AIR_MIN,hi=AIR_MAX,a=Number.isFinite(+settings.sliceAir)?+settings.sliceAir:-500,put=v=>{settings.sliceAir=cl(Math.round(v/WIN_STEP)*WIN_STEP,lo,hi)};
    label(X,y0+640,L.airL);w.push({type:'slider',x:CX+26,y:y0+604,w:300,h:72,value:cl((a-lo)/(hi-lo),0,1),text:a+' HU',set:v=>put(lo+v*(hi-lo))});
    btn(800,y0+604,70,'−',false,()=>put(a-WIN_STEP),{size:30});btn(890,y0+604,70,'＋',false,()=>put(a+WIN_STEP),{size:30});
    label(X,y0+720,L.airHelp,{size:24,color:'#9fb3c3'})}
  }else if(ui.tab===3){
   choice(y0,L.r,VRES.map((r,i)=>({label:r?Math.round(r*100)+'%':L.auto,value:i})),settings.vres,v=>{settings.vres=v;applyQuality()});
   choice(y0+90,L.dt,[{label:'256³',value:1},{label:'512³',value:0}],settings.data,v=>{settings.data=v;applyQuality()});
   choice(y0+180,L.q,L.qv.map((t,i)=>({label:t,value:i})),settings.quality,v=>{settings.quality=v;applyQuality()});
   choice(y0+270,L.f,L.fv.map((t,i)=>({label:t,value:i})),settings.foveation,v=>{settings.foveation=v;applyQuality()});
   if(rates.length>1)choice(y0+360,L.hz,rates.slice(0,4).map((r,i)=>({label:r+' Hz',value:i})),settings.rate,v=>{settings.rate=v;applyQuality()});
   // build 385: in-VR benchmark (the owner should not have to read numbers off the headset one by one)
   btn(X,y0+460,460,L.bench,bench.active,()=>startBench(),{size:28});btn(X+480,y0+460,440,L.anBench,anBench.active,()=>startAnBench(),{size:28});if(ui.benchLine)label(X,y0+560,ui.benchLine,{size:26,color:'#9fb3c3'});label(X,y0+600,L.benchHelp,{size:22,color:'#9fb3c3'});
  }else if(ui.tab===5){
   // build 409 (owner: show the analysis results in VR / AR): read only — colour, segment, volume; 10 per page
   label(X,y0+10,L.anT,{bold:true,size:30});
   if(!regionList.length)label(X,y0+70,L.anNone,{size:26,color:'#9fb3c3'});
   else{
    const per=10,pages=Math.ceil(regionList.length/per),pg=Math.min(ui.anPage|0,pages-1);
    regionList.slice(pg*per,pg*per+per).forEach((r,k)=>{const y=y0+56+k*62,hex='#'+r.color.toString(16).padStart(6,'0');
     w.push({type:'button',x:X,y,w:56,h:50,label:'',on:true,color:hex,action:()=>{}});
     label(X+76,y+34,String(pg*per+k+1)+'. '+r.segmentKeys.map(k2=>tr(k2)).join('+'),{size:28,color:hex,bold:true});
     label(X+520,y+34,r.mm3.toFixed(2)+' mm³',{size:28})});
    const total=regionList.reduce((a,r)=>a+r.mm3,0);label(X,y0+56+per*62+40,L.anTotal+' '+total.toFixed(2)+' mm³ · '+regionList.length,{size:26,color:'#9fb3c3'});
    if(pages>1){btn(MENU_W-X-300,y0+56+per*62,140,'◀',false,()=>{ui.anPage=Math.max(0,pg-1)},{size:28});btn(MENU_W-X-150,y0+56+per*62,140,'▶',false,()=>{ui.anPage=Math.min(pages-1,pg+1)},{size:28});label(MENU_W-X-470,y0+56+per*62+40,L.anPage+' '+(pg+1)+'/'+pages,{size:26,color:'#9fb3c3'})}
   }
   choice(y0+770,L.lbSize,L.lbSizeV.map((t,i)=>({label:t,value:i})),settings.labelSize??1,v=>{settings.labelSize=v;saveSettings(settings)});
  }else if(ui.tab===6){
   // VR position points (stage 3): record button (off without a section), how it works, the position comments of this series
   label(X,y0+10,L.ptT,{bold:true,size:30});
   btn(X,y0+40,460,L.ptRec,false,()=>{recordPoint(null)},{size:30,disabled:!section.on});
   label(X+480,y0+76,section.on?'':L.ptNeed,{size:26,color:'#ffd27a'});
   // select with the trigger (laser on a point), then delete here; the undo puts it back where it was in the list (as the 2D list)
   const selNo=vpSel?getComments().findIndex(c=>c.id===vpSel)+1:0;
   btn(X,y0+120,460,L.ptDel,false,()=>{deleteSelectedPoint()},{size:30,disabled:!selNo});
   btn(X+480,y0+120,300,L.ptUndo,false,()=>{undoDeletePoint()},{size:30,disabled:!vpDeleted});
   label(X,y0+222,selNo?L.ptSel+selNo:L.ptNoSel,{size:26,color:selNo?'#ffd23d':'#9fb3c3'});
   L.ptHelp.forEach((t,i)=>label(X,y0+262+i*32,t,{size:22,color:'#9fb3c3'}));
   label(X,y0+420,L.ptList,{bold:true,size:28});
   const mine=getComments().map((c,n)=>({c,n})).filter(x=>vrFp&&commentMatchesSeries(x.c,vrFp)),shown=mine.slice(-6);
   if(!shown.length)label(X,y0+470,L.ptNone,{size:26,color:'#9fb3c3'});
   shown.forEach(({c,n},k)=>{const y=y0+440+k*60;
    w.push({type:'button',x:X,y,w:56,h:50,label:String(n+1),on:true,color:c.id===vpSel?'#ffd23d':'#4dd8ff',size:26,action:()=>{}});
    label(X+76,y+34,(c.text||'—').slice(0,14),{size:28,bold:true});label(X+520,y+34,'i '+c.position.i+' · j '+c.position.j+' · k '+c.position.k,{size:26,color:'#9fb3c3'})});
   if(mine.length>shown.length)label(X,y0+440+shown.length*60+30,'… '+(mine.length-shown.length),{size:24,color:'#9fb3c3'});
  }else if(ui.tab===4){
   label(X,y0+10,ui.fpsLine,{size:28});label(X,y0+50,ui.sizeLine,{size:28});if(ui.placeLine)label(X,y0+90,ui.placeLine,{size:26,color:'#9fb3c3'});if(ui.sampleLine)label(X,y0+122,ui.sampleLine,{size:26,color:'#9fb3c3'});if(ui.autoLine)label(X,y0+154,ui.autoLine,{size:26,color:'#9fb3c3'});
   choice(y0+200,L.diag,L.dv.slice(0,3).map((t,i)=>({label:t,value:i})),settings.diag,v=>{settings.diag=v;applyQuality()});
   choice(y0+470,L.clsD,[{label:L.offOn[1],value:0},{label:L.offOn[0],value:1}],settings.clsDiag|0,v=>{settings.clsDiag=v;applyQuality()});
   choice(y0+560,L.refineL,L.refineV.map((t,i)=>({label:t,value:1-i})),settings.refine|0,v=>{settings.refine=v;applyQuality()});
   choice(y0+650,L.distD,[{label:L.offOn[1],value:0},{label:L.offOn[0],value:1}],settings.distDiag|0,v=>{settings.distDiag=v;applyQuality()});
   choice(y0+380,L.editD,L.editDv.map((t,i)=>({label:t,value:i})),settings.editDiag|0,v=>{settings.editDiag=v;refreshEdits()});
   choice(y0+290,'',L.dv.slice(3).map((t,i)=>({label:t,value:i+3})),settings.diag,v=>{settings.diag=v;applyQuality()});
  }
  return w;
 });
 // section panel (build 365): name of the selected plane, snap, flip / clip / remove / add; font 28, buttons 72 high
 panel.onDraw(()=>{
  const w=[],sp=section.selected;if(!sp)return w;
  const col='#'+sp.color.toString(16).padStart(6,'0'),btn=(x,y,wd,label,on,action,extra={})=>w.push({type:'button',x,y,w:wd,h:72,label,on,action,size:28,...extra});
  w.push({type:'label',x:20,y:52,text:L.planeN+(planes.indexOf(sp)+1),color:col,bold:true,size:28});
  L.snapModes.forEach((t,i)=>btn(200+i*140,16,130,t,planeAxis(sp)===i,()=>snapPlane(sp,i)));
  if(settings.cut===2&&sp.cut)btn(20,128,140,L.flip,false,()=>{sp.side=-sp.side;menu.refresh()},{size:24}); // 24: '向きを反転' is 141 px at 28
  btn(180,128,160,sp.cut?L.clipOn:L.clipOff,sp.cut,()=>{sp.cut=!sp.cut;if(sp.cut&&settings.cut===2)chooseSide(sp);menu.refresh()},{color:col});
  btn(360,128,120,L.remove,false,()=>removePlane(sp));
  if(planes.length<MAX_PLANES)btn(500,128,120,L.addPlane,false,()=>{addPlane()});
  return w;
 });
 let panelKey='';
 await renderer.xr.setSession(session);
 applyQuality();menu.refresh();
 let lastT=0;const tmpS=new THREE.Vector3(); // scroll: previous frame time, parent scale
 const color=new THREE.Color(),tmpP=new THREE.Vector3(),tmpQ=new THREE.Vector3(),tmpN=new THREE.Vector3(),tmpE=new THREE.Vector3(),tmpD=new THREE.Vector3();
 // GPU time per pass (EXT_disjoint_timer_query_webgl2, when offered) and JS
 // time per frame, averaged over the fps window
 const gl=renderer.getContext(),timerExt=gl.getExtension('EXT_disjoint_timer_query_webgl2');
 const pending=[],sums={vol:0,main:0,js:0},counts={vol:0,main:0,js:0},ctrl={vol:0,main:0},ctrlN={vol:0,main:0};let sizes='';
 const timed=(kind,fn)=>{
  if(!timerExt||pending.length>12){fn();return}
  const q=gl.createQuery();gl.beginQuery(timerExt.TIME_ELAPSED_EXT,q);fn();gl.endQuery(timerExt.TIME_ELAPSED_EXT);pending.push({q,kind});
 };
 const pollTimers=()=>{
  while(pending.length){
   const {q,kind}=pending[0];
   if(!gl.getQueryParameter(q,gl.QUERY_RESULT_AVAILABLE))break;
   pending.shift();
   if(!gl.getParameter(timerExt.GPU_DISJOINT_EXT)){const ms=gl.getQueryParameter(q,gl.QUERY_RESULT)/1e6;sums[kind]+=ms;counts[kind]++;if(kind in ctrl){ctrl[kind]+=ms;ctrlN[kind]++}}
   gl.deleteQuery(q);
  }
 };
 const avg=k=>counts[k]?(sums[k]/counts[k]).toFixed(1):'–';
 // screenshot: the left eye's view rendered again at full resolution into
 // an offscreen target (menu and controller rays hidden), read back as PNG
 const takeScreenshot=()=>{
  const sub=renderer.xr.getCamera().cameras[0];if(!sub||!mesh)return;
  const v=sub.viewport,W=1600,H=Math.max(1,Math.round(W*v.w/Math.max(1,v.z)));
  const rt=new THREE.WebGLRenderTarget(W,H),prev=renderer.getRenderTarget(),hidden=[menu.mesh,badge,panel.mesh,help.mesh,...controllers.map(c=>c.userData.ray)].filter(o=>o.visible);
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
 // lazy follow (build 345 / 367): a board moves back in front once the head
 // has turned well away or it is far off; returns the new 'moving' state
 const lazyFollow=(m,target,moving,hold)=>{
  tmpD.subVectors(m.position,head);tmpD.y=0;
  const ang=tmpD.lengthSq()>1e-6?tmpD.normalize().angleTo(tmpE.subVectors(target,head).setY(0).normalize()):0;
  if(ang>0.6||m.position.distanceTo(target)>0.45)moving=true;
  if(moving&&!hold){m.position.lerp(target,0.08);m.lookAt(head);if(m.position.distanceTo(target)<0.01)moving=false}
  return moving;
 };
 // samples per pixel (build 369): the loop-count diagnostic drawn to a 48×48
 // target from the left eye once a second while 詳細 is open, averaged over
 // the covered pixels (8-bit: steps of 4 samples)
 const probeTarget=new THREE.WebGLRenderTarget(48,48,{depthBuffer:false}),probePx=new Uint8Array(48*48*4);
 const measureSamples=()=>{
  if(!mesh||!material||!rayMesh)return;
  const sub=renderer.xr.getCamera().cameras[0]||camera,prev=renderer.getRenderTarget(),wasXr=renderer.xr.enabled,d0=material.uniforms.diag.value,clearC=renderer.getClearColor(new THREE.Color()),clearA=renderer.getClearAlpha();
  material.uniforms.diag.value=2;renderer.xr.enabled=false;renderer.setRenderTarget(probeTarget);renderer.setClearColor(0x000000,0);renderer.clear();
  scene.updateMatrixWorld();rayMesh.matrixWorld.copy(mesh.matrixWorld);renderer.render(volScene,sub);renderer.readRenderTargetPixels(probeTarget,0,0,48,48,probePx);
  renderer.setRenderTarget(prev);renderer.xr.enabled=wasXr;material.uniforms.diag.value=d0;renderer.setClearColor(clearC,clearA);
  let sum=0,n=0;for(let i=0;i<probePx.length;i+=4)if(probePx[i+3]>0){sum+=probePx[i]/255*1024;n++}
  ui.sampleLine=n?L.samples+(sum/n).toFixed(0)+L.samplesNote:'';
 };
 renderer.setAnimationLoop(()=>{
  const js0=performance.now();if(timerExt)pollTimers();
  const dt=lastT?Math.min(0.05,(js0-lastT)/1000):0;lastT=js0;
  readHead();frameNo++;
  if(!poseAt&&poseOk())poseAt=frameNo;
  if(!menuPlaced&&poseAt)placeMenuNow();
  if(placePending&&poseAt){placePending=false;bringVolumeFront();ui.placeLine=(ja?'初期配置: 姿勢取得 フレーム ':'placed: pose at frame ')+poseAt+(ja?' / 配置 フレーム ':' / placed at frame ')+frameNo+(ja?' / 頭の高さ ':' / head height ')+head.y.toFixed(2)+' m';if(ui.tab===4)menu.refresh()}
  // lazy follow: move back in front once the head has turned well away
  if(ui.open&&settings.menuMode===0&&!menuHeld){computeMenuTarget();menuMoving=lazyFollow(menu.mesh,menuTarget,menuMoving,!!dragging)}
  help.mesh.visible=(settings.help|0)>0;
  if(help.mesh.visible&&!helpPlaced&&poseAt)placeHelpNow();
  if(help.mesh.visible&&settings.help===1&&!helpHeld){computeHelpTarget();helpMoving=lazyFollow(help.mesh,helpTarget,helpMoving,false)}
  if(twoHand){const s=Math.min(20,Math.max(0.025,twoHand.s0*handDist()/twoHand.d0));holder.scale.setScalar(s)}
  let hover=-1,panelHover=-1,scroll=0;const hoverIds=new Set();
  panel.mesh.visible=section.on&&planes.length>0;
  for(const c of controllers){
   // ray priority: the nearest board (menu, menu tag, section panel, help; build 404), then a section frame, then the volume
   const bd=boardHits(c),h=bd.menu,bh=bd.badge,ph=bd.panel,hh=bd.help,rp=h||bh||ph||hh?null:rayPlane(c),vh=h||bh||ph||hh||rp?null:volumeHit(c),ray=c.userData.ray,sh=h||bh||ph||hh?null:sectionPointOf(c);c.userData.secHit=sh;
   // build 464: an existing point under the laser (drawn spheres, world space); boards and section frames come first, as for the trigger
   const pt=h||bh||ph||hh||rp?null:(setRay(c),vpMarkers.pick(raycaster.ray.origin,raycaster.ray.direction));c.userData.ptHit=pt;if(pt)hoverIds.add(pt.id);c.userData.rayPlane=rp?.pl||null;c.userData.helpHit=!!hh;c.userData.volHit=vh;
   // build 397: the one frame this hand's button would take, the same rule the press uses;
   // build 399: the frame the laser points at wins, the nearest frame (guide line) only when the ray hits none
   const np=h||bh||ph||hh||rp||c.userData.heldPlane?null:nearestPlane(c);c.userData.target=h||bh||ph||hh||c.userData.heldPlane?null:c.userData.rayPlane||np;
   const gd=c.userData.guide;gd.visible=!!np;gd.material.color.setHex(handColor(c));if(np){const a=gd.geometry.attributes.position;c.getWorldPosition(tmpA);np.handle.getWorldPosition(tmpB);a.setXYZ(0,tmpA.x,tmpA.y,tmpA.z);a.setXYZ(1,tmpB.x,tmpB.y,tmpB.z);a.needsUpdate=true}
   const hc=handColor(c),hit=h||bh||ph||hh||pt||sh||rp||vh,dot=c.userData.dot;ray.material.color.setHex(hc);dot.material.color.setHex(hc);dot.visible=!!hit;dot.scale.setScalar(sh&&!pt?1.8:1); // the tip of a laser on a section is the place that would be recorded (bigger dot)
   
   if(hit){ray.scale.z=hit.distance;ray.material.opacity=1;setRay(c);raycaster.ray.at(hit.distance,dot.position);if(h){const i=menu.hit(h.uv);if(i>=0)hover=i}if(ph){const i=panel.hit(ph.uv);if(i>=0)panelHover=i}}
   else{ray.scale.z=0.6;ray.material.opacity=0.35}
   // thumbstick Y (xr-standard axes[3], up is negative), dead zone 0.15, squared response; both hands add up
   const ay=c.userData.source?.gamepad?.axes?.[3]||0,am=Math.abs(ay);if(am>0.15)scroll+=Math.sign(ay)*((am-0.15)/0.85)**2;
   if(dragging?.c===c){setRay(c);const hh=raycaster.intersectObject(menu.mesh,false)[0];if(hh)menu.drag(dragging.i,hh.uv)}
   // xr-standard buttons: 4 = A/X toggles the menu, 5 = B/Y the section
   const bt=c.userData.source?.gamepad?.buttons;
   const a=!!bt?.[4]?.pressed;if(a&&!c.userData.aDown)setMenuOpen(!ui.open);c.userData.aDown=a;
   // build 464: the thumbstick (axes 2 / 3) only feeds the recording gate; its click (button 3) is unused again
   c.userData.gate.update(c.userData.source?.gamepad?.axes?.[2]||0,ay,performance.now());
   // B/Y: short press shows / hides the sections, long press adds one
   const b=!!bt?.[5]?.pressed,nowB=performance.now();
   if(b&&!c.userData.bDown){c.userData.bAt=nowB;c.userData.bLong=false;c.add(ring);ring.visible=true}
   if(b&&!c.userData.bLong){const f=Math.min(1,(nowB-c.userData.bAt)/LONG_PRESS);ringGeo.setDrawRange(0,Math.max(2,Math.round(f*33)));
    if(f>=1){c.userData.bLong=true;ring.visible=false;if(planes.length>=MAX_PLANES){pulse(c,0.15,30);ui.flash=L.maxPlanes;ui.flashUntil=nowB+2000;menu.refresh()}else{addPlane(c);pulse(c,0.6,50)}}}
   if(!b&&c.userData.bDown){if(ring.parent===c)ring.visible=false;if(!c.userData.bLong)setSection(!section.on)}
   c.userData.bDown=b;
  }
  menu.setHover(hover);panel.setHover(panelHover);
  // build 423: faint label of what each laser points at (not when that result is already pinned); pinned labels follow the volume
  {const on=labelMode()&&!diagAn.noLabels;if(on||pins.size)readHead();anBenchTick();
   for(const c of controllers){const hit=on?c.userData.volHit:null;if(hit&&!(hit.id&&pins.has(hit.id))){const lb=hoverLabelOf(c);drawLabel(lb,hit,true);lb.anchor.copy(hit.local);placeLabel(lb)}else hideLabel(c.userData.hoverLabel)}
   for(const lb of pins.values())placeLabel(lb)}
  // thumbstick scroll (build 364): the selected plane along its own normal, same world speed fixed in the scaled holder or held
  const sp=section.selected;
  if(section.on&&sp&&scroll&&dt){const ps=sp.obj.parent?sp.obj.parent.getWorldScale(tmpS).x||1:1;sp.obj.translateX(-scroll*SCROLL_SPEED*dt/ps)}
  // frame: own colour; a glow band in the hand's colour while held or while that hand's button would take it
  if(section.on){const glowBy=new Map();for(const c of controllers){const pl=c.userData.heldPlane||c.userData.target;if(pl&&!glowBy.has(pl))glowBy.set(pl,handColor(c))}for(const pl of planes){const gc=glowBy.get(pl);pl.glow.visible=gc!==undefined;if(gc!==undefined)pl.glow.material.color.setHex(gc)}}
  const st=section.on?(controllers.some(c=>c.userData.heldPlane)?L.stHeld:L.stFixed):L.stNone;
  if(mesh&&st!==ui.status){ui.status=st;menu.refresh()}
  if(material){
   const u=material.uniforms;
   // planes in the volume's object space. 'near': the normal is flipped so
   // the eye is on the removed side; 'one side': the plane's chosen side
   // stays removed wherever the viewer goes
   let n=0,cutBits=0;
   if(section.on){scene.updateMatrixWorld();tmpE.copy(head);mesh.worldToLocal(tmpE);
    for(const pl of planes){
     pl.obj.getWorldPosition(tmpP);tmpN.set(1,0,0).transformDirection(pl.obj.matrixWorld);
     tmpQ.copy(tmpP).add(tmpN);mesh.worldToLocal(tmpP);mesh.worldToLocal(tmpQ);tmpN.subVectors(tmpQ,tmpP).normalize();
     if(settings.cut===2){if(pl.side<0)tmpN.negate()}else if(tmpN.dot(tmpE)-tmpN.dot(tmpP)>0)tmpN.negate();
     pl.arrow.visible=settings.cut===2&&pl.cut;pl.arrow.scale.x=-pl.side;
     u.cutPlanes.value[n].set(tmpN.x,tmpN.y,tmpN.z,tmpN.dot(tmpP));if(pl.cut&&settings.cut)cutBits|=1<<n;n++;
    }}
   if(bench.noSection){n=0;cutBits=0}
   u.planeCount.value=n;u.planeCut.value=cutBits;u.capOn.value=settings.cap?1:0;u.sliceTint.value=+settings.sliceTint||0;u.sliceOpacity.value=section.on&&!bench.noSection?settings.sliceOpacity:0;
   u.sliceWindow.value.set(vrWindow.c,Math.max(1,vrWindow.w));u.sliceAir.value=Number.isFinite(+settings.sliceAir)?+settings.sliceAir:-500;
   for(let i=0;i<4;i++){
    const key=SEGMENT_PRESET_ORDER[i],seg=segmentState[key];
    u.segA.value[i].set(seg?.min||0,seg?.max||0,segOpacity[key]??1,seg?.active&&seg?.enabled&&segMode[key]!==2?1:0);
    color.set(seg?.color||'#ffffff');u.segC.value[i].set(color.r,color.g,color.b,segMode[key]===1?1:0);
   }
   refreshCombo();
  }
  benchTick();
  {const nowH=performance.now();if(nowH-vpHiddenAt>=100)updateHidden(nowH);
   // the active section = the selected one while sections are on, as the shader's plane (object space, unit normal, same index as planes)
   let secPl=null;if(section.on&&section.selected&&material&&!bench.noSection){const i=planes.indexOf(section.selected);if(i>=0&&i<material.uniforms.planeCount.value){const q=material.uniforms.cutPlanes.value[i];secPl={x:q.x,y:q.y,z:q.z,w:q.w}}}
   vpMarkers.update({fingerprint:vrFp,dims:vrDims,halfExt:vrHalfExt,mesh:mesh?.parent?mesh:null,head,hidden:vpHidden,section:secPl,selectedId:vpSel,hover:hoverIds})}
  // auto: frame interval from the XR loop, checked twice a second
  const auto=!VRES[settings.vres];
  if(auto){
   autoFrames++;const nowA=performance.now();
   if(nowA-autoAt>=500){
    const interval=(nowA-autoAt)/autoFrames,budget=1000/(targetRate()||72);
    const volMs=ctrlN.vol?ctrl.vol/ctrlN.vol:0,mainMs=ctrlN.main?ctrl.main/ctrlN.main:0;
    if(mainMs>0){
     // build 370: GPU-timed control. The frame interval is quantised by the
     // display (a small overrun shows as a halved rate), so the factor now
     // follows the measured GPU time: pixel cost ∝ f², target = 80 % of the
     // budget minus the rest of the frame; damped (×0.7 … ×1.15 per step)
     let want;
     if(autoF>=1||volMs<=0){const total=mainMs;want=total>budget*0.8?autoF*Math.sqrt(budget*0.8/total):(autoF<1?autoF*1.15:1)}
     else{const target=Math.max(1,budget*0.8-mainMs);want=autoF*Math.sqrt(target/volMs)}
     let next=want<autoF?Math.max(want,autoF*0.7):Math.min(want,autoF*1.15);
     if(interval>budget*1.5)next=Math.min(next,autoF*0.85); // frames are being dropped anyway
     autoF=Math.min(AUTO_MAX,Math.max(AUTO_MIN,next));
     ui.autoLine=(ja?'自動: GPU ボリューム ':'auto: GPU volume ')+volMs.toFixed(1)+' ms · '+(ja?'本描画 ':'main ')+mainMs.toFixed(1)+' ms / '+(ja?'予算 ':'budget ')+budget.toFixed(1)+' ms → '+Math.round(autoF*100)+'%';
    }else{
     if(interval>budget*1.12)autoF=Math.max(AUTO_MIN,autoF*Math.min(0.92,Math.sqrt(budget/interval)));
     else if(interval<budget*1.04)autoF=Math.min(AUTO_MAX,autoF*1.15); // build 395: 1.06 → 1.15 per half second (50 % → 100 % in about 2.5 s instead of 6)
     ui.autoLine=(ja?'自動（間隔）: ':'auto (interval): ')+interval.toFixed(1)+' ms / '+budget.toFixed(1)+' ms → '+Math.round(autoF*100)+'%';
    }
    ctrl.vol=ctrl.main=0;ctrlN.vol=ctrlN.main=0;autoFrames=0;autoAt=nowA;
   }
  }
  const f=auto?autoF:(VRES[settings.vres]??1);
  // build 424: the same variants without VRL_REGIONS (sharing the uniforms), built on first use by the analysis bench
  let plain=null;
  const plainSets=()=>{if(!plain){const base=material.clone();base.uniforms=material.uniforms;base.defines={};const vars=materialVariants(base);plain={vars,ray:{full:rayMaterialOf(vars.full),combined:rayMaterialOf(vars.combined),noEvents:rayMaterialOf(vars.noEvents)}}}return plain};
  const variantKey=()=>{const u=material.uniforms;if(!(u.distInCls.value>0&&u.useCls.value>0)||(settings.diag|0))return 'full';return u.planeCount.value===0?'noEvents':'combined'};
  if(mesh){
   if(f<1){
    // own pass per eye into the small target, then the composite material
    // on the same box upscales it inside the main XR render
    const xrTarget=renderer.getRenderTarget(),w=xrTarget?.width||1,h=xrTarget?.height||1;
    renderer.xr.updateCamera(camera);const xrCam=renderer.xr.getCamera();
    // auto: one target at the largest factor, only the viewports shrink
    // build 371: the target grows to the factor in use (never shrinks) instead of being allocated at the maximum
    const tw0=Math.max(1,Math.ceil(w*f)),th0=Math.max(1,Math.ceil(h*f));
    if(!lowTarget)lowTarget=new THREE.WebGLRenderTarget(tw0,th0,{depthBuffer:false,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter});
    else if(lowTarget.width<tw0||lowTarget.height<th0)lowTarget.setSize(Math.max(lowTarget.width,tw0),Math.max(lowTarget.height,th0));
    const tw=lowTarget.width,th=lowTarget.height;
    scene.updateMatrixWorld();rayMesh.matrixWorld.copy(mesh.matrixWorld);rayMesh.material=(diagAn.noRegion?plainSets().ray:rayVariants)[variantKey()];
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
   }else{mesh.material=(diagAn.noRegion?plainSets().vars:variants)[variantKey()];const t=renderer.getRenderTarget();sizes=(ja?'直接描画 ':'direct ')+'XR '+(t?.width||0)+'×'+(t?.height||0)}
   if(firstDrawMs<0)firstDrawMs=performance.now()-sessionAt;
  }
  menu.flush();
  // section panel (build 365): redrawn when its state changes (no refresh at every call site); flush is a no-op when clean
  const pk=[section.on,planes.length,planes.indexOf(sp),sp?.cut,sp?.side,settings.cut,planeAxis(sp)].join();
  if(pk!==panelKey){panelKey=pk;panel.refresh();if(ui.tab===1)menu.refresh()} // the 断面 tab's snap buttons follow too
  panel.flush();
  const hk=[section.on,ui.open,settings.secHold].join();if(hk!==helpKey){helpKey=hk;help.refresh()}help.flush();
  sums.js+=performance.now()-js0;counts.js++;
  timed('main',()=>renderer.render(scene,camera));
  if(shotRequested){shotRequested=false;try{takeScreenshot()}catch(e){console.error(e)}}
  frames++;const now=performance.now();
  if(now-fpsAt>=1000){
   fps=frames*1000/(now-fpsAt);frames=0;fpsAt=now;
   ui.fpsLine=(firstDrawMs>=0?(ja?'初回描画 ':'first draw ')+Math.round(firstDrawMs)+' ms · ':'')+fps.toFixed(0)+' fps · '+(ja?'ボリューム ':'volume ')+avg('vol')+' ms · '+(ja?'本描画 ':'main ')+avg('main')+' ms · JS '+avg('js')+' ms'+(timerExt?'':(ja?'（GPU計測なし）':' (no GPU timer)'));
   ui.sizeLine=sizes+' · ×'+holder.scale.x.toFixed(2)+' · '+info;
   if(ui.tab===4)try{measureSamples()}catch(e){console.warn(e)}
   if(ui.tab===4||ui.flash)menu.refresh();
   if(ui.flash&&now>ui.flashUntil)ui.flash='';
   for(const k in sums){sums[k]=0;counts[k]=0}
  }
 });
 const cleanup=()=>{
  renderer.setAnimationLoop(null);
  probeTarget.dispose();volTex?.dispose();brickTex?.dispose();comboT?.combo?.dispose();disposeExtra();disposeEdits();material?.dispose();if(variants){variants.combined.dispose();variants.noEvents.dispose()}if(rayVariants)Object.values(rayVariants).forEach(m=>m.dispose());gpu?.warm.forEach(m=>m.dispose());compMaterial?.dispose();lowTarget?.dispose();mesh?.geometry.dispose();menu.dispose();panel.dispose();help.dispose();badge.userData.dispose();
  background.traverse(o=>{o.geometry?.dispose();o.material?.dispose()});planes.forEach(disposePlane);unsubComments();vpMarkers.dispose();ringGeo.dispose();ring.material.dispose();
  renderer.dispose();renderer.domElement.remove();running=null;
  showShotsPanel(ja);showBenchPanel(ja);
 };
 session.addEventListener('end',cleanup,{once:true});
 try{
  // prepared before the session (or now, if the data changed meanwhile)
  const P=await prepareVrData(({phase,done,total})=>{ui.status=L.preparing+(phase==='read'?done+' / '+total:phase);menu.refresh()});
  const vd=P.vd;
  if(!running)return;
  vrHalfExt=vd.halfExt;vrDims=activeSeries?{columns:activeSeries.columns,rows:activeSeries.rows,slices:activeSeries.slices.length}:null;vrFp=activeSeries?datasetFingerprint(activeSeries):null;
  const makeTextures=makeVolumeTextures;
  if(gpu&&gpu.key!==P.key){disposeGpuPrepared();}
  // classification texture from the prepared bytes (only on the ≤256 grid)
  // build 402: classification bytes for the laser's volume hit (the ≤256 grid they were built on)
  volPick=P.cls?{cls:P.cls,dims:(P.half||vd).dims,halfExt:vd.halfExt,ids:P.region?.ids&&P.region.dims.join()===(P.half||vd).dims.join()?P.region.ids:null}:null;regionList=P.region?.list||[];
  const clsTexture=t=>{
   const c=P.cls;if(!c||(P.half||vd).dims.join()!==t.dims.join())return null;
   const x=new THREE.Data3DTexture(c.data,...t.dims);x.format=c.C===1?THREE.RedFormat:c.C===2?THREE.RGFormat:THREE.RGBAFormat;x.userData.chan=c.chan;x.type=THREE.UnsignedByteType;x.minFilter=x.magFilter=THREE.LinearFilter;x.unpackAlignment=1;x.needsUpdate=true;
   return x;
  };
  // distance field texture (build 369), same grid and channels as the classification, nearest sampling
  const distTexture=t=>{
   const c=P.dist;if(!c||(P.half||vd).dims.join()!==t.dims.join())return null;
   const x=new THREE.Data3DTexture(c.data,...t.dims);x.format=c.C===1?THREE.RedFormat:c.C===2?THREE.RGFormat:THREE.RGBAFormat;x.type=THREE.UnsignedByteType;x.minFilter=x.magFilter=THREE.NearestFilter;x.unpackAlignment=1;x.needsUpdate=true;
   return x;
  };
  const full=(gpu&&gpu.key===P.key&&gpu.full)||makeTextures(vd);let half=(gpu&&gpu.key===P.key&&gpu.half)||null;volTex=full.v;brickTex=full.b;
  // 512 / 256 data (256 made on first use, kept for the session)
  useData=i=>{
   const t=i===1&&P.half?(half||=makeTextures(P.half)):full;
   material.uniforms.vol.value=t.v;material.uniforms.bricks.value=t.b;material.uniforms.texDims.value.set(...t.dims);material.uniforms.brickDims.value.set(...t.brickDims);
   info=t.dims.join('×')+(vd.filtered?L.filtered:'');
   // classification only on grids of at most 256 (512³ × 4 bytes is too big);
   // built on first use from this grid's data and the processing mask
   if(Math.max(...t.dims)<=256&&!t.cls&&!(settings.clsDiag|0))t.cls=clsTexture(t);
   const on=!!t.cls&&!(settings.clsDiag|0);
   material.uniforms.useCls.value=on?1:0;material.uniforms.clsTex.value=t.cls||dummyEdit;if(t.cls)material.uniforms.clsChan.value.set(...t.cls.userData.chan);
   // sphere tracing needs the classification grid (the distances describe its boundaries)
   // build 395: the separate field texture (67 MB at 256³) is uploaded only when the combined texture cannot serve (four segments stored)
   const comboOk=on&&P.cls&&P.dist&&!P.cls.chan.some(c=>c>=3);
   if(on&&!t.dist&&P.dist&&!comboOk)t.dist=distTexture(t);
   const onD=on&&(comboOk||!!t.dist)&&!(settings.distDiag|0);
   material.uniforms.useDist.value=onD?1:0;material.uniforms.distTex.value=t.dist||dummyEdit;material.uniforms.voxelMin.value=Math.min(2*vd.halfExt[0]/t.dims[0],2*vd.halfExt[1]/t.dims[1],2*vd.halfExt[2]/t.dims[2]);
   // build 384: classification + combined distance in one RGBA texture (needs a free channel: at most three segments stored)
   comboT=onD&&comboOk?t:null;comboMask=-1;refreshCombo();
   refreshEdits();
  };
  // the alpha depends on which segments are shown: rebuilt (about 0.2 s at 256³) when that set changes
  refreshCombo=()=>{
   const t=comboT;
   if(!t){material.uniforms.distInCls.value=0;return}
   const mask=shownMask();
   if(mask===comboMask)return;
   // prepared on the page for this mask (build 393): no rebuild, no upload
   if(t.combo&&t.comboMask===mask){comboMask=mask;material.uniforms.clsTex.value=t.combo;material.uniforms.clsChan.value.set(...P.cls.chan);material.uniforms.distInCls.value=1;return}
   comboMask=mask;
   const data=combineClassificationDistance(P.cls,P.dist,mask,t.combo?.image?.data||null);
   if(!data){material.uniforms.distInCls.value=0;return}
   if(!t.combo)t.combo=makeComboTexture(data,t.dims);
   t.combo.needsUpdate=true;t.comboMask=mask;
   material.uniforms.clsTex.value=t.combo;material.uniforms.clsChan.value.set(...P.cls.chan);material.uniforms.distInCls.value=1;
  };
  // processed segments: built once when VR starts (edits cannot change in
  // VR), on a grid of at most 256 per side (texture coordinates are
  // normalised, so it serves both data sizes); the filter follows the
  // diagnostic setting (0 smooth, 1 nearest, 2 off)
  const dummyEdit=new THREE.Data3DTexture(new Uint8Array(4),1,1,1);dummyEdit.format=THREE.RGBAFormat;dummyEdit.needsUpdate=true;
  const editTex=(gpu&&gpu.key===P.key&&gpu.edit)||makeEditTexture(P),editActive=P.edit.active;
  const regionTex=(gpu&&gpu.key===P.key&&gpu.region)||makeRegionTexture(P),regionColors=P.region?.colors||[],regionSegs=P.region?.segs||[];
  refreshEdits=()=>{
   if(!material)return;const mode=settings.editDiag|0;
   if(editTex){const f=mode===1?THREE.NearestFilter:THREE.LinearFilter;if(editTex.minFilter!==f||!editTex.userData.up){editTex.minFilter=editTex.magFilter=f;editTex.needsUpdate=true;editTex.userData.up=true}}
   material.uniforms.editMask.value=mode===2?0:editActive;material.uniforms.editMaskOnly.value=mode===2?0:(P.edit.maskOnly|0);material.uniforms.editTex.value=editTex||dummyEdit;
   // build 409: analysis result colours
   material.uniforms.regionTex.value=regionTex||dummyEdit;regionColors.forEach((c,i)=>{color.setHex(c);material.uniforms.regionC.value[i].set(color.r,color.g,color.b);material.uniforms.regionSeg.value[i]=regionSegs[i]|0});
  };
  disposeEdits=()=>{editTex?.dispose();regionTex?.dispose();dummyEdit.dispose()};
  disposeExtra=()=>{half?.v.dispose();half?.b.dispose();half?.cls?.dispose();half?.dist?.dispose();half?.combo?.dispose();full.cls?.dispose();full.dist?.dispose();full.combo?.dispose()};
  material=new THREE.ShaderMaterial({glslVersion:THREE.GLSL3,vertexShader,fragmentShader,side:THREE.BackSide,toneMapped:false,uniforms:volumeUniforms(vd,full,settings),defines:P.region?.data?{VRL_REGIONS:''}:{}});
  material.uniforms.clsTex.value=dummyEdit;material.uniforms.editTex.value=dummyEdit;material.uniforms.distTex.value=dummyEdit;
  material.transparent=true;material.depthWrite=false;material.blending=THREE.CustomBlending;material.blendSrc=THREE.OneFactor;material.blendDst=THREE.OneMinusSrcAlphaFactor;
  // build 393: variants without the unused loops, chosen per frame (same uniforms)
  variants=materialVariants(material);
  // BackSide: rays start at the eye when the head is inside the box
  mesh=new THREE.Mesh(new THREE.BoxGeometry(2,2,2),material);mesh.frustumCulled=false;
  compMaterial=new THREE.ShaderMaterial({glslVersion:THREE.GLSL3,vertexShader:compositeVertex,fragmentShader:compositeFragment,side:THREE.BackSide,toneMapped:false,depthWrite:false,transparent:true,
   blending:THREE.CustomBlending,blendSrc:THREE.OneFactor,blendDst:THREE.OneMinusSrcAlphaFactor,uniforms:{img:{value:null},invSize:{value:new THREE.Vector2(1,1)},halfExt:{value:new THREE.Vector3(...vd.halfExt)}}});
  // the offscreen target is cleared to 0 and written with plain premultiplied
  // colour (no blending needed inside the volume pass)
  rayVariants={full:rayMaterialOf(variants.full),combined:rayMaterialOf(variants.combined),noEvents:rayMaterialOf(variants.noEvents)};
  rayMesh=new THREE.Mesh(mesh.geometry,rayVariants.full);
  rayMesh.matrixAutoUpdate=false;rayMesh.matrixWorldAutoUpdate=false;rayMesh.frustumCulled=false;volScene.add(rayMesh);
  // app units (longest side 3.3) -> 0.3 m in VR, placed in front of the head
  mesh.renderOrder=1;holder.add(mesh);baseStep=vd.step;applyQuality();placePending=true;
  ui.status=L.stNone;menu.refresh();
 }catch(e){
  console.error(e);ui.status=L.failed+String(e.message||e).slice(0,40);menu.refresh();
 }
}
