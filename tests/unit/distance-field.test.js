import { describe, it, expect } from 'vitest';
import { chamferDistanceBytes, buildDistanceBytes } from '../../docs/distance-field.js';

// build 369: the VR sphere tracing jumps by (byte - 3) voxels, so the byte
// must never exceed the true distance to the other class, and should not be
// much smaller either (the jumps would be short)
function sphereVolume(N,r){
 const inside=new Uint8Array(N*N*N),c=(N-1)/2;
 for(let z=0;z<N;z++)for(let y=0;y<N;y++)for(let x=0;x<N;x++)inside[(z*N+y)*N+x]=Math.hypot(x-c,y-c,z-c)<=r?1:0;
 return inside;
}
function trueDistance(inside,N){
 // brute force: nearest voxel of the other class
 const out=new Float32Array(N*N*N),pts=[[],[]];
 for(let z=0;z<N;z++)for(let y=0;y<N;y++)for(let x=0;x<N;x++)pts[inside[(z*N+y)*N+x]].push([x,y,z]);
 for(let z=0;z<N;z++)for(let y=0;y<N;y++)for(let x=0;x<N;x++){const i=(z*N+y)*N+x,other=pts[1-inside[i]];let best=1e9;
  for(const p of other){const d=Math.hypot(p[0]-x,p[1]-y,p[2]-z);if(d<best)best=d}out[i]=best}
 return out;
}
describe('distance field (chamfer 3-4-5 lower bound)',()=>{
 it('never exceeds the true distance to the other class and is not far below it',()=>{
  const N=24,inside=sphereVolume(N,7),bytes=chamferDistanceBytes(inside,[N,N,N]),truth=trueDistance(inside,N);
  let worstRatio=1;
  for(let i=0;i<bytes.length;i++){
   expect(bytes[i]).toBeLessThanOrEqual(truth[i]+1e-9);
   if(truth[i]>=8)worstRatio=Math.min(worstRatio,bytes[i]/truth[i]);
  }
  expect(worstRatio).toBeGreaterThan(0.55); // seeds sit one voxel inside the other class, then 0.9 and the floor
 });
 it('is zero on both sides of the boundary and grows away from it',()=>{
  const N=16,inside=sphereVolume(N,5),bytes=chamferDistanceBytes(inside,[N,N,N]),c=(N-1)/2,at=(x,y,z)=>bytes[(z*N+y)*N+x];
  expect(at(Math.round(c),Math.round(c),Math.round(c))).toBeGreaterThanOrEqual(2); // sphere centre (radius 5): seeds one voxel in, 0.9, floor
  expect(at(0,0,0)).toBeGreaterThan(3); // corner: outside, far
  // a voxel on the surface has a neighbour of the other class → 0
  let zeros=0;for(let i=0;i<bytes.length;i++)if(bytes[i]===0)zeros++;
  expect(zeros).toBeGreaterThan(200);
 });
 it('packs one byte per classification channel',async()=>{
  const N=8,n=N*N*N,C=2,data=new Uint8Array(n*C);
  for(let i=0;i<n;i++){data[i*C]=i<n/2?200:10;data[i*C+1]=10}
  const r=await buildDistanceBytes({data,C,chan:[0,1,-1,-1]},[N,N,N]);
  expect(r.C).toBe(2);expect(r.data.length).toBe(n*C);
  // channel 1 is all outside → no boundary → capped at 255 everywhere
  expect(r.data[1]).toBe(255);
  // channel 0: half/half → small distances
  expect(r.data[0]).toBeLessThan(8);
 });
});
