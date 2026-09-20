import * as THREE from 'three/webgpu';
import './style.css';
import {
  formatBytes,
  formatSpacing,
  groupDicomSeries,
  parseDicomFiles,
  type DicomSeriesSummary,
} from './dicom';
import { loadPublicMouseDemo, PUBLIC_MOUSE_DEMO } from './demo';
import {
  decodeSeriesToCtVolume,
  renderPlaneToCanvas,
  type CtVolume,
  type Plane,
} from './volume';
import {
  DEFAULT_PROCESSING_SETTINGS,
  processVolume,
  type ProcessingSettings,
} from './processing';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) throw new Error('Application root was not found.');

app.innerHTML = `
  <main class="app-shell">
    <header class="topbar">
      <div>
        <p class="eyebrow">SMALL-ANIMAL CT / WEBGPU</p>
        <h1>Virtual Rodent Lab</h1>
        <p class="subtitle">Browser-based DICOM CT viewer for mouse and laboratory-animal imaging</p>
      </div>
      <div class="topbar-actions">
        <div id="gpu-status" class="status status-checking">WebGPU CHECKING</div>
        <button id="demo-button" class="secondary-button" type="button">公開マウスCTデモ</button>
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
            <strong>データを選択してください</strong>
            <span>ローカルフォルダ、または約20.8MBの公開マウスPET/CTデモを利用できます。</span>
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
              <p class="panel-kicker">DISPLAY</p>
              <h2>CT表示</h2>
            </div>
          </div>

          <label class="range-row">
            <span>Window Center</span>
            <output id="window-center-value">—</output>
            <input id="window-center" type="range" min="-2000" max="4000" value="500" disabled />
          </label>

          <label class="range-row">
            <span>Window Width</span>
            <output id="window-width-value">—</output>
            <input id="window-width" type="range" min="1" max="8000" value="3000" disabled />
          </label>

          <div class="filter-stack" id="filter-stack">
            ${filterControl('gaussian', 'Gaussian 3D', 0.5, 3, 0.5, 1)}
            ${filterControl('spike-hole', 'Spike / Hole', 0.25, 3, 0.25, 1)}
            ${filterControl('nlm', 'Non-Local Means', 0.5, 3, 0.5, 1, true)}
            ${filterControl('anisotropic', 'Anisotropic Diffusion', 0.5, 3, 0.5, 1, true)}
          </div>

          <div class="processing-actions">
            <button id="reset-processing" class="secondary-button processing-reset" type="button" disabled>Reset</button>
            <span id="processing-status" class="processing-status">Original</span>
          </div>
          <p class="hint">チェックした処理だけを元のCT値ボリュームから固定順で再計算します。</p>
        </section>
      </aside>

      <section class="viewer-grid" aria-label="DICOM viewer">
        <section class="viewport-card viewport-card-main">
          <div class="viewport-label">
            <strong>3D</strong>
            <span id="three-d-label">WebGPU</span>
          </div>
          <div id="viewport-3d" class="viewport viewport-3d"></div>
          <div id="selected-series" class="selected-series-overlay">
            <strong>Series未選択</strong>
            <span>左の一覧からCT Seriesを選択してください。</span>
          </div>
        </section>

        <section class="mpr-column">
          ${mprCard('axial', 'Axial')}
          ${mprCard('coronal', 'Coronal')}
          ${mprCard('sagittal', 'Sagittal')}
        </section>
      </section>
    </section>

    <footer>
      <span id="footer-status">Original calibrated CT values are preserved.</span>
    </footer>
  </main>
`;

function filterControl(
  id: string,
  label: string,
  min: number,
  max: number,
  step: number,
  value: number,
  pending = false,
): string {
  return `
    <div class="filter-control ${pending ? 'is-pending' : ''}">
      <label class="filter-toggle-row">
        <input id="${id}-enabled" type="checkbox" disabled ${pending ? 'data-pending="true"' : ''} />
        <span>${label}</span>
        ${pending ? '<small>準備中</small>' : ''}
      </label>
      <label class="filter-strength-row">
        <span>Strength</span>
        <output id="${id}-strength-value">${value}</output>
        <input id="${id}-strength" type="range" min="${min}" max="${max}" step="${step}" value="${value}" disabled />
      </label>
    </div>
  `;
}

