import { test, expect } from '@playwright/test';

async function seedRainPlan(page) {
  await page.evaluate(() => {
    const values = {
      eventDate:'2026-08-23',meetingTime:'05:00',meetingPlace:'信州大学 松本キャンパス サークルボックス前',rainPolicy:'雨天中止',
      plannerStudentId:'24T4082A',plannerName:'武藤俊樹',plannerPhone:'090-1111-2222',baseName:'留守本部',basePhone:'090-3333-4444',
      mountainName:'雨飾山',areaMunicipality:'小谷村・糸魚川市',drinkLiters:'2.0',durationMinutes:'380',distanceKm:'7.5',ascentM:'1052',descentM:'1052',
      police1Name:'大町警察署',police1Phone:'0261-22-0110'
    };
    for (const [id,value] of Object.entries(values)) document.getElementById(id).value=value;

    const c=document.createElement('canvas');
    c.width=640;c.height=900;
    const ctx=c.getContext('2d');
    ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);
    ctx.strokeStyle='#555';ctx.lineWidth=8;ctx.beginPath();ctx.moveTo(90,760);ctx.bezierCurveTo(180,150,420,720,550,180);ctx.stroke();
    const route=c.toDataURL('image/png');

    const app=window.__tozanApp;
    app.state.metrics={durationMinutes:380,distanceKm:7.5,ascentM:1052,descentM:1052};
    app.state.itinerary=[
      {time:'06:30',place:'雨飾高原登山口',major:true,restMinutes:0},
      {time:'06:30',place:'雨飾高原登山口トイレ',major:true,restMinutes:0},
      {time:'06:30',place:'雨飾高原キャンプ場駐車場',major:true,restMinutes:0},
      {time:'08:05',place:'標高1445m地点',major:true,restMinutes:0},
      {time:'09:35',place:'笹平',major:true,restMinutes:0},
      {time:'10:05',place:'雨飾山',major:true,restMinutes:0},
      {time:'10:30',place:'笹平',major:true,restMinutes:0},
      {time:'11:30',place:'標高1445m地点',major:true,restMinutes:0},
      {time:'12:50',place:'雨飾高原登山口',major:true,restMinutes:0},
      {time:'12:50',place:'雨飾高原登山口トイレ',major:true,restMinutes:0},
      {time:'12:50',place:'雨飾高原キャンプ場駐車場',major:true,restMinutes:0}
    ];
    app.state.routeImage=route;
    app.state.uploads=[
      {id:'route',name:'route.png',url:route,kind:'route',classification:'route',routeSource:true},
      {id:'itin1',name:'itin1.png',url:route,kind:'itinerary',classification:'itinerary',routeSource:false},
      {id:'itin2',name:'itin2.png',url:route,kind:'itinerary',classification:'itinerary',routeSource:false}
    ];
    app.state.step=2;
    app.goToStep(3);
  });
}

test('rain itinerary uses readable type and available page space', async ({ page }) => {
  await page.goto('/');
  await seedRainPlan(page);
  await page.evaluate(() => window.__tozanApp.renderDocument());

  const result = await page.locator('.doc-page[data-page="1"] .journey-box').evaluate(box => ({
    fontSize: parseFloat(getComputedStyle(box).fontSize),
    lineHeight: parseFloat(getComputedStyle(box).lineHeight),
    compact: box.classList.contains('journey-box--compact'),
    dense: box.classList.contains('journey-box--dense'),
    height: box.getBoundingClientRect().height,
    pageFits: box.closest('.doc-page').scrollHeight <= box.closest('.doc-page').clientHeight + 1,
  }));

  expect(result.fontSize).toBeGreaterThanOrEqual(16);
  expect(result.compact).toBe(false);
  expect(result.dense).toBe(false);
  expect(result.height).toBeGreaterThan(250);
  expect(result.pageFits).toBe(true);
  await page.locator('.doc-page[data-page="1"]').screenshot({path:'test-results/page-1-rain-readable.png'});
});

test('prepared PDF shares immediately even when canShare reports false', async ({ page }) => {
  await page.addInitScript(() => {
    window.__shareCalls=[];
    Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>false});
    Object.defineProperty(navigator,'share',{configurable:true,value:data=>{
      window.__shareCalls.push({count:data.files?.length||0,type:data.files?.[0]?.type||'',name:data.files?.[0]?.name||''});
      return Promise.resolve();
    }});
  });

  let downloads=0;
  page.on('download',()=>{ downloads+=1; });
  await page.goto('/');
  await seedRainPlan(page);

  const button=page.locator('#print-button');
  await expect(button).toHaveText('PDFを共有',{timeout:30000});
  await expect(button).toBeEnabled();
  const beforeUrl=page.url();
  const beforeUploads=await page.evaluate(()=>window.__tozanApp.state.uploads.length);
  const beforeRoute=await page.evaluate(()=>window.__tozanApp.state.routeImage.length);

  await button.click();
  await expect.poll(async()=>page.evaluate(()=>window.__shareCalls.length)).toBe(1);
  const shared=await page.evaluate(()=>window.__shareCalls[0]);
  expect(shared.count).toBe(1);
  expect(shared.type).toBe('application/pdf');
  expect(shared.name.endsWith('.pdf')).toBe(true);
  expect(page.url()).toBe(beforeUrl);
  expect(downloads).toBe(0);
  expect(await page.evaluate(()=>window.__tozanApp.state.uploads.length)).toBe(beforeUploads);
  expect(await page.evaluate(()=>window.__tozanApp.state.routeImage.length)).toBe(beforeRoute);
});
