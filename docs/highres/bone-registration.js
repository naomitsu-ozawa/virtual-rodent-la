import * as THREE from 'three/webgpu';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';

const STORAGE_KEY = 'virtual-rodent-bone-registration-v1';
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

  const posteriorCandidates = [22, 18, 12, 2, 11]
    .map((id) => centerOfLabel(nifti, stats, id))
    .filter(Boolean);

  let posterior = null;
  let bestDistance = -Infinity;
  for (const point of posteriorCandidates) {
    const distance = point.distanceToSquared(brain);
    if (distance > bestDistance) {
      bestDistance = distance;
      posterior = point;
    }
  }

  let headSign;
  if (posterior) {
    headSign = posterior.getComponent(longAxis) > brain.getComponent(longAxis) ? -1 : 1;
  } else {
    const distToMin = brain.getComponent(longAxis) - sourceBox.min.getComponent(longAxis);
    const distToMax = sourceBox.max.getComponent(longAxis) - brain.getComponent(longAxis);
    headSign = distToMin < distToMax ? -1 : 1;
  }

  return {
    box: sourceBox.clone(),
    size,
    center,
    axes,
    longAxis,
    brain,
    posterior,
    headSign,
  };
}

export async function loadRegisteredSkeleton(urls, target) {
  let lastError = null;
  for (const url of urls) {
    try {
      const geometry = await new STLLoader().loadAsync(url);
      registerSkeletonToBrain(geometry, target);
      return geometry;
    } catch (error) {
      lastError = error;
      console.warn('Skeleton source failed', url, error);
    }
  }
  throw lastError || new Error('骨格データを取得できませんでした。');
}

function registerSkeletonToBrain(geometry, target) {
  geometry.computeBoundingBox();
  const sourceBox = geometry.boundingBox.clone();
  const sourceSize = sourceBox.getSize(new THREE.Vector3());
  const sourceAxes = [0, 1, 2].sort((a, b) => sourceSize.getComponent(b) - sourceSize.getComponent(a));
  const sourceLongAxis = sourceAxes[0];
  const sourceHead = detectSourceHead(geometry.getAttribute('position'), sourceBox, sourceLongAxis);

  const mapTargetToSource = [0, 0, 0];
  for (let rank = 0; rank < 3; rank += 1) {
    mapTargetToSource[target.axes[rank]] = sourceAxes[rank];
  }

  const targetLength = target.size.getComponent(target.longAxis);
  const sourceLength = Math.max(sourceSize.getComponent(sourceLongAxis), 1e-6);
  const scale = (targetLength / sourceLength) * 0.965;

  const targetHeadIsMax = target.headSign > 0;
  const sourceHeadIsMax = sourceHead.side === 'max';
  const longSign = targetHeadIsMax === sourceHeadIsMax ? 1 : -1;
  const axisSign = [1, 1, 1];
  axisSign[target.longAxis] = longSign;

  const position = geometry.getAttribute('position');
  const original = new THREE.Vector3();
  const delta = new THREE.Vector3();
  const mapped = new THREE.Vector3();

  for (let i = 0; i < position.count; i += 1) {
    original.fromBufferAttribute(position, i);
    delta.copy(original).sub(sourceHead.anchor);

    for (let targetAxis = 0; targetAxis < 3; targetAxis += 1) {
      const sourceAxis = mapTargetToSource[targetAxis];
      const value = delta.getComponent(sourceAxis) * axisSign[targetAxis] * scale;
      mapped.setComponent(targetAxis, target.brain.getComponent(targetAxis) + value);
    }
    position.setXYZ(i, mapped.x, mapped.y, mapped.z);
  }

  position.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  // Use the target brain centre as the pivot for small manual corrections.
  geometry.translate(-target.brain.x, -target.brain.y, -target.brain.z);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
}

function detectSourceHead(position, sourceBox, longAxis) {
  const min = sourceBox.min.getComponent(longAxis);
  const max = sourceBox.max.getComponent(longAxis);
  const length = Math.max(max - min, 1e-6);
  const sourceSize = sourceBox.getSize(new THREE.Vector3());
  const otherAxes = [0, 1, 2].filter((axis) => axis !== longAxis);

  const summarize = (side) => {
    const centroid = new THREE.Vector3();
    const lo = [Infinity, Infinity, Infinity];
    const hi = [-Infinity, -Infinity, -Infinity];
    let count = 0;
    const vertex = new THREE.Vector3();

    for (let i = 0; i < position.count; i += 1) {
      vertex.fromBufferAttribute(position, i);
      const rel = (vertex.getComponent(longAxis) - min) / length;
      const inside = side === 'min' ? rel <= 0.24 : rel >= 0.76;
      if (!inside) continue;

      centroid.add(vertex);
      count += 1;
      for (const axis of otherAxes) {
        lo[axis] = Math.min(lo[axis], vertex.getComponent(axis));
        hi[axis] = Math.max(hi[axis], vertex.getComponent(axis));
      }
    }

    if (count) centroid.multiplyScalar(1 / count);
    const spanA = count
      ? Math.max(hi[otherAxes[0]] - lo[otherAxes[0]], sourceSize.getComponent(otherAxes[0]) * 0.01)
      : 0;
    const spanB = count
      ? Math.max(hi[otherAxes[1]] - lo[otherAxes[1]], sourceSize.getComponent(otherAxes[1]) * 0.01)
      : 0;
    return {
      side,
      anchor: centroid,
      count,
      score: count * Math.sqrt(spanA * spanB),
    };
  };

  const minEnd = summarize('min');
  const maxEnd = summarize('max');
  const result = minEnd.score >= maxEnd.score ? minEnd : maxEnd;

  if (!result.count) {
    result.anchor.copy(sourceBox.getCenter(new THREE.Vector3()));
    result.anchor.setComponent(longAxis, result.side === 'min' ? min : max);
  }
  return result;
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
    '<p>頭蓋を脳の位置へ自動整列した後の微調整です。値はこのブラウザに保存されます。</p>' +
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
