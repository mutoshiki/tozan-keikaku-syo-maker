import { test, expect } from '@playwright/test';

const THEME_KEY = 'sanpokai-theme-preference-v1';

async function resetTheme(page) {
  await page.addInitScript((key) => localStorage.removeItem(key), THEME_KEY);
}

async function selectTheme(page, currentLabel, id) {
  await page.getByRole('button', { name: `テーマ設定：${currentLabel}` }).click();
  await page.locator(`label[for="${id}"]`).click();
}

async function verifyThemeFlow(page, label) {
  await page.emulateMedia({ colorScheme: 'light' });
  await resetTheme(page);
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'テーマ設定：システム設定' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.carbonTheme)).toBe('white');

  await selectTheme(page, 'システム設定', 'theme-dark');
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.carbonTheme)).toBe('g100');
  expect(await page.evaluate((key) => localStorage.getItem(key), THEME_KEY)).toBe('dark');

  const dark = await page.evaluate(() => {
    const input = document.querySelector('#eventDate');
    const example = document.querySelector('.example-card');
    const image = document.querySelector('.example-card img');
    const panel = document.querySelector('.cds--header-panel');
    window.__tozanApp.renderDocument();
    const documentPage = document.querySelector('.doc-page');
    return {
      root: getComputedStyle(document.documentElement).backgroundColor,
      body: getComputedStyle(document.body).backgroundColor,
      input: getComputedStyle(input).backgroundColor,
      example: getComputedStyle(example).backgroundColor,
      panel: getComputedStyle(panel).backgroundColor,
      imageFilter: getComputedStyle(image).filter,
      paperBackground: getComputedStyle(documentPage).backgroundColor,
      paperColor: getComputedStyle(documentPage).color,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
  expect(dark.body).not.toBe('rgb(255, 255, 255)');
  expect(dark.input).not.toBe('rgb(255, 255, 255)');
  expect(dark.example).not.toBe('rgb(255, 255, 255)');
  expect(dark.panel).not.toBe('rgb(255, 255, 255)');
  expect(dark.imageFilter).toBe('none');
  expect(dark.paperBackground).toBe('rgb(255, 255, 255)');
  expect(dark.paperColor).toBe('rgb(17, 17, 17)');
  expect(dark.overflow).toBeLessThanOrEqual(1);
  await page.screenshot({ path: `test-results/theme-${label}-dark.png`, fullPage: true });

  await selectTheme(page, 'ダーク', 'theme-light');
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.carbonTheme)).toBe('white');
  expect(await page.evaluate((key) => localStorage.getItem(key), THEME_KEY)).toBe('light');
  await page.screenshot({ path: `test-results/theme-${label}-light.png`, fullPage: true });

  await selectTheme(page, 'ライト', 'theme-system');
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.carbonTheme)).toBe('white');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.carbonTheme)).toBe('g100');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.carbonTheme)).toBe('white');

  await selectTheme(page, 'システム設定', 'theme-dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.carbonTheme)).toBe('g100');
  await page.reload();
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.carbonTheme)).toBe('g100');
  expect(await page.evaluate((key) => localStorage.getItem(key), THEME_KEY)).toBe('dark');

  await page.locator('#eventDate').focus();
  const focus = await page.locator('#eventDate').evaluate((node) => ({ outline: getComputedStyle(node).outline, boxShadow: getComputedStyle(node).boxShadow }));
  expect(focus.outline === 'none' && focus.boxShadow === 'none').toBe(false);
}

test('Carbon themes work on desktop and keep the PDF paper white', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await verifyThemeFlow(page, 'desktop');
});

test('Carbon theme control remains usable on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await verifyThemeFlow(page, 'mobile');
});