function mprCard(id: Plane, label: string): string {
  return `
    <article class="viewport-card mpr-card">
      <div class="viewport-label">
        <strong>${label}</strong>
        <span id="${id}-index-label">—</span>
      </div>
      <canvas id="${id}-canvas" class="mpr-canvas"></canvas>
      <input id="${id}-slider" class="slice-slider" type="range" min="0" max="0" value="0" disabled />
    </article>
  `;
}

const viewport = mustElement<HTMLDivElement>('#viewport-3d');
const status = mustElement<HTMLDivElement>('#gpu-status');
const openFolderButton = mustElement<HTMLButtonElement>('#open-folder');
const demoButton = mustElement<HTMLButtonElement>('#demo-button');
const folderInput = mustElement<HTMLInputElement>('#folder-input');
const scanState = mustElement<HTMLDivElement>('#scan-state');
const progressWrap = mustElement<HTMLDivElement>('#scan-progress');
const progressBar = mustElement<HTMLDivElement>('#scan-progress-bar');
const progressLabel = mustElement<HTMLSpanElement>('#scan-progress-label');
const seriesList = mustElement<HTMLDivElement>('#series-list');
const selectedSeriesOverlay = mustElement<HTMLDivElement>('#selected-series');
const footerStatus = mustElement<HTMLSpanElement>('#footer-status');
const threeDLabel = mustElement<HTMLSpanElement>('#three-d-label');
const windowCenterInput = mustElement<HTMLInputElement>('#window-center');
const windowWidthInput = mustElement<HTMLInputElement>('#window-width');
const windowCenterValue = mustElement<HTMLOutputElement>('#window-center-value');
const windowWidthValue = mustElement<HTMLOutputElement>('#window-width-value');
const resetProcessingButton = mustElement<HTMLButtonElement>('#reset-processing');
const processingStatus = mustElement<HTMLSpanElement>('#processing-status');

const filterControls = {
  gaussian: processingControl('gaussian'),
  spikeHole: processingControl('spike-hole'),
  nlm: processingControl('nlm'),
  anisotropic: processingControl('anisotropic'),
};

const planeControls = {
  axial: planeControl('axial'),
  coronal: planeControl('coronal'),
  sagittal: planeControl('sagittal'),
} satisfies Record<Plane, ReturnType<typeof planeControl>>;

let activeSeriesId: string | null = null;
let seriesSummaries: DicomSeriesSummary[] = [];
let sourceVolume: CtVolume | null = null;
let currentVolume: CtVolume | null = null;
let processingSettings: ProcessingSettings = structuredClone(DEFAULT_PROCESSING_SETTINGS);
let processingRevision = 0;
let webGpuScene: {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGPURenderer;
  volumeObject: THREE.Object3D | null;
} | null = null;

openFolderButton.addEventListener('click', () => {
  folderInput.value = '';
  folderInput.click();
});

folderInput.addEventListener('change', async () => {
  const files = Array.from(folderInput.files ?? []);
  if (files.length === 0) return;
  await inspectFiles(files, false);
});

