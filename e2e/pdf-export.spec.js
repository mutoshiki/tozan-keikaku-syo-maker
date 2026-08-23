import { test, expect } from '@playwright/test';
import fs from 'node:fs';

function pdfPageCount(buffer) {
  return (buffer.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length;
}

async function seedPlan(page) {
  await page.evaluate(() => {
    const values = {
      eventDate:'2026-08-21',meetingTime:'05:00',meetingPlace:'信州大学 松本キャンパス サークルボックス前',rainPolicy:'雨天中止',
      plannerStudentId:'TEST-001',plannerName:'企画 太郎',plannerPhone:'090-1111-2222',baseName:'留守 花子',basePhone:'090-3333-4444',
      mountainName:'根子岳・四阿山',areaMunicipality:'四阿山 / 長野県上田市',police1Name:'上田警察署',police1Phone:'0268-22-0110',police2Name:'',police2Phone:'',drinkLiters:'2.0',
      durationMinutes:'370',distanceKm:'9.5',ascentM:'987',descentM:'988'
    };
    for (const [id,value] of Object.entries(values)) document.getElementById(id).value = value;
    const c=document.createElement('canvas');c.width=540;c.height=1170;const ctx=c.getContext('2d');
    ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle='#f4f4f4';ctx.fillRect(30,80,480,850);
    ctx.strokeStyle='#555';ctx.lineWidth=8;ctx.beginPath();ctx.moveTo(70,780);ctx.bezierCurveTo(180,130,360,760,480,220);ctx.stroke();
    const app=window.__tozanApp;
    app.state.metrics={durationMinutes:370,distanceKm:9.5,ascentM:987,descentM:988};
    app.state.itinerary=[
      {time:'07:00',place:'菅平牧場公衆トイレ',major:true,restMinutes:0},{time:'09:00',place:'根子岳',major:true,restMinutes:0},
      {time:'10:30',place:'分岐',major:false,restMinutes:0},{time:'10:45',place:'四阿山',major:true,restMinutes:0},
      {time:'11:35',place:'中四阿',major:true,restMinutes:0},{time:'12:05',place:'小四阿',major:true,restMinutes:0},
      {time:'13:05',place:'四阿山登山口（中四阿経由）',major:true,restMinutes:0},{time:'13:10',place:'菅平牧場公衆トイレ',major:true,restMinutes:0}
    ];
    app.state.routeImage=c.toDataURL('image/png');
    app.state.step=2;app.goToStep(3);
  });
}

test('simplified Carbon flow keeps only three steps and generates a three-page PDF', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.progress__step')).toHaveCount(3);
  await expect(page.getByRole('button',{name:'基本情報'})).toBeVisible();
  await expect(page.getByRole('button',{name:'YAMAP'})).toBeVisible();
  await expect(page.getByRole('button',{name:'確認'})).toBeVisible();
  await expect(page.locator('.cds-header a')).toHaveCount(0);
  await expect(page.locator('.fixed-panel')).toHaveCount(0);
  await expect(page.locator('.summary-strip')).toHaveCount(0);

  await page.fill('#plannerStudentId','TEST-001');
  await page.fill('#plannerName','企画 太郎');
  await page.fill('#plannerPhone','090-1111-2222');
  await page.fill('#baseName','留守 花子');
  await page.fill('#basePhone','090-3333-4444');
  await page.check('#rememberContacts');
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('tozanContactsV2')));
  expect(saved.baseName).toBe('留守 花子');
  expect(saved.basePhone).toBe('090-3333-4444');

  const police=await page.evaluate(()=>window.__tozanApp.resolveNaganoPoliceStations(['上田市'],'').stations);
  expect(police).toEqual([{name:'上田警察署',phone:'0268-22-0110'}]);

  await seedPlan(page);
  await expect(page.locator('.step[data-step="3"]')).toBeVisible();
  await expect(page.locator('#route-preview img')).toHaveCount(1);
  await page.screenshot({path:'test-results/ui-desktop.png',fullPage:true});

  await page.evaluate(()=>window.__tozanApp.renderDocument());
  await expect(page.locator('.doc-page')).toHaveCount(3);
  await expect(page.locator('.doc-page[data-page="2"] .gear-box')).toHaveCount(0);
  await expect(page.locator('.doc-page[data-page="3"] .gear-box')).toHaveCount(1);
  await expect(page.locator('.doc-page[data-page="3"] .contact-list p')).toHaveCount(5);
  const routeBox=await page.locator('.doc-page[data-page="2"] .route-image-frame').boundingBox();
  expect(routeBox?.height||0).toBeGreaterThan(650);
  await page.locator('.doc-page[data-page="1"]').screenshot({path:'test-results/page-1.png'});
  await page.locator('.doc-page[data-page="2"]').screenshot({path:'test-results/page-2.png'});
  await page.locator('.doc-page[data-page="3"]').screenshot({path:'test-results/page-3.png'});

  const downloadPromise=page.waitForEvent('download');
  await page.getByRole('button',{name:'PDFを作成'}).click();
  const download=await downloadPromise;
  const output='test-results/generated-plan.pdf';
  await download.saveAs(output);
  const data=fs.readFileSync(output);
  expect(data.length).toBeGreaterThan(100_000);
  expect(pdfPageCount(data)).toBe(3);
});

test('mobile layout has no horizontal page overflow', async ({ page }) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto('/');
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await page.screenshot({path:'test-results/ui-mobile.png',fullPage:true});
});
