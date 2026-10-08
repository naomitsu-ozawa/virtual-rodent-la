import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { gpuAdapterRequestOptions } from '../../docs/gpu-diagnostics.js';

// gpu-compute.js needs a DOM to import, so the pure helpers are cut out of the source and evaluated here.
const src = readFileSync('docs/gpu-compute.js', 'utf8');
const grab = re => { const m = src.match(re); if (!m) throw new Error('helper not found: ' + re); return m[0].replace('export ', ''); };
const { gpuAdapterInfo, gpuAdapterHint, gpuAdapterLabel } = new Function(
  grab(/export function gpuAdapterInfo[^\n]*\n/) + grab(/export function gpuAdapterHint[\s\S]*?\n}\n/) +
  grab(/export function gpuAdapterLabel[\s\S]*?\n}\n/) +
  '\nreturn{gpuAdapterInfo,gpuAdapterHint,gpuAdapterLabel}')();

describe('gpuAdapterHint', () => {
  it('flags software renderers', () => {
    expect(gpuAdapterHint({ vendor: 'google', architecture: 'swiftshader' })).toMatch(/software/);
    expect(gpuAdapterHint({ description: 'llvmpipe (LLVM 15)' })).toMatch(/software/);
  });
  it('flags integrated Intel but not Intel Arc / NVIDIA / AMD', () => {
    expect(gpuAdapterHint({ vendor: 'intel', architecture: 'gen-12lp' })).toMatch(/integrated/);
    expect(gpuAdapterHint({ vendor: 'intel', architecture: 'xe-hpg', description: 'Intel Arc A770' })).toBe('');
    expect(gpuAdapterHint({ vendor: 'nvidia', architecture: 'ampere' })).toBe('');
    expect(gpuAdapterHint({ vendor: 'amd', architecture: 'rdna-3' })).toBe('');
  });
  it('tolerates missing info', () => {
    expect(gpuAdapterHint(null)).toBe('');
    expect(gpuAdapterHint({})).toBe('');
  });
});

describe('gpuAdapterInfo / gpuAdapterLabel', () => {
  it('uses adapter.info, falling back to the info stashed from requestAdapterInfo', () => {
    expect(gpuAdapterInfo({ info: { vendor: 'a' } })).toEqual({ vendor: 'a' });
    expect(gpuAdapterInfo({ __vrlInfo: { vendor: 'b' } })).toEqual({ vendor: 'b' });
    expect(gpuAdapterInfo(null)).toBe(null);
  });
  it('builds a de-duplicated label and appends the hint', () => {
    expect(gpuAdapterLabel({ info: { vendor: 'nvidia', architecture: 'ampere', device: '', description: 'nvidia' } })).toBe('nvidia ampere');
    expect(gpuAdapterLabel({ info: { vendor: 'intel', architecture: 'gen-12lp' } })).toMatch(/^intel gen-12lp ⚠ integrated/);
    expect(gpuAdapterLabel({})).toBe('');
  });
});

describe('gpuAdapterRequestOptions', () => {
  it('asks high-performance first, then no options, then compatibility', () => {
    const o = gpuAdapterRequestOptions(false);
    expect(o[0]).toEqual({ powerPreference: 'high-performance', featureLevel: 'core' });
    expect(o[1]).toEqual({ powerPreference: 'high-performance' });
    expect(o[2]).toBeUndefined();
    expect(o.at(-1)).toEqual({ featureLevel: 'compatibility' });
  });
  it('skips core attempts when compatibility is forced', () => {
    expect(gpuAdapterRequestOptions(true).every(x => x?.featureLevel === 'compatibility')).toBe(true);
  });
});
