import { test, expect } from '@playwright/test';

test('keyboardCanChooseRouteAndItinerary', async ({ page }) => {
  await page.route('**/analyze', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ mountainName: '評価用の山', itinerary: [{ time: '08:00', place: '登山口', major: true }, { time: '09:00', place: '山頂', major: true }], routeImageIndex: 0, warnings: [] }),
  }));
  await page.goto('/');
  await page.fill('#eventDate', '2026-10-20');
  await page.fill('#plannerStudentId', 'AUDIT-001');
  await page.fill('#plannerName', '評価用企画者');
  await page.fill('#plannerPhone', '090-1234-5678');
  await page.fill('#baseName', '評価用留守本部');
  await page.fill('#basePhone', '0267-22-0110');
  await page.locator('#step1-next').click();
  await expect(page.locator('.step[data-step="2"]')).toBeVisible();

  const routeButton = page.locator('#route-drop-zone .cds--file__drop-container');
  await routeButton.focus();
  const routeChooserPromise = page.waitForEvent('filechooser');
  await routeButton.press('Enter');
  const routeChooser = await routeChooserPromise;
  expect(routeChooser.isMultiple()).toBe(false);
  await routeChooser.setFiles('public/examples/yamap-route.webp');
  await expect(page.locator('#route-upload-list .upload-card')).toHaveCount(1);
  await expect(routeButton).toBeFocused();

  const itineraryButton = page.locator('#itinerary-drop-zone .cds--file__drop-container');
  await itineraryButton.focus();
  const itineraryChooserPromise = page.waitForEvent('filechooser');
  await itineraryButton.press('Space');
  const itineraryChooser = await itineraryChooserPromise;
  expect(itineraryChooser.isMultiple()).toBe(true);
  await itineraryChooser.setFiles('public/examples/yamap-itinerary-1.webp');
  await expect(page.locator('#itinerary-upload-list .upload-card')).toHaveCount(1);
  await expect(page.locator('#analysis-status')).toContainText('読み取り完了');
  await expect(itineraryButton).toBeFocused();
});

test('collapsedThemePanelIsNotFocusable', async ({ page }) => {
  await page.goto('/');
  const trigger = page.getByRole('button', { name: /テーマ設定/ });
  const panel = page.locator('.cds--header-panel');

  await trigger.focus();
  await page.keyboard.press('Tab');
  expect(await panel.evaluate((node) => node.contains(document.activeElement))).toBe(false);

  await trigger.focus();
  await page.keyboard.press('Enter');
  const radio = page.locator('#theme-system');
  await radio.focus();
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  expect(await panel.evaluate((node) => node.contains(document.activeElement))).toBe(false);
  expect(await radio.evaluate((node) => node.closest('[inert]') !== null)).toBe(true);
});

test('narrowReflowAndForcedColorFocusRemainAvailable', async ({ page }) => {
  await page.setViewportSize({width:320,height:900});
  await page.emulateMedia({forcedColors:'active'});
  await page.goto('/');
  const date = page.locator('#eventDate');
  await date.focus();
  await expect(date).toBeFocused();
  expect(await date.evaluate(node => getComputedStyle(node).outlineStyle)).toBe('solid');
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await expect(page.getByRole('link', {name:'登山計画書メーカー'})).toBeVisible();
});
