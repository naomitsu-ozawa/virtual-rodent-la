import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { gpuVendorKey, gpuAdapterVendorKey, gpuSplitDecision, gpuSplitCandidate, gpuSplitStatusParts, webglDisplayGpu } from '../../docs/gpu-split.js';
import { gpuPlatformOs, gpuEffectivePreference, gpuPreferenceSupported, gpuAdapterRequestOptions, gpuPreferenceInfoText } from '../../docs/gpu-preference.js';

// build 516: GPU split (display Intel / compute NVIDIA hybrid on Linux only). Chrome 155 Linux allocates WebGPU shared images
// (canvas, copyExternalImageToTexture, importExternalTexture) on the display GPU's VkDevice and imports them into Dawn's device
// by opaque FD; on the NVIDIA device that import fails. Owner's rule: only that hybrid case is handled; single GPU, Mac and
// iPad keep the single shared device of builds up to 515. gpu-split.js is pure and imported as is; the orchestration in
// gpu-compute.js / scene-view.js is cut out of the sources (as in gpu-limit-caps.test.js) and run against fakes.
const nav = (userAgent, platform, maxTouchPoints = 0) => ({ userAgent, platform, maxTouchPoints });
const LINUX = nav('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/155 Safari/537.36', 'Linux x86_64');
const WIN = nav('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/155', 'Win32');
const MAC = nav('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/155', 'MacIntel');
const IPAD = nav('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15', 'MacIntel', 5);
const ANDROID = nav('Mozilla/5.0 (Linux; Android 14; Quest 3) Chrome/155 Mobile', 'Linux armv8l', 5);
const CROS = nav('Mozilla/5.0 (X11; CrOS x86_64 15000.0.0) Chrome/155', 'Linux x86_64');

const NV_INFO = { vendor: 'nvidia', architecture: 'ada', device: '', description: 'NVIDIA GeForce RTX 4070 Ti' };
const INTEL_INFO = { vendor: 'intel', architecture: 'gen-12lp', device: '', description: 'Intel(R) UHD Graphics 770' };
const AMD_INFO = { vendor: 'amd', architecture: 'rdna-3', device: '', description: 'AMD Radeon RX 7800 XT' };
const APPLE_INFO = { vendor: 'apple', architecture: 'metal-3', device: '', description: '' };
const WEBGL_INTEL = { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Mesa Intel(R) UHD Graphics 770 (ADL-S GT1), OpenGL 4.6)' };
const WEBGL_NV = { vendor: 'Google Inc. (NVIDIA Corporation)', renderer: 'ANGLE (NVIDIA Corporation, NVIDIA GeForce RTX 4070 Ti/PCIe/SSE2, OpenGL 4.5.0)' };
const WEBGL_SW = { vendor: 'Google Inc. (Google)', renderer: 'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)' };

describe('vendor detection', () => {
  it('adapter.info of the usual GPUs', () => {
    expect([NV_INFO, INTEL_INFO, AMD_INFO, APPLE_INFO].map(i => gpuAdapterVendorKey({ info: i }))).toEqual(['nvidia', 'intel', 'amd', 'apple']);
  });
  it('WebGL unmasked strings (ANGLE) of the usual GPUs', () => {
    expect(gpuVendorKey(WEBGL_INTEL.vendor, WEBGL_INTEL.renderer)).toBe('intel');
    expect(gpuVendorKey(WEBGL_NV.vendor, WEBGL_NV.renderer)).toBe('nvidia');
    expect(gpuVendorKey(WEBGL_SW.vendor, WEBGL_SW.renderer)).toBe('software');
    expect(gpuVendorKey('Google Inc. (AMD)', 'ANGLE (AMD, AMD Radeon RX 7800 XT, OpenGL 4.6)')).toBe('amd');
  });
  it('anything unreadable is unknown', () => {
    expect([gpuAdapterVendorKey(null), gpuAdapterVendorKey({}), gpuAdapterVendorKey({ info: {} }), gpuVendorKey(), gpuVendorKey('', null)]).toEqual(['', '', '', '', '']);
    expect(gpuAdapterVendorKey({ get info() { throw new Error('x'); } })).toBe('');
  });
});

