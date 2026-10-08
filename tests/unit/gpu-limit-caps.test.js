import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// build 508: the WebGPU device request caps maxBufferSize / maxStorageBufferBindingSize at Dawn's 2 GiB tier
// (owner's NVIDIA RTX 4070 Ti on Linux/Vulkan failed with VK_ERROR_OUT_OF_DEVICE_MEMORY). The modules need a DOM to
// import, so the functions are cut out of the sources and evaluated here (as in gpu-check-sync.test.js).
const read = p => readFileSync(p, 'utf8');
const gpuSrc = read('docs/gpu-compute.js');
const grab = (src, re) => { const m = src.match(re); if (!m) throw new Error('not found: ' + re); return m[0].replace(/^export /, ''); };
const fnSrc = (src, name) => grab(src, new RegExp('export (async )?function ' + name + '\\([\\s\\S]*?\\n}\\n'));

const capsSrc = grab(gpuSrc, /export const GPU_BUFFER_LIMIT_CAPS=[^\n]*\n/);
const build = (forceCompat = false) => new Function('gpuForceCompat', 'navigator', 'gpuFilterRuntime', 'console',
  capsSrc + fnSrc(gpuSrc, 'capGpuBufferLimits') + fnSrc(gpuSrc, 'gpuLimitInfoText') + fnSrc(gpuSrc, 'gpuDeviceRequestDescriptor') +
  fnSrc(gpuSrc, 'requestVrlGpuAdapter') + fnSrc(gpuSrc, 'requestVrlGpuDevice') + grab(gpuSrc, /export function gpuLostText[^\n]*\n/) +
  '\nreturn{GPU_BUFFER_LIMIT_CAPS,capGpuBufferLimits,gpuLimitInfoText,gpuDeviceRequestDescriptor,requestVrlGpuDevice,gpuLostText}');
const quiet = { info() {}, warn() {} };
const api = (forceCompat = false, navigator = {}, runtime = {}) => build()(forceCompat, navigator, runtime, quiet);

// the request as it was up to build 502 (verbatim, for the "unchanged below the cap" checks)
function oldDescriptor(adapter, gpuForceCompat = false) {
  const requiredFeatures = []; if (!gpuForceCompat && adapter?.features?.has?.('core-features-and-limits')) requiredFeatures.push('core-features-and-limits');
  if (!requiredFeatures.includes('core-features-and-limits')) { const all = {}; for (const k in adapter?.limits || {}) { const v = adapter.limits[k]; if (typeof v === 'number' && Number.isFinite(v)) all[k] = v; } return { requiredFeatures, requiredLimits: all }; }
  const requiredLimits = {};
  if ((adapter?.limits?.maxComputeInvocationsPerWorkgroup || 0) >= 256) requiredLimits.maxComputeInvocationsPerWorkgroup = 256;
  if ((adapter?.limits?.maxComputeWorkgroupSizeX || 0) >= 256) requiredLimits.maxComputeWorkgroupSizeX = 256;
  const maxBufferSize = Number(adapter?.limits?.maxBufferSize) || 0; if (maxBufferSize > 0) requiredLimits.maxBufferSize = maxBufferSize;
  const maxStorageBufferBindingSize = Number(adapter?.limits?.maxStorageBufferBindingSize) || 0; if (maxStorageBufferBindingSize > 0) requiredLimits.maxStorageBufferBindingSize = maxStorageBufferBindingSize;
  return { requiredFeatures, requiredLimits };
}

