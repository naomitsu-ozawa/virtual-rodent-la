import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const app = document.querySelector('#app');
if (!app) throw new Error('Application root was not found.');

app.innerHTML = `
  <main class="app-shell">
    <header class="topbar">
      <div>
        <p class="eyebrow">DIGIMOUSE ANATOMY DEMO</p>
        <h1>Virtual Rodent Lab</h1>
        <p class="subtitle">Digimouse由来の解剖レイヤーをWebGPUで表示</p>
      </div>
      <div id="gpu-status" class="status status-checking">WEBGPU CHECKING</div>
    </header>

    <section class="viewer-card" aria-label="3D mouse anatomy viewer">
      <div id="viewport" class="viewport"></div>

      <aside class="layer-panel" aria-label="Anatomy layers">
        <div class="panel-title">表示する組織</div>
        <label><input type="checkbox" data-layer="skin" checked>皮膚</label>
        <label><input type="checkbox" data-layer="skeleton" checked>骨格</label>
        <label><input type="checkbox" data-layer="heart" checked>心臓</label>
        <label><input type="checkbox" data-layer="liver" checked>肝臓</label>
        <label><input type="checkbox" data-layer="kidneys" checked>腎臓</label>
        <label><input type="checkbox" data-layer="lungs" checked>肺</label>
      </aside>

      <div class="viewer-help">
        <span>ドラッグ：回転</span>
        <span>ホイール：拡大・縮小</span>
      </div>
    </section>

    <footer>
      <span>Digimouse由来の低解像度プレビューです。</span>
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
    viewport.innerHTML = '<div class="error-panel"><strong>3Dデータの読み込みに失敗しました。</strong><span>ページを再読み込みしてください。</span></div>';
  });
}

async function loadEmbeddedGlb() {
  const response = await fetch('./models/digimouse_micro.b64?v=2', { cache: 'no-store' });
  if (!response.ok) throw new Error(`Model fetch failed: ${response.status}`);
  const encoded = (await response.text()).trim();
  const raw = atob(encoded);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);

  const loader = new GLTFLoader();
  return new Promise((resolve, reject) => {
    loader.parse(bytes.buffer, '', resolve, reject);
  });
}

async function startDemo() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf4f1eb);

  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0, 1.8, 8.0);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGPURenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  await renderer.init();

  const backendName = renderer.backend.constructor.name;
  const usingWebGPU = backendName.toLowerCase().includes('webgpu');
  status.textContent = usingWebGPU ? 'WEBGPU ACTIVE' : `BACKEND: ${backendName}`;
  status.className = usingWebGPU ? 'status status-ok' : 'status status-warning';
  viewport.appendChild(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x62594f, 2.2));
  const keyLight = new THREE.DirectionalLight(0xffffff, 3.1);
  keyLight.position.set(4, 6, 5);
  scene.add(keyLight);
  const fillLight = new THREE.DirectionalLight(0xddeaff, 1.2);
  fillLight.position.set(-4, 1, 3);
  scene.add(fillLight);

  const platform = new THREE.Mesh(
    new THREE.CylinderGeometry(3.7, 3.7, 0.08, 72),
    new THREE.MeshStandardMaterial({ color: 0xd9d3c9, roughness: 0.95 }),
  );
  platform.position.y = -1.65;
  scene.add(platform);

  const gltf = await loadEmbeddedGlb();
  const mouse = gltf.scene;
  const tissues = new Map();

  const styles = {
    skin: { color: 0xd7beaa, opacity: 0.22 },
    skeleton: { color: 0xebe6d0, opacity: 1 },
    heart: { color: 0xaa3c41, opacity: 1 },
    liver: { color: 0x964b41, opacity: 1 },
    kidneys: { color: 0x7d4b37, opacity: 1 },
    lungs: { color: 0xdc919b, opacity: 0.95 },
  };

  mouse.traverse((object) => {
    if (!object.isMesh) return;
    const lower = object.name.toLowerCase();
    const tissue = Object.keys(styles).find((key) => lower.includes(key));
    if (!tissue) return;

    if (!object.geometry.getAttribute('normal')) object.geometry.computeVertexNormals();
    const style = styles[tissue];
    const transparent = style.opacity < 1;
    object.material = new THREE.MeshStandardMaterial({
      color: style.color,
      roughness: tissue === 'skeleton' ? 0.78 : 0.68,
      metalness: 0,
      transparent,
      opacity: style.opacity,
      depthWrite: tissue !== 'skin',
      side: THREE.DoubleSide,
    });
    tissues.set(tissue, object);
  });

  mouse.rotation.z = -Math.PI / 2;
  mouse.updateMatrixWorld(true);

  let bounds = new THREE.Box3().setFromObject(mouse);
  const size = bounds.getSize(new THREE.Vector3());
  mouse.scale.setScalar(5.8 / Math.max(size.x, size.y, size.z));
  mouse.updateMatrixWorld(true);

  bounds = new THREE.Box3().setFromObject(mouse);
  const center = bounds.getCenter(new THREE.Vector3());
  mouse.position.sub(center);
  mouse.position.y = 0.15;
  scene.add(mouse);

  layerInputs.forEach((input) => {
    input.addEventListener('change', () => {
      const mesh = tissues.get(input.dataset.layer);
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
