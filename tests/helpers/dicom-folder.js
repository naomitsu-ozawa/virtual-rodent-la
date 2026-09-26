import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { makeCtSlice } from './synthetic-dicom.js';

// A tiny synthetic CT series on disk (16x16x12, series UID 1.2.3.4) for E2E
// tests that open a DICOM folder. `dataset` matches the app's fingerprint.
export const syntheticDataset = { seriesUid: '1.2.3.4', columns: 16, rows: 16, slices: 12, spacing: [0.1, 0.1, 0.2] };
export function dicomFolder() {
  const dir = mkdtempSync(join(tmpdir(), 'vrl-folder-'));
  for (let z = 0; z < 12; z++) {
    const pixels = new Int16Array(16 * 16).map((_, i) => ((i + z) % 7) * 200);
    writeFileSync(join(dir, `slice${String(z).padStart(3, '0')}.dcm`), makeCtSlice({ rows: 16, columns: 16, pixelSpacing: [0.1, 0.1], position: [0, 0, z * 0.2], instance: z + 1, pixels }));
  }
  return dir;
}
