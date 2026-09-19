import * as THREE from 'three/webgpu';
import './style.css';
import {
  formatBytes,
  formatSpacing,
  groupDicomSeries,
  parseDicomFiles,
  type DicomSeriesSummary,
} from './dicom';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('Application root was not found.');
}

app.innerHTML = `
  <main class="app-shell">
    <header class="topbar">
      <div>
        <p class="eyebrow">SMALL-ANIMAL CT / WEBGPU</p>
        <h1>Virtual Rodent Lab</h1>
        <p class="subtitle">Local DICOM viewer for mouse and laboratory-animal CT</p>
      </div>
      <div class="topbar-actions">
        <div id="gpu-status" class="status status-checking">WebGPU CHECKING</div>
        <button id="open-folder" class="primary-button" type="button">DICOMフォルダを開く</button>
        <input id="folder-input" class="visually-hidden" type="file" webkitdirectory multiple />
      </div>
    </header>

    <section class="workspace">
      <aside class="sidebar">
        <section class="panel">
          <div class="panel-heading">
            <div>
              <p class="panel-kicker">DATASET</p>
              <h2>DICOM Series</h2>
            </div>
          </div>

          <div id="scan-state" class="empty-state">
            <strong>フォルダを選択してください</strong>
            <span>DICOMはサーバーへ送信せず、ブラウザ内で解析します。</span>
          </div>

          <div id="scan-progress" class="progress-wrap is-hidden" aria-live="polite">
            <div class="progress-track"><div id="scan-progress-bar" class="progress-bar"></div></div>
            <span id="scan-progress-label">0 / 0</span>
          </div>

          <div id="series-list" class="series-list"></div>
        </section>

        <section class="panel compact-panel">
          <div class="panel-heading">
            <div>
              <p class="panel-kicker">PIPELINE</p>
              <h2>画像処理</h2>
            </div>
          </div>
          <div class="tool-grid">
            <button class="tool-chip" disabled>Window / Level</button>
            <button class="tool-chip" disabled>NLM</button>
            <button class="tool-chip" disabled>Anisotropic Diffusion</button>
            <button class="tool-chip" disabled>Spike / Hole</button>
            <button class="tool-chip" disabled>Bone</button>
            <button class="tool-chip" disabled>Soft tissue</button>
            <button class="tool-chip" disabled>Fat</button>
          </div>
          <p class="hint">Seriesを選択後、順次有効化します。</p>
        </section>
      </aside>

      <section class="viewer-grid" aria-label="DICOM viewer">
        <section class="viewport-card viewport-card-main">
          <div class="viewport-label">
            <strong>3D</strong>
            <span>WebGPU</span>
          </div>
          <div id="viewport-3d" class="viewport viewport-3d"></div>
          <div id="selected-series" class="selected-series-overlay">
            <strong>Series未選択</strong>
            <span>左の一覧からDICOM Seriesを選択してください。</span>
          </div>
        </section>

        <section class="mpr-column">
          <article class="viewport-card mpr-card">
            <div class="viewport-label"><strong>Axial</strong><span>—</span></div>
            <div class="mpr-placeholder"><span>Axial</span></div>
          </article>
          <article class="viewport-card mpr-card">
            <div class="viewport-label"><strong>Coronal</strong><span>—</span></div>
            <div class="mpr-placeholder"><span>Coronal</span></div>
          </article>
          <article class="viewport-card mpr-card">
            <div class="viewport-label"><strong>Sagittal</strong><span>—</span></div>
            <div class="mpr-placeholder"><span>Sagittal</span></div>
          </article>
        </section>
      </section>
    </section>

    <footer>
      <span>Original CT values are preserved. Heavy volume processing starts only after Series selection.</span>
    </footer>
  </main>
`;

const viewport = mustElement<HTMLDivElement>('#viewport-3d');
const status = mustElement<HTMLDivElement>('#gpu-status');
const openFolderButton = mustElement<HTMLButtonElement>('#open-folder');
const folderInput = mustElement<HTMLInputElement>('#folder-input');
const scanState = mustElement<HTMLDivElement>('#scan-state');
const progressWrap = mustElement<HTMLDivElement>('#scan-progress');
const progressBar = mustElement<HTMLDivElement>('#scan-progress-bar');
const progressLabel = mustElement<HTMLSpanElement>('#scan-progress-label');
const seriesList = mustElement<HTMLDivElement>('#series-list');
const selectedSeriesOverlay = mustElement<HTMLDivElement>('#selected-series');

let activeSeriesId: string | null = null;
let seriesSummaries: DicomSeriesSummary[] = [];

openFolderButton.addEventListener('click', () => {
  folderInput.value = '';
  folderInput.click();
});

folderInput.addEventListener('change', async () => {
  const files = Array.from(folderInput.files ?? []);
  if (files.length === 0) return;
  await inspectDirectory(files);
});

async function inspectDirectory(files: File[]): Promise<void> {
  activeSeriesId = null;
  seriesSummaries = [];
  seriesList.replaceChildren();

  scanState.classList.remove('is-hidden');
  scanState.innerHTML = '<strong>DICOMを確認中…</strong><span>Pixel Dataはまだ展開しません。</span>';
  progressWrap.classList.remove('is-hidden');
  updateProgress(0, files.length);
  openFolderButton.disabled = true;

  try {
    const slices = await parseDicomFiles(files, updateProgress);
    seriesSummaries = groupDicomSeries(slices);

    if (seriesSummaries.length === 0) {
      scanState.innerHTML =
        '<strong>DICOM Seriesを検出できませんでした</strong><span>選択したフォルダ内のファイルを確認してください。</span>';
      return;
    }

    scanState.classList.add('is-hidden');
    renderSeriesList(seriesSummaries);
  } catch (error) {
    console.error(error);
    scanState.classList.remove('is-hidden');
    scanState.innerHTML =
      '<strong>解析中にエラーが発生しました</strong><span>この段階ではファイルの変更やアップロードは行っていません。</span>';
  } finally {
    openFolderButton.disabled = false;
    progressWrap.classList.add('is-hidden');
  }
}

