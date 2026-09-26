import { test, expect } from '@playwright/test';

// End-to-end pass through the real DICOM pipeline with the public Zenodo mouse
// PET/CT (~20.8 MB): download -> unzip -> header parse -> series grouping ->
// pixel decode -> MPR. Runs when RUN_DEMO_E2E=1 (set by the CI demo job).
test.skip(!process.env.RUN_DEMO_E2E, 'set RUN_DEMO_E2E=1 to run the demo download test');

test('public mouse CT demo loads, decodes and becomes ready', async ({ page }) => {
  test.setTimeout(300_000);
  const errors = [], consoleLines = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') consoleLines.push(`${m.type()}: ${m.text()}`.slice(0, 300)); });

  // On failure, report what the UI was showing so CI annotations are useful.
  const snapshot = async stage => {
    const text = async sel => (await page.locator(sel).first().textContent({ timeout: 1000 }).catch(() => null))?.trim().slice(0, 200);
    return [
      `stage: ${stage}`,
      `series cards: ${await page.locator('#series-list .series-card').count()}`,
      `ready badge: ${await text('.ready-badge')}`,
      `gpu status: ${await text('#gpu-status')}`,
      `footer: ${await text('footer')}`,
      `page errors: ${JSON.stringify(errors.slice(0, 5))}`,
      `console: ${JSON.stringify(consoleLines.slice(-8))}`,
    ].join('\n');
  };
  const step = async (stage, fn) => { try { await fn(); } catch (e) { throw new Error(`${e.message.split('\n')[0]}\n${await snapshot(stage)}`); } };

  await page.goto('/');
  await page.locator('#demo-button').click();

  const firstCard = page.locator('#series-list .series-card').first();
  await step('download + parse (waiting for series list)', () => expect(firstCard).toBeVisible({ timeout: 200_000 }));

  // The largest series is selected automatically; its status badge lives in
  // the "selected series" panel (not in the list) and ends with "ready" or
  // "... failed" (see selectSeries in docs/app.js).
  const badge = page.locator('.ready-badge').first();
  await step('series auto-selection (waiting for status badge)', () => expect(badge).toBeAttached({ timeout: 30_000 }));
  await step('decode (waiting for ready badge)', () => expect(badge).toContainText(/ready/i, { timeout: 120_000 }));
  await step('decode did not fail', async () => expect(await badge.textContent()).not.toMatch(/failed/i));
  await step('no uncaught errors', async () => expect(errors).toEqual([]));
});

test('project file round-trip restores filters and segments', async ({ page }) => {
  test.setTimeout(420_000);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const loadDemo = async () => {
    await page.goto('/');
    await page.locator('#demo-button').click();
    await expect(page.locator('.ready-badge').first()).toContainText(/ready/i, { timeout: 240_000 });
    await expect(page.locator('#project-save')).toBeEnabled();
  };
  await loadDemo();
  // settings to save
  await page.selectOption('#filter-add-select', 'gaussian');
  await page.locator('#filter-add-button').click();
  const strength = page.locator('#gaussian-strength');
  await strength.evaluate(el => { el.value = String(el.max); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); });
  const savedStrength = await strength.inputValue();
  await page.selectOption('#segment-add-select', 'bone');
  await page.locator('#segment-add-button').click();
  const download = page.waitForEvent('download');
  await page.locator('#project-save').click();
  const file = await (await download).path();
  expect((await download).suggestedFilename()).toMatch(/\.vrlab$/);

  // fresh session, same data, open the project
  await loadDemo();
  await expect(page.locator('#filter-gaussian')).not.toBeChecked();
  await page.locator('#project-input').setInputFiles(file);
  // the footer confirmation is soon replaced by the filter rebuild status, so
  // assert on the restored state itself
  await expect(page.locator('#filter-gaussian')).toBeChecked({ timeout: 60_000 });
  await expect(strength).toHaveValue(savedStrength);
  await expect(page.locator('[data-segment="bone"]')).not.toHaveClass(/is-hidden/);
  expect(errors).toEqual([]);
});
