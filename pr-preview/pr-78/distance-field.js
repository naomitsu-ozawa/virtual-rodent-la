// Distance field for VR sphere tracing (build 369). For each segment channel
// of the classification bytes (>= 128 inside), a byte per voxel: a lower
// bound, in voxels, of the distance to the nearest voxel of the other class
// (inside → nearest outside, outside → nearest inside), capped at 255.
// Chamfer 3-4-5 distance to the seed voxels: every voxel with a 26-neighbour
// of the other class (both sides). Every corner of a cell crossed by the
// trilinear 0.5 iso-surface is such a voxel, so any surface point is within
// 0.87 voxel of a seed. The chamfer metric is at most 1.106 × the Euclidean
// one, so 0.9 × chamfer/3, floored, never exceeds the true distance to a
// seed. The VR shader samples the field at the nearest voxel (offset up to
// 0.87) and jumps d − 2 voxels when d >= 3: no surface inside the jump.
// Pure module (no DOM), unit-tested.
const INF=0x3fffffff;
// inside: Uint8Array (non-zero = inside), dims [w,h,d]; returns Uint8Array
export function chamferDistanceBytes(inside,dims){
 const [w,h,d]=dims,n=w*h*d,D=new Int32Array(n),wh=w*h;
 // seeds: voxels with a 26-neighbour of the other class
 for(let z=0;z<d;z++)for(let y=0;y<h;y++){const row=z*wh+y*w;for(let x=0;x<w;x++){const i=row+x,v=inside[i]!==0;let b=false;
  for(let dz=-1;dz<=1&&!b;dz++){const zz=z+dz;if(zz<0||zz>=d)continue;for(let dy=-1;dy<=1&&!b;dy++){const yy=y+dy;if(yy<0||yy>=h)continue;const r2=zz*wh+yy*w;
   for(let dx=-1;dx<=1;dx++){const xx=x+dx;if(xx<0||xx>=w)continue;if((inside[r2+xx]!==0)!==v){b=true;break}}}}
  D[i]=b?0:INF}}
 // forward pass: neighbours already visited (z-1 layer: 9, y-1 row: 3, x-1: 1)
 const F=[[-1,0,0,3],[-1,-1,0,4],[0,-1,0,3],[1,-1,0,4],[-1,-1,-1,5],[0,-1,-1,4],[1,-1,-1,5],[-1,0,-1,4],[0,0,-1,3],[1,0,-1,4],[-1,1,-1,5],[0,1,-1,4],[1,1,-1,5]];
 const pass=(offs,zs,ze,zi,ys,ye,yi,xs,xe,xi)=>{
  for(let z=zs;z!==ze;z+=zi)for(let y=ys;y!==ye;y+=yi)for(let x=xs;x!==xe;x+=xi){const i=z*wh+y*w+x;let m=D[i];if(m===0)continue;
   for(let k=0;k<offs.length;k++){const o=offs[k],xx=x+o[0],yy=y+o[1],zz=z+o[2];if(xx<0||yy<0||zz<0||xx>=w||yy>=h||zz>=d)continue;const c=D[zz*wh+yy*w+xx]+o[3];if(c<m)m=c}
   D[i]=m}};
 pass(F,0,d,1,0,h,1,0,w,1);
 pass(F.map(o=>[-o[0],-o[1],-o[2],o[3]]),d-1,-1,-1,h-1,-1,-1,w-1,-1,-1);
 const out=new Uint8Array(n);
 for(let i=0;i<n;i++){const v=Math.floor(D[i]*0.3);out[i]=v>255?255:v}
 return out;
}
// cls: {data, C, chan} as built by the VR view (bytes per channel, >= 128
// inside); returns the same layout with distance bytes
export function buildDistanceBytes(cls,dims){
 const n=dims[0]*dims[1]*dims[2],C=cls.C,out=new Uint8Array(n*C),inside=new Uint8Array(n);
 for(let c=0;c<C;c++){
  for(let i=0;i<n;i++)inside[i]=cls.data[i*C+c]>=128?1:0;
  const dist=chamferDistanceBytes(inside,dims);
  for(let i=0;i<n;i++)out[i*C+c]=dist[i];
 }
 return{data:out,C,chan:cls.chan};
}