describe('split decision: only display Intel + compute NVIDIA on Linux', () => {
  const d = o => gpuSplitDecision({ os: 'linux', computeVendor: 'nvidia', lowPowerVendor: 'intel', displayVendor: 'intel', ...o });
  it('the hybrid case splits', () => {
    expect(d({})).toMatchObject({ split: true, renderVendor: 'intel', computeVendor: 'nvidia' });
  });
  it('every other vendor combination does not', () => {
    const vendors = ['nvidia', 'intel', 'amd', 'apple', 'software', 'other', ''];
    let splits = 0;
    for (const computeVendor of vendors) for (const lowPowerVendor of vendors) for (const displayVendor of vendors) {
      const r = d({ computeVendor, lowPowerVendor, displayVendor });
      if (r.split) { splits++; expect([computeVendor, lowPowerVendor, displayVendor]).toEqual(['nvidia', 'intel', 'intel']); }
    }
    expect(splits).toBe(1);
  });
  it('display NVIDIA (monitor on the NVIDIA port), AMD iGPU + NVIDIA, unknown display: no split', () => {
    expect(d({ displayVendor: 'nvidia' }).split).toBe(false);
    expect(d({ displayVendor: 'amd', lowPowerVendor: 'amd' }).split).toBe(false);
    expect(d({ displayVendor: '' }).reason).toBe('display gpu unknown');
  });
  it('single GPU: the low-power adapter is the NVIDIA one -> no split', () => {
    expect(d({ lowPowerVendor: 'nvidia', displayVendor: 'nvidia' }).split).toBe(false);
  });
  it('preference low-power (compute on Intel): no split', () => {
    expect(d({ computeVendor: 'intel' }).split).toBe(false);
  });
  it('not Linux: never', () => {
    for (const os of ['windows', 'mac', 'ios', 'android', 'other', undefined]) expect(d({ os }).split).toBe(false);
    expect(gpuSplitDecision().split).toBe(false);
  });
});

describe('UA gating (nothing else runs unless Linux + NVIDIA compute adapter)', () => {
  const nv = { info: NV_INFO };
  it('Linux + NVIDIA adapter is a candidate', () => expect(gpuSplitCandidate(LINUX, nv)).toBe(true));
  it('Windows, Mac, iPad, Android, ChromeOS: not', () => {
    for (const n of [WIN, MAC, IPAD, ANDROID, CROS, {}]) expect(gpuSplitCandidate(n, nv)).toBe(false);
  });
  it('Linux with a non-NVIDIA / unknown compute adapter: not', () => {
    for (const a of [{ info: INTEL_INFO }, { info: AMD_INFO }, { info: APPLE_INFO }, {}, null]) expect(gpuSplitCandidate(LINUX, a)).toBe(false);
  });
});

describe('WebGL display probe', () => {
  const doc = ctx => { const log = []; return { log, createElement: () => ({ getContext: () => ctx(log) }) }; };
  const glFor = (vendor, renderer) => log => ({
    getExtension: n => n === 'WEBGL_debug_renderer_info' ? { UNMASKED_VENDOR_WEBGL: 1, UNMASKED_RENDERER_WEBGL: 2 } : n === 'WEBGL_lose_context' ? { loseContext: () => log.push('lose') } : null,
    getParameter: p => (p === 1 ? vendor : renderer),
  });
  it('reads the unmasked vendor / renderer and releases the context', () => {
    const d = doc(glFor(WEBGL_INTEL.vendor, WEBGL_INTEL.renderer));
    expect(webglDisplayGpu(d)).toEqual(WEBGL_INTEL);
    expect(d.log).toEqual(['lose']);
  });
  it('null when there is no document, no context or no debug info', () => {
    expect(webglDisplayGpu(undefined)).toBe(null);
    expect(webglDisplayGpu(doc(() => null))).toBe(null);
    expect(webglDisplayGpu(doc(() => ({ getExtension: () => null })))).toBe(null);
    expect(webglDisplayGpu({ createElement: () => { throw new Error('x'); } })).toBe(null);
  });
});