demoButton.addEventListener('click', async () => {
  setBusy(true);
  clearLoadedVolume();
  seriesList.replaceChildren();
  scanState.classList.remove('is-hidden');
  progressWrap.classList.remove('is-hidden');
  scanState.innerHTML =
    '<strong>公開マウスPET/CTを取得中…</strong><span>画像本体はGitHubには保存していません。</span>';

  try {
    const files = await loadPublicMouseDemo((progress) => {
      if (progress.phase === 'download') {
        const total = progress.total ?? PUBLIC_MOUSE_DEMO.archiveSizeBytes;
        updateByteProgress(progress.loaded, total, 'Download');
      } else {
        updateByteProgress(progress.loaded, progress.total ?? progress.loaded, 'Unzip');
      }
    });

    await inspectFiles(files, true);
  } catch (error) {
    console.error(error);
    scanState.classList.remove('is-hidden');
    scanState.innerHTML =
      '<strong>公開デモを読み込めませんでした</strong><span>配信元のCORSまたはネットワーク状態を確認してください。</span>';
    footerStatus.textContent = error instanceof Error ? error.message : String(error);
  } finally {
    setBusy(false);
    progressWrap.classList.add('is-hidden');
  }
});

for (const plane of Object.keys(planeControls) as Plane[]) {
  const control = planeControls[plane];

  control.slider.addEventListener('input', () => {
    if (!currentVolume) return;
    renderPlane(plane);
  });

  installMprTouchNavigation(plane);
}

windowCenterInput.addEventListener('input', renderAllPlanes);
windowWidthInput.addEventListener('input', renderAllPlanes);

for (const [key, control] of Object.entries(filterControls) as Array<
  [keyof typeof filterControls, ReturnType<typeof processingControl>]
>) {
  if (control.enabled.dataset.pending === 'true') continue;

  control.enabled.addEventListener('change', () => {
    processingSettings[key].enabled = control.enabled.checked;
    control.strength.disabled = !control.enabled.checked || !sourceVolume;
    void rebuildProcessingPipeline();
  });

  control.strength.addEventListener('input', () => {
    const value = Number(control.strength.value);
    processingSettings[key].strength = value;
    control.output.value = value.toFixed(value % 1 === 0 ? 0 : 2);
    if (control.enabled.checked) void rebuildProcessingPipeline();
  });
}

resetProcessingButton.addEventListener('click', () => {
  processingSettings = structuredClone(DEFAULT_PROCESSING_SETTINGS);
  syncProcessingControls();
  if (!sourceVolume) return;
  currentVolume = sourceVolume;
  processingRevision += 1;
  processingStatus.textContent = 'Original';
  renderAllPlanes();
  renderVolumePointCloud(currentVolume);
});

async function inspectFiles(files: File[], fromDemo: boolean): Promise<void> {
  activeSeriesId = null;
  seriesSummaries = [];
  clearLoadedVolume();
  seriesList.replaceChildren();

  scanState.classList.remove('is-hidden');
  scanState.innerHTML =
    '<strong>DICOMを確認中…</strong><span>Pixel DataはまだCTボリュームへ展開しません。</span>';
  progressWrap.classList.remove('is-hidden');
  updateProgress(0, files.length);
  setBusy(true);

  try {
    const slices = await parseDicomFiles(files, updateProgress);
    seriesSummaries = groupDicomSeries(slices);

    if (seriesSummaries.length === 0) {
      scanState.innerHTML =
        '<strong>DICOM Seriesを検出できませんでした</strong><span>選択データを確認してください。</span>';
      return;
    }

    scanState.classList.add('is-hidden');
    renderSeriesList(seriesSummaries);

    if (fromDemo) {
      const ctSeries =
        seriesSummaries.find((series) => series.modality.toUpperCase() === 'CT') ??
        seriesSummaries[0];
      footerStatus.textContent =
        `Public demo: ${PUBLIC_MOUSE_DEMO.source}. CT Seriesを自動選択します。`;
      await selectSeries(ctSeries);
    }
  } catch (error) {
    console.error(error);
    scanState.classList.remove('is-hidden');
    scanState.innerHTML =
      '<strong>解析中にエラーが発生しました</strong><span>元ファイルは変更していません。</span>';
    footerStatus.textContent = error instanceof Error ? error.message : String(error);
  } finally {
    setBusy(false);
    progressWrap.classList.add('is-hidden');
  }
}

