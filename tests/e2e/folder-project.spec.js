import { test, expect } from '@playwright/test';
import { mkdtempSync, mkdirSync, writeFileSync, utimesSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { zipSync, strToU8 } from 'fflate';
import { makeCtSlice } from '../helpers/synthetic-dicom.js';

// Opening a DICOM folder that contains a project applies the newest project
// automatically: the matching series is selected and its settings restored.
// Browsers cannot open unpicked files, so this is the one-step reopen path.
// Safari/iOS may save the download as "*.vrlab.zip", and the Files app may
// extract it into a folder (project.json + edits/) — all three must work.
const FORMAT = { format: 'virtual-rodent-lab-project', version: 1 };
const dataset = { seriesUid: '1.2.3.4', columns: 16, rows: 16, slices: 12, spacing: [0.1, 0.1, 0.2] };
const vrlab = (project, extra = {}) => zipSync({ 'project.json': strToU8(JSON.stringify({ ...FORMAT, ...project })), ...extra });

function dicomFolder() {
  const dir = mkdtempSync(join(tmpdir(), 'vrl-folder-'));
  for (let z = 0; z < 12; z++) {
    const pixels = new Int16Array(16 * 16).map((_, i) => ((i + z) % 7) * 200);
    writeFileSync(join(dir, `slice${String(z).padStart(3, '0')}.dcm`), makeCtSlice({ rows: 16, columns: 16, pixelSpacing: [0.1, 0.1], position: [0, 0, z * 0.2], instance: z + 1, pixels }));
  }
  return dir;
}

async function openFolder(page, dir) {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await page.locator('#folder-input').setInputFiles(dir);
  await expect(page.locator('.ready-badge').first()).toContainText(/ready/i, { timeout: 60_000 });
  return errors;
}

test('a .vrlab inside the opened DICOM folder is applied automatically (newest wins)', async ({ page }) => {
  test.setTimeout(120_000);
  const dir = dicomFolder();
  writeFileSync(join(dir, 'old.vrlab'), vrlab({ dataset: { ...dataset, seriesUid: '9.9.9' }, filters: { order: [{ key: 'unsharp', params: {} }] } }));
  utimesSync(join(dir, 'old.vrlab'), new Date('2020-01-01'), new Date('2020-01-01'));
  writeFileSync(join(dir, 'current.vrlab'), vrlab({ dataset, filters: { order: [{ key: 'gaussian', params: {} }] }, threeD: { filtersApplied: false } }));
  const errors = await openFolder(page, dir);
  await expect(page.locator('#filter-gaussian')).toBeChecked({ timeout: 30_000 });
  await expect(page.locator('#filter-unsharp')).not.toBeChecked();
  expect(errors).toEqual([]);
});

test('a Safari-renamed "*.vrlab.zip" project is applied', async ({ page }) => {
  test.setTimeout(120_000);
  const dir = dicomFolder();
  writeFileSync(join(dir, 'mouse_2026-09-26.vrlab.zip'), vrlab({ dataset, filters: { order: [{ key: 'gaussian', params: {} }] } }));
  const errors = await openFolder(page, dir);
  await expect(page.locator('#filter-gaussian')).toBeChecked({ timeout: 30_000 });
  expect(errors).toEqual([]);
});

test('an extracted project folder (project.json + edits/) is applied', async ({ page }) => {
  test.setTimeout(120_000);
  const dir = dicomFolder(), proj = join(dir, 'mouse.vrlab');
  mkdirSync(join(proj, 'edits'), { recursive: true });
  // edit mask in the project run format: 'VLR1', slices, offsets[slices+1], runs [y,x0,x1]
  const words = [0x31524c56, 12, 0, ...Array(12).fill(3), 1, 2, 3], bin = new Uint8Array(new Uint32Array(words).buffer);
  writeFileSync(join(proj, 'edits', 'bone-exclude.bin'), bin);
  // edits are decoded and validated before any setting is applied, so the
  // restored filter below also proves the extracted edit file was read
  writeFileSync(join(proj, 'project.json'), JSON.stringify({ ...FORMAT, dataset, filters: { order: [{ key: 'gaussian', params: {} }] }, edits: { bone: { exclude: 'edits/bone-exclude.bin' } } }));
  const errors = await openFolder(page, dir);
  await expect(page.locator('#filter-gaussian')).toBeChecked({ timeout: 30_000 });
  // the project files were not fed to the DICOM parser: still exactly one series
  await expect(page.locator('#series-list .series-card')).toHaveCount(1);
  expect(errors).toEqual([]);
});