describe('status parts', () => {
  it('empty when not split (single-GPU line unchanged)', () => {
    expect(gpuSplitStatusParts(null)).toEqual({ render: '', compute: '' });
    expect(gpuSplitStatusParts({ active: false })).toEqual({ render: '', compute: '' });
  });
  it('split wording', () => {
    expect(gpuSplitStatusParts({ active: true, renderVendor: 'intel', computeVendor: 'nvidia' })).toEqual({ render: ' intel (display)', compute: ' nvidia (split)' });
  });
});

// ---- orchestration, cut out of the sources and run against fakes ----
const read = p => readFileSync(p, 'utf8');
const gpuSrc = read('docs/gpu-compute.js'), sceneSrc = read('docs/scene-view.js');
const grab = (src, re) => { const m = src.match(re); if (!m) throw new Error('not found: ' + re); return m[0].replace(/^export /, ''); };
const fnSrc = (src, name) => grab(src, new RegExp('export (async )?function ' + name + '\\([\\s\\S]*?\\n}\\n'));
const constSrc = (src, name) => grab(src, new RegExp('export const ' + name + '=[^\\n]*\\n'));
const MiB = 2 ** 20, GiB = 2 ** 30;
const LIMITS = { maxBufferSize: 4 * GiB - 4, maxStorageBufferBindingSize: 4 * GiB - 4, maxComputeInvocationsPerWorkgroup: 1024, maxComputeWorkgroupSizeX: 1024, maxTextureDimension3D: 2048 };

// a machine with the listed adapters; requestAdapter picks by powerPreference like Chrome on a hybrid laptop
function fakeMachine(adapters, { deviceFails = () => false } = {}) {
  const log = [], devices = [];
  const mk = info => ({
    info, features: new Set(['core-features-and-limits']), limits: { ...LIMITS },
    async requestDevice(desc) {
      log.push('device ' + info.vendor + ' ' + (desc.requiredLimits.maxBufferSize === undefined ? 'default' : desc.requiredLimits.maxBufferSize / MiB + 'MB'));
      if (deviceFails(info.vendor)) throw new Error('Failed to create device: VK_ERROR_OUT_OF_DEVICE_MEMORY');
      const dev = { vendor: info.vendor, limits: desc.requiredLimits, queue: { onSubmittedWorkDone: async () => {} }, lost: new Promise(() => {}), destroyed: false, destroy() { this.destroyed = true; } };
      devices.push(dev); return dev;
    },
  });
  const high = adapters.find(a => a.high) || adapters[0], low = adapters.find(a => a.low) || adapters[0];
  return {
    log, devices,
    gpu: { async requestAdapter(opts) { log.push('adapter ' + (opts?.powerPreference || '-')); return mk((opts?.powerPreference === 'low-power' ? low : high).info); } },
  };
}
const HYBRID = [{ info: NV_INFO, high: true }, { info: INTEL_INFO, low: true }];
const ONLY_NV = [{ info: NV_INFO }];
const ONLY_INTEL = [{ info: INTEL_INFO }];