function updateProgress(completed: number, total: number): void {
  const ratio = total > 0 ? completed / total : 0;
  progressBar.style.width = `${Math.round(ratio * 100)}%`;
  progressLabel.textContent = `${completed.toLocaleString()} / ${total.toLocaleString()}`;
}

function updateByteProgress(loaded: number, total: number, phase: string): void {
  const ratio = total > 0 ? loaded / total : 0;
  progressBar.style.width = `${Math.max(0, Math.min(100, Math.round(ratio * 100)))}%`;
  progressLabel.textContent = `${phase} ${formatBytes(loaded)} / ${formatBytes(total)}`;
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
    note.textContent =
      `推定展開サイズ: ${formatBytes(summary.estimatedBytes)} / Transfer Syntax: ` +
      summary.transferSyntaxes.join(', ');

    card.append(header, grid, note);
    card.addEventListener('click', () => void selectSeries(summary));
    seriesList.append(card);
  }
}

async function selectSeries(summary: DicomSeriesSummary): Promise<void> {
  activeSeriesId = summary.id;
  currentVolume = null;

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

  const loading = document.createElement('span');
  loading.className = 'ready-badge';
  loading.textContent = 'CT volume decoding…';

  selectedSeriesOverlay.append(title, detail, loading);
  progressWrap.classList.remove('is-hidden');
  setBusy(true);

  try {
    sourceVolume = await decodeSeriesToCtVolume(summary, (completed, total) => {
      updateProgress(completed, total);
    });
    currentVolume = sourceVolume;

    configureVolumeControls(currentVolume);
    enableProcessingControls();
    syncProcessingControls();
    renderAllPlanes();
    renderVolumePointCloud(currentVolume);

    loading.textContent = 'CT volume ready';
    footerStatus.textContent =
      `CT range: ${Math.round(currentVolume.min)} to ${Math.round(currentVolume.max)} · ` +
      `Float32 working volume: ${formatBytes(currentVolume.data.byteLength)}`;
  } catch (error) {
    console.error(error);
    loading.textContent = 'Decode failed';
    loading.classList.add('ready-badge-error');
    footerStatus.textContent = error instanceof Error ? error.message : String(error);
  } finally {
    progressWrap.classList.add('is-hidden');
    setBusy(false);
  }
}

function configureVolumeControls(volume: CtVolume): void {
  const range = Math.max(1, volume.max - volume.min);
  const center = (volume.min + volume.max) / 2;

  windowCenterInput.min = String(Math.floor(volume.min));
  windowCenterInput.max = String(Math.ceil(volume.max));
  windowCenterInput.value = String(center);

  windowWidthInput.min = '1';
  windowWidthInput.max = String(Math.ceil(range));
  windowWidthInput.value = String(range);

  windowCenterInput.disabled = false;
  windowWidthInput.disabled = false;

  planeControls.axial.slider.max = String(volume.slices - 1);
  planeControls.axial.slider.value = String(Math.floor(volume.slices / 2));

  planeControls.coronal.slider.max = String(volume.rows - 1);
  planeControls.coronal.slider.value = String(Math.floor(volume.rows / 2));

  planeControls.sagittal.slider.max = String(volume.columns - 1);
  planeControls.sagittal.slider.value = String(Math.floor(volume.columns / 2));

  for (const control of Object.values(planeControls)) {
    control.slider.disabled = false;
  }
}

function renderAllPlanes(): void {
  if (!currentVolume) return;

  windowCenterValue.value = String(Math.round(Number(windowCenterInput.value)));
  windowWidthValue.value = String(Math.round(Number(windowWidthInput.value)));

  renderPlane('axial');
  renderPlane('coronal');
  renderPlane('sagittal');
}

function renderPlane(plane: Plane): void {
  if (!currentVolume) return;
  const control = planeControls[plane];
  const index = Number(control.slider.value);

  control.indexLabel.textContent = String(index + 1);
  renderPlaneToCanvas(
    currentVolume,
    plane,
    index,
    control.canvas,
    Number(windowCenterInput.value),
    Number(windowWidthInput.value),
  );
}

