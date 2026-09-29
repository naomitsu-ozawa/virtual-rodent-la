import { describe, it, expect } from 'vitest';
import { WgslReflect } from 'wgsl_reflect/wgsl_reflect.module.js';
import { gpuFilterShader, normalizeVrlWgsl, GPU_PREWARM_KINDS } from '../../docs/gpu-shaders.js';
import { volumeShader, brickShader, volumePickShader, mprPlaneShader } from '../../docs/medical-volume.js';

// CI has no GPU, so WGSL compile errors used to surface only on the device.
// wgsl_reflect parses WGSL in Node: it catches syntax/structure errors (not
// every validation rule a real GPU driver applies, e.g. type checking).
const parse = src => new WgslReflect(src);

// 'faceExtract' is handled by gpuFilterShader but not prewarmed.
const FILTER_KINDS = [...GPU_PREWARM_KINDS, 'faceExtract'];

describe('compute shaders (docs/gpu-shaders.js)', () => {
  // gpuFilterPipeline rewrites gid.x for 2D dispatch grids (build 263)
  it.each(FILTER_KINDS)('%s parses with the 2D-grid index rewrite', kind => {
    const src = normalizeVrlWgsl(gpuFilterShader(kind, 64)).replaceAll('gid.x', '(gid.x+gid.y*' + (65535 * 64) + 'u)');
    expect(() => parse(src)).not.toThrow();
    expect(src).not.toMatch(/[^(]gid\.x/);
  });
  it.each(FILTER_KINDS)('%s parses and exposes a compute main()', kind => {
    const src = normalizeVrlWgsl(gpuFilterShader(kind, 64));
    expect(src).not.toMatch(/undefined|NaN/);
    // nlmTile is a fixed 8×8 tile kernel (build 328)
    expect(src).toContain(kind === 'nlmTile' ? '@workgroup_size(8,8,1)' : '@workgroup_size(64)');
    const r = parse(src);
    expect(r.entry.compute.map(e => e.name)).toContain('main');
  });

  it('uses the workgroup size it is given', () => {
    expect(gpuFilterShader('gaussian', 128)).toContain('@workgroup_size(128)');
  });

  it('normalizeVrlWgsl renames identifiers that clash with WGSL reserved words', () => {
    expect(normalizeVrlWgsl('let meta = active + target;')).toBe('let vrlMeta = vrlActive + vrlTarget;');
  });

  it('rejects broken WGSL (parser sanity check)', () => {
    expect(() => parse('fn main( { let x = ; }')).toThrow();
  });
});

describe('render shaders (docs/medical-volume.js)', () => {
  it('volumeShader has vertex + fragment entry points', () => {
    const r = parse(volumeShader());
    expect(r.entry.vertex.length).toBe(1);
    expect(r.entry.fragment.length).toBe(1);
  });
  it.each([['brickShader', brickShader], ['volumePickShader', volumePickShader], ['mprPlaneShader', mprPlaneShader]])(
    '%s parses and exposes a compute main()', (_name, fn) => {
      expect(parse(fn()).entry.compute.map(e => e.name)).toContain('main');
    });
});
