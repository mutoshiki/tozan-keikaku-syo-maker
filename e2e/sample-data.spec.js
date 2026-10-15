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
  await expect(page.locator('#sample-data-notice')).toContainText('入力エラーを確認するため');
  await expect(page.locator('.step[data-step="1"] .form-intro')).toContainText('（任意）の表示がない項目は必須');
  await expect(page.locator('#plannerName')).toHaveValue('');
  await page.locator('#step1-next').click();
  await expect(page.locator('#plannerName')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#plannerName')).toHaveAttribute('aria-describedby', /plannerName-error/);
  await expect(page.locator('#plannerName-error .field-error__icon')).toHaveAttribute('aria-hidden', 'true');
  const summary = page.locator('.step[data-step="1"] [role="alert"]');
  await expect(summary).toContainText('4件');
  await expect(summary.locator('a')).toHaveCount(4);
  await summary.getByRole('link', {name:/留守本部の氏名を入力/}).click();
  await expect(page.locator('#baseName')).toBeFocused();
  await page.locator('#baseName').fill('機能確認用 留守本部');
  await expect(summary).toContainText('3件');
  await expect(summary.locator('a')).toHaveCount(3);
});

test('mobile validation sample keeps the notice close to the progress indicator', async ({ page }) => {
  await page.setViewportSize({width:393,height:852});
  await loadSample(page, 'validation');
  const gap = await page.evaluate(() => {
    const progress = document.querySelector('.app-shell-progress').getBoundingClientRect();
    const notice = document.querySelector('#sample-data-notice').getBoundingClientRect();
    return notice.top - progress.bottom;
  });
  expect(gap).toBeLessThanOrEqual(32);
});
