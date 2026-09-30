import { describe,it,expect } from 'vitest';
import { buildVrBrickFlags } from '../../docs/vr-brick-flags.js';

const volume=(brickDims=[2,2,2],dims=[16,16,16])=>({dims,brickDims,bricks:Float32Array.from({length:brickDims.reduce((a,b)=>a*b,1)*2},(_,i)=>i%2?100:0)});
const segments=[{min:40,max:60},{min:101,max:200},{min:-50,max:0},{min:100,max:100}];
const edit=(dims=[16,16,16],active=1)=>({dims,active,data:new Uint8Array(dims.reduce((a,b)=>a*b,1)*4)});
const set=(m,x,y,z,s,v)=>{m.data[((z*m.dims[1]+y)*m.dims[0]+x)*4+s]=v};

describe('VR conservative brick flags',()=>{
 it('stores the 512 cubed brick grid in 256 KiB',()=>{
  const f=buildVrBrickFlags(volume([64,64,64],[512,512,512]),segments);
  expect(f.byteLength).toBe(256*1024);
  expect(f[0]).toBe(0xdd);expect(f.at(-1)).toBe(0xdd);
 });
 it('keeps the original range test, including thresholds crossed only by interpolation',()=>{
  const f=buildVrBrickFlags(volume(),segments);
  // 40..60 intersects 0..100 even if no voxel centre is in 40..60.
  expect([...f]).toEqual(Array(8).fill(0xdd));
 });
 it('removes only a segment with a provably empty processing mask',()=>{
  expect([...buildVrBrickFlags(volume(),segments,edit())]).toEqual(Array(8).fill(0xcd));
 });
 it('includes both sides of a linearly interpolated brick boundary',()=>{
  const m=edit();set(m,7,7,7,0,128);
  expect([...buildVrBrickFlags(volume(),segments,m)]).toEqual(Array(8).fill(0xdd));
 });
 it('retains unrelated mask channels and rejects values below the 0.5 threshold',()=>{
  const m=edit();set(m,4,4,4,0,127);set(m,4,4,4,1,255);
  expect([...buildVrBrickFlags(volume(),segments,m)]).toEqual(Array(8).fill(0xcd));
 });
 it('uses the mask grid rather than assuming it has the volume resolution',()=>{
  const m=edit([8,8,8]);set(m,3,3,3,0,255);
  expect([...buildVrBrickFlags(volume(),segments,m)]).toEqual(Array(8).fill(0xdd));
 });
 it('uses classification support when the shader uses the classification path',()=>{
  const v=volume(),c={C:1,chan:[0,-1,-1,-1],data:new Uint8Array(16**3)};
  expect([...buildVrBrickFlags(v,segments,null,c)]).toEqual(Array(8).fill(0x0d));
  c.data[(7*16+7)*16+7]=128;
  expect([...buildVrBrickFlags(v,segments,null,c)]).toEqual(Array(8).fill(0x1d));
 });
 it('compares thresholds with the float32 precision of GLSL uniforms',()=>{
  const v=volume([1,1,1]);v.bricks.set([0.1,0.1]);
  expect(buildVrBrickFlags(v,[{min:0.1,max:0.1}])[0]).toBe(0x11);
 });
 it('never rejects positive interpolated mask support on nonmatching, noncubic grids',()=>{
  const v=volume([3,2,2],[19,13,11]),m=edit([13,9,7]);
  for(let z=0;z<7;z++)for(let y=0;y<9;y++)for(let x=0;x<13;x++)if((x*3+y*5+z*7)%17===0)set(m,x,y,z,0,255);
  const flags=buildVrBrickFlags(v,[segments[0]],m);
  const linear=tc=>{
   const pos=tc.map((t,i)=>t*m.dims[i]-0.5),base=pos.map(Math.floor),f=pos.map((t,i)=>t-base[i]);let a=0;
   for(let dz=0;dz<2;dz++)for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++){
    const xyz=[dx,dy,dz].map((d,i)=>Math.max(0,Math.min(m.dims[i]-1,base[i]+d)));
    a+=m.data[((xyz[2]*9+xyz[1])*13+xyz[0])*4]*(dx?f[0]:1-f[0])*(dy?f[1]:1-f[1])*(dz?f[2]:1-f[2]);
   }
   return a/255;
  };
  let hits=0;
  for(let i=0;i<2000;i++){
   const tc=[(i*37%1999)/1999,(i*83%1997)/1997,(i*113%1993)/1993];
   if(linear(tc)<0.5)continue;hits++;
   const cell=tc.map((t,j)=>Math.min(v.brickDims[j]-1,Math.floor(t*v.brickDims[j])));
   expect(flags[(cell[2]*2+cell[1])*3+cell[0]]&0x10).toBe(0x10);
  }
  expect(hits).toBeGreaterThan(0);
 });
});
