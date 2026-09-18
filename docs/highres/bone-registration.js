import * as THREE from 'three/webgpu';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';

const STORAGE_KEY = 'virtual-rodent-bone-registration-v2';
const DEFAULT_ADJUST = Object.freeze({
  offsetX: 0,
  offsetY: 0,
  offsetZ: 0,
  scale: 1,
  rotX: 0,
  rotY: 0,
  rotZ: 0,
});

function physicalBoxFromStat(nifti, stat) {
  const min = new THREE.Vector3(
    stat.min[0] * nifti.pixdim[0],
    stat.min[1] * nifti.pixdim[1],
    stat.min[2] * nifti.pixdim[2],
  );
  const max = new THREE.Vector3(
    (stat.max[0] + 1) * nifti.pixdim[0],
    (stat.max[1] + 1) * nifti.pixdim[1],
    (stat.max[2] + 1) * nifti.pixdim[2],
  );
  return new THREE.Box3(min, max);
}

function centerOfLabel(nifti, stats, id) {
  const stat = stats.get(id);
  return stat ? physicalBoxFromStat(nifti, stat).getCenter(new THREE.Vector3()) : null;
}

export function buildTargetLandmarks(nifti, stats, sourceBox) {
  const size = sourceBox.getSize(new THREE.Vector3());
  const center = sourceBox.getCenter(new THREE.Vector3());
  const axes = [0, 1, 2].sort((a, b) => size.getComponent(b) - size.getComponent(a));
  const longAxis = axes[0];

  const brain = centerOfLabel(nifti, stats, 5) || center.clone();
  const thorax =
    centerOfLabel(nifti, stats, 3) ||
    centerOfLabel(nifti, stats, 4) ||
    center.clone();
  const pelvis =
    centerOfLabel(nifti, stats, 22) ||
    centerOfLabel(nifti, stats, 18) ||
    centerOfLabel(nifti, stats, 2) ||
    center.clone();

  let headSign = 1;
  if (pelvis.getComponent(longAxis) !== brain.getComponent(longAxis)) {
    headSign = pelvis.getComponent(longAxis) > brain.getComponent(longAxis) ? -1 : 1;
  }

  const frame = makeAnatomicalFrame(brain, thorax, pelvis);
  return {
    box: sourceBox.clone(),
    size,
    center,
    axes,
    longAxis,
    brain,
    thorax,
    pelvis,
    headSign,
    frame,
  };
}

export async function loadRegisteredSkeleton(urls, target) {
  let lastError = null;
  for (const url of urls) {
    try {
      const geometry = await new STLLoader().loadAsync(url);
      registerSkeletonByLandmarks(geometry, target);
      return geometry;
    } catch (error) {
      lastError = error;
      console.warn('Skeleton source failed', url, error);
    }
  }
  throw lastError || new Error('骨格データを取得できませんでした。');
}

function registerSkeletonByLandmarks(geometry, target) {
  geometry.computeBoundingBox();
  const position = geometry.getAttribute('position');
  const sourceBox = geometry.boundingBox.clone();
  const sourceSize = sourceBox.getSize(new THREE.Vector3());
  const sourceAxes = [0, 1, 2].sort((a, b) => sourceSize.getComponent(b) - sourceSize.getComponent(a));
  const longAxis = sourceAxes[0];

  const endA = regionLandmark(position, sourceBox, longAxis, 'min', 0.01, 0.19);
  const endB = regionLandmark(position, sourceBox, longAxis, 'max', 0.01, 0.19);
  const head = endA.score >= endB.score ? endA : endB;
  const headSide = head.side;

  const thorax = regionLandmark(position, sourceBox, longAxis, headSide, 0.22, 0.46);
  const pelvis = regionLandmark(position, sourceBox, longAxis, headSide, 0.56, 0.79);

  const sourceFrame = makeAnatomicalFrame(head.anchor, thorax.anchor, pelvis.anchor);
  const targetFrame = target.frame;

  const sourceHeadPelvis = head.anchor.distanceTo(pelvis.anchor);
  const targetHeadPelvis = target.brain.distanceTo(target.pelvis);
  const sourceHeadThorax = head.anchor.distanceTo(thorax.anchor);
  const targetHeadThorax = target.brain.distanceTo(target.thorax);

  const ratios = [];
  if (sourceHeadPelvis > 1e-6 && targetHeadPelvis > 1e-6) ratios.push(targetHeadPelvis / sourceHeadPelvis);
  if (sourceHeadThorax > 1e-6 && targetHeadThorax > 1e-6) ratios.push(targetHeadThorax / sourceHeadThorax);
  let scale = ratios.length ? ratios.reduce((a, b) => a + b, 0) / ratios.length : 1;
  scale *= 0.985;

  const original = new THREE.Vector3();
  const delta = new THREE.Vector3();
  const mapped = new THREE.Vector3();

  for (let i = 0; i < position.count; i += 1) {
    original.fromBufferAttribute(position, i);
    delta.copy(original).sub(head.anchor);

    const x = delta.dot(sourceFrame.x) * scale;
    const y = delta.dot(sourceFrame.y) * scale;
    const z = delta.dot(sourceFrame.z) * scale;

    mapped.copy(target.brain)
      .addScaledVector(targetFrame.x, x)
      .addScaledVector(targetFrame.y, y)
      .addScaledVector(targetFrame.z, z);

    position.setXYZ(i, mapped.x, mapped.y, mapped.z);
  }

  position.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  // Keep the brain position as the pivot for fine correction.
  geometry.translate(-target.brain.x, -target.brain.y, -target.brain.z);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
}

