import * as THREE from 'three/webgpu';
import {surfaceNets} from './surface-nets.js';

const TARGET_GRID_VOXELS = 4.5e6;
const SAMPLE_TARGET = 300000;

export function buildSameMouseBoneGeometry(seg, pi, af) {
  validateSameGrid(seg, pi, 'PI');
  validateSameGrid(seg, af, 'AF');

  const [nx, ny, nz] = seg.dims;
  const total = nx * ny * nz;
  const step = Math.max(1, Math.ceil(Math.cbrt(total / TARGET_GRID_VOXELS)));
  const sx = Math.ceil(nx / step) + 2;
  const sy = Math.ceil(ny / step) + 2;
  const sz = Math.ceil(nz / step) + 2;

  const sampleStride = Math.max(1, Math.floor(total / SAMPLE_TARGET));
  const piSample = [];
  const afSample = [];

  for (let i = 0; i < total; i += sampleStride) {
    if (seg.data[i] !== 0) continue;
    const pv = pi.data[i];
    const av = af.data[i];
    if (pv > 0) piSample.push(pv);
    if (av > 0) afSample.push(av);
  }

  if (piSample.length < 1000) {
    throw new Error('同一個体PIデータから骨候補の強度分布を推定できませんでした。');
  }

  const piHigh = quantile(piSample, 0.985);
  const piScale = Math.max(quantile(piSample, 0.997), piHigh + 1);
  const afScale = Math.max(quantile(afSample, 0.995), 1);

  const rawMask = new Uint8Array(sx * sy * sz);
  for (let z = 0; z < nz; z += step) {
    const mz = Math.floor(z / step) + 1;
    for (let y = 0; y < ny; y += step) {
      const my = Math.floor(y / step) + 1;
      for (let x = 0; x < nx; x += step) {
        const mx = Math.floor(x / step) + 1;
        const src = x + nx * (y + ny * z);

        // The organ mask and the raw PI/AF volumes are from CD68_chow_7790.
        // Remove labelled organs first, then keep PI-dominant high-intensity tissue.
        if (seg.data[src] !== 0) continue;

        const pv = pi.data[src];
        if (pv < piHigh) continue;

        const piNorm = Math.min(1.5, pv / piScale);
        const afNorm = Math.min(1.5, af.data[src] / afScale);
        const score = piNorm - 0.30 * afNorm;
        if (score < 0.56) continue;

        rawMask[mx + sx * (my + sy * mz)] = 1;
      }
    }
  }

  // Remove isolated single voxels while preserving thin ribs and digits.
  const mask = new Uint8Array(rawMask.length);
  const plane = sx * sy;
  for (let z = 1; z < sz - 1; z++) {
    for (let y = 1; y < sy - 1; y++) {
      for (let x = 1; x < sx - 1; x++) {
        const i = x + sx * (y + sy * z);
        if (!rawMask[i]) continue;
        const neighbours =
          rawMask[i - 1] + rawMask[i + 1] +
          rawMask[i - sx] + rawMask[i + sx] +
          rawMask[i - plane] + rawMask[i + plane];
        if (neighbours >= 1) mask[i] = 1;
      }
    }
  }

  keepConnectedComponents(mask, sx, sy, sz, 6);

  const mesh = surfaceNets(
    [sx, sy, sz],
    (x, y, z) => mask[Math.round(x) + sx * (Math.round(y) + sy * Math.round(z))] ? -1 : 1,
  );

  if (!mesh.positions.length) {
    throw new Error('同一個体PI/AFデータから骨格表面を生成できませんでした。');
  }

  const positions = new Float32Array(mesh.positions.length * 3);
  const indices = new Uint32Array(mesh.cells.length * 3);

  for (let i = 0; i < mesh.positions.length; i++) {
    const p = mesh.positions[i];
    positions[i * 3] = ((p[0] - 1) * step) * pi.pixdim[0];
    positions[i * 3 + 1] = ((p[1] - 1) * step) * pi.pixdim[1];
    positions[i * 3 + 2] = ((p[2] - 1) * step) * pi.pixdim[2];
  }

  for (let i = 0; i < mesh.cells.length; i++) {
    indices[i * 3] = mesh.cells[i][0];
    indices[i * 3 + 1] = mesh.cells[i][1];
    indices[i * 3 + 2] = mesh.cells[i][2];
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData.sameMouse = true;
  geometry.userData.sourceMouse = 'CD68_chow_7790';
  geometry.userData.source = 'MouseMapper C01/C02 PI-AF';
  geometry.userData.thresholds = { piHigh, piScale, afScale, step };
  return geometry;
}

function validateSameGrid(seg, raw, label) {
  if (seg.dims.length !== raw.dims.length || seg.dims.some((v, i) => v !== raw.dims[i])) {
    throw new Error(`${label}と臓器セグメンテーションのボクセル格子が一致しません。`);
  }
  for (let i = 0; i < 3; i++) {
    const a = seg.pixdim[i];
    const b = raw.pixdim[i];
    if (Math.abs(a - b) > Math.max(a, b, 1) * 1e-4) {
      throw new Error(`${label}と臓器セグメンテーションのボクセル寸法が一致しません。`);
    }
  }
}

function quantile(values, q) {
  values.sort((a, b) => a - b);
  const index = Math.max(0, Math.min(values.length - 1, Math.floor((values.length - 1) * q)));
  return values[index];
}

function keepConnectedComponents(mask, sx, sy, sz, minSize) {
  const visited = new Uint8Array(mask.length);
  const plane = sx * sy;
  const stack = [];
  const component = [];

  for (let i = 0; i < mask.length; i++) {
    if (!mask[i] || visited[i]) continue;
    stack.length = 0;
    component.length = 0;
    stack.push(i);
    visited[i] = 1;

    while (stack.length) {
      const cur = stack.pop();
      component.push(cur);
      const z = Math.floor(cur / plane);
      const rem = cur - z * plane;
      const y = Math.floor(rem / sx);
      const x = rem - y * sx;

      if (x > 0) visit(cur - 1);
      if (x < sx - 1) visit(cur + 1);
      if (y > 0) visit(cur - sx);
      if (y < sy - 1) visit(cur + sx);
      if (z > 0) visit(cur - plane);
      if (z < sz - 1) visit(cur + plane);
    }

    if (component.length < minSize) {
      for (const idx of component) mask[idx] = 0;
    }
  }

  function visit(idx) {
    if (!mask[idx] || visited[idx]) return;
    visited[idx] = 1;
    stack.push(idx);
  }
}
