import { test, expect } from '@playwright/test';
import { zipSync, strToU8 } from 'fflate';
import { makeCtSlice } from '../helpers/synthetic-dicom.js';
import { syntheticDataset } from '../helpers/dicom-folder.js';

// Build 368: a project shipped next to the practice data (demo/sample1/project.vrlab)
// is applied when the sample opens. The sample index, its slices and the project
// are stubbed with the synthetic 16x16x12 series used by folder-project.spec.js.
const FORMAT = { format: 'virtual-rodent-lab-project', version: 1 };
const dataset = syntheticDataset;
const vrlab = project => Buffer.from(zipSync({ 'project.json': strToU8(JSON.stringify({ ...FORMAT, ...project })) }));
const names = Array.from({ length: 12 }, (_, z) => `slice${String(z).padStart(3, '0')}.dcm`);
const slices = names.map((_, z) => Buffer.from(makeCtSlice({ rows: 16, columns: 16, pixelSpacing: [0.1, 0.1], position: [0, 0, z * 0.2], instance: z + 1, pixels: new Int16Array(16 * 16).map((_, i) => ((i + z) % 7) * 200) })));

async function stubSample(page, project) {
  const requests = [];
  await page.route('**/demo/sample1/index.json', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ name: 'Synthetic', files: names }) }));
  await page.route('**/demo/sample1/*.dcm', route => {
    const i = names.indexOf(decodeURIComponent(new URL(route.request().url()).pathname.split('/').pop()));
    return i < 0 ? route.fulfill({ status: 404, body: '' }) : route.fulfill({ contentType: 'application/dicom', body: slices[i] });
  });
  await page.route('**/demo/sample1/project.vrlab', route => {
    requests.push(route.request().url());
    return project ? route.fulfill({ contentType: 'application/octet-stream', body: project }) : route.fulfill({ status: 404, body: 'not found' });
  });
  return requests;
}

async function openSample(page) {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await page.locator('#sample-demo-button').click();
  await page.locator('[data-sample-set="sample1"]').click();
  await expect(page.locator('.ready-badge').first()).toContainText(/ready/i, { timeout: 60_000 });
  return errors;
}

test('the practice data applies the bundled project.vrlab', async ({ page }) => {
  test.setTimeout(120_000);
  const project = vrlab({
    dataset,
    filters: { order: [{ key: 'gaussian', params: {} }] },
    display: { windowCenter: -300, windowWidth: 700 },
    segments: { bone: { active: true, enabled: true, color: '#ff3300', min: -600, max: 100, opacity: 0.8, opening: 0, closing: 0, minComponent: 0, holeFill: false } },
    threeD: { filtersApplied: false },
  });
  const requests = await stubSample(page, project);
  const errors = await openSample(page);
  await expect(page.locator('#filter-gaussian')).toBeChecked({ timeout: 30_000 });
  await expect(page.locator('#filter-unsharp')).not.toBeChecked();
  // (the 'Project applied' footer is overwritten by the filter status right away, so not asserted)
  await expect(page.locator('#wc')).toHaveValue('-300');
  await expect(page.locator('#ww')).toHaveValue('700');
  await expect(page.locator('[data-seg-color="bone"]')).toHaveValue('#ff3300');
  await expect(page.locator('[data-seg-min="bone"]')).toHaveValue('-600');
  await expect(page.locator('[data-seg-max="bone"]')).toHaveValue('100');
  await expect(page.locator('#series-list .series-card')).toHaveCount(1);
  expect(requests.length).toBe(1);
  // the project is not stored in the sample slice cache (it is always refetched)
  const cachedProject = await page.evaluate(async () => {
    for (const name of await caches.keys()) for (const req of await (await caches.open(name)).keys()) if (req.url.includes('project.vrlab')) return req.url;
    return null;
  });
  expect(cachedProject).toBeNull();
  expect(errors).toEqual([]);
});

test('the practice data still opens when there is no project.vrlab', async ({ page }) => {
  test.setTimeout(120_000);
  const requests = await stubSample(page, null);
  const errors = await openSample(page);
  await expect(page.locator('#series-list .series-card')).toHaveCount(1);
  await expect(page.locator('#filter-gaussian')).not.toBeChecked();
  await expect(page.locator('#footer')).not.toContainText(/プロジェクト|Project/);
  expect(requests.length).toBe(1);
  expect(errors).toEqual([]);
});
