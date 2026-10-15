import { test, expect } from '@playwright/test';

async function enterReview(page) {
  await page.goto('/');
  await page.evaluate(() => {
    const values = {
      eventDate: '2026-10-20', meetingTime: '08:00', meetingPlace: '評価用集合場所', rainPolicy: '雨天中止',
      plannerStudentId: 'AUDIT-001', plannerName: '評価用企画者', plannerPhone: '0267-22-0110',
      baseName: '評価用留守本部', basePhone: '090-1234-5678',
      mountainName: '評価用の山', areaMunicipality: '長野県小諸市',
      durationMinutes: '180', distanceKm: '5.2', ascentM: '600', descentM: '600', drinkLiters: '2.0',
      police1Name: '小諸警察署', police1Phone: '0267-22-0110',
    };
    for (const [id, value] of Object.entries(values)) document.getElementById(id).value = value;

    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    canvas.getContext('2d').fillRect(0, 0, canvas.width, canvas.height);
    const route = canvas.toDataURL('image/png');
    const app = window.__tozanApp;
    app.state.routeImage = route;
    app.state.uploads = [
      { id: 'route-test', name: 'route.png', url: route, kind: 'route', classification: 'route', routeSource: true },
      { id: 'itinerary-test', name: 'itinerary.png', url: route, kind: 'itinerary', classification: 'itinerary', routeSource: false },
    ];
    app.state.metrics = { durationMinutes: 180, distanceKm: 5.2, ascentM: 600, descentM: 600 };
    app.state.itinerary = [
      { time: '08:00', place: '削除対象の地点', major: true, restMinutes: 0 },
      { time: '09:00', place: '中間地点', major: true, restMinutes: 0 },
      { time: '11:00', place: '評価用の山', major: true, restMinutes: 0 },
    ];
    app.state.step = 2;
    app.state.maxReachedStep = 2;
    app.goToStep(3);
  });
}

test('removingItineraryRowInvalidatesPreparedPdf', async ({ page }) => {
  await enterReview(page);
  const button = page.locator('#print-button');
  await expect(button).toHaveAttribute('data-pdf-ready', 'true', { timeout: 30000 });
  const firstFile = await page.evaluate(() => window.__tozanShare.getPreparedFile().name);

  await page.getByRole('button', {name:'08:00 削除対象の地点を編集'}).click();
  await page.getByRole('button', {name:'08:00 削除対象の地点を削除'}).click();
  await expect.poll(() => page.evaluate(() => window.__tozanShare.getPreparedFile())).toBeNull();
  await expect(button).toHaveAttribute('data-pdf-ready', 'true', { timeout: 30000 });

  const result = await page.evaluate(() => ({
    name: window.__tozanShare.getPreparedFile().name,
    preview: document.querySelector('#document-preview').textContent,
    rowCount: window.__tozanApp.state.itinerary.length,
  }));
  expect(result.name).toBe(firstFile);
  expect(result.rowCount).toBe(2);
  expect(result.preview).not.toContain('削除対象の地点');
});

test('invalidRequiredValuesBlockExport', async ({ page }) => {
  await enterReview(page);
  const button = page.locator('#print-button');
  let downloads = 0;
  page.on('download', () => { downloads += 1; });

  await page.fill('#mountainName', '');
  await page.evaluate(() => {
    const validate = window.__tozanApp.validateStep3;
    window.__validationCalls = 0;
    window.__tozanApp.validateStep3 = () => {
      window.__validationCalls += 1;
      return validate();
    };
  });
  await expect(button).toBeEnabled({ timeout: 30000 });
  await button.evaluate(el => el.click());
  await expect.poll(() => page.evaluate(() => window.__validationCalls)).toBe(1);
  await expect(page.locator('#mountainName')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#mountainName').locator('xpath=..')).toContainText('山名を入力してください');

  await page.fill('#mountainName', '評価用の山');
  await page.fill('#drinkLiters', '11');
  await expect(button).toBeEnabled({ timeout: 30000 });
  await button.evaluate(el => el.click());
  await expect.poll(() => page.evaluate(() => window.__validationCalls)).toBe(2);
  await expect(page.locator('#drinkLiters')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#drinkLiters').locator('xpath=..')).toContainText('0.5〜10');
  expect(downloads).toBe(0);
});

test('phoneFormatErrorsAreExplained', async ({ page }) => {
  await page.goto('/');
  await page.fill('#eventDate', '2026-10-20');
  await page.fill('#plannerStudentId', 'AUDIT-001');
  await page.fill('#plannerName', '評価用企画者');
  await page.fill('#plannerPhone', '5');
  await page.fill('#baseName', '評価用留守本部');
  await page.fill('#basePhone', '090-1234-5678');

  await page.locator('#step1-next').click();
  await expect(page.locator('#plannerPhone')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#plannerPhone').locator('xpath=..')).toContainText('電話番号を確認してください');
  await expect(page.locator('.step[data-step="1"]')).toBeVisible();

  await page.fill('#plannerPhone', '0267-22-0110');
  await page.locator('#step1-next').click();
  await expect(page.locator('.step[data-step="2"]')).toBeVisible();
});

test('latestEditWinsDuringPdfPreparation', async ({ page }) => {
  await enterReview(page);
  await expect(page.locator('#print-button')).toHaveAttribute('data-pdf-ready', 'true', { timeout: 30000 });

  await page.evaluate(() => {
    const calls = [];
    window.__pdfPreparationCalls = calls;
    window.__tozanApp.createPdfFile = () => new Promise(resolve => calls.push(resolve));
    window.__tozanShare.markDirty();
    window.__tozanShare.preparePdf();
  });
  await expect.poll(() => page.evaluate(() => window.__pdfPreparationCalls.length)).toBe(1);

  await page.fill('#mountainName', '更新後の山名');
  await page.evaluate(() => window.__pdfPreparationCalls[0](new File(['old'], 'stale.pdf', { type: 'application/pdf' })));
  await expect.poll(() => page.evaluate(() => window.__pdfPreparationCalls.length)).toBe(2);
  await page.evaluate(() => window.__pdfPreparationCalls[1](new File(['latest'], 'latest.pdf', { type: 'application/pdf' })));

  await expect.poll(() => page.evaluate(() => window.__tozanShare.getPreparedFile()?.name)).toBe('latest.pdf');
  await expect(page.locator('#print-button')).toHaveAttribute('data-pdf-ready', 'true');
});