function planeControl(plane: Plane) {
  return {
    canvas: mustElement<HTMLCanvasElement>(`#${plane}-canvas`),
    slider: mustElement<HTMLInputElement>(`#${plane}-slider`),
    indexLabel: mustElement<HTMLSpanElement>(`#${plane}-index-label`),
  };
}

function installMprTouchNavigation(plane: Plane): void {
  const control = planeControls[plane];
  let pointerId: number | null = null;
  let startY = 0;
  let startIndex = 0;

  control.canvas.addEventListener('pointerdown', (event) => {
    if (!currentVolume || control.slider.disabled) return;
    pointerId = event.pointerId;
    startY = event.clientY;
    startIndex = Number(control.slider.value);
    control.canvas.setPointerCapture(event.pointerId);
  });

  control.canvas.addEventListener('pointermove', (event) => {
    if (pointerId !== event.pointerId || !currentVolume) return;
    const dy = event.clientY - startY;
    const max = Number(control.slider.max);
    const sensitivity = Math.max(1, control.canvas.clientHeight / Math.max(max + 1, 1));
    const next = Math.round(startIndex - dy / sensitivity);
    control.slider.value = String(Math.max(0, Math.min(max, next)));
    renderPlane(plane);
  });

  const finish = (event: PointerEvent) => {
    if (pointerId !== event.pointerId) return;
    if (control.canvas.hasPointerCapture(event.pointerId)) {
      control.canvas.releasePointerCapture(event.pointerId);
    }
    pointerId = null;
  };

  control.canvas.addEventListener('pointerup', finish);
  control.canvas.addEventListener('pointercancel', finish);
}

function clearLoadedVolume(): void {
  sourceVolume = null;
  currentVolume = null;
  processingRevision += 1;
  processingSettings = structuredClone(DEFAULT_PROCESSING_SETTINGS);
  syncProcessingControls();
  disableProcessingControls();
  windowCenterInput.disabled = true;
  windowWidthInput.disabled = true;
  windowCenterValue.value = '—';
  windowWidthValue.value = '—';

  for (const control of Object.values(planeControls)) {
    control.slider.disabled = true;
    control.indexLabel.textContent = '—';
    const context = control.canvas.getContext('2d');
    context?.clearRect(0, 0, control.canvas.width, control.canvas.height);
  }

  if (webGpuScene?.volumeObject) {
    webGpuScene.scene.remove(webGpuScene.volumeObject);
    disposeObject(webGpuScene.volumeObject);
    webGpuScene.volumeObject = null;
  }

  threeDLabel.textContent = 'WebGPU';
}

async function rebuildProcessingPipeline(): Promise<void> {
  if (!sourceVolume) return;

  const revision = ++processingRevision;
  processingStatus.textContent = 'Processing…';
  setProcessingBusy(true);

  try {
    const next = await processVolume(sourceVolume, processingSettings, (stage, completed, total) => {
      if (revision !== processingRevision) return;
      processingStatus.textContent = `${stage} ${completed}/${total}`;
    });

    if (revision !== processingRevision) return;

    currentVolume = next;
    processingStatus.textContent = activeFilterSummary();
    renderAllPlanes();
    renderVolumePointCloud(next);
  } catch (error) {
    console.error(error);
    if (revision === processingRevision) {
      processingStatus.textContent = 'Processing error';
      footerStatus.textContent = error instanceof Error ? error.message : String(error);
    }
  } finally {
    if (revision === processingRevision) setProcessingBusy(false);
  }
}

function activeFilterSummary(): string {
  const active: string[] = [];
  if (processingSettings.gaussian.enabled) active.push('Gaussian');
  if (processingSettings.spikeHole.enabled) active.push('Spike/Hole');
  if (processingSettings.nlm.enabled) active.push('NLM');
  if (processingSettings.anisotropic.enabled) active.push('Anisotropic');
  return active.length > 0 ? active.join(' → ') : 'Original';
}

