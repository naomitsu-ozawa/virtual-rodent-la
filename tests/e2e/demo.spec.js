import { test, expect } from '@playwright/test';

// Downloads the ~20.8 MB public Zenodo dataset, so it only runs when
// RUN_DEMO_E2E=1 (manual "Run workflow" in Actions, or locally).
test.skip(!process.env.RUN_DEMO_E2E, 'set RUN_DEMO_E2E=1 to run the demo download test');

test('public mouse CT demo loads and lists a series', async ({ page }) => {
  test.setTimeout(240_000);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await page.locator('#demo-button').click();
  await expect(page.locator('#series-list .series-card').first()).toBeVisible({ timeout: 200_000 });
  expect(errors).toEqual([]);
});
