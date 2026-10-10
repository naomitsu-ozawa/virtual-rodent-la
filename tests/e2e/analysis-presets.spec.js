import { test, expect } from '@playwright/test';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { makeCtSlice } from '../helpers/synthetic-dicom.js';

// Analysis presets: applying one switches the source filters, the CT window and the segment HU range together; the active
// preset is shown (and marked modified once a setting changes); user presets are saved, applied, exported and deleted.

// 16x16x12 series spanning -1024 .. 2576 HU, so every built-in window (lung, fat, bone, soft tissue) fits the data
// (the bone window -100 .. 1900 included)
function wideFolder() {
  const dir = mkdtempSync(join(tmpdir(), 'vrl-presets-'));
  for (let z = 0; z < 12; z++) {
    const pixels = new Int16Array(16 * 16).map((_, i) => ((i + z) % 7) * 600);
    writeFileSync(join(dir, `slice${String(z).padStart(3, '0')}.dcm`), makeCtSlice({ rows: 16, columns: 16, bitsStored: 16, pixelSpacing: [0.1, 0.1], position: [0, 0, z * 0.2], instance: z + 1, pixels }));
  }
  return dir;
}

async function loadSeries(page) {
  await page.goto('/');
  await page.locator('#folder-input').setInputFiles(wideFolder());
  await page.locator('#series-list .series-card').first().click({ timeout: 30_000 });
  await expect(page.locator('.ready-badge').first()).toContainText(/ready/i, { timeout: 60_000 });
  await expect(page.locator('#analysis-preset-apply')).toBeEnabled({ timeout: 30_000 });
}
const value = (page, sel) => page.locator(sel).evaluate(el => +el.value);
const applyPreset = async (page, optionValue) => {
  await page.locator('#analysis-preset-select').selectOption(optionValue);
  await page.locator('#analysis-preset-apply').click();
};
const card = (page, key) => page.locator(`.filter-control-card[data-filter-key="${key}"]`);

test('applying a built-in preset switches filters, CT window and segment range; modified is shown', async ({ page }) => {
  await loadSeries(page);
  const active = page.locator('#analysis-preset-active');
  await expect(active).toHaveText('プリセット: なし');
  await expect(card(page, 'bilateral')).toHaveClass(/is-hidden/);

  await applyPreset(page, 'b:lung');
  await expect(active).toHaveText('プリセット: 肺');
  await expect(card(page, 'bilateral')).not.toHaveClass(/is-hidden/);
  await expect(card(page, 'sigmoid')).toHaveClass(/is-hidden/);
  // every built-in preset uses the bilateral filter at its own defaults
  expect(await value(page, '#bilateral-strength')).toBeCloseTo(0.8, 5);
  expect(await value(page, '#bilateral-intensity')).toBe(50);
  expect(await value(page, '#bilateral-passes')).toBe(2);
  expect(await value(page, '#wc')).toBe(-450);
  expect(await value(page, '#ww')).toBe(1200);
  await expect(page.locator('[data-segment="lung"]')).not.toHaveClass(/is-hidden/);
  expect(await value(page, '[data-seg-min="lung"]')).toBe(-700);
  expect(await value(page, '[data-seg-max="lung"]')).toBe(-150);
  // the CT range mode stays Auto (re-centred on the new window)
  await expect(page.locator('#ct-range-auto')).toHaveClass(/is-active/);

  // a filter added by hand is removed when a preset is applied (the preset replaces the filter set), and the window changes
  await page.selectOption('#filter-add-select', 'sigmoid');
  await page.locator('#filter-add-button').click();
  await expect(card(page, 'sigmoid')).not.toHaveClass(/is-hidden/);
  await expect(active).toHaveText('プリセット: 肺（変更あり）');
  await applyPreset(page, 'b:soft');
  await expect(active).toHaveText('プリセット: 軟部・造影');
  await expect(card(page, 'sigmoid')).toHaveClass(/is-hidden/);
  await expect(card(page, 'bilateral')).not.toHaveClass(/is-hidden/);
  expect(await value(page, '#bilateral-intensity')).toBe(50);
  expect(await value(page, '#wc')).toBe(150);
  expect(await value(page, '#ww')).toBe(500);
  expect(await value(page, '[data-seg-min="soft"]')).toBe(0);
  expect(await value(page, '[data-seg-max="soft"]')).toBe(350);

  // any later change shows as modified
  await page.locator('#bilateral-intensity').evaluate(el => { el.value = '77'; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); });
  await expect(active).toHaveText('プリセット: 軟部・造影（変更あり）');
  // applying again clears it
  await page.locator('#analysis-preset-apply').click();
  await expect(active).toHaveText('プリセット: 軟部・造影');
  expect(await value(page, '#bilateral-intensity')).toBe(50);
});

