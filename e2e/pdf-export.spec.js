import { test, expect } from '@playwright/test';
import fs from 'node:fs';

function pdfPageCount(buffer) {
  const text = buffer.toString('latin1');
  return (text.match(/\/Type\s*\/Page\b/g) || []).length;
}

test('A4 preview is balanced and PDF downloads as three pages', async ({ page }) => {
  await page.goto('/');

  await page.evaluate(() => {
    const values = {
      eventDate: '2026-08-21', meetingTime: '05:00', meetingPlace: '信州大学 松本キャンパス サークルボックス前',
      mountainName: '根子岳・四阿山', areaMunicipality: '四阿山 / 長野県上田市', rainPolicy: '雨天中止',
      plannerStudentId: 'TEST-001', plannerName: '企画 太郎', plannerPhone: '090-1111-2222',
      baseName: '留守 花子', basePhone: '090-3333-4444', police1Name: '上田警察署', police1Phone: '0268-22-0110',
      police2Name: '', police2Phone: '', drinkLiters: '1.5',
      durationMinutes: '370', distanceKm: '9.5', ascentM: '987', descentM: '988',
    };
    for (const [id, value] of Object.entries(values)) document.getElementById(id).value = value;

    const c = document.createElement('canvas');
    c.width = 540; c.height = 1170;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,c.width,c.height);
    ctx.fillStyle = '#111111'; ctx.font = '28px sans-serif'; ctx.fillText('YAMAP plan screenshot', 30, 55);
    ctx.fillStyle = '#f4f4f4'; ctx.fillRect(30,120,480,580);
    ctx.strokeStyle = '#555555'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(70,600); ctx.bezierCurveTo(180,150,360,680,480,260); ctx.stroke();
    ctx.fillStyle = '#111111'; ctx.font = '24px sans-serif'; ctx.fillText('9.5 km   987 m   988 m', 40, 760);

    const app = window.__tozanApp;
    app.state.metrics = { durationMinutes: 370, distanceKm: 9.5, ascentM: 987, descentM: 988 };
    app.state.itinerary = [
      {time:'07:00',place:'菅平牧場公衆トイレ',major:true,restMinutes:0},
      {time:'09:00',place:'根子岳',major:true,restMinutes:0},
      {time:'10:30',place:'分岐',major:false,restMinutes:0},
      {time:'10:45',place:'四阿山',major:true,restMinutes:0},
      {time:'11:35',place:'中四阿',major:true,restMinutes:0},
      {time:'12:05',place:'小四阿',major:true,restMinutes:0},
      {time:'13:05',place:'四阿山登山口（中四阿経由）',major:true,restMinutes:0},
      {time:'13:10',place:'菅平牧場公衆トイレ',major:true,restMinutes:0},
    ];
    app.state.routeImage = c.toDataURL('image/png');
    app.state.step = 3;
    app.goToStep(4);
  });

  await expect(page.locator('.doc-page')).toHaveCount(3);
  await expect(page.locator('.doc-page[data-page="2"] .gear-box')).toHaveCount(0);
  await expect(page.locator('.doc-page[data-page="3"] .gear-box')).toHaveCount(1);
  await expect(page.locator('.doc-page[data-page="3"] .contact-list p')).toHaveCount(5);

  const routeBox = await page.locator('.doc-page[data-page="2"] .route-image-frame--large').boundingBox();
  expect(routeBox?.height || 0).toBeGreaterThan(650);

  await page.locator('.doc-page[data-page="1"]').screenshot({ path: 'test-results/page-1.png' });
  await page.locator('.doc-page[data-page="2"]').screenshot({ path: 'test-results/page-2.png' });
  await page.locator('.doc-page[data-page="3"]').screenshot({ path: 'test-results/page-3.png' });

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'PDFをダウンロード' }).click();
  const download = await downloadPromise;
  const output = 'test-results/generated-plan.pdf';
  await download.saveAs(output);
  const data = fs.readFileSync(output);
  expect(data.length).toBeGreaterThan(100_000);
  expect(pdfPageCount(data)).toBe(3);
});