const buildCompute = (navigator, runtime = {}, extra = {}) => {
  const src = constSrc(gpuSrc, 'GPU_BUFFER_LIMIT_CAPS') + fnSrc(gpuSrc, 'gpuAdapterLabel') + fnSrc(gpuSrc, 'capGpuBufferLimits') + fnSrc(gpuSrc, 'gpuLimitInfoText') + fnSrc(gpuSrc, 'gpuDeviceRequestDescriptor') +
    constSrc(gpuSrc, 'vrlGpuPreference') + fnSrc(gpuSrc, 'requestVrlGpuAdapter') + fnSrc(gpuSrc, 'gpuLostAtCreation') + fnSrc(gpuSrc, 'requestVrlGpuDevice') + grab(gpuSrc, /export function gpuLostText[^\n]*\n/) +
    fnSrc(gpuSrc, 'requestVrlSplitRenderDevice') + fnSrc(gpuSrc, 'adoptSplitGpuDevices') + fnSrc(gpuSrc, 'createGpuResidentFloat3Attribute') + fnSrc(gpuSrc, 'destroyGpuResidentAttribute') + fnSrc(gpuSrc, 'ensureGpuFilterDevice') +
    fnSrc(gpuSrc, 'updateGpuStatus') + fnSrc(gpuSrc, 'setGpuComputeBackend') +
    '\nreturn{requestVrlGpuDevice,requestVrlSplitRenderDevice,adoptSplitGpuDevices,createGpuResidentFloat3Attribute,ensureGpuFilterDevice,updateGpuStatus,setGpuComputeBackend}';
  const calls = [];
  const deps = {
    gpuForceCompat: false, navigator, gpuFilterRuntime: runtime, console: { info() {}, warn() {}, error() {} },
    gpuSplitCandidate, gpuSplitDecision, gpuVendorKey, gpuAdapterVendorKey, gpuSplitStatusParts, webglDisplayGpu, gpuPlatformOs,
    gpuEffectivePreference, gpuPreferenceSupported, gpuAdapterRequestOptions, gpuPreferenceInfoText,
    sceneState: { backend: 'WEBGPU', renderer: { backend: { device: null, set() {} } } },
    THREE: { Float32BufferAttribute: class { constructor(a) { this.array = a; } } },
    status: { removeAttribute() {}, textContent: '', className: '', title: '' }, document: { getElementById: () => null },
    performance: { now: () => 1000 },
    installGpuErrorListener: (d, role) => calls.push('listener ' + (role || 'compute')),
    clearGpuBufferPool() {}, setGpuPrewarmIndex() {}, setGpuPrewarmScheduled() {}, gpuComputeWorkgroupSize: () => 128, gpuDeviceMode: () => 'CORE',
    verifyGpuComputeDevice: async () => true, verifyGpuPipelineSet: async () => true,
    ...extra,
  };
  const api = new Function('deps', 'const {' + Object.keys(deps).join(',') + '}=deps;' + src)(deps);
  return { api, calls, deps };
};
const rt = () => ({ device: null, adapter: null, initPromise: null, disabled: false, pipelines: new Map(), lastBackend: 'CPU', lastError: '', retryAfter: 0, bufferPool: new Map() });
const probeOf = (g, log) => () => { if (log) log.push('webgl'); return g; };

