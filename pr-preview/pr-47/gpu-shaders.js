// Extracted verbatim from app.js by tools/extract-module.mjs.
// Self-contained: depends only on the imports below (no module state).
export function gpuFilterShader(kind,workgroupSize){
 const header=`
@group(0) @binding(0) var<storage, read> src: array<f32>;
@group(0) @binding(1) var<storage, read_write> dst: array<f32>;
@group(0) @binding(2) var<storage, read> meta: array<u32>;
@group(0) @binding(3) var<storage, read> params: array<f32>;
fn coord(i:u32)->vec3<u32>{
 let w=meta[0];let h=meta[1];let plane=w*h;
 return vec3<u32>(i%w,(i/w)%h,i/plane);
}
fn idx(x:u32,y:u32,z:u32)->u32{return z*meta[0]*meta[1]+y*meta[0]+x;}
fn cidx(x:i32,y:i32,z:i32)->u32{
 let xx=u32(clamp(x,0,i32(meta[0])-1));let yy=u32(clamp(y,0,i32(meta[1])-1));let zz=u32(clamp(z,0,i32(meta[2])-1));
 return idx(xx,yy,zz);
}
`;
 if(kind==='gaussian')return header+`
@compute @workgroup_size(${workgroupSize})
fn main(@builtin(global_invocation_id) gid:vec3<u32>){
 let i=gid.x;if(i>=meta[3]){return;}let c=coord(i);let w=meta[0];let h=meta[1];let d=meta[2];let axis=meta[4];
 var x0=c.x;var x1=c.x;var y0=c.y;var y1=c.y;var z0=c.z;var z1=c.z;
 if(axis==0u){x0=select(c.x-1u,0u,c.x==0u);x1=min(w-1u,c.x+1u);}
 if(axis==1u){y0=select(c.y-1u,0u,c.y==0u);y1=min(h-1u,c.y+1u);}
 if(axis==2u){z0=select(c.z-1u,0u,c.z==0u);z1=min(d-1u,c.z+1u);}
 let a=src[idx(x0,y0,z0)];let b=src[i];let cc=src[idx(x1,y1,z1)];
 let blur=(a+2.0*b+cc)*0.25;let s=params[0];dst[i]=b*(1.0-s)+blur*s;
}`;
 if(kind==='median')return header+`
@compute @workgroup_size(${workgroupSize})
fn main(@builtin(global_invocation_id) gid:vec3<u32>){
 let i=gid.x;if(i>=meta[3]){return;}let c=coord(i);let w=meta[0];let h=meta[1];let d=meta[2];
 if(c.x==0u){dst[i]=src[i];return;}if(c.y==0u){dst[i]=src[i];return;}if(c.z==0u){dst[i]=src[i];return;}if(c.x+1u>=w){dst[i]=src[i];return;}if(c.y+1u>=h){dst[i]=src[i];return;}if(c.z+1u>=d){dst[i]=src[i];return;}
 let plane=w*h;var vals:array<f32,7>;
 vals[0]=src[i];vals[1]=src[i-1u];vals[2]=src[i+1u];vals[3]=src[i-w];vals[4]=src[i+w];vals[5]=src[i-plane];vals[6]=src[i+plane];
 for(var q:u32=1u;q<7u;q=q+1u){
  let v=vals[q];var j=i32(q)-1;
  loop{
   if(j<0){break;}if(vals[u32(j)]<=v){break;}
   vals[u32(j+1)]=vals[u32(j)];j=j-1;
  }
  vals[u32(j+1)]=v;
 }
 let s=params[0];dst[i]=src[i]*(1.0-s)+vals[3]*s;
}`;
 if(kind==='sigmoid')return header+`
@compute @workgroup_size(${workgroupSize})
fn main(@builtin(global_invocation_id) gid:vec3<u32>){
 let i=gid.x;if(i>=meta[3]){return;}let minv=params[0];let maxv=params[1];let strength=params[2];let centerValue=clamp(params[3],minv,maxv);
 let range=max(1.0,maxv-minv);let gain=2.0+strength*10.0;let center=(centerValue-minv)/range;
 let lo=1.0/(1.0+exp(gain*center));let hi=1.0/(1.0+exp(-gain*(1.0-center)));let norm=max(0.000001,hi-lo);
 let x=clamp((src[i]-minv)/range,0.0,1.0);let y=(1.0/(1.0+exp(-gain*(x-center)))-lo)/norm;
 dst[i]=minv+clamp(y,0.0,1.0)*range;
}`;
 if(kind==='spikeHole')return header+`
@compute @workgroup_size(${workgroupSize})
fn main(@builtin(global_invocation_id) gid:vec3<u32>){
 let i=gid.x;if(i>=meta[3]){return;}let c=coord(i);let w=meta[0];let h=meta[1];let d=meta[2];
 if(c.x==0u){dst[i]=src[i];return;}if(c.y==0u){dst[i]=src[i];return;}if(c.z==0u){dst[i]=src[i];return;}if(c.x+1u>=w){dst[i]=src[i];return;}if(c.y+1u>=h){dst[i]=src[i];return;}if(c.z+1u>=d){dst[i]=src[i];return;}
 let n0=src[i-1u];let n1=src[i+1u];let n2=src[i-w];let n3=src[i+w];let plane=w*h;let n4=src[i-plane];let n5=src[i+plane];
 let mean=(n0+n1+n2+n3+n4+n5)/6.0;let lo=min(min(min(n0,n1),min(n2,n3)),min(n4,n5));let hi=max(max(max(n0,n1),max(n2,n3)),max(n4,n5));
 let range=max(1.0,params[1]-params[0]);let strength=params[2];let threshold=range*params[3];let guard=threshold*(0.55+0.35*strength);let diff=src[i]-mean;
 if(hi-lo<=guard){if(abs(diff)>threshold){let target=mean+sign(diff)*threshold*0.08;let blend=0.20+0.75*strength;dst[i]=src[i]*(1.0-blend)+target*blend;return;}}dst[i]=src[i];
}`;
 if(kind==='anisotropic')return header+`
@compute @workgroup_size(${workgroupSize})
fn main(@builtin(global_invocation_id) gid:vec3<u32>){
 let i=gid.x;if(i>=meta[3]){return;}let c=coord(i);let w=meta[0];let h=meta[1];let d=meta[2];
 if(c.x==0u){dst[i]=src[i];return;}if(c.y==0u){dst[i]=src[i];return;}if(c.z==0u){dst[i]=src[i];return;}if(c.x+1u>=w){dst[i]=src[i];return;}if(c.y+1u>=h){dst[i]=src[i];return;}if(c.z+1u>=d){dst[i]=src[i];return;}
 let center=src[i];let plane=w*h;let range=max(1.0,params[1]-params[0]);let strength=params[2];let k=range*(0.025+0.09*strength);let k2=max(k*k,0.000001);let lambda=0.06+0.14*strength;
 var flux=0.0;var diff=src[i-1u]-center;flux+=exp(-(diff*diff)/k2)*diff;diff=src[i+1u]-center;flux+=exp(-(diff*diff)/k2)*diff;
 diff=src[i-w]-center;flux+=exp(-(diff*diff)/k2)*diff;diff=src[i+w]-center;flux+=exp(-(diff*diff)/k2)*diff;
 diff=src[i-plane]-center;flux+=exp(-(diff*diff)/k2)*diff;diff=src[i+plane]-center;flux+=exp(-(diff*diff)/k2)*diff;
 dst[i]=center+lambda*flux;
}`;
 if(kind==='tv')return header+`
@compute @workgroup_size(${workgroupSize})
fn main(@builtin(global_invocation_id) gid:vec3<u32>){
 let i=gid.x;if(i>=meta[3]){return;}let c=coord(i);let w=meta[0];let h=meta[1];let d=meta[2];
 if(c.x==0u){dst[i]=src[i];return;}if(c.y==0u){dst[i]=src[i];return;}if(c.z==0u){dst[i]=src[i];return;}if(c.x+1u>=w){dst[i]=src[i];return;}if(c.y+1u>=h){dst[i]=src[i];return;}if(c.z+1u>=d){dst[i]=src[i];return;}
 let center=src[i];let plane=w*h;let range=max(1.0,params[1]-params[0]);let weight=params[2];let lambda=min(0.18,0.02+weight*0.45);let eps=range*0.0001;
 var flux=0.0;var diff=src[i-1u]-center;flux+=diff/sqrt(diff*diff+eps*eps);diff=src[i+1u]-center;flux+=diff/sqrt(diff*diff+eps*eps);
 diff=src[i-w]-center;flux+=diff/sqrt(diff*diff+eps*eps);diff=src[i+w]-center;flux+=diff/sqrt(diff*diff+eps*eps);
 diff=src[i-plane]-center;flux+=diff/sqrt(diff*diff+eps*eps);diff=src[i+plane]-center;flux+=diff/sqrt(diff*diff+eps*eps);
 dst[i]=center+lambda*flux;
}`;
 if(kind==='unsharp')return header+`
@compute @workgroup_size(${workgroupSize})
fn main(@builtin(global_invocation_id) gid:vec3<u32>){
 let i=gid.x;if(i>=meta[3]){return;}let c=coord(i);let w=i32(meta[0]);let h=i32(meta[1]);let d=i32(meta[2]);let r=i32(meta[4]);
 var sum=0.0;var count=0.0;
 for(var dz:i32=-r;dz<=r;dz=dz+1){let zz=i32(c.z)+dz;if(zz<0){continue;}if(zz>=d){continue;}
  for(var dy:i32=-r;dy<=r;dy=dy+1){let yy=i32(c.y)+dy;if(yy<0){continue;}if(yy>=h){continue;}
   for(var dx:i32=-r;dx<=r;dx=dx+1){let xx=i32(c.x)+dx;if(xx<0){continue;}if(xx>=w){continue;}sum+=src[u32(zz)*meta[0]*meta[1]+u32(yy)*meta[0]+u32(xx)];count+=1.0;}
  }
 }
 let blur=sum/max(count,1.0);let detail=src[i]-blur;let range=max(1.0,params[1]-params[0]);let threshold=params[3]*range;
 dst[i]=select(src[i],src[i]+params[2]*detail,abs(detail)>=threshold);
}`;
 if(kind==='bilateral')return header+`
@compute @workgroup_size(${workgroupSize})
fn main(@builtin(global_invocation_id) gid:vec3<u32>){
 let i=gid.x;if(i>=meta[3]){return;}let c=coord(i);let center=src[i];
 let strength=params[2];let spatialSigma=params[3];let intensitySigma=max(0.000001,params[4]*max(1.0,params[1]-params[0]));
 let radius=i32(meta[4]);let sp2=2.0*spatialSigma*spatialSigma;let int2=2.0*intensitySigma*intensitySigma;
 var sum=0.0;var wsum=0.0;
 for(var dz:i32=-radius;dz<=radius;dz=dz+1){
  let zz=i32(c.z)+dz;if(zz<0){continue;}if(zz>=i32(meta[2])){continue;}
  for(var dy:i32=-radius;dy<=radius;dy=dy+1){
   let yy=i32(c.y)+dy;if(yy<0){continue;}if(yy>=i32(meta[1])){continue;}
   for(var dx:i32=-radius;dx<=radius;dx=dx+1){
    let xx=i32(c.x)+dx;if(xx<0){continue;}if(xx>=i32(meta[0])){continue;}
    let j=idx(u32(xx),u32(yy),u32(zz));let dv=src[j]-center;
    let sw=exp(-f32(dx*dx+dy*dy+dz*dz)/sp2);let iw=exp(-(dv*dv)/int2);let ww=sw*iw;
    sum+=src[j]*ww;wsum+=ww;
   }
  }
 }
 let filtered=select(center,sum/wsum,wsum>0.0);dst[i]=center*(1.0-strength)+filtered*strength;
}`;
 if(kind==='nlm')return header+`
@compute @workgroup_size(${workgroupSize})
fn main(@builtin(global_invocation_id) gid:vec3<u32>){
 let i=gid.x;if(i>=meta[3]){return;}let c=coord(i);let center=src[i];
 let sr=i32(meta[4]);let pr=i32(meta[5]);let range=max(1.0,params[1]-params[0]);let hp=range*(0.018+0.11*params[2]);let h2=max(hp*hp,0.000001);
 var weighted=center;var weightSum=1.0;
 for(var dz:i32=-sr;dz<=sr;dz=dz+1){
  let nz=i32(c.z)+dz;if(nz<0){continue;}if(nz>=i32(meta[2])){continue;}
  for(var dy:i32=-sr;dy<=sr;dy=dy+1){
   let ny=i32(c.y)+dy;if(ny<0){continue;}if(ny>=i32(meta[1])){continue;}
   for(var dx:i32=-sr;dx<=sr;dx=dx+1){
    let nx=i32(c.x)+dx;if(nx<0){continue;}if(nx>=i32(meta[0])){continue;}if(dx==0){if(dy==0){if(dz==0){continue;}}}
    var dist2=0.0;var samples=1.0;
    var dv=src[cidx(i32(c.x),i32(c.y),i32(c.z))]-src[cidx(nx,ny,nz)];dist2+=dv*dv;
    for(var r:i32=1;r<=pr;r=r+1){
     dv=src[cidx(i32(c.x)+r,i32(c.y),i32(c.z))]-src[cidx(nx+r,ny,nz)];dist2+=dv*dv;
     dv=src[cidx(i32(c.x)-r,i32(c.y),i32(c.z))]-src[cidx(nx-r,ny,nz)];dist2+=dv*dv;
     dv=src[cidx(i32(c.x),i32(c.y)+r,i32(c.z))]-src[cidx(nx,ny+r,nz)];dist2+=dv*dv;
     dv=src[cidx(i32(c.x),i32(c.y)-r,i32(c.z))]-src[cidx(nx,ny-r,nz)];dist2+=dv*dv;
     dv=src[cidx(i32(c.x),i32(c.y),i32(c.z)+r)]-src[cidx(nx,ny,nz+r)];dist2+=dv*dv;
     dv=src[cidx(i32(c.x),i32(c.y),i32(c.z)-r)]-src[cidx(nx,ny,nz-r)];dist2+=dv*dv;
     samples+=6.0;
    }
    dist2/=samples;let weight=exp(-dist2/h2);let j=idx(u32(nx),u32(ny),u32(nz));weighted+=weight*src[j];weightSum+=weight;
   }
  }
 }
 dst[i]=weighted/weightSum;
}`;
 if(kind==='meshCount')return `
struct Counters{values:array<atomic<u32>,4>};
@group(0) @binding(0) var<storage, read> src:array<f32>;
@group(0) @binding(2) var<storage, read> meta:array<u32>;
@group(0) @binding(3) var<storage, read> thresholds:array<f32>;
@group(0) @binding(4) var<storage, read_write> counters:Counters;
fn localIdx(x:u32,y:u32,z:u32)->u32{return z*meta[0]*meta[1]+y*meta[0]+x;}
fn insideSegment(v:f32,s:u32)->bool{if(v<thresholds[s*2u]){return false;}if(v>thresholds[s*2u+1u]){return false;}return true;}
fn outsideLocal(x:i32,y:i32,z:i32,s:u32)->bool{
 if(x<0){return true;}if(y<0){return true;}if(z<0){return true;}
 if(x>=i32(meta[0])){return true;}if(y>=i32(meta[1])){return true;}if(z>=i32(meta[2])){return true;}
 return !insideSegment(src[localIdx(u32(x),u32(y),u32(z))],s);
}
@compute @workgroup_size(${workgroupSize})
fn main(@builtin(global_invocation_id) gid:vec3<u32>){
 let i=gid.x;if(i>=meta[9]){return;}let tw=meta[6];let th=meta[7];
 let tx=i%tw;let ty=(i/tw)%th;let tz=i/(tw*th);let x=meta[3]+tx;let y=meta[4]+ty;let z=meta[5]+tz;
 let gx=meta[11]+x;let gy=meta[12]+y;let gz=meta[13]+z;let center=src[localIdx(x,y,z)];
 for(var s:u32=0u;s<meta[10];s=s+1u){
  if(!insideSegment(center,s)){continue;}var count=0u;
  if(outsideLocal(i32(x)-1,i32(y),i32(z),s)){count=count+1u;}
  if(outsideLocal(i32(x)+1,i32(y),i32(z),s)){count=count+1u;}
  if(outsideLocal(i32(x),i32(y)-1,i32(z),s)){count=count+1u;}
  if(outsideLocal(i32(x),i32(y)+1,i32(z),s)){count=count+1u;}
  if(outsideLocal(i32(x),i32(y),i32(z)-1,s)){count=count+1u;}
  if(outsideLocal(i32(x),i32(y),i32(z)+1,s)){count=count+1u;}
  if(count>0u){atomicAdd(&counters.values[s],count);}
 }
}`;
 if(kind==='meshWrite')return `
struct Counters{values:array<atomic<u32>,4>};
@group(0) @binding(0) var<storage, read> src:array<f32>;
@group(0) @binding(1) var<storage, read_write> dst:array<f32>;
@group(0) @binding(2) var<storage, read> meta:array<u32>;
@group(0) @binding(3) var<storage, read> thresholds:array<f32>;
@group(0) @binding(4) var<storage, read_write> counters:Counters;
@group(0) @binding(5) var<storage, read> geom:array<f32>;
fn localIdx(x:u32,y:u32,z:u32)->u32{return z*meta[0]*meta[1]+y*meta[0]+x;}
fn insideSegment(v:f32,s:u32)->bool{if(v<thresholds[s*2u]){return false;}if(v>thresholds[s*2u+1u]){return false;}return true;}
fn outsideLocal(x:i32,y:i32,z:i32,s:u32)->bool{
 if(x<0){return true;}if(y<0){return true;}if(z<0){return true;}
 if(x>=i32(meta[0])){return true;}if(y>=i32(meta[1])){return true;}if(z>=i32(meta[2])){return true;}
 return !insideSegment(src[localIdx(u32(x),u32(y),u32(z))],s);
}
fn writeFace(base:u32,a:vec3<f32>,b:vec3<f32>,c:vec3<f32>,d:vec3<f32>,e:vec3<f32>,f:vec3<f32>){
 dst[base]=a.x;dst[base+1u]=a.y;dst[base+2u]=a.z;dst[base+3u]=b.x;dst[base+4u]=b.y;dst[base+5u]=b.z;
 dst[base+6u]=c.x;dst[base+7u]=c.y;dst[base+8u]=c.z;dst[base+9u]=d.x;dst[base+10u]=d.y;dst[base+11u]=d.z;
 dst[base+12u]=e.x;dst[base+13u]=e.y;dst[base+14u]=e.z;dst[base+15u]=f.x;dst[base+16u]=f.y;dst[base+17u]=f.z;
}
fn slotFor(s:u32)->u32{return (meta[17u+s]+atomicAdd(&counters.values[s],1u))*18u;}
@compute @workgroup_size(${workgroupSize})
fn main(@builtin(global_invocation_id) gid:vec3<u32>){
 let i=gid.x;if(i>=meta[9]){return;}let tw=meta[6];let th=meta[7];
 let tx=i%tw;let ty=(i/tw)%th;let tz=i/(tw*th);let x=meta[3]+tx;let y=meta[4]+ty;let z=meta[5]+tz;
 let gx=meta[11]+x;let gy=meta[12]+y;let gz=meta[13]+z;let center=src[localIdx(x,y,z)];
 let sx=geom[0];let sy=geom[1];let sz=geom[2];let scale=geom[3];let px=geom[4];let py=geom[5];let pz=geom[6];
 let x0=(f32(gx)*sx-px*0.5)*scale;let x1=(f32(gx+1u)*sx-px*0.5)*scale;
 let y0=-(f32(gy)*sy-py*0.5)*scale;let y1=-(f32(gy+1u)*sy-py*0.5)*scale;
 let z0=(f32(gz)*sz-pz*0.5)*scale;let z1=(f32(gz+1u)*sz-pz*0.5)*scale;
 for(var s:u32=0u;s<meta[10];s=s+1u){
  if(!insideSegment(center,s)){continue;}
  if(outsideLocal(i32(x)-1,i32(y),i32(z),s)){let b=slotFor(s);writeFace(b,vec3f(x0,y0,z0),vec3f(x0,y0,z1),vec3f(x0,y1,z1),vec3f(x0,y0,z0),vec3f(x0,y1,z1),vec3f(x0,y1,z0));}
  if(outsideLocal(i32(x)+1,i32(y),i32(z),s)){let b=slotFor(s);writeFace(b,vec3f(x1,y0,z0),vec3f(x1,y1,z0),vec3f(x1,y1,z1),vec3f(x1,y0,z0),vec3f(x1,y1,z1),vec3f(x1,y0,z1));}
  if(outsideLocal(i32(x),i32(y)-1,i32(z),s)){let b=slotFor(s);writeFace(b,vec3f(x0,y0,z0),vec3f(x1,y0,z0),vec3f(x1,y0,z1),vec3f(x0,y0,z0),vec3f(x1,y0,z1),vec3f(x0,y0,z1));}
  if(outsideLocal(i32(x),i32(y)+1,i32(z),s)){let b=slotFor(s);writeFace(b,vec3f(x0,y1,z0),vec3f(x0,y1,z1),vec3f(x1,y1,z1),vec3f(x0,y1,z0),vec3f(x1,y1,z1),vec3f(x1,y1,z0));}
  if(outsideLocal(i32(x),i32(y),i32(z)-1,s)){let b=slotFor(s);writeFace(b,vec3f(x0,y0,z0),vec3f(x0,y1,z0),vec3f(x1,y1,z0),vec3f(x0,y0,z0),vec3f(x1,y1,z0),vec3f(x1,y0,z0));}
  if(outsideLocal(i32(x),i32(y),i32(z)+1,s)){let b=slotFor(s);writeFace(b,vec3f(x0,y0,z1),vec3f(x1,y0,z1),vec3f(x1,y1,z1),vec3f(x0,y0,z1),vec3f(x1,y1,z1),vec3f(x0,y1,z1));}
 }
}`;
 if(kind==='meshCornerInit')return `
@group(0) @binding(0) var<storage, read> src:array<f32>;
@group(0) @binding(1) var<storage, read_write> corners:array<f32>;
@group(0) @binding(2) var<storage, read> meta:array<u32>;
@group(0) @binding(3) var<storage, read> thresholds:array<f32>;
@group(0) @binding(5) var<storage, read> geom:array<f32>;
fn localIdx(x:u32,y:u32,z:u32)->u32{return z*meta[0]*meta[1]+y*meta[0]+x;}
fn insideSegmentAt(x:i32,y:i32,z:i32,s:u32)->bool{
 if(x<0){return false;}if(y<0){return false;}if(z<0){return false;}if(x>=i32(meta[0])){return false;}if(y>=i32(meta[1])){return false;}if(z>=i32(meta[2])){return false;}
 let v=src[localIdx(u32(x),u32(y),u32(z))];if(v<thresholds[s*2u]){return false;}if(v>thresholds[s*2u+1u]){return false;}return true;
}
@compute @workgroup_size(${workgroupSize})
fn main(@builtin(global_invocation_id) gid:vec3<u32>){
 let cw=meta[6]+1u;let ch=meta[7]+1u;let cd=meta[8]+1u;let cornerCount=cw*ch*cd;let total=cornerCount*meta[10];
 let q=gid.x;if(q>=total){return;}let s=q/cornerCount;let ci=q-s*cornerCount;let cx=ci%cw;let cy=(ci/cw)%ch;let cz=ci/(cw*ch);
 let lx=i32(meta[3]+cx);let ly=i32(meta[4]+cy);let lz=i32(meta[5]+cz);var insideCount=0u;var sampleCount=0u;
 for(var dz:i32=-1;dz<=0;dz=dz+1){for(var dy:i32=-1;dy<=0;dy=dy+1){for(var dx:i32=-1;dx<=0;dx=dx+1){
  let vx=lx+dx;let vy=ly+dy;let vz=lz+dz;
  var valid=true;if(vx<0){valid=false;}if(vy<0){valid=false;}if(vz<0){valid=false;}if(vx>=i32(meta[0])){valid=false;}if(vy>=i32(meta[1])){valid=false;}if(vz>=i32(meta[2])){valid=false;}if(valid){sampleCount=sampleCount+1u;if(insideSegmentAt(vx,vy,vz,s)){insideCount=insideCount+1u;}}
 }}}
 var activeFlag=false;if(insideCount>0u){if(insideCount<sampleCount){activeFlag=true;}}let active=select(0.0,1.0,activeFlag);
 let gx=meta[11]+meta[3]+cx;let gy=meta[12]+meta[4]+cy;let gz=meta[13]+meta[5]+cz;
 let sx=geom[0];let sy=geom[1];let sz=geom[2];let scale=geom[3];let px=geom[4];let py=geom[5];let pz=geom[6];
 let base=q*4u;corners[base]=(f32(gx)*sx-px*0.5)*scale;corners[base+1u]=-(f32(gy)*sy-py*0.5)*scale;corners[base+2u]=(f32(gz)*sz-pz*0.5)*scale;corners[base+3u]=active;
}`;
 if(kind==='meshCornerSmooth')return `
@group(0) @binding(0) var<storage, read> srcCorners:array<f32>;
@group(0) @binding(1) var<storage, read_write> dstCorners:array<f32>;
@group(0) @binding(2) var<storage, read> meta:array<u32>;
@group(0) @binding(3) var<storage, read> params:array<f32>;
fn baseIndex(s:u32,cx:u32,cy:u32,cz:u32)->u32{
 let cw=meta[6]+1u;let ch=meta[7]+1u;let cd=meta[8]+1u;let cornerCount=cw*ch*cd;
 return (s*cornerCount+cz*cw*ch+cy*cw+cx)*4u;
}
@compute @workgroup_size(${workgroupSize})
fn main(@builtin(global_invocation_id) gid:vec3<u32>){
 let cw=meta[6]+1u;let ch=meta[7]+1u;let cd=meta[8]+1u;let cornerCount=cw*ch*cd;let total=cornerCount*meta[10];
 let q=gid.x;if(q>=total){return;}let s=q/cornerCount;let ci=q-s*cornerCount;let cx=ci%cw;let cy=(ci/cw)%ch;let cz=ci/(cw*ch);let base=q*4u;
 let active=srcCorners[base+3u];var px=srcCorners[base];var py=srcCorners[base+1u];var pz=srcCorners[base+2u];
 var edge=false;if(active<0.5){edge=true;}if(cx==0u){edge=true;}if(cy==0u){edge=true;}if(cz==0u){edge=true;}if(cx+1u>=cw){edge=true;}if(cy+1u>=ch){edge=true;}if(cz+1u>=cd){edge=true;}if(edge){
  dstCorners[base]=px;dstCorners[base+1u]=py;dstCorners[base+2u]=pz;dstCorners[base+3u]=active;return;
 }
 var ax=0.0;var ay=0.0;var az=0.0;var count=0.0;
 for(var dz:i32=-1;dz<=1;dz=dz+1){for(var dy:i32=-1;dy<=1;dy=dy+1){for(var dx:i32=-1;dx<=1;dx=dx+1){
  if(dx==0){if(dy==0){if(dz==0){continue;}}}if(abs(dx)+abs(dy)+abs(dz)>2){continue;}
  let nb=baseIndex(s,u32(i32(cx)+dx),u32(i32(cy)+dy),u32(i32(cz)+dz));
  if(srcCorners[nb+3u]>0.5){ax+=srcCorners[nb];ay+=srcCorners[nb+1u];az+=srcCorners[nb+2u];count+=1.0;}
 }}}
 if(count>0.0){let factor=params[0];px+=factor*(ax/count-px);py+=factor*(ay/count-py);pz+=factor*(az/count-pz);}
 dstCorners[base]=px;dstCorners[base+1u]=py;dstCorners[base+2u]=pz;dstCorners[base+3u]=active;
}`;
 if(kind==='meshWriteSmooth')return `
struct Counters{values:array<atomic<u32>,4>};
@group(0) @binding(0) var<storage, read> src:array<f32>;
@group(0) @binding(1) var<storage, read_write> dst:array<f32>;
@group(0) @binding(2) var<storage, read> meta:array<u32>;
@group(0) @binding(3) var<storage, read> thresholds:array<f32>;
@group(0) @binding(4) var<storage, read_write> counters:Counters;
@group(0) @binding(5) var<storage, read> corners:array<f32>;
@group(0) @binding(6) var<storage, read_write> normals:array<f32>;
fn localIdx(x:u32,y:u32,z:u32)->u32{return z*meta[0]*meta[1]+y*meta[0]+x;}
fn insideSegment(v:f32,s:u32)->bool{if(v<thresholds[s*2u]){return false;}if(v>thresholds[s*2u+1u]){return false;}return true;}
fn outsideLocal(x:i32,y:i32,z:i32,s:u32)->bool{
 if(x<0){return true;}if(y<0){return true;}if(z<0){return true;}
 if(x>=i32(meta[0])){return true;}if(y>=i32(meta[1])){return true;}if(z>=i32(meta[2])){return true;}
 return !insideSegment(src[localIdx(u32(x),u32(y),u32(z))],s);
}
fn insideAt(x:i32,y:i32,z:i32,s:u32)->f32{
 if(x<0){return 0.0;}if(y<0){return 0.0;}if(z<0){return 0.0;}if(x>=i32(meta[0])){return 0.0;}if(y>=i32(meta[1])){return 0.0;}if(z>=i32(meta[2])){return 0.0;}
 return select(0.0,1.0,insideSegment(src[localIdx(u32(x),u32(y),u32(z))],s));
}
fn cornerBase(s:u32,cx:u32,cy:u32,cz:u32)->u32{
 let cw=meta[6]+1u;let ch=meta[7]+1u;let cd=meta[8]+1u;let cornerCount=cw*ch*cd;return (s*cornerCount+cz*cw*ch+cy*cw+cx)*4u;
}
fn cornerPos(s:u32,cx:u32,cy:u32,cz:u32)->vec3<f32>{
 let b=cornerBase(s,cx,cy,cz);return vec3f(corners[b],corners[b+1u],corners[b+2u]);
}
fn cornerNormal(s:u32,cx:u32,cy:u32,cz:u32)->vec3<f32>{
 let vx=i32(meta[3]+cx);let vy=i32(meta[4]+cy);let vz=i32(meta[5]+cz);
 var nx=0.0;var ny=0.0;var nz=0.0;
 for(var dz:i32=-1;dz<=0;dz=dz+1){for(var dy:i32=-1;dy<=0;dy=dy+1){nx+=insideAt(vx-1,vy+dy,vz+dz,s)-insideAt(vx,vy+dy,vz+dz,s);}}
 for(var dz:i32=-1;dz<=0;dz=dz+1){for(var dx:i32=-1;dx<=0;dx=dx+1){ny+=insideAt(vx+dx,vy-1,vz+dz,s)-insideAt(vx+dx,vy,vz+dz,s);}}
 for(var dy:i32=-1;dy<=0;dy=dy+1){for(var dx:i32=-1;dx<=0;dx=dx+1){nz+=insideAt(vx+dx,vy+dy,vz-1,s)-insideAt(vx+dx,vy+dy,vz,s);}}
 let n=vec3f(nx,-ny,nz);let len=length(n);if(len>0.00001){return n/len;}return vec3f(0.0,0.0,1.0);
}
fn writeVertex(base:u32,v:vec3<f32>,n:vec3<f32>){dst[base]=v.x;dst[base+1u]=v.y;dst[base+2u]=v.z;normals[base]=n.x;normals[base+1u]=n.y;normals[base+2u]=n.z;}
fn writeFace(base:u32,a:vec3<f32>,na:vec3<f32>,b:vec3<f32>,nb:vec3<f32>,c:vec3<f32>,nc:vec3<f32>,d:vec3<f32>,nd:vec3<f32>,e:vec3<f32>,ne:vec3<f32>,f:vec3<f32>,nf:vec3<f32>){
 writeVertex(base,a,na);writeVertex(base+3u,b,nb);writeVertex(base+6u,c,nc);writeVertex(base+9u,d,nd);writeVertex(base+12u,e,ne);writeVertex(base+15u,f,nf);
}
fn slotFor(s:u32)->u32{return (meta[17u+s]+atomicAdd(&counters.values[s],1u))*18u;}
@compute @workgroup_size(${workgroupSize})
fn main(@builtin(global_invocation_id) gid:vec3<u32>){
 let i=gid.x;if(i>=meta[9]){return;}let tw=meta[6];let th=meta[7];
 let tx=i%tw;let ty=(i/tw)%th;let tz=i/(tw*th);let x=meta[3]+tx;let y=meta[4]+ty;let z=meta[5]+tz;
 let gx=meta[11]+x;let gy=meta[12]+y;let gz=meta[13]+z;let center=src[localIdx(x,y,z)];
 for(var s:u32=0u;s<meta[10];s=s+1u){
  if(!insideSegment(center,s)){continue;}
  let p000=cornerPos(s,tx,ty,tz);let p001=cornerPos(s,tx,ty,tz+1u);let p010=cornerPos(s,tx,ty+1u,tz);let p011=cornerPos(s,tx,ty+1u,tz+1u);
  let p100=cornerPos(s,tx+1u,ty,tz);let p101=cornerPos(s,tx+1u,ty,tz+1u);let p110=cornerPos(s,tx+1u,ty+1u,tz);let p111=cornerPos(s,tx+1u,ty+1u,tz+1u);
  let n000=cornerNormal(s,tx,ty,tz);let n001=cornerNormal(s,tx,ty,tz+1u);let n010=cornerNormal(s,tx,ty+1u,tz);let n011=cornerNormal(s,tx,ty+1u,tz+1u);
  let n100=cornerNormal(s,tx+1u,ty,tz);let n101=cornerNormal(s,tx+1u,ty,tz+1u);let n110=cornerNormal(s,tx+1u,ty+1u,tz);let n111=cornerNormal(s,tx+1u,ty+1u,tz+1u);
  if(outsideLocal(i32(x)-1,i32(y),i32(z),s)){let b=slotFor(s);writeFace(b,p000,n000,p001,n001,p011,n011,p000,n000,p011,n011,p010,n010);}
  if(outsideLocal(i32(x)+1,i32(y),i32(z),s)){let b=slotFor(s);writeFace(b,p100,n100,p110,n110,p111,n111,p100,n100,p111,n111,p101,n101);}
  if(outsideLocal(i32(x),i32(y)-1,i32(z),s)){let b=slotFor(s);writeFace(b,p000,n000,p100,n100,p101,n101,p000,n000,p101,n101,p001,n001);}
  if(outsideLocal(i32(x),i32(y)+1,i32(z),s)){let b=slotFor(s);writeFace(b,p010,n010,p011,n011,p111,n111,p010,n010,p111,n111,p110,n110);}
  if(outsideLocal(i32(x),i32(y),i32(z)-1,s)){let b=slotFor(s);writeFace(b,p000,n000,p010,n010,p110,n110,p000,n000,p110,n110,p100,n100);}
  if(outsideLocal(i32(x),i32(y),i32(z)+1,s)){let b=slotFor(s);writeFace(b,p001,n001,p101,n101,p111,n111,p001,n001,p111,n111,p011,n011);}
 }
}`;
 if(kind==='faceCompact')return `
struct Counter{value:atomic<u32>};
@group(0) @binding(0) var<storage, read> src: array<f32>;
@group(0) @binding(1) var<storage, read_write> dst: array<u32>;
@group(0) @binding(2) var<storage, read> meta: array<u32>;
@group(0) @binding(3) var<storage, read> thresholds: array<f32>;
@group(0) @binding(4) var<storage, read_write> counter:Counter;
fn localIdx(x:u32,y:u32,z:u32)->u32{return z*meta[0]*meta[1]+y*meta[0]+x;}
fn insideSegment(value:f32,s:u32)->bool{if(value<thresholds[s*2u]){return false;}if(value>thresholds[s*2u+1u]){return false;}return true;}
fn outsideLocal(x:i32,y:i32,z:i32,s:u32)->bool{
 if(x<0){return true;}if(y<0){return true;}if(z<0){return true;}
 if(x>=i32(meta[0])){return true;}if(y>=i32(meta[1])){return true;}if(z>=i32(meta[2])){return true;}
 return !insideSegment(src[localIdx(u32(x),u32(y),u32(z))],s);
}
@compute @workgroup_size(${workgroupSize})
fn main(@builtin(global_invocation_id) gid:vec3<u32>){
 let i=gid.x;let count=meta[9];if(i>=count){return;}
 let tw=meta[6];let th=meta[7];let tx=i%tw;let ty=(i/tw)%th;let tz=i/(tw*th);
 let x=meta[3]+tx;let y=meta[4]+ty;let z=meta[5]+tz;
 let gx=meta[11]+x;let gy=meta[12]+y;let gz=meta[13]+z;
 let center=src[localIdx(x,y,z)];var packed=0u;
 for(var s:u32=0u;s<meta[10];s=s+1u){
  if(!insideSegment(center,s)){continue;}
  let shift=s*6u;var faces=0u;
  if(outsideLocal(i32(x)-1,i32(y),i32(z),s)){faces=faces|1u;}
  if(outsideLocal(i32(x)+1,i32(y),i32(z),s)){faces=faces|2u;}
  if(outsideLocal(i32(x),i32(y)-1,i32(z),s)){faces=faces|4u;}
  if(outsideLocal(i32(x),i32(y)+1,i32(z),s)){faces=faces|8u;}
  if(outsideLocal(i32(x),i32(y),i32(z)-1,s)){faces=faces|16u;}
  if(outsideLocal(i32(x),i32(y),i32(z)+1,s)){faces=faces|32u;}
  packed=packed|(faces<<shift);
 }
 if(packed!=0u){
  let slot=atomicAdd(&counter.value,1u);
  dst[slot*2u]=i;dst[slot*2u+1u]=packed;
 }
}`;
 if(kind==='faceExtract')return `
@group(0) @binding(0) var<storage, read> src: array<f32>;
@group(0) @binding(1) var<storage, read_write> dst: array<u32>;
@group(0) @binding(2) var<storage, read> meta: array<u32>;
@group(0) @binding(3) var<storage, read> thresholds: array<f32>;
fn localIdx(x:u32,y:u32,z:u32)->u32{return z*meta[0]*meta[1]+y*meta[0]+x;}
fn insideSegment(value:f32,s:u32)->bool{if(value<thresholds[s*2u]){return false;}if(value>thresholds[s*2u+1u]){return false;}return true;}
fn outsideLocal(x:i32,y:i32,z:i32,s:u32)->bool{
 if(x<0){return true;}if(y<0){return true;}if(z<0){return true;}
 if(x>=i32(meta[0])){return true;}if(y>=i32(meta[1])){return true;}if(z>=i32(meta[2])){return true;}
 return !insideSegment(src[localIdx(u32(x),u32(y),u32(z))],s);
}
@compute @workgroup_size(${workgroupSize})
fn main(@builtin(global_invocation_id) gid:vec3<u32>){
 let i=gid.x;let count=meta[9];if(i>=count){return;}
 let tw=meta[6];let th=meta[7];let tx=i%tw;let ty=(i/tw)%th;let tz=i/(tw*th);
 let x=meta[3]+tx;let y=meta[4]+ty;let z=meta[5]+tz;
 let gx=meta[11]+x;let gy=meta[12]+y;let gz=meta[13]+z;
 let center=src[localIdx(x,y,z)];var packed=0u;
 for(var s:u32=0u;s<meta[10];s=s+1u){
  if(!insideSegment(center,s)){continue;}
  let shift=s*6u;var faces=0u;
  if(outsideLocal(i32(x)-1,i32(y),i32(z),s)){faces=faces|1u;}
  if(outsideLocal(i32(x)+1,i32(y),i32(z),s)){faces=faces|2u;}
  if(outsideLocal(i32(x),i32(y)-1,i32(z),s)){faces=faces|4u;}
  if(outsideLocal(i32(x),i32(y)+1,i32(z),s)){faces=faces|8u;}
  if(outsideLocal(i32(x),i32(y),i32(z)-1,s)){faces=faces|16u;}
  if(outsideLocal(i32(x),i32(y),i32(z)+1,s)){faces=faces|32u;}
  packed=packed|(faces<<shift);
 }
 dst[i]=packed;
}`;
 if(kind==='maskExtract')return `
@group(0) @binding(0) var<storage, read> src: array<f32>;
@group(0) @binding(1) var<storage, read_write> dst: array<u32>;
@group(0) @binding(2) var<storage, read> meta: array<u32>;
@group(0) @binding(3) var<storage, read> thresholds: array<f32>;
@compute @workgroup_size(${workgroupSize})
fn main(@builtin(global_invocation_id) gid:vec3<u32>){
 let i=gid.x;let count=meta[9];if(i>=count){return;}
 let tw=meta[6];let th=meta[7];let x=i%tw;let y=(i/tw)%th;let z=i/(tw*th);
 let sx=meta[3]+x;let sy=meta[4]+y;let sz=meta[5]+z;let value=src[sz*meta[0]*meta[1]+sy*meta[0]+sx];
 var bits=0u;let segmentCount=meta[10];
 for(var s:u32=0u;s<segmentCount;s=s+1u){
  if(value>=thresholds[s*2u]){if(value<=thresholds[s*2u+1u]){bits=bits|(1u<<s);}}
 }
 dst[i]=bits;
}`;
 if(kind==='analysisRunCount')return `
struct Counter{value:atomic<u32>};
@group(0) @binding(0) var<storage, read> src:array<f32>;
@group(0) @binding(2) var<storage, read> meta:array<u32>;
@group(0) @binding(3) var<storage, read> thresholds:array<f32>;
@group(0) @binding(4) var<storage, read_write> counter:Counter;
fn localIdx(x:u32,y:u32,z:u32)->u32{return z*meta[0]*meta[1]+y*meta[0]+x;}
fn inside(v:f32)->bool{if(v<thresholds[0]){return false;}if(v>thresholds[1]){return false;}return true;}
@compute @workgroup_size(${workgroupSize})
fn main(@builtin(global_invocation_id) gid:vec3<u32>){
 let i=gid.x;if(i>=meta[9]){return;}let tw=meta[6];let th=meta[7];
 let tx=i%tw;let ty=(i/tw)%th;let tz=i/(tw*th);let x=meta[3]+tx;let y=meta[4]+ty;let z=meta[5]+tz;
 if(!inside(src[localIdx(x,y,z)])){return;}
 if(tx>0u){if(inside(src[localIdx(x-1u,y,z)])){return;}}
 atomicAdd(&counter.value,1u);
}`;
 if(kind==='analysisRunWrite')return `
struct Counter{value:atomic<u32>};
@group(0) @binding(0) var<storage, read> src:array<f32>;
@group(0) @binding(1) var<storage, read_write> dst:array<u32>;
@group(0) @binding(2) var<storage, read> meta:array<u32>;
@group(0) @binding(3) var<storage, read> thresholds:array<f32>;
@group(0) @binding(4) var<storage, read_write> counter:Counter;
fn localIdx(x:u32,y:u32,z:u32)->u32{return z*meta[0]*meta[1]+y*meta[0]+x;}
fn inside(v:f32)->bool{if(v<thresholds[0]){return false;}if(v>thresholds[1]){return false;}return true;}
@compute @workgroup_size(${workgroupSize})
fn main(@builtin(global_invocation_id) gid:vec3<u32>){
 let i=gid.x;if(i>=meta[9]){return;}let tw=meta[6];let th=meta[7];
 let tx=i%tw;let ty=(i/tw)%th;let tz=i/(tw*th);let x=meta[3]+tx;let y=meta[4]+ty;let z=meta[5]+tz;
 if(!inside(src[localIdx(x,y,z)])){return;}
 if(tx>0u){if(inside(src[localIdx(x-1u,y,z)])){return;}}
 var x1=tx;
 loop{
  if(x1+1u>=tw){break;}
  if(!inside(src[localIdx(meta[3]+x1+1u,y,z)])){break;}
  x1=x1+1u;
 }
 let slot=atomicAdd(&counter.value,1u)*4u;
 dst[slot]=tz;dst[slot+1u]=ty;dst[slot+2u]=tx;dst[slot+3u]=x1;
}`;
 if(kind==='extract')return `
@group(0) @binding(0) var<storage, read> src: array<f32>;
@group(0) @binding(1) var<storage, read_write> dst: array<f32>;
@group(0) @binding(2) var<storage, read> meta: array<u32>;
@compute @workgroup_size(${workgroupSize})
fn main(@builtin(global_invocation_id) gid:vec3<u32>){
 let i=gid.x;let count=meta[9];if(i>=count){return;}
 let tw=meta[6];let th=meta[7];let x=i%tw;let y=(i/tw)%th;let z=i/(tw*th);
 let sx=meta[3]+x;let sy=meta[4]+y;let sz=meta[5]+z;
 dst[i]=src[sz*meta[0]*meta[1]+sy*meta[0]+sx];
}`;
 throw new Error('Unknown GPU filter shader '+kind);
}
export function normalizeVrlWgsl(source){
 return source.replace(/\bmeta\b/g,'vrlMeta').replace(/\bactive\b/g,'vrlActive').replace(/\btarget\b/g,'vrlTarget');
}
export const GPU_PREWARM_KINDS=['gaussian','median','sigmoid','spikeHole','anisotropic','tv','unsharp','bilateral','nlm','extract','maskExtract','faceCompact','meshCount','meshWrite','meshCornerInit','meshCornerSmooth','meshWriteSmooth','analysisRunCount','analysisRunWrite'];
