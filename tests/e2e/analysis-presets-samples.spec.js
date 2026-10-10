import { test, expect } from '@playwright/test';
import { mkdtempSync, copyFileSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

// Build 550: a built-in preset is mapped to the loaded scan's HU scale (its air and soft-tissue peaks). The two practice scans
// in docs/demo are on different scales (rat: air about -1018 / soft tissue +152; mouse: air about -2008 / soft tissue -18), so
// the same preset must give different HU ranges on them. 32 real slices of each scan are loaded (spread over the body).
const DEMO = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'docs', 'demo');
function subset(sample, first, step) {
  const files = JSON.parse(readFileSync(join(DEMO, sample, 'index.json'), 'utf8')).files;
  const dir = mkdtempSync(join(tmpdir(), 'vrl-scale-' + sample + '-'));
  for (let k = 0; k < 32; k++) { const f = files[first + k * step]; copyFileSync(join(DEMO, sample, f), join(dir, f)); }
  return dir;
}
const value = (page, sel) => page.locator(sel).evaluate(el => +el.value);
async function loadAndApply(page, dir, preset) {
  await page.goto('/');
  await page.locator('#folder-input').setInputFiles(dir);
  await page.locator('#series-list .series-card').first().click({ timeout: 30_000 });
  await expect(page.locator('.ready-badge').first()).toContainText(/ready/i, { timeout: 90_000 });
  await expect(page.locator('#analysis-preset-apply')).toBeEnabled({ timeout: 30_000 });
  await page.locator('#analysis-preset-select').selectOption(preset);
  await page.locator('#analysis-preset-apply').click();
  await expect(page.locator('#analysis-preset-scale')).toHaveAttribute('data-state', 'ok', { timeout: 60_000 });
  return (await page.locator('#analysis-preset-scale').textContent()).match(/空気 (-?\d+) \/ 軟部 (-?\d+)/).slice(1).map(Number);
}
const near = (v, target, tol) => expect(Math.abs(v - target), `${v} vs ${target}`).toBeLessThanOrEqual(tol);

test.skip(!existsSync(join(DEMO, 'sample1', 'index.json')) || !existsSync(join(DEMO, 'sample2', 'index.json')), 'practice data not checked out');

test('rat practice scan: the fat preset keeps the reference ranges (air about -1018, soft tissue about +152)', async ({ page }) => {
  test.setTimeout(180_000);
  const [air, soft] = await loadAndApply(page, subset('sample1', 70, 12), 'b:fat');
  near(air, -1018, 25); near(soft, 152, 25);
  // fat peak -98 and soft-tissue peak +158 on this scan: the fat range is -250 .. 0 here
  near(await value(page, '[data-seg-min="fat"]'), -250, 30);
  near(await value(page, '[data-seg-max="fat"]'), 0, 20);
});

test('mouse practice scan: the fat and lung presets are mapped to its scale (air about -2008, soft tissue about -18)', async ({ page }) => {
  test.setTimeout(180_000);
  const [air, soft] = await loadAndApply(page, subset('sample2', 8, 16), 'b:fat');
  near(air, -2008, 25); near(soft, -18, 25);
  // the mouse fat peak (-442) lies inside the mapped range, and the range ends at the fat / soft-tissue valley (about -250)
  const fatMin = await value(page, '[data-seg-min="fat"]'), fatMax = await value(page, '[data-seg-max="fat"]');
  near(fatMin, -702, 50); near(fatMax, -277, 40);
  expect(fatMin).toBeLessThan(-442); expect(fatMax).toBeGreaterThan(-442);
  // lung: the mouse lung peak (-925) lies inside the mapped range
  await page.locator('#analysis-preset-select').selectOption('b:lung');
  await page.locator('#analysis-preset-apply').click();
  await expect(page.locator('#analysis-preset-active')).toHaveText('プリセット: 肺', { timeout: 30_000 });
  const lungMin = await value(page, '[data-seg-min="lung"]'), lungMax = await value(page, '[data-seg-max="lung"]');
  near(lungMin, -1467, 60); near(lungMax, -532, 40);
  expect(lungMin).toBeLessThan(-925); expect(lungMax).toBeGreaterThan(-925);
});
