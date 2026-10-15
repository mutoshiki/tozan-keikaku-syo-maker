import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const tinyPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p1sAAAAASUVORK5CYII=';

async function enterReview(page, itinerary = [
  { time: '08:00', place: '車坂峠', major: true, restMinutes: 0 },
  { time: '09:22', place: '分岐', major: false, restMinutes: 0 },
  { time: '14:34', place: '車坂峠', major: true, restMinutes: 0 },
]) {
  await page.goto('/');
  await page.evaluate(({ image, rows }) => {
    const values = {
      eventDate: '2026-10-14', meetingTime: '05:00', meetingPlace: '信州大学 松本キャンパス サークルボックス前',
      plannerStudentId: 'TEST-01', plannerName: '評価用', plannerPhone: '090-1234-5678',
      baseName: '留守本部', basePhone: '0267-22-0110', mountainName: '黒斑山', areaMunicipality: '小諸市・嬬恋村',
      durationMinutes: '394', distanceKm: '9.6', ascentM: '880', descentM: '878', drinkLiters: '2.0',
      police1Name: '小諸警察署', police1Phone: '0267-22-0110', police2Name: '長野原警察署', police2Phone: '0279-82-0110',
    };
    for (const [id, value] of Object.entries(values)) document.getElementById(id).value = value;
    const app = window.__tozanApp;
    app.state.routeImage = image;
    app.state.uploads = [
      { id: 'r', name: 'route.png', url: image, kind: 'route' },
      { id: 'i1', name: 'itinerary-1.png', url: image, kind: 'itinerary' },
      { id: 'i2', name: 'itinerary-2.png', url: image, kind: 'itinerary' },
      { id: 'i3', name: 'itinerary-3.png', url: image, kind: 'itinerary' },
    ];
    app.state.metrics = { durationMinutes: 394, distanceKm: 9.6, ascentM: 880, descentM: 878 };
    app.state.itinerary = rows;
    app.state.step = 2;
    app.state.maxReachedStep = 2;
    document.querySelector('#police-secondary').hidden = false;
    app.renderUploads();
    app.goToStep(3);
  }, { image: tinyPng, rows: itinerary });
}

test('removesTheDuplicateTitleAndSpecifiedYamapCopy', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('main > h1')).toHaveCount(0);
  await page.fill('#eventDate', '2026-10-14');
  await page.fill('#plannerStudentId', 'TEST-01');
  await page.fill('#plannerName', '評価用');
  await page.fill('#plannerPhone', '090-1234-5678');
  await page.fill('#baseName', '留守本部');
  await page.fill('#basePhone', '0267-22-0110');
  await page.locator('#step1-next').click();
  await expect(page.getByRole('heading', { level: 1, name: 'YAMAP画像の取り込み' })).toBeVisible();
  await expect(page.locator('.step[data-step="2"]')).not.toContainText('選択した画像は外部の画像解析サービス（AI）に送信して読み取ります。');
  await expect(page.locator('.step[data-step="2"]')).not.toContainText('読み取り後も内容を確認して修正できます。');
});

test('keepsTheContinueButtonEnabledStateInSyncWithSuccessfulAnalysis', async ({ page }) => {
  await page.route('**/analyze', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ mountainName: '黒斑山', itinerary: [{ time: '08:00', place: '登山口' }, { time: '09:00', place: '山頂' }], routeImageIndex: 0 }),
  }));
  await page.goto('/');
  await page.fill('#eventDate', '2026-10-14');
  await page.fill('#plannerStudentId', 'TEST-01');
  await page.fill('#plannerName', '評価用');
  await page.fill('#plannerPhone', '090-1234-5678');
  await page.fill('#baseName', '留守本部');
  await page.fill('#basePhone', '0267-22-0110');
  await page.locator('#step1-next').click();
  const routeFile = page.waitForEvent('filechooser');
  await page.locator('#route-drop-zone .cds--file__drop-container').click();
  await (await routeFile).setFiles('public/examples/yamap-route.webp');
  const itineraryFile = page.waitForEvent('filechooser');
  await page.locator('#itinerary-drop-zone .cds--file__drop-container').click();
  await (await itineraryFile).setFiles('public/examples/yamap-itinerary-1.webp');
  const next = page.locator('#step2-next');
  await expect(page.locator('#analysis-status')).toContainText('読み取り完了');
  await expect(next).toBeEnabled();
  await expect(next).not.toHaveClass(/cds--btn--disabled/);
});

