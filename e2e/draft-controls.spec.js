import { expect, test } from '@playwright/test';

test('autosaves and restores without manual draft controls', async ({ page }) => {
  await page.goto('/tozan-keikaku-syo-maker/');
  await page.waitForFunction(() => window.__tozanApp?.draftRuntime);

  await expect(page.locator('.draft-controls__menu')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '今すぐ保存' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '下書きを読み込む' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '下書きを削除' })).toHaveCount(0);

  await page.fill('#eventDate', '2026-11-02');
  await page.waitForTimeout(1_000);
  await page.reload();
  await page.waitForFunction(() => window.__tozanApp?.draftRuntime);
  await expect(page.locator('#eventDate')).toHaveValue('2026-11-02');
});
