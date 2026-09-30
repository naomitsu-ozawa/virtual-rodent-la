
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
 return texture(editTex,clamp(tc,vec3(0.0),vec3(0.999999)))[s]>=0.5;
}
// precomputed classification (build 356): per segment, 0.5 + (HU distance
// inside its range)/2048, folded with the processing mask, one byte each.
// The trilinear value crosses 0.5 where the HU crosses the threshold (linear
// map), so one fetch replaces HU decode + range test + mask fetch.
uniform int useCls;
uniform sampler3D clsTex;
uniform ivec4 clsChan; // channel of each segment (-1: none); only active segments are stored
int segmentIndexAt(vec3 tc){
 if(useCls>0){
  vec4 q=texture(clsTex,clamp(tc,vec3(0.0),vec3(0.999999)));
  for(int s=0;s<4;s++){int c=clsChan[s];if(c>=0&&segA[s].w>0.5&&q[c]>=0.5)return s;}
  return -1;
 }
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
vec3 sliceColor(vec3 p){
 float g=sliceGray(p);
 if(sliceTint>0.0){int si=segmentIndexAt(texCoord(p));if(si>=0)return mix(vec3(g),segC[si].rgb,sliceTint);}
 return vec3(g);
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
 for(int iter=0;iter<4096;iter++){
  if(t>endT||acc.a>0.985)break;
  iters++;
  while(nextSlice<nSlice&&sliceT[nextSlice]<=t+step){
   // a slice lies before the next sample: composite it in depth order
   vec3 sc=sliceColor(o+dir*sliceT[nextSlice]);nextSlice++;
   float contribution=(1.0-acc.a)*sliceOpacity;acc=vec4(acc.rgb+sc*contribution,acc.a+contribution);
  }
  if(capT>=0.0){
   // cut face: flat, segment colour lightened, lit by the plane normal
   int ci=segmentIndexAt(texCoord(o+dir*capT));capT=-1.0;
   if(ci>=0){
    vec3 n=cutPlanes[capPlane].xyz;vec3 viewDir=-dir;vec3 lightDir=normalize(viewDir+vec3(0.35,0.5,0.25));
    float diffuse=0.28+0.72*abs(dot(n,lightDir));
    vec3 lit=mix(segC[ci].rgb,vec3(1.0),0.22)*diffuse;
    float contribution=(1.0-acc.a)*clamp(segA[ci].z,0.03,1.0);acc=vec4(acc.rgb+lit*contribution,acc.a+contribution);
    lastIndex=ci;previousT=t;t+=step;continue;
   }
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
 while(nextSlice<nSlice&&acc.a<=0.985){
  vec3 sc=sliceColor(o+dir*sliceT[nextSlice]);nextSlice++;
  float contribution=(1.0-acc.a)*sliceOpacity;acc=vec4(acc.rgb+sc*contribution,acc.a+contribution);
 }
 if(diag==2){float h=clamp(float(iters)/1024.0,0.0,1.0);outColor=vec4(h,1.0-abs(h*2.0-1.0),1.0-h,1.0);return;}
 if(acc.a<0.004)discard;
 // premultiplied, blended over the VR background (raw colour like the
 // WebGPU canvas: no colour-space conversion)
 outColor=acc;
}