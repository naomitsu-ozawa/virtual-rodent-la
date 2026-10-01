import { describe, it, expect } from 'vitest';
import { marchClassificationHit } from '../../docs/vr-pick.js';

// build 402: 8³ grid in a ±1 box, one channel; index mapping as the VR shader's texCoord (y index runs down)
const N=8,he=[1,1,1],dims=[N,N,N];
const grid=fill=>{const data=new Uint8Array(N*N*N);for(let z=0;z<N;z++)for(let y=0;y<N;y++)for(let x=0;x<N;x++)if(fill(x,y,z))data[x+N*(y+N*z)]=200;return{data,C:1,chan:[0,-1,-1,-1]}};
const v=(x,y,z)=>({x,y,z});
const step=0.125; // half a voxel

describe('marchClassificationHit', () => {
 it('index 0 in y is the top of the box (+y)', () => {
  const cls=grid((x,y)=>y<=1); // p.y in (0.5, 1]
  expect(marchClassificationHit(v(0,3,0),v(0,-1,0),he,dims,cls,[0])).toBeCloseTo(2,6);
  const t=marchClassificationHit(v(0,-3,0),v(0,1,0),he,dims,cls,[0]);
  expect(t).toBeGreaterThanOrEqual(3.5);expect(t).toBeLessThan(3.5+step+1e-9);
 });
 it('x and z run up the index', () => {
  const cx=grid(x=>x===7),cz=grid((x,y,z)=>z===7);
  const tx=marchClassificationHit(v(-3,0,0),v(1,0,0),he,dims,cx,[0]),tz=marchClassificationHit(v(0,0,-3),v(0,0,1),he,dims,cz,[0]);
  for(const t of [tx,tz]){expect(t).toBeGreaterThanOrEqual(3.75);expect(t).toBeLessThan(3.75+step+1e-9)}
 });
 it('starts on the side a clipping plane keeps', () => {
  const cls=grid((x,y)=>y<=1);
  // kept where −y + 0.75 ≥ 0 (y ≤ 0.75): the ray from above starts at the plane
  const pl=[{x:0,y:-1,z:0,w:-0.75}];
  expect(marchClassificationHit(v(0,3,0),v(0,-1,0),he,dims,cls,[0],pl,1,1)).toBeCloseTo(2.25,6);
  // the same plane without its clip bit does nothing
  expect(marchClassificationHit(v(0,3,0),v(0,-1,0),he,dims,cls,[0],pl,1,0)).toBeCloseTo(2,6);
  // kept where y ≥ 0.9: the ray from below starts at the plane, inside the block
  const keepTop=[{x:0,y:1,z:0,w:0.9}];
  expect(marchClassificationHit(v(0,-3,0),v(0,1,0),he,dims,cls,[0],keepTop,1,1)).toBeCloseTo(3.9,6);
 });
 it('misses: hidden channel, outside the box, below 128', () => {
  const cls=grid(()=>true);
  expect(marchClassificationHit(v(0,3,0),v(0,-1,0),he,dims,cls,[])).toBe(-1);
  expect(marchClassificationHit(v(0,3,0),v(1,0,0),he,dims,cls,[0])).toBe(-1);
  const low=grid(()=>true);low.data.fill(127);
  expect(marchClassificationHit(v(0,3,0),v(0,-1,0),he,dims,low,[0])).toBe(-1);
 });
 it('t is in the caller units when the direction is scaled', () => {
  const cls=grid((x,y)=>y<=1);
  expect(marchClassificationHit(v(0,3,0),v(0,-2,0),he,dims,cls,[0])).toBeCloseTo(1,6);
 });
});
