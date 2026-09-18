import * as THREE from 'three/webgpu';
import './style.css';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('Application root was not found.');
}

app.innerHTML = `
  <main class="app-shell">
    <header class="topbar">
      <div>
        <p class="eyebrow">EARLY DEMO</p>
        <h1>Virtual Rodent Lab</h1>
        <p class="subtitle">WebGPU-based virtual rodent training prototype</p>
      </div>
      <div id="gpu-status" class="status status-checking">WebGPU CHECKING</div>
    </header>

    <section class="viewer-card" aria-label="3D rodent viewer">
      <div id="viewport" class="viewport"></div>
      <div class="viewer-help">
        <span>ドラッグ：回転</span>
        <span>ホイール：拡大・縮小</span>
      </div>
    </section>

    <footer>
      <p>Placeholder geometry only — anatomical data is not included yet.</p>
    </footer>
  </main>
`;

const viewport = document.querySelector<HTMLDivElement>('#viewport');
const status = document.querySelector<HTMLDivElement>('#gpu-status');

if (!viewport || !status) {
  throw new Error('Viewer UI was not initialized.');
}

const hasWebGPU = 'gpu' in navigator;

if (!hasWebGPU) {
  status.textContent = 'WEBGPU UNAVAILABLE';
  status.className = 'status status-error';
  viewport.innerHTML = `
    <div class="error-panel">
      <strong>WebGPUを利用できません。</strong>
      <span>Safari 26以降など、WebGPU対応ブラウザで開いてください。</span>
    </div>
  `;
} else {
  void startDemo();
}

async function startDemo(): Promise<void> {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf4f1eb);

  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0, 2.2, 7.8);

  const renderer = new THREE.WebGPURenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  await renderer.init();

  const backendName = renderer.backend.constructor.name;
  const usingWebGPU = backendName.toLowerCase().includes('webgpu');

  status.textContent = usingWebGPU ? 'WEBGPU ACTIVE' : `BACKEND: ${backendName}`;
  status.className = usingWebGPU ? 'status status-ok' : 'status status-warning';

  viewport.appendChild(renderer.domElement);

  const hemisphere = new THREE.HemisphereLight(0xffffff, 0x6e6258, 2.2);
  scene.add(hemisphere);

  const keyLight = new THREE.DirectionalLight(0xffffff, 3.0);
  keyLight.position.set(4, 6, 5);
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0xd9e9ff, 1.1);
  fillLight.position.set(-4, 2, 2);
  scene.add(fillLight);

  const platform = new THREE.Mesh(
    new THREE.CylinderGeometry(3.2, 3.2, 0.12, 96),
    new THREE.MeshStandardMaterial({ color: 0xd9d3c9, roughness: 0.95 }),
  );
  platform.position.y = -1.25;
  scene.add(platform);

  const rodent = createPlaceholderRodent();
  rodent.rotation.y = -0.35;
  scene.add(rodent);

  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let cameraDistance = 7.8;

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

    rodent.rotation.y += dx * 0.008;
    rodent.rotation.x = THREE.MathUtils.clamp(rodent.rotation.x + dy * 0.006, -0.55, 0.55);
  });

  renderer.domElement.addEventListener('pointerup', (event) => {
    dragging = false;
    renderer.domElement.releasePointerCapture(event.pointerId);
  });

  renderer.domElement.addEventListener('pointercancel', () => {
    dragging = false;
  });

  renderer.domElement.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault();
      cameraDistance = THREE.MathUtils.clamp(cameraDistance + event.deltaY * 0.006, 4.5, 11);
      camera.position.z = cameraDistance;
    },
    { passive: false },
  );

  const resize = () => {
    const { clientWidth, clientHeight } = viewport;
    camera.aspect = clientWidth / Math.max(clientHeight, 1);
    camera.updateProjectionMatrix();
    renderer.setSize(clientWidth, clientHeight, false);
  };

  const observer = new ResizeObserver(resize);
  observer.observe(viewport);
  resize();

  renderer.setAnimationLoop(() => {
    renderer.render(scene, camera);
  });
}

function createPlaceholderRodent(): THREE.Group {
  const group = new THREE.Group();

  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: 0xc8beb1,
    roughness: 0.82,
  });
  const earMaterial = new THREE.MeshStandardMaterial({
    color: 0xd9a6a0,
    roughness: 0.9,
  });
  const darkMaterial = new THREE.MeshStandardMaterial({
    color: 0x2c2927,
    roughness: 0.6,
  });

  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 40), bodyMaterial);
  body.scale.set(2.15, 0.95, 1.0);
  group.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.72, 48, 32), bodyMaterial);
  head.scale.set(1.08, 0.86, 0.9);
  head.position.set(2.0, 0.08, 0);
  group.add(head);

  const snout = new THREE.Mesh(new THREE.SphereGeometry(0.38, 40, 24), bodyMaterial);
  snout.scale.set(1.2, 0.7, 0.72);
  snout.position.set(2.67, -0.03, 0);
  group.add(snout);

  for (const z of [-0.48, 0.48]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.28, 32, 20), earMaterial);
    ear.scale.set(0.72, 1.05, 0.34);
    ear.position.set(1.72, 0.66, z);
    group.add(ear);

    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.075, 20, 12), darkMaterial);
    eye.position.set(2.36, 0.25, z * 0.78);
    group.add(eye);
  }

  const tailCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-2.0, -0.15, 0),
    new THREE.Vector3(-2.9, -0.22, 0.08),
    new THREE.Vector3(-3.8, -0.12, 0.28),
    new THREE.Vector3(-4.7, 0.02, 0.18),
  ]);
  const tail = new THREE.Mesh(
    new THREE.TubeGeometry(tailCurve, 64, 0.095, 14, false),
    earMaterial,
  );
  group.add(tail);

  group.position.y = 0.15;
  return group;
}
