import * as THREE from 'three/webgpu';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';

const STORAGE_KEY = 'virtual-rodent-bone-registration-v4';
const DEFAULT_ADJUST = Object.freeze({
  offsetX: 0,
  offsetY: 0,
  offsetZ: 0,
  scale: 1,
  rotX: 0,
  rotY: 0,
  rotZ: 0,
  flipLR: false,
  flipUD: false,
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

function meanOfLabels(nifti, stats, ids, fallback) {
  const points = ids.map((id) => centerOfLabel(nifti, stats, id)).filter(Boolean);
  if (!points.length) return fallback.clone();
  const out = new THREE.Vector3();
  for (const p of points) out.add(p);
  return out.multiplyScalar(1 / points.length);
}

export function buildTargetLandmarks(nifti, stats, sourceBox) {
  const size = sourceBox.getSize(new THREE.Vector3());
  const center = sourceBox.getCenter(new THREE.Vector3());

  const brain = centerOfLabel(nifti, stats, 5) || center.clone();
  const thorax = meanOfLabels(nifti, stats, [3, 4, 9], center);
  const abdomen = meanOfLabels(nifti, stats, [8, 11, 2, 12], center);
  const pelvis = meanOfLabels(nifti, stats, [22, 18, 19, 21], centerOfLabel(nifti, stats, 2) || center);

  // Keep the centreline ordered head -> thorax -> abdomen -> pelvis.
  const points = [brain, thorax, abdomen, pelvis].map((p) => p.clone());
  const frame = makeFrame(points[0], points[1], points[3]);

  return {
    box: sourceBox.clone(),
    size,
    center,
    brain,
    thorax,
    abdomen,
    pelvis,
    points,
    frame,
  };
}

export async function loadRegisteredSkeleton(urls, target) {
  let lastError = null;
  for (const url of urls) {
    try {
      const geometry = await new STLLoader().loadAsync(url);
      warpSkeletonToTarget(geometry, target);
      return geometry;
    } catch (error) {
      lastError = error;
      console.warn('Skeleton source failed', url, error);
    }
  }
  throw lastError || new Error('骨格データを取得できませんでした。');
}

function warpSkeletonToTarget(geometry, target) {
  geometry.computeBoundingBox();
  const position = geometry.getAttribute('position');
  const sourceBox = geometry.boundingBox.clone();
  const sourceSize = sourceBox.getSize(new THREE.Vector3());
  const sourceAxes = [0, 1, 2].sort((a, b) => sourceSize.getComponent(b) - sourceSize.getComponent(a));
  const longAxis = sourceAxes[0];

  const minEnd = regionBoxCenter(position, sourceBox, longAxis, 'min', 0.00, 0.22);
  const maxEnd = regionBoxCenter(position, sourceBox, longAxis, 'max', 0.00, 0.22);
  const headSide = minEnd.score >= maxEnd.score ? 'min' : 'max';

  const head = regionBoxCenter(position, sourceBox, longAxis, headSide, 0.00, 0.22);
  const thorax = regionBoxCenter(position, sourceBox, longAxis, headSide, 0.23, 0.45);
  const abdomen = regionBoxCenter(position, sourceBox, longAxis, headSide, 0.43, 0.61);
  const pelvis = regionBoxCenter(position, sourceBox, longAxis, headSide, 0.60, 0.80);

  const sourceFrame = makeFrame(head.anchor, thorax.anchor, pelvis.anchor);
  const sourcePoints = [head.anchor, thorax.anchor, abdomen.anchor, pelvis.anchor];
  const targetPoints = target.points;

  const sx = sourcePoints.map((p) => p.clone().sub(head.anchor).dot(sourceFrame.x));
  // Force monotonic longitudinal positions in case a local box centre is noisy.
  for (let i = 1; i < sx.length; i += 1) {
    if (sx[i] <= sx[i - 1]) sx[i] = sx[i - 1] + Math.max(sourceSize.getComponent(longAxis) * 0.02, 1e-3);
  }

  const sourceBodyLength = Math.max(sx[3] - sx[0], 1e-6);
  const targetBodyLength = polylineLength(targetPoints);
  const lateralScale = (targetBodyLength / sourceBodyLength) * 0.94;

  const sourceY = sourceFrame.y;
  const sourceZ = sourceFrame.z;
  const original = new THREE.Vector3();
  const delta = new THREE.Vector3();
  const mapped = new THREE.Vector3();

  for (let i = 0; i < position.count; i += 1) {
    original.fromBufferAttribute(position, i);
    delta.copy(original).sub(head.anchor);

    const longitudinal = delta.dot(sourceFrame.x);
    const lateralY = delta.dot(sourceY) * lateralScale;
    const lateralZ = delta.dot(sourceZ) * lateralScale;

    const placement = mapLongitudinalToTarget(longitudinal, sx, targetPoints, target.frame);
    mapped.copy(placement.center)
      .addScaledVector(placement.y, lateralY)
      .addScaledVector(placement.z, lateralZ);

    position.setXYZ(i, mapped.x, mapped.y, mapped.z);
  }

  position.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  // Fine adjustments rotate/translate around the brain centre.
  geometry.translate(-target.brain.x, -target.brain.y, -target.brain.z);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
}

function mapLongitudinalToTarget(x, sourceX, targetPoints, targetFrame) {
  let segment;
  let alpha;

  if (x <= sourceX[0]) {
    segment = 0;
    alpha = (x - sourceX[0]) / Math.max(sourceX[1] - sourceX[0], 1e-6);
  } else if (x >= sourceX[sourceX.length - 1]) {
    segment = sourceX.length - 2;
    alpha = 1 + (x - sourceX[sourceX.length - 1]) /
      Math.max(sourceX[sourceX.length - 1] - sourceX[sourceX.length - 2], 1e-6);
  } else {
    segment = 0;
    while (segment < sourceX.length - 2 && x > sourceX[segment + 1]) segment += 1;
    alpha = (x - sourceX[segment]) /
      Math.max(sourceX[segment + 1] - sourceX[segment], 1e-6);
  }

  const a = targetPoints[segment];
  const b = targetPoints[segment + 1];
  const center = a.clone().lerp(b, alpha);
  const tangent = b.clone().sub(a);
  if (tangent.lengthSq() < 1e-8) tangent.copy(targetFrame.x);
  tangent.normalize();

  // Carry a stable dorsoventral direction along the bent centreline.
  const y = targetFrame.y.clone().addScaledVector(tangent, -targetFrame.y.dot(tangent));
  if (y.lengthSq() < 1e-8) {
    y.copy(targetFrame.z).addScaledVector(tangent, -targetFrame.z.dot(tangent));
  }
  y.normalize();

  const z = new THREE.Vector3().crossVectors(tangent, y).normalize();
  y.crossVectors(z, tangent).normalize();

  return { center, x: tangent, y, z };
}

function makeFrame(head, thorax, pelvis) {
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
  y.crossVectors(z, x).normalize();

  return { x, y, z };
}

function regionBoxCenter(position, box, longAxis, headSide, fromHead, toHead) {
  const min = box.min.getComponent(longAxis);
  const max = box.max.getComponent(longAxis);
  const length = Math.max(max - min, 1e-6);
  const regionMin = new THREE.Vector3(Infinity, Infinity, Infinity);
  const regionMax = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
  const centroid = new THREE.Vector3();
  const vertex = new THREE.Vector3();
  let count = 0;

  for (let i = 0; i < position.count; i += 1) {
    vertex.fromBufferAttribute(position, i);
    let t = (vertex.getComponent(longAxis) - min) / length;
    if (headSide === 'max') t = 1 - t;
    if (t < fromHead || t > toHead) continue;

    regionMin.min(vertex);
    regionMax.max(vertex);
    centroid.add(vertex);
    count += 1;
  }

  if (!count) {
    const fallback = box.getCenter(new THREE.Vector3());
    return { anchor: fallback, score: 0, side: headSide };
  }

  centroid.multiplyScalar(1 / count);
  const boxCenter = regionMin.clone().add(regionMax).multiplyScalar(0.5);
  const anchor = boxCenter.lerp(centroid, 0.35);
  const regionSize = regionMax.clone().sub(regionMin);
  const otherAxes = [0, 1, 2].filter((axis) => axis !== longAxis);
  const crossSection = Math.max(regionSize.getComponent(otherAxes[0]), 1e-6) *
    Math.max(regionSize.getComponent(otherAxes[1]), 1e-6);
  const score = count * Math.sqrt(crossSection);

  return { anchor, score, side: headSide };
}

function polylineLength(points) {
  let length = 0;
  for (let i = 1; i < points.length; i += 1) length += points[i].distanceTo(points[i - 1]);
  return length;
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
    '<div class="bone-adjust-title"><strong>骨格向き・位置調整</strong><button type="button" data-bone-close aria-label="閉じる">×</button></div>' +
    '<p>回転・左右反転・上下反転で骨格の向きを合わせ、その後に位置を微調整できます。値はこのブラウザに保存されます。</p>' +
    '<div class="bone-orient-actions">' +
      '<button type="button" data-rotate-axis="x" data-rotate-delta="-90">X −90°</button>' +
      '<button type="button" data-rotate-axis="x" data-rotate-delta="90">X +90°</button>' +
      '<button type="button" data-rotate-axis="y" data-rotate-delta="-90">Y −90°</button>' +
      '<button type="button" data-rotate-axis="y" data-rotate-delta="90">Y +90°</button>' +
      '<button type="button" data-rotate-axis="z" data-rotate-delta="-90">Z −90°</button>' +
      '<button type="button" data-rotate-axis="z" data-rotate-delta="90">Z +90°</button>' +
    '</div>' +
    '<div class="bone-flip-actions">' +
      '<button type="button" data-flip-key="flipLR">左右反転</button>' +
      '<button type="button" data-flip-key="flipUD">上下反転</button>' +
    '</div>' +
    sliderRow('位置X', 'offsetX', -0.25, 0.25, 0.005) +
    sliderRow('位置Y', 'offsetY', -0.25, 0.25, 0.005) +
    sliderRow('位置Z', 'offsetZ', -0.25, 0.25, 0.005) +
    sliderRow('拡大率', 'scale', 0.70, 1.30, 0.005) +
    sliderRow('回転X', 'rotX', -180, 180, 1) +
    sliderRow('回転Y', 'rotY', -180, 180, 1) +
    sliderRow('回転Z', 'rotZ', -180, 180, 1) +
    '<div class="bone-adjust-actions"><button type="button" data-bone-reset>自動位置に戻す</button></div>';
  container.appendChild(panel);

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'bone-adjust-toggle';
  toggle.textContent = '骨格向き調整';
  help.appendChild(toggle);

  const ranges = [...panel.querySelectorAll('[data-bone-adjust]')];
  const rotateButtons = [...panel.querySelectorAll('[data-rotate-axis]')];
  const flipButtons = [...panel.querySelectorAll('[data-flip-key]')];

  const clampAngle = (value) => {
    let angle = Number(value) % 360;
    if (angle > 180) angle -= 360;
    if (angle < -180) angle += 360;
    return angle;
  };

  const updateUI = () => {
    for (const range of ranges) {
      const key = range.dataset.boneAdjust;
      range.value = String(adjust[key]);
      const output = panel.querySelector('[data-bone-output="' + key + '"]');
      if (output) {
        output.value = key.startsWith('rot')
          ? Number(adjust[key]).toFixed(0) + '°'
          : Number(adjust[key]).toFixed(3);
      }
    }
    for (const button of flipButtons) {
      const key = button.dataset.flipKey;
      const active = Boolean(adjust[key]);
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    }
  };

  for (const range of ranges) {
    range.addEventListener('input', () => {
      const key = range.dataset.boneAdjust;
      adjust[key] = key.startsWith('rot')
        ? clampAngle(Number(range.value))
        : Number(range.value);
      saveAdjust(adjust);
      updateUI();
      onChange();
    });
  }

  for (const button of rotateButtons) {
    button.addEventListener('click', () => {
      const axis = button.dataset.rotateAxis;
      const delta = Number(button.dataset.rotateDelta);
      const key = axis === 'x' ? 'rotX' : axis === 'y' ? 'rotY' : 'rotZ';
      adjust[key] = clampAngle(adjust[key] + delta);
      saveAdjust(adjust);
      updateUI();
      onChange();
    });
  }

  for (const button of flipButtons) {
    button.addEventListener('click', () => {
      const key = button.dataset.flipKey;
      adjust[key] = !adjust[key];
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
      mesh.scale.set(
        (adjust.flipLR ? -1 : 1) * adjust.scale,
        (adjust.flipUD ? -1 : 1) * adjust.scale,
        adjust.scale,
      );
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
