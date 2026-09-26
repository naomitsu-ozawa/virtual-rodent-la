import { test, expect } from '@playwright/test';
import { mkdtempSync, writeFileSync, utimesSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { zipSync, strToU8 } from 'fflate';
import { makeCtSlice } from '../helpers/synthetic-dicom.js';

// Opening a DICOM folder that contains a .vrlab project applies the newest
// project automatically: the matching series is selected and its settings are
// restored (browsers cannot open unpicked files, so this is the one-step
// reopen path, including on iPad).
const vrlab = project => zipSync({ 'project.json': strToU8(JSON.stringify({ format: 'virtual-rodent-lab-project', version: 1, ...project })) });

test('a project inside the opened DICOM folder is applied automatically', async ({ page }) => {
  test.setTimeout(120_000);
  const dir = mkdtempSync(join(tmpdir(), 'vrl-folder-'));
  for (let z = 0; z < 12; z++) {
    const pixels = new Int16Array(16 * 16).map((_, i) => ((i + z) % 7) * 200);
    writeFileSync(join(dir, `slice${String(z).padStart(3, '0')}.dcm`), makeCtSlice({ rows: 16, columns: 16, pixelSpacing: [0.1, 0.1], position: [0, 0, z * 0.2], instance: z + 1, pixels }));
  }
  const dataset = { seriesUid: '1.2.3.4', columns: 16, rows: 16, slices: 12, spacing: [0.1, 0.1, 0.2] };
  // older project for other data (must be ignored), newer one for this series
  writeFileSync(join(dir, 'old.vrlab'), vrlab({ dataset: { ...dataset, seriesUid: '9.9.9' }, filters: { order: [{ key: 'unsharp', params: {} }] } }));
  utimesSync(join(dir, 'old.vrlab'), new Date('2020-01-01'), new Date('2020-01-01'));
  writeFileSync(join(dir, 'current.vrlab'), vrlab({ dataset, filters: { order: [{ key: 'gaussian', params: {} }] }, threeD: { filtersApplied: false } }));

  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await page.locator('#folder-input').setInputFiles(dir);
  await expect(page.locator('.ready-badge').first()).toContainText(/ready/i, { timeout: 60_000 });
  await expect(page.locator('#filter-gaussian')).toBeChecked({ timeout: 30_000 });
  await expect(page.locator('#filter-unsharp')).not.toBeChecked();
  expect(errors).toEqual([]);
});
