import { test, expect } from '@playwright/test';
import { encodeProjectContext } from '../src/project-handoff.js';

const context = { roomId: 'ROOM-42', projectName: '秋名山登山企画', eventDate: '2026-11-02' };

test('shows received project metadata and imports the event date only after confirmation', async ({ page }) => {
  await page.goto(`/#${encodeProjectContext(context).slice(1)}`);

  await expect(page.getByRole('heading', { name: '企画情報を受け取りました' })).toBeVisible();
  await expect(page.getByText('企画名：秋名山登山企画')).toBeVisible();
  await expect(page.locator('#eventDate')).toHaveValue('');
  await page.getByRole('button', { name: '実施日に反映' }).click();

  await expect(page.locator('#eventDate')).toHaveValue('2026-11-02');
  await expect(page.getByRole('status')).toContainText('秋名山登山企画から実施日を反映しました。');
  await expect(page).toHaveURL(/#?$/);
});

test('does not overwrite an event date entered before confirming the import', async ({ page }) => {
  await page.goto(`/#${encodeProjectContext(context).slice(1)}`);
  await page.locator('#eventDate').fill('2026-11-03');

  await page.getByRole('button', { name: '実施日に反映' }).click();

  await expect(page.locator('#eventDate')).toHaveValue('2026-11-03');
  await expect(page.getByRole('status')).toContainText('すでに入力されています。入力内容を保ちました。');
});

test('dismisses the imported context without changing form values', async ({ page }) => {
  await page.goto(`/#${encodeProjectContext(context).slice(1)}`);
  await page.locator('#eventDate').fill('2026-11-04');

  await page.getByRole('button', { name: '今回は使わない' }).click();

  await expect(page.locator('#eventDate')).toHaveValue('2026-11-04');
  await expect(page.getByRole('heading', { name: '企画情報を受け取りました' })).toHaveCount(0);
  await expect(page.getByRole('status')).toContainText('企画情報は反映していません。');
  await expect(page).toHaveURL(/#?$/);
});