test('hidesUnusedPoliceFieldsFromLayoutAndKeyboardUntilAdded', async ({ page }) => {
  await enterReview(page);
  await expect(page.locator('#police-tertiary')).toBeHidden();
  await expect(page.locator('#police3Name')).toBeHidden();
  const add = page.getByRole('button', { name: '管轄を追加' });
  await expect(add).toBeEnabled();
  await add.click();
  await expect(page.locator('#police-tertiary')).toBeVisible();
  await expect(page.locator('#police3Name')).toBeFocused();
});

test('revisitingCompletedStepsKeepsThemAvailableAndPreservesData', async ({ page }) => {
  await enterReview(page);
  await page.locator('#edit-basic').click();
  await expect(page.locator('[data-step-target="2"]')).toBeEnabled();
  await expect(page.locator('[data-step-target="2"]')).toHaveAttribute('aria-label', /完了/);
  await page.locator('[data-step-target="2"]').click();
  await expect(page.locator('[data-step-target="3"]')).toBeEnabled();
  await page.locator('[data-step-target="3"]').click();
  await expect(page.locator('#mountainName')).toHaveValue('黒斑山');
  await expect(page.locator('#itinerary-body')).toContainText('14:34');
});

test('showsACompactFullItineraryAndOpensContextualEditorsOnDemand', async ({ page }) => {
  const rows = Array.from({ length: 21 }, (_, index) => ({
    time: `${String(8 + Math.floor(index / 4)).padStart(2, '0')}:${String((index % 4) * 15).padStart(2, '0')}`,
    place: index === 20 ? '長い地点名を最後まで表示できる到着地点' : `地点${index + 1}`,
    major: index % 3 !== 1,
    restMinutes: 0,
  }));
  await enterReview(page, rows);
  await expect(page.locator('#itinerary-body tr')).toHaveCount(21);
  await expect(page.locator('#itinerary-body')).toContainText('08:00');
  await expect(page.locator('#itinerary-body')).toContainText('長い地点名を最後まで表示できる到着地点');
  await expect(page.locator('.itinerary-editor[hidden] input:visible')).toHaveCount(0);
  const edit = page.getByRole('button', { name: '09:15 地点6を編集' });
  await edit.click();
  await expect(page.getByLabel('09:15 地点6の時刻')).toBeVisible();
  await expect(page.getByLabel('09:15 地点6の地点名')).toBeVisible();
  await expect(page.getByRole('button', { name: '09:15 地点6を削除' })).toBeVisible();
});

test('listsImageReferencesInAnOptionalDisclosureAndNamesEachZoomControl', async ({ page }) => {
  await enterReview(page);
  const refs = page.locator('#review-upload-references details');
  await expect(refs).toBeVisible();
  await expect(refs).not.toHaveAttribute('open', '');
  await refs.locator('summary').click();
  await expect(refs).toContainText('itinerary-3.png');
  await page.locator('#edit-import').click();
  await expect(page.locator('#route-upload-list details summary')).toHaveAttribute('aria-label', 'ルート画像を拡大');
  await expect(page.locator('#itinerary-upload-list details summary').first()).toHaveAttribute('aria-label', '行程1画像を拡大');
  const zoom = page.locator('#route-upload-list details');
  const zoomControl = zoom.locator('summary');
  await zoomControl.focus();
  await zoomControl.press('Enter');
  await expect(zoom).toHaveAttribute('open', '');
  await expect(zoomControl).toBeFocused();
  await zoomControl.press('Space');
  await expect(zoom).not.toHaveAttribute('open', '');
  await expect(zoomControl).toBeFocused();
});

test('keepsRouteImageDimensionsProportionalInThePdfSource', async ({ page }) => {
  await enterReview(page);
  await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 831;
    canvas.getContext('2d').fillRect(0, 0, canvas.width, canvas.height);
    const app = window.__tozanApp;
    app.state.routeImage = canvas.toDataURL('image/png');
    app.renderDocument();
  });
  await page.evaluate(() => window.__tozanApp.fitRouteImageForPdf());
  const dims = await page.locator('.route-image-frame img').evaluate(img => ({
    natural: img.naturalWidth / img.naturalHeight,
    rendered: img.getBoundingClientRect().width / img.getBoundingClientRect().height,
  }));
  expect(Math.abs(dims.natural - dims.rendered) / dims.natural).toBeLessThan(0.01);
  const pdfData = await page.evaluate(async () => {
    const file = await window.__tozanApp.createPdfFile();
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    return dataUrl.split(',')[1];
  });
  fs.writeFileSync('test-results/route-ratio-plan.pdf', Buffer.from(pdfData, 'base64'));
});
