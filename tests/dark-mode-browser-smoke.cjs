const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');

const html = fs.readFileSync(path.join('dist', 'index.html'), 'utf8');
const out = path.join(process.cwd(), 'dark-mode-browser-evidence');
const THEME_KEY = 'sanpokai-theme-preference-v1';
fs.mkdirSync(out, { recursive: true });

function inlineDistHtml(source) {
  let result = source;
  result = result.replace(/<link\b[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi, (_, href) => {
    const file = path.join('dist', href.replace(/^\/tozan-keikaku-syo-maker\//, '').replace(/^\.\//, '').replace(/^\//, ''));
    return `<style>${fs.readFileSync(file, 'utf8').replace(/<\/style/gi, '<\\/style')}</style>`;
  });
  result = result.replace(/<script\b([^>]*)src=["']([^"']+)["']([^>]*)><\/script>/gi, (_, before, src) => {
    const file = path.join('dist', src.replace(/^\/tozan-keikaku-syo-maker\//, '').replace(/^\.\//, '').replace(/^\//, ''));
    return `<script type="module">${fs.readFileSync(file, 'utf8').replace(/<\/script/gi, '<\\/script')}</script>`;
  });
  return result;
}

const inlined = inlineDistHtml(html);

async function selectTheme(page, currentLabel, id) {
  await page.getByRole('button', { name: `テーマ設定：${currentLabel}` }).click();
  await page.locator(`label[for="${id}"]`).click();
}

async function run(browser, name, viewport) {
  const context = await browser.newContext({ viewport, colorScheme: 'light', isMobile: viewport.width <= 430, hasTouch: viewport.width <= 430 });
  const page = await context.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', error => pageErrors.push(String(error)));
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });

  await page.goto(`about:blank?qa=${encodeURIComponent(name)}`);
  await page.evaluate(() => {
    const store = {};
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: key => Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null,
        setItem: (key, value) => { store[key] = String(value); },
        removeItem: key => { delete store[key]; },
        clear: () => Object.keys(store).forEach(key => delete store[key]),
        key: index => Object.keys(store)[index] ?? null,
        get length() { return Object.keys(store).length; },
      },
    });
  });

  await page.setContent(inlined, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.getByRole('heading', { name: '登山計画書', level: 1 }).waitFor({ timeout: 60000 });
  await page.getByRole('button', { name: 'テーマ設定：システム設定' }).waitFor({ timeout: 60000 });
  await page.waitForFunction(() => document.documentElement.dataset.carbonTheme === 'white');

  const initial = await page.evaluate(() => ({
    overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    heading: document.querySelector('#main-content h1')?.textContent?.trim() || '',
    carbonButtons: document.querySelectorAll('.cds--btn').length,
    eventDateHeight: document.querySelector('#eventDate')?.getBoundingClientRect().height || 0,
  }));
  if (initial.heading !== '登山計画書') throw new Error(`${name}: React heading regression`);
  if (initial.carbonButtons < 4) throw new Error(`${name}: expected Carbon actions are missing`);
  if (initial.eventDateHeight < 44) throw new Error(`${name}: primary field target is too small`);
  if (initial.overflowX > 1) throw new Error(`${name}: initial horizontal overflow ${initial.overflowX}px`);

  await selectTheme(page, 'システム設定', 'theme-dark');
  await page.waitForFunction(() => document.documentElement.dataset.carbonTheme === 'g100');

  const dark = await page.evaluate((key) => {
    window.__tozanApp?.renderDocument?.();
    const root = document.documentElement;
    const appRoot = document.querySelector('.app-theme-root');
    const input = document.querySelector('#eventDate');
    const panel = document.querySelector('.cds--header-panel');
    const doc = document.querySelector('.doc-page');
    return {
      rootTheme: root.dataset.carbonTheme,
      rootClasses: root.className,
      storedTheme: localStorage.getItem(key),
      overflowX: root.scrollWidth - root.clientWidth,
      bodyBackground: getComputedStyle(document.body).backgroundColor,
      appBackground: appRoot ? getComputedStyle(appRoot).backgroundColor : '',
      inputBackground: input ? getComputedStyle(input).backgroundColor : '',
      panelBackground: panel ? getComputedStyle(panel).backgroundColor : '',
      docBackground: doc ? getComputedStyle(doc).backgroundColor : '',
      docColor: doc ? getComputedStyle(doc).color : '',
      docCount: document.querySelectorAll('.doc-page').length,
    };
  }, THEME_KEY);

  if (dark.rootTheme !== 'g100' || dark.storedTheme !== 'dark') throw new Error(`${name}: dark theme did not apply/persist`);
  if (!dark.rootClasses.includes('cds--g100') || !dark.rootClasses.includes('cds--layer-one')) throw new Error(`${name}: Carbon theme classes are missing from the document root`);
  if ([dark.bodyBackground, dark.appBackground, dark.inputBackground, dark.panelBackground].includes('rgb(255, 255, 255)')) throw new Error(`${name}: a primary surface stayed white in dark mode`);
  if (dark.overflowX > 1) throw new Error(`${name}: dark mode horizontal overflow ${dark.overflowX}px`);
  if (dark.docCount !== 3 || dark.docBackground !== 'rgb(255, 255, 255)' || dark.docColor !== 'rgb(17, 17, 17)') throw new Error(`${name}: printable three-page preview must stay paper-white`);

  await selectTheme(page, 'ダーク', 'theme-light');
  await page.waitForFunction(() => document.documentElement.dataset.carbonTheme === 'white');
  if (await page.evaluate((key) => localStorage.getItem(key), THEME_KEY) !== 'light') throw new Error(`${name}: light preference did not persist`);

  if (pageErrors.length) throw new Error(`${name}: page errors: ${pageErrors.join(' | ')}`);
  if (consoleErrors.length) throw new Error(`${name}: console errors: ${consoleErrors.join(' | ')}`);

  await selectTheme(page, 'ライト', 'theme-dark');
  await page.waitForFunction(() => document.documentElement.dataset.carbonTheme === 'g100');
  await page.screenshot({ path: path.join(out, `${name}-dark.png`), fullPage: true });
  fs.writeFileSync(path.join(out, `${name}.json`), JSON.stringify({ viewport, initial, dark, pageErrors, consoleErrors }, null, 2));
  await context.close();
}

(async () => {
  fs.mkdirSync(process.env.CHROMIUM_POLICY_DIR || '/tmp/empty-chromium-policy', { recursive: true });
  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-background-networking', '--disable-default-apps'],
    env: { ...process.env, CHROMIUM_POLICY_DIR: process.env.CHROMIUM_POLICY_DIR || '/tmp/empty-chromium-policy' },
  });
  try {
    await run(browser, 'mobile-390x844', { width: 390, height: 844 });
    await run(browser, 'desktop-1280x900', { width: 1280, height: 900 });
  } finally {
    await browser.close();
  }
  console.log('Plan maker isolated Carbon theme browser smoke passed.');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