function updateProgress(completed: number, total: number): void {
  const ratio = total > 0 ? completed / total : 0;
  progressBar.style.width = `${Math.round(ratio * 100)}%`;
  progressLabel.textContent = `${completed.toLocaleString()} / ${total.toLocaleString()}`;
}

function renderSeriesList(series: DicomSeriesSummary[]): void {
  seriesList.replaceChildren();

  for (const summary of series) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'series-card';
    card.dataset.seriesId = summary.id;

    const header = document.createElement('div');
    header.className = 'series-card-header';

    const titleWrap = document.createElement('div');
    const modality = document.createElement('span');
    modality.className = 'modality-badge';
    modality.textContent = summary.modality || 'Unknown';

    const title = document.createElement('strong');
    title.textContent = summary.description;

    titleWrap.append(modality, title);

    const size = document.createElement('strong');
    size.className = 'memory-estimate';
    size.textContent = formatBytes(summary.estimatedBytes);

    header.append(titleWrap, size);

    const grid = document.createElement('dl');
    grid.className = 'series-meta-grid';
    addMeta(grid, 'Slices', summary.slices.length.toLocaleString());
    addMeta(grid, 'Matrix', `${summary.columns} × ${summary.rows}`);
    addMeta(
      grid,
      'Voxel',
      `${formatSpacing(summary.spacingX)} × ${formatSpacing(summary.spacingY)} × ${formatSpacing(summary.spacingZ)}`,
    );
    addMeta(grid, 'Stored', `${summary.bitsAllocated}-bit`);
    addMeta(
      grid,
      'Slope',
      summary.slopeRange[0] === summary.slopeRange[1]
        ? String(summary.slopeRange[0])
        : `${summary.slopeRange[0]} – ${summary.slopeRange[1]}`,
    );
    addMeta(
      grid,
      'Intercept',
      summary.interceptRange[0] === summary.interceptRange[1]
        ? String(summary.interceptRange[0])
        : `${summary.interceptRange[0]} – ${summary.interceptRange[1]}`,
    );

    const note = document.createElement('p');
    note.className = 'series-note';
    note.textContent = `推定展開サイズ: ${formatBytes(summary.estimatedBytes)} / Transfer Syntax: ${summary.transferSyntaxes.join(', ')}`;

    card.append(header, grid, note);
    card.addEventListener('click', () => selectSeries(summary));
    seriesList.append(card);
  }
}

function selectSeries(summary: DicomSeriesSummary): void {
  activeSeriesId = summary.id;

  for (const node of seriesList.querySelectorAll<HTMLElement>('.series-card')) {
    node.classList.toggle('is-selected', node.dataset.seriesId === activeSeriesId);
  }

  selectedSeriesOverlay.replaceChildren();

  const title = document.createElement('strong');
  title.textContent = summary.description;

  const detail = document.createElement('span');
  detail.textContent =
    `${summary.modality} · ${summary.slices.length.toLocaleString()} slices · ` +
    `${summary.columns}×${summary.rows} · ${formatBytes(summary.estimatedBytes)}`;

  const ready = document.createElement('span');
  ready.className = 'ready-badge';
  ready.textContent = 'Volume decode ready';

  selectedSeriesOverlay.append(title, detail, ready);
}

function addMeta(container: HTMLDListElement, label: string, value: string): void {
  const item = document.createElement('div');
  const dt = document.createElement('dt');
  const dd = document.createElement('dd');
  dt.textContent = label;
  dd.textContent = value;
  item.append(dt, dd);
  container.append(item);
}

function mustElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Required element not found: ${selector}`);
  return element;
}

const hasWebGPU = 'gpu' in navigator;

if (!hasWebGPU) {
  status.textContent = 'WEBGPU UNAVAILABLE';
  status.className = 'status status-error';
  viewport.innerHTML = `
    <div class="error-panel">
      <strong>WebGPUを利用できません。</strong>
      <span>WebGPU対応ブラウザで開いてください。</span>
    </div>
  `;
} else {
  void startWebGpuViewport();
}

async function startWebGpuViewport(): Promise<void> {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x111416);

  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0, 1.4, 6.6);

  const renderer = new THREE.WebGPURenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  await renderer.init();

  const backendName = renderer.backend.constructor.name;
  const usingWebGPU = backendName.toLowerCase().includes('webgpu');

  status.textContent = usingWebGPU ? 'WEBGPU ACTIVE' : `BACKEND: ${backendName}`;
  status.className = usingWebGPU ? 'status status-ok' : 'status status-warning';

  viewport.appendChild(renderer.domElement);

  const grid = new THREE.GridHelper(6, 12, 0x52606a, 0x293036);
  grid.rotation.x = Math.PI / 2;
  scene.add(grid);

  const frame = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(2.8, 2.8, 4.2)),
    new THREE.LineBasicMaterial({ color: 0x6f7f89, transparent: true, opacity: 0.55 }),
  );
  frame.rotation.x = 0.14;
  frame.rotation.y = -0.25;
  scene.add(frame);

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
