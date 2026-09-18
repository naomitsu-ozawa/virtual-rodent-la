import * as THREE from 'three/webgpu';
import {surfaceNets} from './surface-nets.js';
import {unionStats} from './nifti.js';
export function buildTissueGeometry(n,stats,t){
 const b=t.id===-1?unionStats(stats):stats.get(t.id);if(!b)throw new Error(`${t.label}のラベルがありません。`);const[nx,ny]=n.dims;
 const lo=b.min.map((v,a)=>Math.max(0,v-1)),hi=b.max.map((v,a)=>Math.min(n.dims[a]-1,v+1));
 const vol=(hi[0]-lo[0]+1)*(hi[1]-lo[1]+1)*(hi[2]-lo[2]+1),target=t.key==='gut'?8e6:t.key==='bone'?6e6:5e6,step=Math.max(1,Math.ceil(Math.cbrt(vol/target)));
 const sx=Math.ceil((hi[0]-lo[0]+1)/step)+2,sy=Math.ceil((hi[1]-lo[1]+1)/step)+2,sz=Math.ceil((hi[2]-lo[2]+1)/step)+2,mask=new Uint8Array(sx*sy*sz),match=t.id===-1?v=>v>0:v=>v===t.id;
 for(let z=lo[2];z<=hi[2];z++){const mz=Math.floor((z-lo[2])/step)+1;for(let y=lo[1];y<=hi[1];y++){const my=Math.floor((y-lo[1])/step)+1;let src=lo[0]+nx*(y+ny*z);for(let x=lo[0];x<=hi[0];x++,src++)if(match(n.data[src])){const mx=Math.floor((x-lo[0])/step)+1;mask[mx+sx*(my+sy*mz)]=1}}}
 const m=surfaceNets([sx,sy,sz],(x,y,z)=>mask[Math.round(x)+sx*(Math.round(y)+sy*Math.round(z))]?-1:1);if(!m.positions.length)throw new Error(`${t.label}の表面生成結果が空です。`);
 const pos=new Float32Array(m.positions.length*3),ind=new Uint32Array(m.cells.length*3);for(let i=0;i<m.positions.length;i++){const p=m.positions[i];pos[i*3]=(lo[0]+(p[0]-1)*step)*n.pixdim[0];pos[i*3+1]=(lo[1]+(p[1]-1)*step)*n.pixdim[1];pos[i*3+2]=(lo[2]+(p[2]-1)*step)*n.pixdim[2]}
 for(let i=0;i<m.cells.length;i++){ind[i*3]=m.cells[i][0];ind[i*3+1]=m.cells[i][1];ind[i*3+2]=m.cells[i][2]}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setIndex(new THREE.BufferAttribute(ind,1));g.computeVertexNormals();g.computeBoundingSphere();return g;
}
