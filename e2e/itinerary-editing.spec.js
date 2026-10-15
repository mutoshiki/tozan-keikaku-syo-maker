import { test, expect } from '@playwright/test';

async function enterReview(page) {
  await page.goto('/');
  await page.evaluate(() => {
    const app = window.__tozanApp;
    const values = { eventDate:'2026-10-20', meetingTime:'08:00', meetingPlace:'長い集合場所の名前 信州大学松本キャンパス', plannerStudentId:'TEST-01', plannerName:'評価用', plannerPhone:'090-1234-5678', baseName:'留守本部', basePhone:'0267-22-0110', mountainName:'評価の山', areaMunicipality:'長野県小諸市', durationMinutes:'394', distanceKm:'9.6', ascentM:'880', descentM:'878', police1Name:'小諸警察署', police1Phone:'0267-22-0110', drinkLiters:'2.0' };
    for (const [id,value] of Object.entries(values)) document.getElementById(id).value=value;
    const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p1sAAAAASUVORK5CYII=';
    app.state.routeImage=image; app.state.uploads=[{id:'r',name:'route.png',url:image,kind:'route'},{id:'i',name:'itinerary.png',url:image,kind:'itinerary'}];
    app.state.metrics={durationMinutes:394,distanceKm:9.6,ascentM:880,descentM:878};
    app.state.itinerary=[{time:'08:00',place:'車坂峠',major:true,restMinutes:0},{time:'09:00',place:'長い地点名の例 松本市方面',major:true,restMinutes:0},{time:'14:34',place:'車坂峠',major:true,restMinutes:0}];
    app.state.step=2; app.state.maxReachedStep=2; app.goToStep(3);
  });
}

test('confirmationHidesItineraryEditorsButPdfKeepsTheJourney', async ({ page }) => {
  await enterReview(page);
  await expect(page.locator('.step[data-step="3"] h1')).toBeFocused();
  await expect(page.getByRole('heading', {name:'行程', exact:true})).toHaveCount(0);
  await expect(page.locator('#itinerary-body')).toHaveCount(0);
  await expect(page.locator('#document-preview')).toContainText('08:00');
  await expect(page.locator('#document-preview')).toContainText('14:34');
});

test('mobileConfirmationOmitsReviewItineraryAndKeepsPdfContents', async ({ page }) => {
  await page.setViewportSize({width:390,height:844});
  await enterReview(page);
  await expect(page.getByRole('heading', {name:'出力前の概要'})).toHaveCount(0);
  await expect(page.locator('#meetingPlace')).toHaveValue('長い集合場所の名前 信州大学松本キャンパス');
  await expect(page.locator('#itinerary-body')).toHaveCount(0);
  await expect(page.locator('#document-preview')).toContainText('14:34');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await page.setViewportSize({width:320,height:844});
  const narrowOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(narrowOverflow).toBeLessThanOrEqual(1);
});

test('confirmationHasNoPdfPreviewButKeepsPdfSourceAndSaveAction', async ({ page }) => {
  await enterReview(page);
  await expect(page.locator('#toggle-pdf-preview')).toHaveCount(0);
  await expect(page.locator('#pdf-preview')).toHaveCount(0);
  await expect(page.locator('#document-preview')).toContainText('08:00');
  await expect(page.locator('#print-button')).toBeVisible();
  await page.fill('#distanceKm','10.1');
  await expect(page.locator('#distanceKm')).toHaveValue('10.1');
});

test('completedStepCanBeRevisitedAndReturnsFocusToItsHeading', async ({ page }) => {
  await enterReview(page);
  await page.locator('[data-step-target="1"]').click();
  await expect(page.locator('.step[data-step="1"]')).toBeVisible();
  await expect(page.locator('#step-heading-1')).toBeFocused();
  await expect(page.locator('[data-step-target="2"]')).toBeEnabled();
  await page.locator('[data-step-target="2"]').click();
  await expect(page.locator('.step[data-step="2"]')).toBeVisible();
  await expect(page.locator('#step-heading-2')).toBeFocused();
});