test('user presets: save, apply, overwrite, export / import, delete, and they survive a reload', async ({ page }) => {
  page.on('dialog', d => d.accept());
  await loadSeries(page);
  await applyPreset(page, 'b:fat');
  // tweak, then save under a name
  await page.locator('#bilateral-intensity').evaluate(el => { el.value = '33'; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.locator('#analysis-preset-name').fill('マイ脂肪');
  await page.locator('#analysis-preset-save').click();
  await expect(page.locator('#analysis-preset-active')).toHaveText('プリセット: マイ脂肪');
  await expect(page.locator('#analysis-preset-select option[value^="u:"]')).toHaveCount(1);

  // another preset, then back to the saved one
  await applyPreset(page, 'b:bone');
  expect(await value(page, '#wc')).toBe(900);
  const userValue = await page.locator('#analysis-preset-select option[value^="u:"]').getAttribute('value');
  await applyPreset(page, userValue);
  expect(await value(page, '#bilateral-intensity')).toBe(33);
  expect(await value(page, '#wc')).toBe(0);
  expect(await value(page, '#ww')).toBe(500);
  await expect(page.locator('#analysis-preset-active')).toHaveText('プリセット: マイ脂肪');

  // overwrite by saving the same name again: still one user preset, with the new value
  await page.locator('#bilateral-intensity').evaluate(el => { el.value = '35'; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.locator('#analysis-preset-name').fill('マイ脂肪');
  await page.locator('#analysis-preset-save').click();
  await expect(page.locator('#analysis-preset-select option[value^="u:"]')).toHaveCount(1);
  await applyPreset(page, 'b:soft');
  await applyPreset(page, userValue);
  expect(await value(page, '#bilateral-intensity')).toBe(35);

  // rename
  await page.locator('#analysis-preset-name').fill('名前変更後');
  await page.locator('#analysis-preset-rename').click();
  await expect(page.locator('#analysis-preset-select option[value^="u:"]')).toHaveText('名前変更後');

  // export, then it comes back through import after a delete
  const download = page.waitForEvent('download');
  await page.locator('#analysis-preset-export').click();
  const exported = JSON.parse(readFileSync(await (await download).path(), 'utf8'));
  expect(exported.format).toBe('vrl-analysis-presets');
  expect(exported.presets.map(p => p.name)).toEqual(['名前変更後']);

  // reload: the preset is still there (localStorage)
  await page.reload();
  await page.locator('#folder-input').setInputFiles(wideFolder());
  await page.locator('#series-list .series-card').first().click({ timeout: 30_000 });
  await expect(page.locator('#analysis-preset-apply')).toBeEnabled({ timeout: 60_000 });
  await expect(page.locator('#analysis-preset-select option[value^="u:"]')).toHaveText('名前変更後');

  // delete
  await page.locator('#analysis-preset-select').selectOption({ label: '名前変更後' });
  await page.locator('#analysis-preset-delete').click();
  await expect(page.locator('#analysis-preset-select option[value^="u:"]')).toHaveCount(0);
  await expect(page.locator('#analysis-preset-export')).toBeDisabled();

  // import the exported file
  const file = join(mkdtempSync(join(tmpdir(), 'vrl-presets-json-')), 'analysis-presets.json');
  writeFileSync(file, JSON.stringify(exported));
  await page.locator('#analysis-preset-import-file').setInputFiles(file);
  await expect(page.locator('#analysis-preset-select option[value^="u:"]')).toHaveText('名前変更後');
  // a file that is not a preset file is refused and changes nothing
  const bad = join(mkdtempSync(join(tmpdir(), 'vrl-presets-json-')), 'bad.json');
  writeFileSync(bad, '{"hello":1}');
  await page.locator('#analysis-preset-import-file').setInputFiles(bad);
  await expect(page.locator('#footer')).toContainText('読み込めませんでした');
  await expect(page.locator('#analysis-preset-select option[value^="u:"]')).toHaveCount(1);
});

test('the preset box is part of the display panel (iPhone / ?ui=classic layouts keep their panels)', async ({ page }) => {
  await page.goto('/?ui=classic');
  await expect(page.locator('.compact-panel #analysis-preset-box')).toHaveCount(1);
  await expect(page.locator('.sidebar-scroll > .panel.compact-panel')).toHaveCount(1);
});