describe('requestVrlSplitRenderDevice: hybrid case', () => {
  it('Linux, display Intel, compute NVIDIA: render device on the low-power Intel adapter, compute records untouched', async () => {
    const m = fakeMachine(HYBRID), runtime = rt(), { api } = buildCompute({ ...LINUX, gpu: m.gpu }, runtime);
    const compute = await api.requestVrlGpuDevice();
    expect(compute.device.vendor).toBe('nvidia');
    const computeInfo = { limitInfo: runtime.limitInfo, prefInfo: runtime.prefInfo, adapterRequest: runtime.adapterRequest };
    const r = await api.requestVrlSplitRenderDevice({ nav: LINUX, computeAdapter: compute.adapter, probe: probeOf(WEBGL_INTEL) });
    expect(r.device.vendor).toBe('intel');
    expect(r.split).toMatchObject({ active: true, renderVendor: 'intel', computeVendor: 'nvidia' });
    expect(m.log.filter(l => l.startsWith('adapter'))).toEqual(['adapter high-performance', 'adapter low-power']);
    // the render request has its own records; the compute device's status data is not clobbered
    expect({ limitInfo: runtime.limitInfo, prefInfo: runtime.prefInfo, adapterRequest: runtime.adapterRequest }).toEqual(computeInfo);
    expect(runtime.renderLimitInfo).toMatch(/^limits buf /);
    expect(runtime.renderAdapterRequest).toBeTruthy();
  });
  it('the render device keeps the limit ladder; every step refused -> null', async () => {
    const m = fakeMachine(HYBRID, { deviceFails: v => v === 'intel' }), { api } = buildCompute({ ...LINUX, gpu: m.gpu }, rt());
    const compute = await api.requestVrlGpuDevice();
    m.log.length = 0;
    expect(await api.requestVrlSplitRenderDevice({ nav: LINUX, computeAdapter: compute.adapter, probe: probeOf(WEBGL_INTEL) })).toBe(null);
    expect(m.log.filter(l => l.startsWith('device'))).toEqual(['device intel ' + (4 * GiB - 4) / MiB + 'MB', 'device intel 2048MB', 'device intel 1024MB', 'device intel default']);
  });
  it('render device creation fails -> null (single shared device), compute device untouched', async () => {
    const m = fakeMachine(HYBRID, { deviceFails: v => v === 'intel' }), runtime = rt(), { api } = buildCompute({ ...LINUX, gpu: m.gpu }, runtime);
    const compute = await api.requestVrlGpuDevice();
    expect(await api.requestVrlSplitRenderDevice({ nav: LINUX, computeAdapter: compute.adapter, probe: probeOf(WEBGL_INTEL) })).toBe(null);
    expect(compute.device.destroyed).toBe(false);
    expect(runtime.splitNote).toMatch(/split not used/);
  });
  it('display is NVIDIA (monitor on the NVIDIA port): no extra adapter request, no split', async () => {
    const m = fakeMachine(HYBRID), { api } = buildCompute({ ...LINUX, gpu: m.gpu }, rt());
    const compute = await api.requestVrlGpuDevice();
    m.log.length = 0;
    expect(await api.requestVrlSplitRenderDevice({ nav: LINUX, computeAdapter: compute.adapter, probe: probeOf(WEBGL_NV) })).toBe(null);
    expect(m.log).toEqual([]);
  });
  it('WebGL unreadable / software renderer: no split', async () => {
    const m = fakeMachine(HYBRID), { api } = buildCompute({ ...LINUX, gpu: m.gpu }, rt());
    const compute = await api.requestVrlGpuDevice();
    m.log.length = 0;
    for (const g of [null, WEBGL_SW]) expect(await api.requestVrlSplitRenderDevice({ nav: LINUX, computeAdapter: compute.adapter, probe: probeOf(g) })).toBe(null);
    expect(m.log).toEqual([]);
  });
  it('the low-power request answers with the NVIDIA adapter (no real second GPU): rejected before any device request', async () => {
    const m = fakeMachine(ONLY_NV), { api } = buildCompute({ ...LINUX, gpu: m.gpu }, rt());
    const compute = await api.requestVrlGpuDevice();
    m.log.length = 0;
    expect(await api.requestVrlSplitRenderDevice({ nav: LINUX, computeAdapter: compute.adapter, probe: probeOf(WEBGL_INTEL) })).toBe(null);
    expect(m.log.filter(l => l.startsWith('device'))).toEqual([]);
  });
});