function processingControl(id: string) {
  return {
    enabled: mustElement<HTMLInputElement>(`#${id}-enabled`),
    strength: mustElement<HTMLInputElement>(`#${id}-strength`),
    output: mustElement<HTMLOutputElement>(`#${id}-strength-value`),
  };
}

function enableProcessingControls(): void {
  filterControls.gaussian.enabled.disabled = false;
  filterControls.spikeHole.enabled.disabled = false;
  resetProcessingButton.disabled = false;
  syncProcessingControls();
}

function disableProcessingControls(): void {
  for (const control of Object.values(filterControls)) {
    control.enabled.disabled = true;
    control.strength.disabled = true;
  }
  resetProcessingButton.disabled = true;
  processingStatus.textContent = 'Original';
}

function syncProcessingControls(): void {
  for (const [key, control] of Object.entries(filterControls) as Array<
    [keyof typeof filterControls, ReturnType<typeof processingControl>]
  >) {
    const state = processingSettings[key];
    control.enabled.checked = state.enabled;
    control.strength.value = String(state.strength);
    control.output.value = String(state.strength);
    control.strength.disabled =
      !sourceVolume || !state.enabled || control.enabled.dataset.pending === 'true';
  }
}

function setProcessingBusy(busy: boolean): void {
  filterControls.gaussian.enabled.disabled = busy || !sourceVolume;
  filterControls.spikeHole.enabled.disabled = busy || !sourceVolume;
  filterControls.gaussian.strength.disabled =
    busy || !sourceVolume || !processingSettings.gaussian.enabled;
  filterControls.spikeHole.strength.disabled =
    busy || !sourceVolume || !processingSettings.spikeHole.enabled;
  resetProcessingButton.disabled = busy || !sourceVolume;
}

function setBusy(busy: boolean): void {
  openFolderButton.disabled = busy;
  demoButton.disabled = busy;
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
  scene.background = new THREE.Color(0x090c0e);

  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0, 0, 5.2);

  const renderer = new THREE.WebGPURenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  await renderer.init();

  const backendName = renderer.backend.constructor.name;
  const usingWebGPU = backendName.toLowerCase().includes('webgpu');

  status.textContent = usingWebGPU ? 'WEBGPU ACTIVE' : `BACKEND: ${backendName}`;
  status.className = usingWebGPU ? 'status status-ok' : 'status status-warning';

  viewport.appendChild(renderer.domElement);

  const grid = new THREE.GridHelper(5, 10, 0x354149, 0x1c2429);
  grid.rotation.x = Math.PI / 2;
  grid.position.z = -1.8;
  scene.add(grid);

  const pointers = new Map<number, { x: number; y: number }>();
  let distance = 5.2;
  let lastPinchDistance = 0;
  let lastPinchCenter: { x: number; y: number } | null = null;

  renderer.domElement.addEventListener('contextmenu', (event) => event.preventDefault());

  renderer.domElement.addEventListener('pointerdown', (event) => {
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    renderer.domElement.setPointerCapture(event.pointerId);

    if (pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      lastPinchDistance = Math.hypot(b.x - a.x, b.y - a.y);
      lastPinchCenter = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    }
  });

  renderer.domElement.addEventListener('pointermove', (event) => {
    const previous = pointers.get(event.pointerId);
    if (!previous) return;

    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (!webGpuScene?.volumeObject) return;

    if (pointers.size === 1) {
      const dx = event.clientX - previous.x;
      const dy = event.clientY - previous.y;
      webGpuScene.volumeObject.rotation.y += dx * 0.008;
      webGpuScene.volumeObject.rotation.x += dy * 0.008;
      return;
    }

    const [a, b] = [...pointers.values()];
    const pinchDistance = Math.hypot(b.x - a.x, b.y - a.y);
    const pinchCenter = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };

    if (lastPinchDistance > 0) {
      const ratio = lastPinchDistance / Math.max(pinchDistance, 1);
      distance = THREE.MathUtils.clamp(distance * ratio, 2.2, 12);
      camera.position.z = distance;
    }

    if (lastPinchCenter) {
      const dx = pinchCenter.x - lastPinchCenter.x;
      const dy = pinchCenter.y - lastPinchCenter.y;
      const panScale = distance * 0.0015;
      webGpuScene.volumeObject.position.x += dx * panScale;
      webGpuScene.volumeObject.position.y -= dy * panScale;
    }

    lastPinchDistance = pinchDistance;
    lastPinchCenter = pinchCenter;
  });

  const releasePointer = (event: PointerEvent) => {
    pointers.delete(event.pointerId);
    if (renderer.domElement.hasPointerCapture(event.pointerId)) {
      renderer.domElement.releasePointerCapture(event.pointerId);
    }

    if (pointers.size < 2) {
      lastPinchDistance = 0;
      lastPinchCenter = null;
    }
  };

  renderer.domElement.addEventListener('pointerup', releasePointer);
  renderer.domElement.addEventListener('pointercancel', releasePointer);
  renderer.domElement.addEventListener('pointerleave', (event) => {
    if (event.pointerType === 'mouse') releasePointer(event);
  });

  renderer.domElement.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault();
      distance = THREE.MathUtils.clamp(distance + event.deltaY * 0.004, 2.2, 12);
      camera.position.z = distance;
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

  webGpuScene = { scene, camera, renderer, volumeObject: null };

  renderer.setAnimationLoop(() => {
    renderer.render(scene, camera);
  });
}

