import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const TEST_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAAtklEQVR42u3UQQ0AIAwEsAlIQzcKEYIVXr0UkSk/NklpKh8gUhFRARERFRARUQEREQsiIiIiKiAioqIiouIiqgIiIqLiIqICKKqLiIiKiAioqIiouIiqgIiIqLiIqICKKqLiIiKiAioqIiouIiqgIiIqLiIqICKKqLiIiKiAioqIiouIiqgIiIqLiIqICKKqLiIiKiAioqIiouIiqgIiIqLiIqICKKqLiIiKiAioqIiouIiqgIiIqLiIqAAA=',
  'base64'
);
const tmpImg = path.join(os.tmpdir(), 'wc-test.png');
fs.writeFileSync(tmpImg, TEST_PNG);

test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (e) => console.error('[pageerror]', e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') console.log('[browser:error]', m.text());
  });
});

test('admin page loads with seeded gallery', async ({ page }) => {
  await page.goto('/admin.html');
  await expect(page.locator('#gallery-name')).toHaveValue(/.+/);
  await expect(page.locator('#artwork-rows tr')).toHaveCount(10);
  await expect(page.locator('.slot-group')).toHaveCount(10);
});

test('add → list → detail via API for new artwork', async ({ page, request }) => {
  await page.goto('/admin.html');
  await page.click('#add-artwork');
  await page.waitForSelector('#modal.open');

  await page.fill('#f-no', '99');
  await page.fill('#f-title', 'Smoke Test Artwork');
  await page.fill('#f-artist', 'Playwright');
  await page.fill('#f-year', '2026');
  await page.fill('#f-medium', 'Pixel');
  await page.fill('#f-dim', '100 × 100 cm');
  await page.fill('#f-desc', 'Created by smoke test.');
  await page.setInputFiles('#f-image', tmpImg);
  await page.waitForFunction(() => {
    const p = document.getElementById('image-preview');
    return p && p.style.display !== 'none';
  }, null, { timeout: 5000 });

  await page.click('#modal-save');
  await expect(page.locator('#toast.visible')).toContainText('저장');
  await expect(page.locator('#artwork-rows tr')).toHaveCount(11);
  await expect(
    page.locator('#artwork-rows tr td:nth-child(3)', { hasText: 'Smoke Test Artwork' })
  ).toBeVisible();

  // verify via API
  const resp = await request.get('/api/galleries');
  expect(resp.ok()).toBeTruthy();
  const state = await resp.json();
  const g = state.galleries.find(g => g.id === state.activeGalleryId);
  const created = g.artworks.find(a => a.title === 'Smoke Test Artwork');
  expect(created).toBeTruthy();
  expect(created.imageId).toBeTruthy();

  const img = await request.get(`/api/images/${created.imageId}`);
  expect(img.ok()).toBeTruthy();
  expect(img.headers()['content-type']).toMatch(/^image\//);
  const body = await img.body();
  expect(body.length).toBeGreaterThan(0);
});

test('edit existing artwork', async ({ page }) => {
  await page.goto('/admin.html');
  const row = page.locator('#artwork-rows tr', { has: page.locator('td:nth-child(3)', { hasText: 'Smoke Test Artwork' }) });
  await row.locator('button.btn-ghost').click();
  await page.waitForSelector('#modal.open');
  await expect(page.locator('#f-title')).toHaveValue('Smoke Test Artwork');
  await page.fill('#f-title', 'Smoke Test Artwork (edited)');
  await page.click('#modal-save');
  await expect(
    page.locator('#artwork-rows tr td:nth-child(3)', { hasText: 'Smoke Test Artwork (edited)' })
  ).toBeVisible();
});

test('delete the test artwork', async ({ page }) => {
  await page.goto('/admin.html');
  page.once('dialog', d => d.accept());
  const row = page.locator('#artwork-rows tr', { has: page.locator('td:nth-child(3)', { hasText: /Smoke Test Artwork/ }) });
  await row.locator('button.btn-danger').click();
  await expect(page.locator('#artwork-rows tr')).toHaveCount(10);
});

test('viewer splash + gallery list', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#splash-name')).not.toBeEmpty();
  await expect(page.locator('#gallery-list button.gallery-card').first()).toBeVisible();
});

test('health endpoint', async ({ request }) => {
  const r = await request.get('/api/health');
  expect(r.ok()).toBeTruthy();
  expect(await r.json()).toEqual({ ok: true });
});
