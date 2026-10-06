import { describe, it, expect, vi } from 'vitest';
import { WgslReflect } from 'wgsl_reflect/wgsl_reflect.module.js';
import { MedicalVolumeRenderer, volumeShader, volumePickShader } from '../../docs/medical-volume.js';
import { readFileSync } from 'node:fs';

// build 459: a segment whose mask can hold voxels outside its HU range (Closing / hole filling added them, the owner's rule is
// that the 3D volume agrees with 2D) is decided by the mask alone. The renderer flags it with bit 4+s of the keep word
// (editRows[1]); the shaders test that bit before the HU range. These tests pin the encoding and that every membership test
// goes through it.
globalThis.GPUBufferUsage ??= { STORAGE: 0x80, COPY_DST: 0x8 };
function fakeRenderer(textureDims) {
  const written = [];
  const device = { limits: { maxStorageBufferBindingSize: 1 << 20 }, createBuffer: ({ size }) => ({ size, destroy: vi.fn() }), queue: { writeBuffer: (b, _o, data) => written.push(new Uint32Array(data)) } };
  const r = Object.create(MedicalVolumeRenderer.prototype);
  Object.assign(r, { device, textureDims, reducedVolume: false, rebuildBindGroup: vi.fn(), setAppliedCutRuns: vi.fn(), clearEditRuns: vi.fn(), clearAppliedCutRuns: vi.fn() });
  return { r, written };
}
const runs = (d, perSlice) => Array.from({ length: d }, (_, z) => new Uint32Array(perSlice[z] || []));

describe('edit descriptors: maskOnly flag', () => {
  it('keep + maskOnly sets bits s and 4+s of the keep word; plain keep only bit s; exclude neither', () => {
    const { r, written } = fakeRenderer([4, 2, 1]);
    const v = { columns: 4, rows: 2, slices: 1 };
    r.setEditRuns({
      bone: { mode: 'keep', maskOnly: true, runs: runs(1, { 0: [0, 0, 1] }) },
      soft: { mode: 'keep', runs: runs(1, { 0: [1, 2, 3] }) },
      fat: { mode: 'exclude', runs: runs(1, { 0: [0, 0, 0] }) },
    }, ['bone', 'soft', 'fat', 'lung'], v);
    const head = written.at(-2); // the row-index buffer is written before the intervals
    expect(head[0]).toBe(0b0111); // active: bone, soft, fat
    expect(head[1]).toBe(0b0001 | 0b0010 | 0b00010000); // keep: bone, soft; maskOnly: bone
  });
  it('without maskOnly the keep word is unchanged from before (no high bits)', () => {
    const { r, written } = fakeRenderer([4, 2, 1]);
    r.setEditRuns({ bone: { mode: 'keep', runs: runs(1, { 0: [0, 0, 1] }) } }, ['bone', 'soft', 'fat', 'lung'], { columns: 4, rows: 2, slices: 1 });
    expect(written.at(-2)[1]).toBe(1);
  });
});

describe('shaders: membership tests honour the mask-only bit', () => {
  const src = [volumeShader(), volumePickShader()];
  it('both shaders define segMember and parse', () => {
    for (const s of src) { expect(s).toMatch(/fn segMember\(/); expect(() => new WgslReflect(s)).not.toThrow(); }
  });
  it('no membership test is HU range && editAllows any more (they all use segMember)', () => {
    for (const s of src) expect(s.replace(/fn segMember[\s\S]*?\n}\n/, '')).not.toMatch(/v>=a\.x&&v<=a\.y&&editAllows/);
  });
  it('the brick classification does not skip a mask-only segment on HU range alone', () => {
    expect(src[0]).toMatch(/\(editRows\[1\]&\(16u<<s\)\)!=0u\|\|\(a\.y>=mm\.x&&a\.x<=mm\.y\)/);
  });
  it('the VR shader and classification data carry the same flag', () => {
    const vr = readFileSync(new URL('../../docs/vr-view.js', import.meta.url), 'utf8');
    expect(vr).toMatch(/uniform int editMaskOnly;/);
    expect(vr).toMatch(/\(\(editMaskOnly>>s\)&1\)==1\|\|\(v>=a\.x&&v<=a\.y\)/);
    expect(vr).toMatch(/else if\(maskOnly&&f<191\)f=191/);
  });
});
