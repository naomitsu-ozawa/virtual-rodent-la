import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const tissues = [
  { id: 1, key: 'skin', label: '皮膚', color: 0xd7beaa, opacity: 0.18 },
  { id: 2, key: 'skeleton', label: '骨格', color: 0xebe6d0, opacity: 1 },
  { id: 3, key: 'eye', label: '眼球', color: 0x5f8fb5, opacity: 1 },
  { id: 4, key: 'medulla', label: '延髄', color: 0xe3a7b3, opacity: 1 },
  { id: 5, key: 'cerebellum', label: '小脳', color: 0xdc91a7, opacity: 1 },
  { id: 6, key: 'olfactory_bulbs', label: '嗅球', color: 0xe8b3bf, opacity: 1 },
  { id: 7, key: 'external_cerebrum', label: '大脳（外側）', color: 0xd38c9f, opacity: 1 },
  { id: 8, key: 'striatum', label: '線条体', color: 0xb76f89, opacity: 1 },
  { id: 9, key: 'heart', label: '心臓', color: 0xaa3c41, opacity: 1 },
  { id: 10, key: 'rest_of_brain', label: 'その他の脳', color: 0xc9829a, opacity: 1 },
  { id: 11, key: 'masseter_muscles', label: '咬筋', color: 0xad625e, opacity: 1 },
  { id: 12, key: 'lachrymal_glands', label: '涙腺', color: 0xd29f96, opacity: 1 },
  { id: 13, key: 'bladder', label: '膀胱', color: 0xd9ad7d, opacity: 1 },
  { id: 14, key: 'testis', label: '精巣', color: 0xd2b98f, opacity: 1 },
  { id: 15, key: 'stomach', label: '胃', color: 0xd09b87, opacity: 1 },
  { id: 16, key: 'spleen', label: '脾臓', color: 0x90465a, opacity: 1 },
  { id: 17, key: 'pancreas', label: '膵臓', color: 0xdcb078, opacity: 1 },
  { id: 18, key: 'liver', label: '肝臓', color: 0x91463d, opacity: 1 },
  { id: 19, key: 'kidneys', label: '腎臓', color: 0x7d4b37, opacity: 1 },
  { id: 20, key: 'adrenal_glands', label: '副腎', color: 0xc79b61, opacity: 1 },
  { id: 21, key: 'lungs', label: '肺', color: 0xdc919b, opacity: 0.95 },
];

const app = document.querySelector('#app');
if (!app) throw new Error('Application root was not found.');

const layerMarkup = tissues
  .map(
    (tissue) => `
      <label>
        <input type="checkbox" data-layer="${tissue.key}" checked>
        <span>${tissue.label}</span>
      </label>`,
  )
  .join('');

app.innerHTML = `
  <main class="app-shell">
    <header class="topbar">
      <div>
        <p class="eyebrow">DIGIMOUSE ANATOMY DEMO</p>
        <h1>Virtual Rodent Lab</h1>
        <p class="subtitle">Digimouse FEM meshの全21組織をWebGPUで表示</p>
      </div>
      <div id="gpu-status" class="status status-checking">WEBGPU CHECKING</div>
    </header>

    <section class="viewer-card" aria-label="3D mouse anatomy viewer">
      <div id="viewport" class="viewport"></div>

      <aside class="layer-panel" aria-label="Anatomy layers">
        <div class="panel-title">表示する組織（21）</div>
        <div class="layer-list">${layerMarkup}</div>
      </aside>

      <div class="viewer-help">
        <span>ドラッグ：回転</span>
        <span>ホイール：拡大・縮小</span>
      </div>
    </section>

    <footer>
      <span>Digimouse FEM Mesh Version 1L の face 表面データを使用しています。</span>
    </footer>
  </main>
`;

const viewport = document.querySelector('#viewport');
const status = document.querySelector('#gpu-status');
const layerInputs = [...document.querySelectorAll('[data-layer]')];
if (!viewport || !status) throw new Error('Viewer UI was not initialized.');

if (!('gpu' in navigator)) {
  status.textContent = 'WEBGPU UNAVAILABLE';
  status.className = 'status status-error';
  viewport.innerHTML = '<div class="error-panel"><strong>WebGPUを利用できません。</strong><span>WebGPU対応ブラウザで開いてください。</span></div>';
} else {
  startDemo().catch((error) => {
    console.error(error);
    status.textContent = 'MODEL LOAD FAILED';
    status.className = 'status status-error';
    viewport.innerHTML = `<div class="error-panel"><strong>3Dデータの読み込みに失敗しました。</strong><span>${error?.message ?? 'Unknown error'}</span></div>`;
  });
}

