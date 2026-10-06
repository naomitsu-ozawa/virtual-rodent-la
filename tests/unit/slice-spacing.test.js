import { describe, it, expect } from 'vitest';
import { groupSeries, parseDicomHeader, parsedSliceMeta } from '../../docs/dicom.js';
import { analyzeSliceSpacing, spacingWarningText, spacingCheckForProject, sliceNormal, SPACING_THRESHOLDS } from '../../docs/slice-spacing.js';
import { packProject, unpackProject } from '../../docs/project-file.js';
import { makeCtSlice, asFile } from '../helpers/synthetic-dicom.js';

// synthetic slice metas (no real data); z positions in mm
const meta = (z, extra = {}) => ({ studyUid: 's', seriesUid: 'u', description: 'syn', modality: 'CT', rows: 4, columns: 4, bits: 16, bitsStored: 16, signed: 0, slope: 1, intercept: 0, pixelSpacing: [0.2, 0.1], thickness: 0.5, spacingBetween: null, pos: [0, 0, z], instance: 1, ...extra });
const series = (zs, extra) => groupSeries(zs.map(z => meta(z, extra)))[0];
const volumeMm3 = (s, voxels) => voxels * s.spacingX * s.spacingY * s.spacingZ; // same formula as analysis-ops

describe('slice spacing check', () => {
  it('uniform spacing: no warning, spacing unchanged (first gap)', () => {
    const s = series([0, 0.5, 1, 1.5, 2]);
    expect(s.spacingCheck).toMatchObject({ warn: false, missing: 0, duplicates: 0, nonUniform: false, basis: 'first-gap', used: 0.5, method: 'z' });
    expect(spacingWarningText(s.spacingCheck)).toBeNull();
    expect(s.spacingZ).toBe(0.5);
  });

  it('uniform data gives the identical volume as the previous first-two-slices rule', () => {
    const zs = [10, 10.35, 10.7, 11.05, 11.4];
    const s = series(zs);
    const before = Math.abs(zs[1] - zs[0]); // previous implementation
    expect(s.spacingZ).toBe(before);
    expect(volumeMm3(s, 1234)).toBe(1234 * 0.1 * 0.2 * before);
  });

  it('detects one missing slice and uses the median', () => {
    const s = series([0, 0.5, 1, 2, 2.5, 3]);
    const c = s.spacingCheck;
    expect(c).toMatchObject({ warn: true, missing: 1, duplicates: 0, basis: 'median', medianGap: 0.5 });
    expect(c.missingGaps).toEqual([{ index: 2, gap: 1, missing: 1 }]);
    expect(s.spacingZ).toBe(0.5);
    const w = spacingWarningText(c);
    expect(w.ja).toContain('抜け 1 枚');
    expect(w.ja).toContain('中央値 0.5 mm');
    expect(w.en).toContain('1 missing');
  });

  it('counts several missing slices in one gap', () => {
    expect(series([0, 1, 2, 5, 6]).spacingCheck.missing).toBe(2);
  });

  it('detects a duplicate slice', () => {
    const s = series([0, 0.5, 0.5, 1, 1.5]);
    expect(s.spacingCheck).toMatchObject({ warn: true, duplicates: 1, missing: 0, basis: 'median' });
    expect(s.spacingZ).toBe(0.5);
    expect(spacingWarningText(s.spacingCheck).ja).toContain('重複 1 枚');
  });

  it('a wrong first gap no longer skews the volume (median is used)', () => {
    const s = series([0, 0.1, 0.6, 1.1, 1.6, 2.1]); // first gap 0.1 would have been used before
    expect(s.spacingZ).toBeCloseTo(0.5, 10);
    expect(volumeMm3(s, 100)).toBeCloseTo(100 * 0.1 * 0.2 * 0.5, 10);
    expect(volumeMm3(s, 100)).not.toBeCloseTo(100 * 0.1 * 0.2 * 0.1, 6);
  });

  it('detects non-uniform spacing above 1% and reports the spread', () => {
    const s = series([0, 0.5, 1.02, 1.5, 2.0]); // gaps .5 .52 .48 .5 -> spread 8%
    const c = s.spacingCheck;
    expect(c.nonUniform).toBe(true);
    expect(c.warn).toBe(true);
    expect(c.spreadPct).toBeCloseTo(8, 5);
    expect(c.medianGap).toBeCloseTo(0.5, 10);
    expect(spacingWarningText(c).ja).toContain('間隔のばらつき 8%');
  });

  it('tolerates float noise below the 1% threshold', () => {
    const c = series([0, 0.5, 1.0004, 1.4998, 2.0001]).spacingCheck;
    expect(c.nonUniform).toBe(false);
    expect(c.warn).toBe(false);
    expect(SPACING_THRESHOLDS.uniformRel).toBe(0.01);
  });

  it('flags SpacingBetweenSlices that disagrees with the measured gaps; thickness is only recorded', () => {
    const a = series([0, 0.5, 1, 1.5], { spacingBetween: 1 }).spacingCheck;
    expect(a).toMatchObject({ spacingBetweenMismatch: true, warn: true, used: 0.5 });
    expect(spacingWarningText(a).ja).toContain('SpacingBetweenSlices');
    const b = series([0, 0.5, 1, 1.5], { thickness: 2 }).spacingCheck; // overlapping/gapped recon is legitimate
    expect(b).toMatchObject({ thicknessDiffers: true, spreadPct: 0, warn: false });
    const c = series([0, 0.5, 1, 1.5], { spacingBetween: 0.5 }).spacingCheck;
    expect(c.warn).toBe(false);
  });

  it('sorts and measures along the normal for an oblique orientation', () => {
    // rows along x, columns tilted 30 deg about x: normal = (0, -sin30, cos30)
    const a = Math.PI / 6, orientation = [1, 0, 0, 0, Math.cos(a), Math.sin(a)];
    const n = sliceNormal(orientation);
    expect(n[0]).toBeCloseTo(0, 10);
    const step = 0.5, mk = k => meta(0, { orientation, pos: [0, k * step * n[1], k * step * n[2]] });
    const slices = [3, 1, 0, 2, 4].map(mk); // shuffled
    const s = groupSeries(slices)[0];
    expect(s.spacingCheck).toMatchObject({ method: 'normal', warn: false });
    expect(s.spacingZ).toBeCloseTo(step, 10); // Z-only would give 0.5*cos30 = 0.433
    const proj = s.slices.map(x => x.pos[1] * n[1] + x.pos[2] * n[2]);
    expect(proj).toEqual([...proj].sort((p, q) => p - q));
    expect(proj[0]).toBeCloseTo(0, 10);
  });

  it('axial orientation tag gives the same result as the Z fallback', () => {
    const o = [1, 0, 0, 0, 1, 0];
    const z = series([0, 0.5, 1, 1.5]), n = series([0, 0.5, 1, 1.5], { orientation: o });
    expect(n.spacingZ).toBe(z.spacingZ);
  });

  it('falls back to the tags when positions are missing or there is one slice', () => {
    const noPos = groupSeries([1, 2, 3].map(i => meta(0, { pos: null, instance: i, spacingBetween: 0.7 })))[0];
    expect(noPos.spacingZ).toBe(0.7);
    expect(noPos.spacingCheck.warn).toBe(false);
    expect(groupSeries([meta(0)])[0].spacingZ).toBe(0.5);
  });

  it('many duplicates do not collapse the reference gap to zero', () => {
    const c = analyzeSliceSpacing([0, 0, 0, 0.5, 0.5, 1].map(z => meta(z)));
    expect(c.duplicates).toBe(3);
    expect(c.medianGap).toBeCloseTo(0.5, 10);
  });

  it('parses ImageOrientationPatient from a synthetic DICOM header', async () => {
    const f = asFile(makeCtSlice({ orientation: [1, 0, 0, 0, 1, 0] }), 'a.dcm');
    const m = parsedSliceMeta(f, await parseDicomHeader(f));
    expect(m.orientation).toEqual([1, 0, 0, 0, 1, 0]);
  });

  it('is stored in the project file as an optional field without a version change', () => {
    const c = spacingCheckForProject(series([0, 0.5, 1, 2]).spacingCheck);
    const bytes = packProject({ dataset: {}, spacingCheck: c });
    const back = unpackProject(bytes).project;
    expect(back.version).toBe(1);
    expect(back.spacingCheck).toMatchObject({ missing: 1, basis: 'median', used: 0.5 });
    expect(unpackProject(packProject({ dataset: {} })).project.spacingCheck).toBeUndefined();
  });
});