describe('single GPU / Mac / iPad / Windows: the extra work never starts (same path as before)', () => {
  const cases = [
    ['Mac (Apple)', MAC, [{ info: APPLE_INFO }]], ['iPad (Apple)', IPAD, [{ info: APPLE_INFO }]],
    ['Windows hybrid', WIN, HYBRID], ['Windows single NVIDIA', WIN, ONLY_NV],
    ['Linux single NVIDIA', LINUX, ONLY_NV], ['Linux single Intel', LINUX, ONLY_INTEL], ['Linux AMD', LINUX, [{ info: AMD_INFO }]],
    ['Android / Quest', ANDROID, [{ info: { vendor: 'qualcomm', description: 'Adreno' } }]],
  ];
  for (const [name, n, adapters] of cases) {
    it(name + ': no split, no extra requestAdapter', async () => {
      const m = fakeMachine(adapters), log = m.log, { api } = buildCompute({ ...n, gpu: m.gpu }, rt());
      const compute = await api.requestVrlGpuDevice();
      const before = [...log], probeLog = [];
      // a Linux single NVIDIA is a candidate for the cheap pre-check; its display GPU (WebGL) is the same NVIDIA -> no extra adapter
      expect(await api.requestVrlSplitRenderDevice({ nav: n, computeAdapter: compute.adapter, probe: probeOf(WEBGL_NV, probeLog) })).toBe(null);
      expect(log).toEqual(before);
      if (!(n === LINUX && adapters === ONLY_NV)) expect(probeLog).toEqual([]);
    });
  }
  it('Linux hybrid with preference low-power (compute on Intel): no split', async () => {
    const m = fakeMachine(HYBRID), { api } = buildCompute({ ...LINUX, gpu: m.gpu }, rt());
    const compute = await api.requestVrlGpuDevice({ preference: 'low-power' });
    expect(compute.device.vendor).toBe('intel');
    m.log.length = 0;
    expect(await api.requestVrlSplitRenderDevice({ nav: LINUX, computeAdapter: compute.adapter, probe: probeOf(WEBGL_INTEL) })).toBe(null);
    expect(m.log).toEqual([]);
  });
});

describe('split mode: devices and cross-device resources', () => {
  const setup = async () => {
    const m = fakeMachine(HYBRID), runtime = rt(), built = buildCompute({ ...LINUX, gpu: m.gpu }, runtime);
    const compute = await built.api.requestVrlGpuDevice();
    const render = await built.api.requestVrlSplitRenderDevice({ nav: LINUX, computeAdapter: compute.adapter, probe: probeOf(WEBGL_INTEL) });
    built.deps.sceneState.renderer.backend.device = render.device;
    return { m, runtime, built, compute, render };
  };
  it('adoptSplitGpuDevices: render listener only on the render device; compute handed to ensureGpuFilterDevice, not adopted as shared', async () => {
    const { runtime, built, compute, render } = await setup();
    built.api.adoptSplitGpuDevices(built.deps.sceneState.renderer, compute, render);
    expect(runtime.split).toMatchObject({ active: true });
    expect(runtime.renderDevice).toBe(render.device);
    expect(runtime.device).toBe(null);
    expect(runtime.sharedRendererDevice).toBe(false);
    expect(built.calls).toEqual(['listener render']);
    expect(runtime.pendingCompute.device).toBe(compute.device);
  });
  it("ensureGpuFilterDevice in split mode returns the compute (NVIDIA) device, never the renderer's", async () => {
    const { runtime, built, compute, render } = await setup();
    built.api.adoptSplitGpuDevices(built.deps.sceneState.renderer, compute, render);
    const device = await built.api.ensureGpuFilterDevice();
    expect(device).toBe(compute.device);
    expect(device).not.toBe(render.device);
    expect(runtime.sharedRendererDevice).toBe(false);
    expect(runtime.pendingCompute).toBe(null);
    expect(built.calls).toEqual(['listener render', 'listener compute']);
    expect(runtime.lastBackend).toBe('WEBGPU CORE FULL VERIFIED · WG128');
  });
  it('after the compute device is lost, the retry requests a new compute device (NVIDIA), not the Intel render device', async () => {
    const { m, runtime, built, compute, render } = await setup();
    built.api.adoptSplitGpuDevices(built.deps.sceneState.renderer, compute, render);
    await built.api.ensureGpuFilterDevice();
    runtime.device = null; // as the device.lost handler leaves it
    m.log.length = 0;
    const again = await built.api.ensureGpuFilterDevice();
    expect(again.vendor).toBe('nvidia');
    expect(again).not.toBe(render.device);
    expect(m.log.filter(l => l.startsWith('adapter'))).toEqual(['adapter high-performance']);
  });
  it('GPU-resident attribute: the compute device never shares a buffer with the renderer (null -> CPU readback path)', async () => {
    const { built, compute } = await setup();
    expect(built.api.createGpuResidentFloat3Attribute(compute.device, 300, 'VRL GPU resident position')).toBe(null);
  });
  it('GPU-resident attribute: unchanged on the shared device (single GPU)', () => {
    globalThis.GPUBufferUsage = { STORAGE: 1, VERTEX: 2, COPY_SRC: 4, COPY_DST: 8 };
    const device = { createBuffer: d => ({ size: d.size, destroy() {} }) };
    const set = [];
    const built = buildCompute({ ...LINUX }, rt(), {});
    built.deps.sceneState.renderer.backend = { device, set: (a, b) => set.push(b) };
    const resident = built.api.createGpuResidentFloat3Attribute(device, 300, 'VRL GPU resident position');
    expect(resident.buffer.size).toBe(300 * 3 * 4);
    expect(set.length).toBe(1);
  });
  it('render-device errors never become a compute FAIL', () => {
    const listenerSrc = fnSrc(gpuSrc, 'installGpuErrorListener');
    const handlers = {}, runtime = rt(), backendCalls = [];
    const device = { addEventListener: (n, h) => { handlers[n] = h; }, createTexture: () => ({}) };
    new Function('deps', 'const {installGpuLedger,gpuFilterRuntime,setGpuComputeBackend,updateGpuStatus,console}=deps;' + listenerSrc + 'installGpuErrorListener(deps.device,deps.role);')(
      { installGpuLedger() {}, gpuFilterRuntime: runtime, setGpuComputeBackend: l => backendCalls.push(l), updateGpuStatus() {}, console: { error() {}, warn() {} }, device, role: 'render' });
    handlers.uncapturederror({ error: { message: 'Requested allocation size (10407936) is smaller than the image requires (11000000).' } });
    expect(backendCalls).toEqual([]);
    expect(runtime.lastError).toBe('');
    expect(runtime.renderError).toMatch(/^uncaptured: Requested allocation size/);
  });
});