const MiB = 2 ** 20, GiB = 2 ** 30;
// Representative adapter limits. Chrome reports Dawn's tiers (Limits.cpp): maxBufferSize 256 MiB / 1 GiB / 2 GiB /
// 4 GiB-4, maxStorageBufferBindingSize 128 / 256 / 512 MiB / 1 GiB / 2 GiB-4 / 4 GiB-4. The device rows are
// assumptions (the owner's chrome://gpu values are not logged); the tier sweep below covers every combination.
const PROFILES = {
  'NVIDIA RTX 4070 Ti (Vulkan)': { core: true, limits: { maxBufferSize: 4 * GiB - 4, maxStorageBufferBindingSize: 4 * GiB - 4, maxComputeInvocationsPerWorkgroup: 1024, maxComputeWorkgroupSizeX: 1024, maxComputeWorkgroupStorageSize: 32768, maxTextureDimension3D: 2048 } },
  'Intel UHD 770 (Vulkan)': { core: true, limits: { maxBufferSize: 2 * GiB, maxStorageBufferBindingSize: 1 * GiB, maxComputeInvocationsPerWorkgroup: 1024, maxComputeWorkgroupSizeX: 1024, maxComputeWorkgroupStorageSize: 32768, maxTextureDimension3D: 2048 } },
  'Apple M-series (Metal, 2 GiB tier)': { core: true, limits: { maxBufferSize: 2 * GiB, maxStorageBufferBindingSize: 2 * GiB - 4, maxComputeInvocationsPerWorkgroup: 1024, maxComputeWorkgroupSizeX: 1024, maxComputeWorkgroupStorageSize: 32768, maxTextureDimension3D: 2048 } },
  'Apple M-series (Metal, 4 GiB tier)': { core: true, limits: { maxBufferSize: 4 * GiB - 4, maxStorageBufferBindingSize: 4 * GiB - 4, maxComputeInvocationsPerWorkgroup: 1024, maxComputeWorkgroupSizeX: 1024, maxComputeWorkgroupStorageSize: 32768, maxTextureDimension3D: 2048 } },
  'iPad (Metal)': { core: true, limits: { maxBufferSize: 1 * GiB, maxStorageBufferBindingSize: 1 * GiB, maxComputeInvocationsPerWorkgroup: 1024, maxComputeWorkgroupSizeX: 1024, maxComputeWorkgroupStorageSize: 32768, maxTextureDimension3D: 2048 } },
  'Quest (Adreno, Vulkan)': { core: true, limits: { maxBufferSize: 1 * GiB, maxStorageBufferBindingSize: 512 * MiB, maxComputeInvocationsPerWorkgroup: 1024, maxComputeWorkgroupSizeX: 1024, maxComputeWorkgroupStorageSize: 32768, maxTextureDimension3D: 2048 } },
  'Linux OpenGL ES (compat)': { core: false, limits: { maxBufferSize: 4 * GiB - 4, maxStorageBufferBindingSize: 4 * GiB - 4, maxComputeInvocationsPerWorkgroup: 256, maxComputeWorkgroupSizeX: 256, maxStorageBuffersPerShaderStage: 8, maxTextureDimension3D: 2048 } },
};
const adapterOf = p => ({ features: new Set(p.core ? ['core-features-and-limits'] : []), limits: { ...p.limits } });
const over2G = p => p.limits.maxBufferSize > 2 * GiB || p.limits.maxStorageBufferBindingSize > 2 * GiB - 4;

describe('device request: buffer limits capped at the 2 GiB tier', () => {
  const { gpuDeviceRequestDescriptor } = api();
  for (const [name, p] of Object.entries(PROFILES)) {
    it(name, () => {
      const now = gpuDeviceRequestDescriptor(adapterOf(p)), before = oldDescriptor(adapterOf(p));
      if (!over2G(p)) { expect(now).toEqual(before); return; }
      // above the cap: only the two byte limits change, to the 2 GiB tier
      expect(now.requiredFeatures).toEqual(before.requiredFeatures);
      expect(now.requiredLimits).toEqual({ ...before.requiredLimits, maxBufferSize: 2 * GiB, maxStorageBufferBindingSize: 2 * GiB - 4 });
    });
  }
  it('every Dawn tier at or below 2 GiB requests exactly what it did before (core and compat)', () => {
    const bufs = [256 * MiB, 1 * GiB, 2 * GiB], binds = [128 * MiB, 256 * MiB, 512 * MiB, 1 * GiB, 2 * GiB - 4];
    for (const core of [true, false]) for (const b of bufs) for (const s of binds) {
      const a = adapterOf({ core, limits: { maxBufferSize: b, maxStorageBufferBindingSize: s, maxComputeInvocationsPerWorkgroup: 256, maxComputeWorkgroupSizeX: 256 } });
      expect(gpuDeviceRequestDescriptor(a)).toEqual(oldDescriptor(a));
    }
  });
  it('the requested binding size stays a multiple of 4 and <= maxBufferSize at every cap', () => {
    const { GPU_BUFFER_LIMIT_CAPS } = api();
    expect(GPU_BUFFER_LIMIT_CAPS).toEqual([2 * GiB, 1 * GiB, 0]);
    for (const cap of GPU_BUFFER_LIMIT_CAPS) {
      const l = gpuDeviceRequestDescriptor(adapterOf(PROFILES['NVIDIA RTX 4070 Ti (Vulkan)']), cap).requiredLimits;
      if (cap === 0) { expect(l.maxBufferSize).toBeUndefined(); expect(l.maxStorageBufferBindingSize).toBeUndefined(); continue; }
      expect(l.maxStorageBufferBindingSize % 4).toBe(0);
      expect(l.maxStorageBufferBindingSize).toBeLessThanOrEqual(l.maxBufferSize);
      expect(l.maxBufferSize).toBeLessThanOrEqual(cap);
    }
  });
  it('the forced compatibility device (?gpucompat) is capped the same way', () => {
    const forced = build()(true, {}, {}, quiet).gpuDeviceRequestDescriptor(adapterOf(PROFILES['NVIDIA RTX 4070 Ti (Vulkan)']));
    expect(forced.requiredFeatures).toEqual([]);
    expect(forced.requiredLimits.maxBufferSize).toBe(2 * GiB);
    expect(forced.requiredLimits.maxComputeWorkgroupStorageSize).toBe(32768);
  });
});