function makeAnatomicalFrame(head, thorax, pelvis) {
  const x = pelvis.clone().sub(head);
  if (x.lengthSq() < 1e-8) x.set(1, 0, 0);
  x.normalize();

  const headToThorax = thorax.clone().sub(head);
  const projection = x.clone().multiplyScalar(headToThorax.dot(x));
  const y = headToThorax.sub(projection);

  if (y.lengthSq() < 1e-8) {
    const fallback = Math.abs(x.y) < 0.9
      ? new THREE.Vector3(0, 1, 0)
      : new THREE.Vector3(0, 0, 1);
    y.copy(fallback).addScaledVector(x, -fallback.dot(x));
  }
  y.normalize();

  const z = new THREE.Vector3().crossVectors(x, y);
  if (z.lengthSq() < 1e-8) z.set(0, 0, 1);
  z.normalize();

  // Re-orthogonalize to prevent accumulated skew.
  y.crossVectors(z, x).normalize();

  return { x, y, z };
}

function regionLandmark(position, box, longAxis, headSide, fromHead, toHead) {
  const min = box.min.getComponent(longAxis);
  const max = box.max.getComponent(longAxis);
  const length = Math.max(max - min, 1e-6);
  const bins = 72;
  const bucket = Array.from({ length: bins }, () => ({
    count: 0,
    sum: new THREE.Vector3(),
    minA: Infinity,
    maxA: -Infinity,
    minB: Infinity,
    maxB: -Infinity,
  }));
  const otherAxes = [0, 1, 2].filter((axis) => axis !== longAxis);
  const v = new THREE.Vector3();

  for (let i = 0; i < position.count; i += 1) {
    v.fromBufferAttribute(position, i);
    let t = (v.getComponent(longAxis) - min) / length;
    if (headSide === 'max') t = 1 - t;
    if (t < fromHead || t > toHead) continue;

    const local = (t - fromHead) / Math.max(toHead - fromHead, 1e-6);
    const index = Math.max(0, Math.min(bins - 1, Math.floor(local * bins)));
    const b = bucket[index];
    b.count += 1;
    b.sum.add(v);
    const a = v.getComponent(otherAxes[0]);
    const c = v.getComponent(otherAxes[1]);
    b.minA = Math.min(b.minA, a);
    b.maxA = Math.max(b.maxA, a);
    b.minB = Math.min(b.minB, c);
    b.maxB = Math.max(b.maxB, c);
  }

  let bestIndex = 0;
  let bestScore = -Infinity;
  for (let i = 0; i < bins; i += 1) {
    const b = bucket[i];
    if (!b.count) continue;
    const spanA = Math.max(b.maxA - b.minA, 1e-6);
    const spanB = Math.max(b.maxB - b.minB, 1e-6);
    const score = b.count * Math.sqrt(spanA * spanB);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  const anchor = new THREE.Vector3();
  let total = 0;
  let score = 0;
  for (let i = Math.max(0, bestIndex - 2); i <= Math.min(bins - 1, bestIndex + 2); i += 1) {
    const b = bucket[i];
    if (!b.count) continue;
    anchor.add(b.sum);
    total += b.count;
    const spanA = Math.max(b.maxA - b.minA, 1e-6);
    const spanB = Math.max(b.maxB - b.minB, 1e-6);
    score += b.count * Math.sqrt(spanA * spanB);
  }

  if (total) {
    anchor.multiplyScalar(1 / total);
  } else {
    anchor.copy(box.getCenter(new THREE.Vector3()));
  }

  return {
    anchor,
    score,
    side: headSide,
  };
}

function readAdjust() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return { ...DEFAULT_ADJUST, ...saved };
  } catch {
    return { ...DEFAULT_ADJUST };
  }
}

