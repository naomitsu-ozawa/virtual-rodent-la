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
    expect(src).toContain('@workgroup_size(64)');
    const r = parse(src);
    expect(r.entry.compute.map(e => e.name)).toContain('main');
  });

  // build 447: the strength parameters are absolute HU values at fixed indexes (params[0..]); the volume range
  // (min / max) is no longer passed, so no shader may compute a range from the params
  it.each(['sigmoid', 'spikeHole', 'anisotropic', 'tv', 'unsharp', 'unsharpCombine', 'bilateral', 'nlm'])('%s does not use a volume range', kind => {
    const src = gpuFilterShader(kind, 64);
    expect(src).not.toMatch(/params\[1\]\s*-\s*params\[0\]/);
    expect(src).not.toMatch(/let range=/);
  });
  it('the HU parameters are read from params[] at the documented indexes', () => {
    expect(gpuFilterShader('bilateral', 64)).toMatch(/intensitySigma=max\(0\.000001,params\[2\]\)/);
    expect(gpuFilterShader('nlm', 64)).toMatch(/let hp=params\[0\];/);
    expect(gpuFilterShader('anisotropic', 64)).toMatch(/let k=params\[1\];/);
    expect(gpuFilterShader('tv', 64)).toMatch(/let eps=params\[1\];/);
    expect(gpuFilterShader('spikeHole', 64)).toMatch(/let threshold=params\[1\];/);
    expect(gpuFilterShader('unsharp', 64)).toMatch(/let threshold=params\[1\];/);
    expect(gpuFilterShader('unsharpCombine', 64)).toMatch(/let threshold=params\[1\];/);
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
