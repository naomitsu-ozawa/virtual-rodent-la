// GPU split (build 516): render on the display GPU, compute on the other GPU, ONLY for one hybrid case.
// Pure (its only import is the pure gpu-preference.js), so unit tests load it without a DOM.
//
// Why (owner, Ubuntu / Chrome 155, Optimus: Intel UHD 770 drives the display, NVIDIA RTX 4070 Ti computes; the WebGPU
// interop path is on): Chrome allocates every WebGPU "shared image" (canvas getCurrentTexture, copyExternalImageToTexture
// from a canvas / ImageBitmap such as three.js CanvasTexture, importExternalTexture) with its OWN VkDevice, the display
// GPU (Intel), and imports it into Dawn's device by opaque file descriptor. When Dawn's device is on the NVIDIA adapter that
// import fails Dawn's size check ("Requested allocation size (X) is smaller than the image requires (Y)"). Plain
// createTexture / createBuffer / writeTexture / writeBuffer / compute never take that path. So the app keeps compute on the
// NVIDIA adapter (its own device, which never configures a canvas or imports an image) and gives the three.js renderer
// and the volume renderer a separate device on the display (low-power, Intel) adapter. Chrome developers recommend the
// integrated GPU for presenting on Linux hybrids. Scope: Linux only (the cause is Vulkan opaque-FD import; Windows / D3D12
// shares across adapters by another mechanism that is not verified here).
//
// Owner's rule: handle only this combination (display = Intel, compute = NVIDIA, different GPUs). A single GPU, Mac, iPad,
// Windows, or any uncertainty keeps the single shared device, i.e. the behaviour of builds up to 515.
import { gpuPlatformOs } from './gpu-preference.js?v=20261008-build516';

// 'nvidia' | 'intel' | 'amd' | 'apple' | 'software' | 'other' | '' (unknown). `parts` are the strings that name the GPU:
// adapter.info.vendor / architecture / device / description, or the WebGL UNMASKED_VENDOR / UNMASKED_RENDERER.
export function gpuVendorKey(...parts) {
  const s = parts.flat().filter(v => v !== undefined && v !== null).map(v => String(v)).join(' ').toLowerCase();
  if (!s.trim()) return '';
  if (/swiftshader|llvmpipe|softpipe|software|lavapipe/.test(s)) return 'software';
  if (/nvidia|geforce|quadro|\brtx\b|\bgtx\b/.test(s)) return 'nvidia';
  if (/\bintel\b|\biris\b|uhd graphics|hd graphics/.test(s)) return 'intel';
  if (/\bamd\b|\bati\b|radeon|advanced micro/.test(s)) return 'amd';
  if (/apple/.test(s)) return 'apple';
  return 'other';
}
export function gpuAdapterVendorKey(adapter) {
  try {
    const i = adapter?.info;
    return i ? gpuVendorKey(i.vendor, i.architecture, i.device, i.description) : '';
  } catch { return ''; }
}

// Decide whether to split. Inputs are plain values so tests can feed every combination:
//   os            gpuPlatformOs() result
//   computeVendor vendor key of the adapter the compute device is on (per 「使う GPU」 / the limit ladder)
//   lowPowerVendor vendor key of the adapter requestAdapter({powerPreference:'low-power'}) returned
//   displayVendor vendor key of the GPU WebGL renders on (WEBGL_debug_renderer_info) = Chrome's display / GL GPU
// A low-power adapter is NOT proof of the display GPU (the monitor may be wired to the NVIDIA port), hence the WebGL
// probe: split only when the display GPU and the low-power adapter are both Intel and the compute adapter is NVIDIA.
export function gpuSplitDecision({ os, computeVendor = '', lowPowerVendor = '', displayVendor = '' } = {}) {
  const no = reason => ({ split: false, reason, renderVendor: '', computeVendor });
  if (os !== 'linux') return no('not linux');
  if (computeVendor !== 'nvidia') return no('compute adapter is not nvidia');
  if (!displayVendor) return no('display gpu unknown');
  if (displayVendor !== 'intel') return no('display gpu is not intel');
  if (lowPowerVendor !== 'intel') return no('low-power adapter is not intel');
  return { split: true, reason: 'display intel, compute nvidia', renderVendor: 'intel', computeVendor };
}

// A cheap pre-check that needs no GPU access at all: only a Linux machine whose compute adapter is NVIDIA can be in the
// hybrid case, so every other machine returns here before any extra adapter request or WebGL context.
export function gpuSplitCandidate(nav, computeAdapter) {
  return gpuPlatformOs(nav) === 'linux' && gpuAdapterVendorKey(computeAdapter) === 'nvidia';
}

// The status-line wording. '' parts when not split, so the single-GPU line is unchanged.
export function gpuSplitStatusParts(split) {
  if (!split?.active) return { render: '', compute: '' };
  return { render: ' ' + split.renderVendor + ' (display)', compute: ' ' + split.computeVendor + ' (split)' };
}

// The display GPU as WebGL sees it: a throwaway WebGL2 context, read once, then released. null when it cannot be read.
// `doc` is injectable for tests.
export function webglDisplayGpu(doc = globalThis.document) {
  let canvas = null, gl = null;
  try {
    canvas = doc?.createElement?.('canvas');
    if (!canvas) return null;
    canvas.width = canvas.height = 1;
    gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return null;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const vendor = ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : '', renderer = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : '';
    if (!vendor && !renderer) return null;
    return { vendor: String(vendor || ''), renderer: String(renderer || '') };
  } catch { return null; } finally {
    try { gl?.getExtension?.('WEBGL_lose_context')?.loseContext?.(); } catch {}
  }
}
