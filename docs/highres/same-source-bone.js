import * as THREE from 'three/webgpu';
import {surfaceNets} from './surface-nets.js';

const TARGET_GRID_VOXELS = 4.5e6;
const SAMPLE_TARGET = 320000;

export function buildSameMouseBoneGeometry(seg, pi, af) {
  validateRawChannels(pi, af);

  const [rx, ry, rz] = pi.dims;
  const [snx, sny, snz] = seg.dims;
  const total = rx * ry * rz;
  const step = Math.max(1, Math.ceil(Math.cbrt(total / TARGET_GRID_VOXELS)));
  const gx = Math.ceil(rx / step) + 2;
  const gy = Math.ceil(ry / step) + 2;
  const gz = Math.ceil(rz / step) + 2;

  const sampleStride = Math.max(1, Math.floor(total / SAMPLE_TARGET));
  const piSample = [];
  const afSample = [];

  for (let raw = 0; raw < total; raw += sampleStride) {
    const z = Math.floor(raw / (rx * ry));
    const rem = raw - z * rx * ry;
    const y = Math.floor(rem / rx);
    const x = rem - y * rx;
    const sidx = mappedSegIndex(x, y, z, rx, ry, rz, snx, sny, snz);
    if (seg.data[sidx] !== 0) continue;
    const pv = pi.data[raw], av = af.data[raw];
    if (pv > 0) piSample.push(pv);
    if (av > 0) afSample.push(av);
  }

  if (piSample.length < 500) {
    for (let raw = 0; raw < total; raw += sampleStride) {
      const pv = pi.data[raw], av = af.data[raw];
      if (pv > 0) piSample.push(pv);
      if (av > 0) afSample.push(av);
    }
  }
  if (piSample.length < 500) throw new Error('同一個体PIデータの有効画素が不足しています。');

  const piScale = Math.max(quantile(piSample, 0.997), 1);
  const afScale = Math.max(quantile(afSample.length ? afSample : piSample, 0.997), 1);
  const passes = [
    {q:0.985, score:0.62},
    {q:0.975, score:0.55},
    {q:0.960, score:0.48},
  ];

  let mask = null, used = null;
  for (const pass of passes) {
    const piHigh = quantile(piSample, pass.q);
    const rawMask = new Uint8Array(gx * gy * gz);
    let candidates = 0;

    for (let z = 0; z < rz; z += step) {
      const mz = Math.floor(z / step) + 1;
      for (let y = 0; y < ry; y += step) {
        const my = Math.floor(y / step) + 1;
        for (let x = 0; x < rx; x += step) {
          const mx = Math.floor(x / step) + 1;
          const ridx = x + rx * (y + ry * z);
          const sidx = mappedSegIndex(x, y, z, rx, ry, rz, snx, sny, snz);
          if (seg.data[sidx] !== 0) continue;

          const pv = pi.data[ridx];
          if (pv < piHigh) continue;
          const piNorm = Math.min(1.5, pv / piScale);
          const afNorm = Math.min(1.5, af.data[ridx] / afScale);
          const score = 0.72 * piNorm + 0.28 * afNorm;
          if (score < pass.score) continue;

          rawMask[mx + gx * (my + gy * mz)] = 1;
          candidates++;
        }
      }
    }

    const cleaned = cleanMask(rawMask, gx, gy, gz);
    const kept = countMask(cleaned);
    if (kept >= 250) {
      mask = cleaned;
      used = {piHigh, piScale, afScale, step, candidates, kept, q:pass.q, score:pass.score};
      break;
    }
  }

  if (!mask) throw new Error('同一個体PI/AFデータから骨候補を十分抽出できませんでした。');

  const mesh = surfaceNets(
    [gx, gy, gz],
    (x,y,z)=>mask[Math.round(x)+gx*(Math.round(y)+gy*Math.round(z))]?-1:1
  );
  if (!mesh.positions.length) throw new Error('同一個体PI/AFデータから骨格表面を生成できませんでした。');

  const positions = new Float32Array(mesh.positions.length * 3);
  const indices = new Uint32Array(mesh.cells.length * 3);

  for (let i = 0; i < mesh.positions.length; i++) {
    const p = mesh.positions[i];
    const rawX = Math.max(0, Math.min(rx - 1, (p[0] - 1) * step));
    const rawY = Math.max(0, Math.min(ry - 1, (p[1] - 1) * step));
    const rawZ = Math.max(0, Math.min(rz - 1, (p[2] - 1) * step));

    // Project the raw channels onto the organ-segmentation grid so the
    // resulting skeleton and organs share one coordinate system.
    const segX = rawX * snx / rx;
    const segY = rawY * sny / ry;
    const segZ = rawZ * snz / rz;
    positions[i*3]   = segX * seg.pixdim[0];
    positions[i*3+1] = segY * seg.pixdim[1];
    positions[i*3+2] = segZ * seg.pixdim[2];
  }
  for (let i = 0; i < mesh.cells.length; i++) {
    indices[i*3]=mesh.cells[i][0];
    indices[i*3+1]=mesh.cells[i][1];
    indices[i*3+2]=mesh.cells[i][2];
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
  geometry.setIndex(new THREE.BufferAttribute(indices,1));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData.sameMouse=true;
  geometry.userData.sourceMouse='CD68_chow_7790';
  geometry.userData.source='MouseMapper C01/C02 PI-AF';
  geometry.userData.thresholds=used;
  return geometry;
}

function validateRawChannels(pi, af) {
  if (pi.dims.some((v,i)=>v!==af.dims[i])) {
    throw new Error('同一個体のPIとautofluorescenceのボクセル格子が一致しません。');
  }
}

function mappedSegIndex(x,y,z,rx,ry,rz,snx,sny,snz){
  const sx=Math.min(snx-1,Math.max(0,Math.floor((x+.5)*snx/rx)));
  const sy=Math.min(sny-1,Math.max(0,Math.floor((y+.5)*sny/ry)));
  const sz=Math.min(snz-1,Math.max(0,Math.floor((z+.5)*snz/rz)));
  return sx+snx*(sy+sny*sz);
}

function cleanMask(rawMask,sx,sy,sz){
  const mask=new Uint8Array(rawMask.length),plane=sx*sy;
  for(let z=1;z<sz-1;z++)for(let y=1;y<sy-1;y++)for(let x=1;x<sx-1;x++){
    const i=x+sx*(y+sy*z);if(!rawMask[i])continue;
    const neighbours=rawMask[i-1]+rawMask[i+1]+rawMask[i-sx]+rawMask[i+sx]+rawMask[i-plane]+rawMask[i+plane];
    if(neighbours>=1)mask[i]=1;
  }
  keepConnectedComponents(mask,sx,sy,sz,5);
  return mask;
}

function quantile(values,q){
  const sorted=values.slice().sort((a,b)=>a-b);
  const index=Math.max(0,Math.min(sorted.length-1,Math.floor((sorted.length-1)*q)));
  return sorted[index];
}
function countMask(mask){let n=0;for(const v of mask)n+=v;return n}

function keepConnectedComponents(mask,sx,sy,sz,minSize){
  const visited=new Uint8Array(mask.length),plane=sx*sy,stack=[],component=[];
  for(let i=0;i<mask.length;i++){
    if(!mask[i]||visited[i])continue;
    stack.length=0;component.length=0;stack.push(i);visited[i]=1;
    while(stack.length){
      const cur=stack.pop();component.push(cur);
      const z=Math.floor(cur/plane),rem=cur-z*plane,y=Math.floor(rem/sx),x=rem-y*sx;
      if(x>0)visit(cur-1);if(x<sx-1)visit(cur+1);if(y>0)visit(cur-sx);if(y<sy-1)visit(cur+sx);if(z>0)visit(cur-plane);if(z<sz-1)visit(cur+plane);
    }
    if(component.length<minSize)for(const idx of component)mask[idx]=0;
  }
  function visit(idx){if(!mask[idx]||visited[idx])return;visited[idx]=1;stack.push(idx)}
}