// Sizes the app derives from device.limits: with the capped request they must equal the sizes of the old request.
const sfSrc = read('docs/source-filters.js'), sbSrc = read('docs/surface-build.js'), srSrc = read('docs/segment-runs.js');
const derived = (limits, desktop = true, touch = 0) => {
  const runtime = { device: { limits } }, nav = { maxTouchPoints: touch };
  const f = new Function('navigator', 'isDesktopRuntime', 'gpuFilterRuntime',
    fnSrc(sfSrc, 'sourceTileBudget') + fnSrc(sfSrc, 'volumeBlockBudget') + fnSrc(sbSrc, 'gpuMeshBlockDepth') +
    'return{tile:sourceTileBudget(),block:volumeBlockBudget(),mesh:gpuMeshBlockDepth()}')(nav, () => desktop, runtime);
  // gpuOpenRuns (gpu-compute.js) and the air-layer block depth (segment-runs.js), for a few image sizes and halos
  const openLine = grab(gpuSrc, /const limit=Number\(device\.limits\?\.maxStorageBufferBindingSize\)\|\|134217728,core=[^;]*;/);
  const airLine = grab(srSrc, /const fit=Math\.floor\(limit\/\(w\*h\*4\)\)-2\*halo-1;if\(fit>blockDepth\)blockDepth=Math\.min\(32,fit\);/);
  const open = new Function('device', 'plane', 'halo', openLine + 'return core;'), air = new Function('limit', 'w', 'h', 'halo', 'blockDepth', airLine + 'return blockDepth;');
  const cores = [];
  for (const side of [256, 512, 1024, 2048]) for (let halo = 0; halo <= 40; halo++) {
    cores.push(open({ limits }, side * side, halo), air(limits.maxStorageBufferBindingSize || 134217728, side, side, halo, 4));
  }
  return { ...f, maxOut: Math.min(limits.maxStorageBufferBindingSize, limits.maxBufferSize || limits.maxStorageBufferBindingSize) >= 256 * MiB, cores };
};
describe('sizes derived from the device limits are unchanged on every profile', () => {
  const { gpuDeviceRequestDescriptor } = api();
  for (const [name, p] of Object.entries(PROFILES)) {
    it(name, () => {
      const req = gpuDeviceRequestDescriptor(adapterOf(p)).requiredLimits, old = oldDescriptor(adapterOf(p)).requiredLimits;
      for (const [desktop, touch] of [[true, 0], [false, 0], [false, 5]]) expect(derived(req, desktop, touch)).toEqual(derived(old, desktop, touch));
    });
  }
  it('the one size that shrinks: 4096x4096 slices on a 4 GiB-tier adapter (opening / air-layer block depth)', () => {
    // core = min(32, floor(binding / (plane*4)) - 2*halo - 1): 4 GiB -> 64 - 2h - 1, 2 GiB -> 32 - 2h - 1.
    // Blocks are exact (halo covers the filter), so the result is identical; only the blocks get thinner.
    const open = new Function('device', 'plane', 'halo', grab(gpuSrc, /const limit=Number\(device\.limits\?\.maxStorageBufferBindingSize\)\|\|134217728,core=[^;]*;/) + 'return core;');
    expect(open({ limits: { maxStorageBufferBindingSize: 4 * GiB - 4 } }, 4096 * 4096, 2)).toBe(32);
    expect(open({ limits: { maxStorageBufferBindingSize: 2 * GiB - 4 } }, 4096 * 4096, 2)).toBe(26);
    expect(open({ limits: { maxStorageBufferBindingSize: 2 * GiB - 4 } }, 2048 * 2048, 47)).toBe(32); // 2048²: equal up to halo 47
  });
  it('documents the old desktop sizes (block 96 MB, tile 32 MB, mesh depth 32)', () => {
    const d = derived(oldDescriptor(adapterOf(PROFILES['NVIDIA RTX 4070 Ti (Vulkan)'])).requiredLimits);
    expect([d.block, d.tile, d.mesh]).toEqual([96 * MiB, 32 * MiB, 32]);
  });
});

