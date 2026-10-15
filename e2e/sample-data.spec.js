import { test, expect } from '@playwright/test';

async function loadSample(page, sample) {
  await page.goto('/');
  await page.getByRole('button', { name:/テーマ設定/ }).click();
  await page.locator('#sample-data-select').selectOption(sample);
  await page.getByRole('button', { name:'サンプルで入力を置き換える' }).click();
}

test('standard sample opens every workflow step without sending images for analysis', async ({ page }) => {
  await loadSample(page, 'standard');

  await expect(page.locator('#sample-data-notice')).toContainText('実際の登山や提出には使用しないでください');
  await expect(page.locator('#plannerName')).toHaveValue('機能確認用 企画者');
  await page.locator('#step1-next').click();
  await expect(page.locator('.step[data-step="2"]')).toBeVisible();
  await expect(page.locator('#route-upload-list .upload-card')).toHaveCount(1);
  await expect(page.locator('#itinerary-upload-list .upload-card')).toHaveCount(1);
  await expect(page.locator('#analysis-status')).toContainText('画像解析は実行していません');
  await expect(page.locator('#step2-next')).toBeEnabled();

  await page.locator('#step2-next').click();
  await expect(page.locator('.step[data-step="3"]')).toBeVisible();
  await expect(page.locator('#document-preview')).toContainText('黒斑山（サンプル）（サンプル県 サンプル市）');
  await expect(page.locator('#document-preview')).toContainText('実際の登山や提出には使用しないでください');
  await expect(page.locator('#toggle-pdf-preview')).toHaveCount(0);
  await expect(page.locator('#print-button')).toBeVisible();
});

test('complex sample exposes long itinerary and optional jurisdictions', async ({ page }) => {
  await loadSample(page, 'complex');
  await page.locator('#step1-next').click();
  await expect(page.locator('#itinerary-upload-list .upload-card')).toHaveCount(2);
  await page.locator('#step2-next').click();
  await expect(page.locator('#police-secondary')).toBeVisible();
  await expect(page.locator('#police-tertiary')).toBeVisible();
  expect(await page.evaluate(() => window.__tozanApp.state.itinerary.length)).toBeGreaterThanOrEqual(12);
  expect(await page.evaluate(() => window.__tozanApp.state.itinerary.some(row => row.time === '12:30'))).toBe(true);
  await expect(page.locator('#document-preview')).toContainText('14:05');
  await expect(page.locator('#document-preview')).toContainText('長い行程の地点名');
});

test('validation sample reveals required-field errors', async ({ page }) => {
  await loadSample(page, 'validation');
  await expect(page.locator('#plannerName')).toHaveValue('');
  await page.locator('#step1-next').click();
  await expect(page.locator('#plannerName')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('.step[data-step="1"] [role="alert"]')).toContainText('企画者の氏名を入力してください');
});