describe('status line', () => {
  const statusOf = (runtime, sceneState = { backend: 'WEBGPU' }) => {
    const { api, deps } = buildCompute(LINUX, runtime, { sceneState });
    api.updateGpuStatus(); return deps.status;
  };
  it('single GPU line is unchanged', () => {
    const s = statusOf({ ...rt(), device: {}, lastBackend: 'WEBGPU CORE FULL VERIFIED · WG256', adapterLabel: 'nvidia ada NVIDIA GeForce RTX 4070 Ti' });
    expect(s.textContent).toBe('Render WEBGPU · Compute WEBGPU CORE FULL VERIFIED · WG256 · nvidia ada NVIDIA GeForce RTX 4070 Ti');
    expect(s.className).toBe('status status-ok');
  });
  it('split line names both GPUs', () => {
    const s = statusOf({ ...rt(), device: {}, lastBackend: 'WEBGPU', split: { active: true, renderVendor: 'intel', computeVendor: 'nvidia' } });
    expect(s.textContent).toBe('Render WEBGPU intel (display) · Compute WEBGPU nvidia (split)');
  });
  it('the last error: chip keeps 160 characters, title and the bar under the views show it in full', () => {
    const long = 'verify [anisotropic]: pipeline anisotropic: Requested allocation size (10407936) is smaller than the image requires (11280384). - While calling [Device].CreateTexture() with a long tail ' + 'x'.repeat(200);
    const bar = { classList: { toggle() {} } }, barText = { textContent: '' };
    const doc = { getElementById: id => (id === 'gpu-status-bar' ? bar : id === 'gpu-status-text' ? barText : null) };
    const runtime = { ...rt(), device: {}, lastBackend: 'WEBGPU COMPUTE FAIL', lastError: long };
    const { api, deps } = buildCompute(LINUX, runtime, { document: doc });
    api.updateGpuStatus();
    expect(deps.status.textContent.length).toBeLessThan(220);
    expect(deps.status.textContent).toContain(long.slice(0, 160));
    expect(deps.status.title).toBe(long);
    expect(barText.textContent.endsWith(' · ' + long)).toBe(true);
    // a short error is shown once, in the chip, and the bar does not repeat it
    runtime.lastError = 'short error';
    api.updateGpuStatus();
    expect(deps.status.textContent).toContain(' · short error');
    expect(barText.textContent).toBe(deps.status.textContent);
  });
  it('a render error shows as Render error and does not touch the compute label', () => {
    const s = statusOf({ ...rt(), device: {}, lastBackend: 'WEBGPU CORE FULL VERIFIED · WG256', split: { active: true, renderVendor: 'intel', computeVendor: 'nvidia' }, renderError: 'uncaptured: boom' });
    expect(s.textContent).toBe('Render WEBGPU intel (display) · Compute WEBGPU CORE FULL VERIFIED · WG256 nvidia (split) · Render error: uncaptured: boom');
    expect(s.title).toBe('Render: uncaptured: boom');
  });
});