describe('device request retries with lower caps when refused', () => {
  // each requestAdapter returns a fresh adapter; requestDevice refuses any maxBufferSize above `refuseAbove`
  const fakeGpu = (limits, refuseAbove) => {
    const log = [];
    return {
      log, gpu: {
        async requestAdapter(opts) {
          log.push('adapter ' + (opts?.featureLevel || '-'));
          return { features: new Set(['core-features-and-limits']), limits: { ...limits }, info: {},
            async requestDevice(desc) {
              const b = desc.requiredLimits.maxBufferSize;
              log.push('device ' + (b === undefined ? 'default' : b / MiB + 'MB'));
              if (b !== undefined && b > refuseAbove) throw new Error('Failed to create device: VK_ERROR_OUT_OF_DEVICE_MEMORY');
              return { limits: desc.requiredLimits };
            } };
        },
      },
    };
  };
  const nv = PROFILES['NVIDIA RTX 4070 Ti (Vulkan)'].limits;
  it('first attempt succeeds: one adapter, one device request at the 2 GiB cap (no extra work)', async () => {
    const f = fakeGpu(nv, Infinity), rt = {};
    const r = await api(false, { gpu: f.gpu }, rt).requestVrlGpuDevice();
    expect(f.log).toEqual(['adapter core', 'device 2048MB']);
    expect(r.device.limits.maxBufferSize).toBe(2 * GiB);
    expect(rt.limitInfo).toBe('limits buf 2048MB/bind 2048MB (adapter 4096MB/4096MB)');
  });
  it('a refused 2 GiB request is retried with 1 GiB, on a fresh adapter', async () => {
    const f = fakeGpu(nv, 1 * GiB), rt = {};
    const r = await api(false, { gpu: f.gpu }, rt).requestVrlGpuDevice();
    expect(f.log).toEqual(['adapter core', 'device 2048MB', 'adapter core', 'device 1024MB']);
    expect(r.device.limits).toMatchObject({ maxBufferSize: 1 * GiB, maxStorageBufferBindingSize: 1 * GiB });
    expect(rt.limitInfo).toMatch(/^limits buf 1024MB\/bind 1024MB \(adapter 4096MB\/4096MB\) · retry 2048MB failed: Failed to create device: VK_ERROR_OUT_OF_DEVICE_MEMORY$/);
  });
  it('then with the WebGPU default buffer limits', async () => {
    const f = fakeGpu(nv, 512 * MiB), rt = {};
    const r = await api(false, { gpu: f.gpu }, rt).requestVrlGpuDevice();
    expect(f.log.filter(l => l.startsWith('device'))).toEqual(['device 2048MB', 'device 1024MB', 'device default']);
    expect(r.device.limits.maxBufferSize).toBeUndefined();
    expect(r.device.limits.maxComputeInvocationsPerWorkgroup).toBe(256);
    expect(rt.limitInfo).toContain('limits buf default/bind default');
  });
  it('throws the last error when every cap is refused (the caller falls back to CPU / WebGL as before)', async () => {
    const f = fakeGpu(nv, -1), rt = {};
    // the default rung has no maxBufferSize; make that one fail too
    f.gpu.requestAdapter = (orig => async o => { const a = await orig(o); const rd = a.requestDevice; a.requestDevice = async d => { if (d.requiredLimits.maxBufferSize === undefined) throw new Error('still refused'); return rd(d); }; return a; })(f.gpu.requestAdapter.bind(f.gpu));
    await expect(api(false, { gpu: f.gpu }, rt).requestVrlGpuDevice()).rejects.toThrow('still refused');
    expect(rt.limitInfo).toMatch(/^device request failed · retry 2048MB failed: .* → 1024MB failed: .* → default failed: still refused$/);
  });
  it('no adapter: same error as before', async () => {
    await expect(api(false, { gpu: { async requestAdapter() { return null; } } }, {}).requestVrlGpuDevice()).rejects.toThrow('WebGPU adapter unavailable (core and compatibility)');
  });
});

describe('device.lost text', () => {
  const { gpuLostText } = api();
  it('carries the reason and message', () => {
    expect(gpuLostText({ reason: 'unknown', message: 'VK_ERROR_DEVICE_LOST' })).toBe('WebGPU device lost (unknown): VK_ERROR_DEVICE_LOST');
    expect(gpuLostText(undefined)).toBe('WebGPU device lost');
  });
});
