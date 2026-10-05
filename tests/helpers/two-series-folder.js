import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { makeCtSlice } from './synthetic-dicom.js';

// Two small synthetic CT series in one folder, for tests that switch series:
//   A  'Test CT'   16x16x12, spacing 0.1 x 0.1 x 0.2 mm, raw pixel = ((y*16 + x + z) % 7) * 200, intercept -1024 (same as dicom-folder.js)
//   B  'Small CT'   8x8x6,   spacing 0.2 x 0.2 x 0.5 mm, raw pixel = ((y*8 + x + 2z) % 5) * 100
// HU of a voxel (i,j,k) of A = ((j*16 + i + k) % 7) * 200 - 1024.
export const huA = (i, j, k) => ((j * 16 + i + k) % 7) * 200 - 1024;
export function twoSeriesFolder() {
  const dir = mkdtempSync(join(tmpdir(), 'vrl-two-'));
  for (let z = 0; z < 12; z++) {
    const pixels = new Int16Array(16 * 16).map((_, i) => ((i + z) % 7) * 200);
    writeFileSync(join(dir, `a${String(z).padStart(3, '0')}.dcm`), makeCtSlice({ rows: 16, columns: 16, pixelSpacing: [0.1, 0.1], position: [0, 0, z * 0.2], instance: z + 1, pixels }));
  }
  for (let z = 0; z < 6; z++) {
    const pixels = new Int16Array(8 * 8).map((_, i) => ((i + 2 * z) % 5) * 100);
    writeFileSync(join(dir, `b${String(z).padStart(3, '0')}.dcm`), makeCtSlice({ studyUid: '1.2.9', seriesUid: '1.2.9.5', description: 'Small CT', rows: 8, columns: 8, pixelSpacing: [0.2, 0.2], position: [0, 0, z * 0.5], thickness: 0.5, instance: z + 1, pixels }));
  }
  return dir;
}
