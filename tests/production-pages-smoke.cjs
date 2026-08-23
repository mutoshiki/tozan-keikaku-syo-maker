const fs = require('fs');
const { chromium } = require('@playwright/test');

const LIVE_URL = process.env.LIVE_URL || 'https://mutoshiki.github.io/tozan-keikaku-syo-maker/';
const OUT = process.env.SMOKE_OUT || 'production-pages-evidence';
fs.mkdirSync(OUT, { recursive: true });

async function openWithRetry(page) {
  let lastError;
  for (let attempt = 1; attempt <= 12; attempt += 1) {
    try {
      const response = await page.goto(LIVE_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
      if (response && response.status() >= 400) throw new Error(`HTTP ${response.status()}`);
      await page.getByRole('heading', { name: '登山計画書', level: 1 }).waitFor({ timeout: 10000 });
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < 12) await page.waitForTimeout(5000);
    }
  }
  throw lastError;
}

async function waitForTheme(page, theme) {
  await page.waitForFunction(expected => document.documentElement.dataset.carbonTheme === expected, theme, { timeout: 10000 });
  await page.evaluate(async () => {
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const animations = document.documentElement.getAnimations({ subtree: true });
    await Promise.all(animations.map(animation => animation.finished.catch(() => undefined)));
  });
}

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    colorScheme: 'light',
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', error => pageErrors.push(String(error)));
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });

  const response = await openWithRetry(page);
  await waitForTheme(page, 'white');

  const initial = await page.evaluate(() => ({
    title: document.title,
    bodyTextLength: document.body.innerText.trim().length,
    viewportWidth: document.documentElement.clientWidth,
    documentWidth: document.documentElement.scrollWidth,
    background: getComputedStyle(document.body).backgroundColor,
    appBackground: getComputedStyle(document.querySelector('.app-theme-root')).backgroundColor,
    inputCount: document.querySelectorAll('input').length,
    buttonCount: document.querySelectorAll('button').length,
    rootChildren: document.getElementById('root')?.childElementCount || 0,
  }));

  if (initial.rootChildren < 1 || initial.bodyTextLength < 80) throw new Error(`React production app did not render: ${JSON.stringify(initial)}`);
  if (initial.documentWidth > initial.viewportWidth + 1) throw new Error(`mobile overflow ${initial.documentWidth} > ${initial.viewportWidth}`);
  if (initial.inputCount < 5 || initial.buttonCount < 3) throw new Error(`production controls missing: ${JSON.stringify(initial)}`);
  if (pageErrors.length || consoleErrors.length) throw new Error(`production errors: ${[...pageErrors, ...consoleErrors].join(' | ')}`);
  await page.screenshot({ path: `${OUT}/mobile-light.png`, fullPage: true });

  await page.getByRole('button', { name: 'テーマ設定：システム設定' }).click();
  await page.locator('label[for="theme-dark"]').click();
  await waitForTheme(page, 'g100');
  const dark = await page.evaluate(() => ({
    preference: localStorage.getItem('sanpokai-theme-preference-v1'),
    theme: document.documentElement.dataset.carbonTheme,
    bodyBackground: getComputedStyle(document.body).backgroundColor,
    appBackground: getComputedStyle(document.querySelector('.app-theme-root')).backgroundColor,
    textColor: getComputedStyle(document.querySelector('.app-theme-root')).color,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }));
  if (dark.preference !== 'dark' || dark.theme !== 'g100') throw new Error(`dark theme failed: ${JSON.stringify(dark)}`);
  if ([dark.bodyBackground, dark.appBackground].includes('rgb(255, 255, 255)')) throw new Error(`white surface leaked in dark production: ${JSON.stringify(dark)}`);
  if (dark.overflow > 1) throw new Error(`dark mobile overflow: ${dark.overflow}`);
  await page.screenshot({ path: `${OUT}/mobile-dark.png`, fullPage: true });

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '登山計画書', level: 1 }).waitFor({ timeout: 15000 });
  await waitForTheme(page, 'g100');
  if (await page.evaluate(() => localStorage.getItem('sanpokai-theme-preference-v1')) !== 'dark') {
    throw new Error('dark preference was not preserved after production reload');
  }

  await page.getByRole('button', { name: 'テーマ設定：ダーク' }).click();
  await page.locator('label[for="theme-system"]').click();
  await page.emulateMedia({ colorScheme: 'dark' });
  await waitForTheme(page, 'g100');
  await page.emulateMedia({ colorScheme: 'light' });
  await waitForTheme(page, 'white');

  const report = {
    status: response?.status() || null,
    url: page.url(),
    initial,
    dark,
    pageErrors,
    consoleErrors,
  };
  fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
})().catch(error => {
  console.error(error);
  process.exit(1);
});