async function loadEmbeddedGlb() {
  const partUrls = Array.from(
    { length: 15 },
    (_, index) => `./models/face_winding_parts/part_${String(index).padStart(2, '0')}.b64?v=7`,
  );

  const responses = await Promise.all(
    partUrls.map((url) => fetch(url, { cache: 'no-store' })),
  );

  responses.forEach((response, index) => {
    if (!response.ok) {
      throw new Error(`Model part ${index} fetch failed: ${response.status}`);
    }
  });

  const encoded = (await Promise.all(responses.map((response) => response.text())))
    .map((part) => part.trim())
    .join('');

  const raw = atob(encoded);
  const compressed = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    compressed[i] = raw.charCodeAt(i);
  }

  if (!('DecompressionStream' in window)) {
    throw new Error('This browser does not support gzip decompression.');
  }

  const stream = new Blob([compressed])
    .stream()
    .pipeThrough(new DecompressionStream('gzip'));
  const glb = await new Response(stream).arrayBuffer();

  if (glb.byteLength < 12) throw new Error('Model payload is too short.');
  const view = new DataView(glb);
  const magic = String.fromCharCode(...new Uint8Array(glb, 0, 4));
  const declaredLength = view.getUint32(8, true);

  if (magic !== 'glTF') throw new Error('Model payload is not a GLB file.');
  if (declaredLength !== glb.byteLength) {
    throw new Error(`GLB length mismatch: declared ${declaredLength}, actual ${glb.byteLength}`);
  }

  const loader = new GLTFLoader();
  return new Promise((resolve, reject) => {
    loader.parse(glb, '', resolve, reject);
  });
}

async function startDemo() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf4f1eb);

  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0, 1.6, 8.0);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGPURenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  await renderer.init();

  const backendName = renderer.backend.constructor.name;
  const usingWebGPU = backendName.toLowerCase().includes('webgpu');
  status.textContent = usingWebGPU ? 'WEBGPU ACTIVE' : `BACKEND: ${backendName}`;
  status.className = usingWebGPU ? 'status status-ok' : 'status status-warning';
  viewport.appendChild(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x665f57, 2.1));
  const keyLight = new THREE.DirectionalLight(0xffffff, 3.0);
  keyLight.position.set(4, 6, 5);
  scene.add(keyLight);
  const fillLight = new THREE.DirectionalLight(0xddeaff, 1.1);
  fillLight.position.set(-4, 1, 3);
  scene.add(fillLight);

  const platform = new THREE.Mesh(
    new THREE.CylinderGeometry(3.7, 3.7, 0.08, 72),
    new THREE.MeshStandardMaterial({ color: 0xd9d3c9, roughness: 0.95 }),
  );
  platform.position.y = -1.62;
  scene.add(platform);

  const gltf = await loadEmbeddedGlb();
  const mouse = gltf.scene;
  const meshByTissue = new Map();
  const definitionByKey = new Map(tissues.map((tissue) => [tissue.key, tissue]));

  mouse.traverse((object) => {
    if (!object.isMesh) return;

    const match = object.name.match(/^tissue_\d+_(.+)$/i);
    if (!match) return;
    const key = match[1].toLowerCase();
    const tissue = definitionByKey.get(key);
    if (!tissue) return;

    if (!object.geometry.getAttribute('normal')) {
      object.geometry.computeVertexNormals();
    }

    const transparent = tissue.opacity < 1;
    object.material = new THREE.MeshStandardMaterial({
      color: tissue.color,
      roughness: tissue.key === 'skeleton' ? 0.92 : 0.82,
      metalness: 0,
      transparent,
      opacity: tissue.opacity,
      depthWrite: tissue.key !== 'skin',
      side: THREE.DoubleSide,
      flatShading: false,
    });
    meshByTissue.set(tissue.key, object);
  });

  if (meshByTissue.size !== tissues.length) {
    const missing = tissues
      .filter((tissue) => !meshByTissue.has(tissue.key))
      .map((tissue) => tissue.key);
    throw new Error(`Missing tissue meshes: ${missing.join(', ')}`);
  }

  mouse.rotation.z = -Math.PI / 2;
  mouse.updateMatrixWorld(true);

  let bounds = new THREE.Box3().setFromObject(mouse);
  const size = bounds.getSize(new THREE.Vector3());
  mouse.scale.setScalar(5.8 / Math.max(size.x, size.y, size.z));
  mouse.updateMatrixWorld(true);

  bounds = new THREE.Box3().setFromObject(mouse);
  const center = bounds.getCenter(new THREE.Vector3());
  mouse.position.sub(center);
  mouse.position.y = 0.12;
  scene.add(mouse);

  layerInputs.forEach((input) => {
    input.addEventListener('change', () => {
      const mesh = meshByTissue.get(input.dataset.layer);
      if (mesh) mesh.visible = input.checked;
    });
  });

  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let cameraDistance = 8.0;

  renderer.domElement.addEventListener('pointerdown', (event) => {
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
    renderer.domElement.setPointerCapture(event.pointerId);
  });

  renderer.domElement.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
    mouse.rotation.y += dx * 0.008;
    mouse.rotation.x = THREE.MathUtils.clamp(mouse.rotation.x + dy * 0.006, -0.8, 0.8);
  });

  renderer.domElement.addEventListener('pointerup', (event) => {
    dragging = false;
    if (renderer.domElement.hasPointerCapture(event.pointerId)) {
      renderer.domElement.releasePointerCapture(event.pointerId);
    }
  });
  renderer.domElement.addEventListener('pointercancel', () => { dragging = false; });

  renderer.domElement.addEventListener('wheel', (event) => {
    event.preventDefault();
    cameraDistance = THREE.MathUtils.clamp(cameraDistance + event.deltaY * 0.006, 4.2, 12);
    camera.position.z = cameraDistance;
  }, { passive: false });

  const resize = () => {
    const { clientWidth, clientHeight } = viewport;
    camera.aspect = clientWidth / Math.max(clientHeight, 1);
    camera.updateProjectionMatrix();
    renderer.setSize(clientWidth, clientHeight, false);
  };

  new ResizeObserver(resize).observe(viewport);
  resize();
  renderer.setAnimationLoop(() => renderer.render(scene, camera));
}