function renderVolumePointCloud(volume: CtVolume): void {
  if (!webGpuScene) return;

  if (webGpuScene.volumeObject) {
    webGpuScene.scene.remove(webGpuScene.volumeObject);
    disposeObject(webGpuScene.volumeObject);
  }

  const object = buildBonePointCloud(volume);
  webGpuScene.scene.add(object);
  webGpuScene.volumeObject = object;
  threeDLabel.textContent = 'WebGPU · high-density CT preview';
}

function buildBonePointCloud(volume: CtVolume): THREE.Points {
  const voxelCount = volume.columns * volume.rows * volume.slices;
  const maxSampledVoxels = 2_000_000;
  const stride = Math.max(1, Math.ceil(Math.cbrt(voxelCount / maxSampledVoxels)));
  const threshold = volume.min + (volume.max - volume.min) * 0.68;
  const positions: number[] = [];

  const sx = volume.spacing[0];
  const sy = volume.spacing[1];
  const sz = volume.spacing[2];

  const physicalX = volume.columns * sx;
  const physicalY = volume.rows * sy;
  const physicalZ = volume.slices * sz;
  const scale = 3.3 / Math.max(physicalX, physicalY, physicalZ, 1);

  for (let z = 0; z < volume.slices; z += stride) {
    for (let y = 0; y < volume.rows; y += stride) {
      const base = z * volume.rows * volume.columns + y * volume.columns;

      for (let x = 0; x < volume.columns; x += stride) {
        const value = volume.data[base + x];
        if (value < threshold) continue;

        positions.push(
          (x * sx - physicalX / 2) * scale,
          -(y * sy - physicalY / 2) * scale,
          (z * sz - physicalZ / 2) * scale,
        );

        if (positions.length / 3 >= 180_000) break;
      }

      if (positions.length / 3 >= 180_000) break;
    }

    if (positions.length / 3 >= 180_000) break;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    size: 0.018,
    color: 0xe7edf0,
    transparent: true,
    opacity: 0.72,
    sizeAttenuation: true,
  });

  return new THREE.Points(geometry, material);
}

function disposeObject(object: THREE.Object3D): void {
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh || child instanceof THREE.Points)) return;
    child.geometry.dispose();

    const material = child.material;
    if (Array.isArray(material)) material.forEach((item) => item.dispose());
    else material.dispose();
  });
}
