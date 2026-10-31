import { expect, test } from '@playwright/test';

test('standalone app keeps its legacy browser compatibility exports', async ({ page }) => {
  await page.goto('/tozan-keikaku-syo-maker/');
  await page.waitForFunction(() => window.__tozanApp?.draftRuntime);

  const exports = await page.evaluate(() => ({
    normalizeVisionResult: typeof window.normalizeVisionResult,
    municipalityArea: typeof window.municipalityArea,
    applyPoliceFromRoute: typeof window.applyPoliceFromRoute,
    getPreparedFile: typeof window.__tozanShare?.getPreparedFile,
    markDirty: typeof window.__tozanShare?.markDirty,
  }));

  expect(exports).toEqual({
    normalizeVisionResult: 'function',
    municipalityArea: 'function',
    applyPoliceFromRoute: 'function',
    getPreparedFile: 'function',
    markDirty: 'function',
  });
});
