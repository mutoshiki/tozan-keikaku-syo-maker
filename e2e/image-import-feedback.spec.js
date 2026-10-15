import { test, expect } from '@playwright/test';

test('missingImageAndUnsupportedTypeExplainNextAction', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => window.__tozanApp.addFiles([new File(['x'], 'bad.pdf', {type:'application/pdf'})], 'route'));
  await expect(page.locator('#analysis-status')).toContainText('PNG、JPEG、WebP形式');
  await expect(page.locator('#step2-next')).toBeDisabled();

  await page.evaluate(async () => {
    const file = await fetch('/examples/yamap-route.webp').then(response => response.blob());
    await window.__tozanApp.addFiles([new File([file], 'route.webp', {type:'image/webp'})], 'route');
  });
  await expect(page.locator('#analysis-status')).toContainText('行程画像を追加してください');
  await expect(page.locator('#step2-next')).toBeDisabled();
});

test('analysisFailureKeepsImagesAndAllowsRetry', async ({ page }) => {
  let attempts = 0;
  await page.route('https://tozan-keikaku-syo-maker.610unko.workers.dev/analyze', route => {
    attempts += 1;
    return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'一時的な読み取り障害'})});
  });
  await page.goto('/');
  await page.evaluate(() => {
    const values = {eventDate:'2026-10-20',plannerStudentId:'TEST-01',plannerName:'評価用',plannerPhone:'090-1234-5678',baseName:'留守本部',basePhone:'0267-22-0110'};
    for (const [id,value] of Object.entries(values)) document.getElementById(id).value=value;
    document.getElementById('step1-next').click();
  });
  await expect(page.locator('.step[data-step="2"]')).toBeVisible();
  await page.evaluate(async () => {
    const load = async name => { const blob=await fetch(`/examples/${name}`).then(response=>response.blob()); return new File([blob],name,{type:'image/webp'}); };
    await window.__tozanApp.addFiles([await load('yamap-route.webp')], 'route');
    await window.__tozanApp.addFiles([await load('yamap-itinerary-1.webp')], 'itinerary');
  });
  await expect(page.locator('#analysis-status')).toContainText('一時的な読み取り障害');
  await expect(page.getByRole('button', {name:'読み取りを再試行'})).toBeVisible();
  await expect(page.locator('#itinerary-upload-list .upload-card')).toHaveCount(1);
  await expect(page.locator('#step2-next')).toBeDisabled();
  await page.getByRole('button', {name:'読み取りを再試行'}).click();
  await expect.poll(() => attempts).toBe(2);
  await expect(page.locator('#analysis-status')).toContainText('読み取りを再試行');
});

test('completedAnalysisWithoutItineraryExplainsWhyNextIsUnavailable', async ({ page }) => {
  await page.route('https://tozan-keikaku-syo-maker.610unko.workers.dev/analyze', route => route.fulfill({
    status:200,contentType:'application/json',body:JSON.stringify({itinerary:[],metrics:{},routeImageIndex:0,warnings:[]}),
  }));
  await page.goto('/');
  await page.evaluate(() => {
    for (const [id,value] of Object.entries({eventDate:'2026-10-20',plannerStudentId:'TEST-01',plannerName:'評価用',plannerPhone:'090-1234-5678',baseName:'留守本部',basePhone:'0267-22-0110'})) document.getElementById(id).value=value;
    document.getElementById('step1-next').click();
  });
  await expect(page.locator('.step[data-step="2"]')).toBeVisible();
  await page.evaluate(async () => {
    const load = async name => { const blob=await fetch(`/examples/${name}`).then(response=>response.blob()); return new File([blob],name,{type:'image/webp'}); };
    await window.__tozanApp.addFiles([await load('yamap-route.webp')], 'route');
    await window.__tozanApp.addFiles([await load('yamap-itinerary-1.webp')], 'itinerary');
  });
  await expect(page.locator('#analysis-status')).toContainText('読み取りは完了しましたが');
  await expect(page.locator('#analysis-status')).toContainText('行程画像を追加するか');
  await expect(page.locator('#step2-next')).toBeDisabled();
});
