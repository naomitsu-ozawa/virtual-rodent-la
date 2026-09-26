import { test, expect } from '@playwright/test';
import { dicomFolder } from '../helpers/dicom-folder.js';

// On iPad/iPhone, "プロジェクト保存" hands the .vrlab to the share sheet so
// "Save to Files" can put it straight into the DICOM folder. navigator.share is
// stubbed to record the call (CI has no share sheet).
const IPAD_UA = 'Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
const stubShare = outcome => {
  window.__shares = [];
  navigator.canShare = d => !!d?.files?.length;
  navigator.share = async d => {
    window.__shares.push({ name: d.files[0].name, size: d.files[0].size, type: d.files[0].type });
    if (outcome === 'cancel') throw new DOMException('cancelled', 'AbortError');
  };
};

async function loadSeries(page) {
  await page.goto('/');
  await page.locator('#folder-input').setInputFiles(dicomFolder());
  await expect(page.locator('.ready-badge').first()).toContainText(/ready/i, { timeout: 60_000 });
  await expect(page.locator('#project-save')).toBeEnabled();
}

test.describe('iPad', () => {
  test.use({ userAgent: IPAD_UA, hasTouch: true });

  test('saving a project opens the share sheet with the .vrlab file (no download)', async ({ page }) => {
    await page.addInitScript(stubShare, 'share');
    const downloads = [];
    page.on('download', d => downloads.push(d));
    await loadSeries(page);
    await page.locator('#project-save').click();
    await expect.poll(() => page.evaluate(() => window.__shares.length)).toBe(1);
    const shared = await page.evaluate(() => window.__shares[0]);
    expect(shared.name).toMatch(/\.vrlab$/);
    expect(shared.size).toBeGreaterThan(0);
    await expect(page.locator('#footer')).toContainText(/Save to Files|"ファイル"に保存/);
    expect(downloads).toHaveLength(0);
  });

  test('cancelling the share sheet saves nothing', async ({ page }) => {
    await page.addInitScript(stubShare, 'cancel');
    const downloads = [];
    page.on('download', d => downloads.push(d));
    await loadSeries(page);
    await page.locator('#project-save').click();
    await expect(page.locator('#footer')).toContainText(/cancelled|キャンセル/);
    expect(downloads).toHaveLength(0);
  });
});

test('other platforms download the .vrlab as before', async ({ page }) => {
  await loadSeries(page);
  const download = page.waitForEvent('download');
  await page.locator('#project-save').click();
  expect((await download).suggestedFilename()).toMatch(/\.vrlab$/);
});