function saveAdjust(adjust) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(adjust));
}

export function createBoneAdjustmentController({ container, help, target, onChange }) {
  const adjust = readAdjust();

  const panel = document.createElement('aside');
  panel.className = 'bone-adjust-panel';
  panel.hidden = true;
  panel.innerHTML =
    '<div class="bone-adjust-title"><strong>骨格位置調整</strong><button type="button" data-bone-close aria-label="閉じる">×</button></div>' +
    '<p>脳・胸郭・骨盤の3点で自動整列しています。ここでは微調整だけ行えます。値はこのブラウザに保存されます。</p>' +
    sliderRow('X', 'offsetX', -0.18, 0.18, 0.005) +
    sliderRow('Y', 'offsetY', -0.18, 0.18, 0.005) +
    sliderRow('Z', 'offsetZ', -0.18, 0.18, 0.005) +
    sliderRow('拡大率', 'scale', 0.80, 1.20, 0.005) +
    sliderRow('回転X', 'rotX', -25, 25, 0.5) +
    sliderRow('回転Y', 'rotY', -25, 25, 0.5) +
    sliderRow('回転Z', 'rotZ', -25, 25, 0.5) +
    '<div class="bone-adjust-actions"><button type="button" data-bone-reset>自動位置に戻す</button></div>';
  container.appendChild(panel);

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'bone-adjust-toggle';
  toggle.textContent = '骨格位置調整';
  help.appendChild(toggle);

  const ranges = [...panel.querySelectorAll('[data-bone-adjust]')];

  const updateUI = () => {
    for (const range of ranges) {
      const key = range.dataset.boneAdjust;
      range.value = String(adjust[key]);
      const output = panel.querySelector('[data-bone-output="' + key + '"]');
      if (output) {
        output.value = key.startsWith('rot')
          ? Number(adjust[key]).toFixed(1) + '°'
          : Number(adjust[key]).toFixed(3);
      }
    }
  };

  for (const range of ranges) {
    range.addEventListener('input', () => {
      const key = range.dataset.boneAdjust;
      adjust[key] = Number(range.value);
      saveAdjust(adjust);
      updateUI();
      onChange();
    });
  }

  toggle.addEventListener('click', () => {
    panel.hidden = !panel.hidden;
  });
  panel.querySelector('[data-bone-close]').addEventListener('click', () => {
    panel.hidden = true;
  });
  panel.querySelector('[data-bone-reset]').addEventListener('click', () => {
    Object.assign(adjust, DEFAULT_ADJUST);
    localStorage.removeItem(STORAGE_KEY);
    updateUI();
    onChange();
  });

  updateUI();

  return {
    adjust,
    apply(mesh) {
      mesh.position.set(
        target.brain.x + adjust.offsetX * target.size.x,
        target.brain.y + adjust.offsetY * target.size.y,
        target.brain.z + adjust.offsetZ * target.size.z,
      );
      mesh.scale.setScalar(adjust.scale);
      mesh.rotation.set(
        THREE.MathUtils.degToRad(adjust.rotX),
        THREE.MathUtils.degToRad(adjust.rotY),
        THREE.MathUtils.degToRad(adjust.rotZ),
      );
    },
  };
}

function sliderRow(label, key, min, max, step) {
  return '<label>' + label +
    ' <input data-bone-adjust="' + key + '" type="range" min="' + min + '" max="' + max + '" step="' + step + '">' +
    '<output data-bone-output="' + key + '"></output></label>';
}