describe('create3DRenderer: split, fallback, unchanged single-device path', () => {
  const build = ({ split, splitInitFails = false, sharedInitFails = false }) => {
    const events = [];
    class Renderer { constructor(o) { this.o = o; events.push('new ' + o.device.name); } setPixelRatio() {} async init() { if ((this.o.device.name === 'render' && splitInitFails) || (this.o.device.name === 'core' && sharedInitFails)) throw new Error('init failed'); events.push('init ' + this.o.device.name); } }
    class WebGL { constructor() { events.push('webgl'); } setPixelRatio() {} setClearColor() {} }
    const core = { adapter: { info: NV_INFO }, device: { name: 'core', destroy() { events.push('destroy core'); } } };
    const render = { adapter: { info: INTEL_INFO }, device: { name: 'render', destroy() { events.push('destroy render'); } }, split: { active: true, renderVendor: 'intel', computeVendor: 'nvidia' } };
    const src = fnSrc(sceneSrc, 'create3DRenderer');
    const deps = {
      navigator: { gpu: {} }, devicePixelRatio: 1, console: { warn() {} },
      THREE: { WebGPURenderer: Renderer, Color: class {} }, WebGLRenderer: WebGL,
      requestVrlGpuDevice: async () => core, requestVrlSplitRenderDevice: async o => { events.push('split-request ' + o.computeAdapter.info.vendor); return split ? render : null; },
      adoptSplitGpuDevices: () => events.push('adopt-split'), adoptRendererGpuDevice: (r, a, d) => events.push('adopt-shared ' + d.name),
      canvasBackground3d: () => null, onCanvasThemeChange() {}, request3DRender() {},
    };
    const fn = new Function('deps', 'const {' + Object.keys(deps).join(',') + '}=deps;' + src + 'return create3DRenderer;')(deps);
    return { fn, events };
  };
  it('single device (no split): exactly the old calls', async () => {
    const { fn, events } = build({ split: false });
    const r = await fn();
    expect(r.backend).toBe('WEBGPU');
    expect(events).toEqual(['split-request nvidia', 'new core', 'init core', 'adopt-shared core']);
  });
  it('split: renderer on the render device, compute device handed over', async () => {
    const { fn, events } = build({ split: true });
    const r = await fn();
    expect(r.backend).toBe('WEBGPU');
    expect(events).toEqual(['split-request nvidia', 'new render', 'init render', 'adopt-split']);
  });
  it('split render init fails: render device destroyed, one shared device as before', async () => {
    const { fn, events } = build({ split: true, splitInitFails: true });
    const r = await fn();
    expect(r.backend).toBe('WEBGPU');
    expect(events).toEqual(['split-request nvidia', 'new render', 'destroy render', 'new core', 'init core', 'adopt-shared core']);
  });
  it('split render fails and the shared device fails too: WebGL, as before', async () => {
    const { fn, events } = build({ split: true, splitInitFails: true, sharedInitFails: true });
    const r = await fn();
    expect(r.backend).toBe('WEBGL');
    expect(events[events.length - 1]).toBe('webgl');
  });
});
