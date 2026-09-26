import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const { build } = JSON.parse(readFileSync('docs/version.json', 'utf8'));

// Collect uncaught errors for every test. CDN or module-graph breakage shows up
// here first, because the whole app is one ES module.
test.beforeEach(async ({ page }, testInfo) => {
  testInfo.pageErrors = [];
  page.on('pageerror', err => testInfo.pageErrors.push(err.message));
});

test.afterEach(async ({}, testInfo) => {
  expect(testInfo.pageErrors, 'uncaught page errors').toEqual([]);
});

test('app boots and renders the main UI', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#app')).not.toBeEmpty();
  await expect(page.locator('#demo-button')).toBeVisible();
  await expect(page.locator('#open-folder')).toBeVisible();
  await expect(page.locator('#gpu-status')).toBeVisible();
  // project file buttons: save needs loaded data, open is always available
  await expect(page.locator('#project-save')).toBeDisabled();
  await expect(page.locator('#project-open')).toBeEnabled();
  // GPU volume cache chip only appears with a WebGPU volume renderer (none in CI)
  await expect(page.locator('#volume-cache-clear')).toBeHidden();
  // 'original CT' badge exists but is hidden unless GPU volume + filters
  await expect(page.locator('#three-filter-badge')).toBeAttached();
  await expect(page.locator('#three-filter-badge')).toBeHidden();
  // 3D edit lasso tool is present (disabled until a 3D segment exists)
  await expect(page.locator('#analysis-lasso-select')).toBeAttached();
  await expect(page.locator('#analysis-lasso-select')).toBeDisabled();
});

test('version badge shows the deployed build and no reload loop occurs', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#app-version-badge')).toContainText(`build ${build}`);
  // ensureLatestDeployedBuild() adds ?build=... when markers disagree.
  await page.waitForTimeout(1500);
  expect(new URL(page.url()).searchParams.get('build')).toBeNull();
});

test('language toggle switches between Japanese and English', async ({ page }) => {
  await page.goto('/');
  const toggle = page.locator('#language-toggle');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
  await expect(toggle).toHaveText('English');
  await toggle.click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(toggle).toHaveText('日本語');
  await expect(page.locator('#demo-button')).toContainText('Public mouse CT demo');
  await toggle.click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
});
