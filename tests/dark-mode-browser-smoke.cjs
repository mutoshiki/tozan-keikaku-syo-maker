const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');

const html = fs.readFileSync(path.join('dist', 'index.html'), 'utf8');
const out = path.join(process.cwd(), 'dark-mode-browser-evidence');
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
  await page.getByRole('heading', { name: '登山計画書を、YAMAPから。', level: 1 }).waitFor({ timeout: 60000 });
  await page.getByRole('button', { name: 'ダークモードに切り替え' }).waitFor({ timeout: 60000 });
  await page.waitForFunction(() => document.documentElement.getAttribute('data-carbon-theme') === 'white');

  const initial = await page.evaluate(() => ({
    carbonInputs: document.querySelectorAll('.cds--text-input').length,
    carbonButtons: document.querySelectorAll('.cds--btn').length,
    overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    heading: document.querySelector('.hero-band h1')?.textContent?.trim() || '',
  }));
  if (initial.heading !== '登山計画書を、YAMAPから。') throw new Error(`${name}: hero heading regression`);
  if (initial.carbonInputs < 8 || initial.carbonButtons < 3) throw new Error(`${name}: expected Carbon controls are missing`);
  if (initial.overflowX > 1) throw new Error(`${name}: initial horizontal overflow ${initial.overflowX}px`);

  await page.getByRole('button', { name: 'ダークモードに切り替え' }).click();
  await page.waitForFunction(() => document.documentElement.getAttribute('data-carbon-theme') === 'g100');
  await page.getByRole('button', { name: 'ライトモードに切り替え' }).waitFor();

  const dark = await page.evaluate(() => {
    const toggle = document.querySelector('.theme-toggle-host .cds--btn')?.getBoundingClientRect();
    const headerName = document.querySelector('.cds--header__name')?.getBoundingClientRect();
    const input = document.querySelector('#mountain');
    const themeValues = [...document.querySelectorAll('[data-carbon-theme]')].map(node => node.getAttribute('data-carbon-theme'));
    return {
      rootTheme: document.documentElement.getAttribute('data-carbon-theme'),
      storedTheme: localStorage.getItem('sanpokai-ui-theme-v1'),
      themeValues,
      overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      bodyBackground: getComputedStyle(document.body).backgroundColor,
      contentBackground: getComputedStyle(document.querySelector('.content-frame')).backgroundColor,
      inputBackground: input ? getComputedStyle(input).backgroundColor : '',
      toggle: toggle ? { x: toggle.x, y: toggle.y, width: toggle.width, height: toggle.height, right: toggle.right } : null,
      headerName: headerName ? { right: headerName.right } : null,
    };
  });

  if (dark.rootTheme !== 'g100' || dark.storedTheme !== 'dark') throw new Error(`${name}: dark theme did not apply/persist`);
  if (dark.themeValues.some(value => value !== 'g100')) throw new Error(`${name}: nested Carbon theme stayed light: ${dark.themeValues.join(',')}`);
  if (dark.overflowX > 1) throw new Error(`${name}: dark mode horizontal overflow ${dark.overflowX}px`);
  if (!dark.toggle || dark.toggle.width < 44 || dark.toggle.height < 44 || dark.toggle.y < -0.5 || dark.toggle.right > viewport.width + 0.5) throw new Error(`${name}: theme toggle is not a stable 44px+ header target`);
  if (dark.headerName && dark.toggle.x < dark.headerName.right) throw new Error(`${name}: theme toggle overlaps header name`);
  if (dark.bodyBackground === 'rgb(255, 255, 255)' || dark.contentBackground === 'rgb(255, 255, 255)' || dark.inputBackground === 'rgb(255, 255, 255)') throw new Error(`${name}: a primary surface stayed white in dark mode`);

  await page.fill('#date', '2026-09-24');
  await page.fill('#mountain', 'QA山');
  await page.fill('#area', '長野市');
  await page.fill('#sid', '24T0000A');
  await page.fill('#pname', 'QA企画者');
  await page.fill('#pphone', '09000000000');
  await page.fill('#bname', 'QA留守本部');
  await page.fill('#bphone', '09011111111');
  await page.getByRole('button', { name: '次へ' }).click();
  await page.getByRole('heading', { name: 'YAMAPスクリーンショット', level: 2 }).waitFor();
  await page.getByRole('button', { name: '読み取らず次へ' }).click();
  await page.getByRole('heading', { name: '読み取り結果を確認', level: 2 }).waitFor();
  await page.getByRole('button', { name: '次へ' }).click();
  await page.getByRole('heading', { name: '提出前プレビュー', level: 2 }).waitFor();

  const preview = await page.evaluate(() => {
    const doc = document.querySelector('.doc-page');
    return {
      overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      theme: localStorage.getItem('sanpokai-ui-theme-v1'),
      docBackground: doc ? getComputedStyle(doc).backgroundColor : '',
      docColor: doc ? getComputedStyle(doc).color : '',
      docCount: document.querySelectorAll('.doc-page').length,
    };
  });
  if (preview.theme !== 'dark') throw new Error(`${name}: dark preference changed during wizard flow`);
  if (preview.overflowX > 1) throw new Error(`${name}: preview caused document overflow ${preview.overflowX}px`);
  if (preview.docCount !== 3) throw new Error(`${name}: expected 3 preview pages, got ${preview.docCount}`);
  if (preview.docBackground !== 'rgb(255, 255, 255)') throw new Error(`${name}: printable preview must stay white in dark mode`);

  if (pageErrors.length) throw new Error(`${name}: page errors: ${pageErrors.join(' | ')}`);
  if (consoleErrors.length) throw new Error(`${name}: console errors: ${consoleErrors.join(' | ')}`);

  await page.screenshot({ path: path.join(out, `${name}-dark.png`), fullPage: true });
  fs.writeFileSync(path.join(out, `${name}.json`), JSON.stringify({ viewport, initial, dark, preview, pageErrors, consoleErrors }, null, 2));
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
  console.log('Plan maker isolated dark-mode browser smoke passed.');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
