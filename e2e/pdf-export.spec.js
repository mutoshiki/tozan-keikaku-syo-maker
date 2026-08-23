import { test, expect } from '@playwright/test';
import fs from 'node:fs';

function pdfPageCount(buffer) {
  return (buffer.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length;
}

async function fillBasicInfo(page) {
  await page.fill('#eventDate','2026-08-21');
  await page.fill('#plannerStudentId','TEST-001');
  await page.fill('#plannerName','企画 太郎');
  await page.fill('#plannerPhone','090-1111-2222');
  await page.fill('#baseName','留守 花子');
  await page.fill('#basePhone','090-3333-4444');
}

async function seedPlan(page) {
  await page.evaluate(() => {
    const values = {
      eventDate:'2026-08-21',meetingTime:'05:00',meetingPlace:'信州大学 松本キャンパス サークルボックス前',rainPolicy:'雨天中止',
      plannerStudentId:'TEST-001',plannerName:'企画 太郎',plannerPhone:'090-1111-2222',baseName:'留守 花子',basePhone:'090-3333-4444',
      mountainName:'根子岳・四阿山',drinkLiters:'2.0',durationMinutes:'370',distanceKm:'9.5',ascentM:'987',descentM:'988'
    };
    for (const [id,value] of Object.entries(values)) document.getElementById(id).value = value;
    const municipalities=['長野県上田市','須坂市','群馬県嬬恋村'];
    const area=municipalityArea(municipalities,'志賀高原・菅平高原山域 / 長野県上田市・須坂市・群馬県嬬恋村');
    document.getElementById('areaMunicipality').value=area;
    applyPoliceFromRoute(municipalities,area);

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

test('guided YAMAP step separates route and itinerary images', async ({ page }) => {
  let analyzeCalls=0;
  let imageCount=0;
  await page.route('**/analyze', async route => {
    analyzeCalls += 1;
    imageCount = route.request().postDataJSON().images.length;
    await route.fulfill({
      status:200,
      contentType:'application/json',
      body:JSON.stringify({
        mountainName:'根子岳・四阿山',areaMunicipality:'菅平高原 / 長野県上田市・須坂市・群馬県嬬恋村',
        municipalities:['上田市','須坂市','嬬恋村'],durationMinutes:370,distanceKm:9.5,ascentM:987,descentM:988,routeImageIndex:0,
        itinerary:[{time:'7:00',place:'車坂峠',major:true},{time:'8:52',place:'黒斑山',major:true},{time:'13:34',place:'車坂峠',major:true}],warnings:[]
      })
    });
  });

  await page.goto('/');
  await expect(page.locator('.example-card')).toHaveCount(3);
  await expect(page.locator('.example-badge')).toHaveCount(3);
  await expect(page.locator('.example-card img')).toHaveCount(3);
  const examplesLoaded=await page.locator('.example-card img').evaluateAll(images=>images.every(img=>img.complete&&img.naturalWidth>0));
  expect(examplesLoaded).toBe(true);
  await expect(page.locator('#route-file-input')).not.toHaveAttribute('multiple','');
  await expect(page.locator('#itinerary-file-input')).toHaveAttribute('multiple','');

  const details=page.locator('.details-panel');
  await expect(details).not.toHaveAttribute('open','');
  await page.locator('.details-panel summary').click();
  await expect(details).toHaveAttribute('open','');
  const chevron=await page.locator('.details-panel summary').evaluate(el=>getComputedStyle(el,'::after').transform);
  expect(chevron).not.toBe('none');
  await page.screenshot({path:'test-results/ui-basic-accordion.png',fullPage:true});

  await fillBasicInfo(page);
  await page.getByRole('button',{name:'次へ'}).click();
  await expect(page.locator('.step[data-step="2"]')).toBeVisible();

  await page.locator('#route-file-input').setInputFiles('public/examples/yamap-route.webp');
  expect(analyzeCalls).toBe(0);
  await expect(page.locator('#route-upload-list .upload-card')).toHaveCount(1);
  await expect(page.locator('#itinerary-upload-list .upload-card')).toHaveCount(0);
  await expect(page.locator('#step2-next')).toBeDisabled();

  await page.locator('#itinerary-file-input').setInputFiles([
    'public/examples/yamap-itinerary-1.webp',
    'public/examples/yamap-itinerary-2.webp'
  ]);
  await expect(page.locator('#analysis-status')).toHaveText('読み取り完了');
  expect(analyzeCalls).toBe(1);
  expect(imageCount).toBe(3);
  await expect(page.locator('#route-upload-list .upload-card')).toHaveCount(1);
  await expect(page.locator('#itinerary-upload-list .upload-card')).toHaveCount(2);
  await expect(page.locator('#step2-next')).toBeEnabled();
  await page.screenshot({path:'test-results/ui-yamap.png',fullPage:true});

  await page.locator('#step2-next').click();
  await expect(page.locator('.step[data-step="3"]')).toBeVisible();
  await expect(page.locator('#drinkLiters')).toHaveValue('2.0');
  await expect(page.locator('#police-secondary')).toBeVisible();
  await expect(page.locator('#police-tertiary')).toBeVisible();
  await expect(page.locator('#police1Name')).toHaveValue('上田警察署');
  await expect(page.locator('#police2Name')).toHaveValue('須坂警察署');
  await expect(page.locator('#police3Name')).toHaveValue('長野原警察署');
});

test('itinerary stays at normal reading size while page one has room', async ({ page }) => {
  await page.goto('/');
  await seedPlan(page);
  await page.evaluate(() => {
    window.__tozanApp.state.itinerary = [
      {time:'06:30',place:'雨飾高原登山口',major:true,restMinutes:0},
      {time:'06:30',place:'雨飾高原登山口トイレ',major:true,restMinutes:0},
      {time:'06:30',place:'雨飾高原キャンプ場駐車場',major:true,restMinutes:0},
      {time:'08:05',place:'標高1445m地点',major:true,restMinutes:0},
      {time:'09:35',place:'笹平',major:true,restMinutes:0},
      {time:'10:05',place:'雨飾山',major:true,restMinutes:0},
      {time:'10:30',place:'笹平',major:true,restMinutes:0},
      {time:'11:30',place:'標高1445m地点',major:true,restMinutes:0},
      {time:'12:50',place:'雨飾高原登山口',major:true,restMinutes:0},
      {time:'12:50',place:'雨飾高原キャンプ場駐車場',major:true,restMinutes:0}
    ];
    window.__tozanApp.renderDocument();
    window.__tozanApp.fitJourneyToPage();
  });
  const page1=page.locator('.doc-page[data-page="1"]');
  const box=page.locator('.doc-page[data-page="1"] .journey-box');
  const fits=await page1.evaluate(el=>el.scrollHeight<=el.clientHeight+1);
  expect(fits).toBe(true);
  await expect(box).not.toHaveClass(/journey-box--dense/);
  const fontSize=await box.evaluate(el=>parseFloat(getComputedStyle(el).fontSize));
  expect(fontSize).toBeGreaterThanOrEqual(13);
  await page1.screenshot({path:'test-results/page-1-readable-itinerary.png'});
});

test('simplified Carbon flow keeps editable auto-filled fields and generates a three-page PDF', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.progress__step')).toHaveCount(3);
  await expect(page.getByRole('button',{name:'基本情報'})).toBeVisible();
  await expect(page.getByRole('button',{name:'YAMAP'})).toBeVisible();
  await expect(page.getByRole('button',{name:'確認'})).toBeVisible();
  await expect(page.locator('.cds-header a')).toHaveCount(0);
  await expect(page.locator('.fixed-panel')).toHaveCount(0);
  await expect(page.locator('.summary-strip')).toHaveCount(0);
  await expect(page.getByText('市町村',{exact:true})).toHaveCount(1);
  await expect(page.locator('#drinkLiters')).toHaveValue('2.0');

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

  const normalized=await page.evaluate(()=>normalizeVisionResult({
    itinerary:[{time:'7:00',place:'菅平牧場公衆トイレ',major:true},{time:'9:00',place:'根子岳',major:true}],
    municipalities:['長野県上田市','須坂市','群馬県嬬恋村'],warnings:[]
  }).itinerary.map(row=>row.time));
  expect(normalized).toEqual(['07:00','09:00']);

  const deterministicArea=await page.evaluate(()=>municipalityArea(
    ['長野県上田市','須坂市','群馬県嬬恋村'],
    '志賀高原・菅平高原山域 / 長野県上田市・須坂市・群馬県嬬恋村'
  ));
  expect(deterministicArea).toBe('上田市・須坂市・嬬恋村');
  expect(deterministicArea).not.toContain('志賀高原');

  const borderPolice=await page.evaluate(()=>window.__tozanApp.resolveNaganoPoliceStations(['上田市','須坂市','嬬恋村'],'').stations);
  expect(borderPolice).toEqual([
    {name:'上田警察署',phone:'0268-22-0110'},
    {name:'須坂警察署',phone:'026-246-0110'},
    {name:'長野原警察署',phone:'0279-82-0110'}
  ]);

  await seedPlan(page);
  await expect(page.locator('.step[data-step="3"]')).toBeVisible();
  await expect(page.locator('#areaMunicipality')).toHaveValue('上田市・須坂市・嬬恋村');
  await expect(page.locator('#police1Name')).toHaveValue('上田警察署');
  await expect(page.locator('#police1Phone')).toHaveValue('0268-22-0110');
  await expect(page.locator('#police2Name')).toHaveValue('須坂警察署');
  await expect(page.locator('#police3Name')).toHaveValue('長野原警察署');
  await expect(page.locator('#police-secondary')).toBeVisible();
  await expect(page.locator('#police-tertiary')).toBeVisible();

  await page.fill('#areaMunicipality','上田市・嬬恋村');
  await page.fill('#police1Name','確認後の警察署');
  await page.fill('#police1Phone','000-0000-0000');
  await page.fill('#police2Name','確認後の第二管轄');
  await expect(page.locator('#areaMunicipality')).toHaveValue('上田市・嬬恋村');
  await expect(page.locator('#police1Name')).toHaveValue('確認後の警察署');
  await expect(page.locator('#police1Phone')).toHaveValue('000-0000-0000');
  await expect(page.locator('#police2Name')).toHaveValue('確認後の第二管轄');

  await page.fill('#areaMunicipality','上田市・須坂市・嬬恋村');
  await expect(page.locator('#police1Name')).toHaveValue('確認後の警察署');
  await expect(page.locator('#police2Name')).toHaveValue('確認後の第二管轄');
  await page.fill('#police1Name','上田警察署');
  await page.fill('#police1Phone','0268-22-0110');
  await page.fill('#police2Name','須坂警察署');

  await expect(page.locator('#route-preview img')).toHaveCount(1);
  await page.screenshot({path:'test-results/ui-desktop.png',fullPage:true});

  await page.evaluate(()=>window.__tozanApp.renderDocument());
  await expect(page.locator('.doc-page')).toHaveCount(3);
  await expect(page.locator('.doc-page[data-page="1"]')).toContainText('根子岳・四阿山（上田市・須坂市・嬬恋村）');
  await expect(page.locator('.doc-page[data-page="1"]')).not.toContainText('志賀高原');
  await expect(page.locator('.doc-page[data-page="2"] .gear-box')).toHaveCount(0);
  await expect(page.locator('.doc-page[data-page="3"] .gear-box')).toHaveCount(1);
  await expect(page.locator('.doc-page[data-page="3"] .contact-list p')).toHaveCount(7);
  await expect(page.locator('.doc-page[data-page="3"] .contact-list')).toContainText('長野原警察署');
  const page3Fits=await page.locator('.doc-page[data-page="3"]').evaluate(el=>el.scrollHeight<=el.clientHeight+1);
  expect(page3Fits).toBe(true);
  const routeBox=await page.locator('.doc-page[data-page="2"] .route-image-frame').boundingBox();
  expect(routeBox?.height||0).toBeGreaterThan(650);
  await page.locator('.doc-page[data-page="1"]').screenshot({path:'test-results/page-1.png'});
  await page.locator('.doc-page[data-page="2"]').screenshot({path:'test-results/page-2.png'});
  await page.locator('.doc-page[data-page="3"]').screenshot({path:'test-results/page-3.png'});

  const downloadPromise=page.waitForEvent('download');
  await page.getByRole('button',{name:'PDFを共有'}).click();
  const download=await downloadPromise;
  const output='test-results/generated-plan.pdf';
  await download.saveAs(output);
  const data=fs.readFileSync(output);
  expect(data.length).toBeGreaterThan(100_000);
  expect(pdfPageCount(data)).toBe(3);
});

test('share-capable mobile browser opens native PDF share without losing uploads', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator,'canShare',{configurable:true,value:({files})=>Array.isArray(files)&&files.length===1&&files[0].type==='application/pdf'});
    Object.defineProperty(navigator,'share',{configurable:true,value:async data=>{
      window.__sharedPdf={name:data.files?.[0]?.name,size:data.files?.[0]?.size,type:data.files?.[0]?.type};
    }});
  });
  await page.goto('/');
  await seedPlan(page);
  await page.evaluate(() => {
    const app=window.__tozanApp;
    const image=app.state.routeImage;
    app.state.uploads=[
      {id:'route-test',name:'route.png',url:image,kind:'route',classification:'route',routeSource:true},
      {id:'itin-test',name:'itinerary.png',url:image,kind:'itinerary',classification:'itinerary',routeSource:false}
    ];
  });
  const beforeUrl=page.url();
  const beforeCount=await page.evaluate(()=>window.__tozanApp.state.uploads.length);
  await page.getByRole('button',{name:'PDFを共有'}).click();
  await expect.poll(()=>page.evaluate(()=>window.__sharedPdf||null)).not.toBeNull();
  const shared=await page.evaluate(()=>window.__sharedPdf);
  expect(shared.type).toBe('application/pdf');
  expect(shared.size).toBeGreaterThan(100_000);
  expect(page.url()).toBe(beforeUrl);
  expect(await page.evaluate(()=>window.__tozanApp.state.uploads.length)).toBe(beforeCount);
  await expect(page.locator('#route-preview img')).toHaveCount(1);
});

test('mobile layout has no horizontal page overflow', async ({ page }) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto('/');
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await page.screenshot({path:'test-results/ui-mobile.png',fullPage:true});
});
