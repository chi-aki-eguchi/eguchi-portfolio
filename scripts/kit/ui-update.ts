import { chromium } from 'playwright';
import sharp from 'sharp';
import { strict as assert } from 'node:assert';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { lab, dir, assertLab } from './local';
assertLab();
const origin = 'http://127.0.0.1:5599';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' });
await page.route('**/*', r => new URL(r.request().url()).origin === origin ? r.continue() : r.abort());
const { password } = JSON.parse(readFileSync(join(dir('sample'), 'access.json'), 'utf8'));
const checks: string[] = [];
try {
  await page.goto(origin + '/admin/login'); await page.locator('input[type=password]').fill(password); await page.locator('button[type=submit]').click();
  await page.waitForSelector('.st-tile');
  let photos = await page.evaluate(async () => (await (await fetch('/api/photos?all=1')).json()).photos);
  let added = photos.find((p: { filename: string }) => p.filename.startsWith('private-test-'));
  if (!added) {
    const image = await sharp({ create: { width: 800, height: 1200, channels: 3, background: '#ae9982' } }).jpeg().toBuffer();
    const registration = page.waitForResponse(r => r.url().endsWith('/api/admin/photos') && r.request().method() === 'POST');
    await page.locator('input[type=file]').first().setInputFiles({ name: `private-test-${Date.now()}.jpg`, mimeType: 'image/jpeg', buffer: image });
    assert((await registration).ok());
    await page.reload(); await page.waitForSelector('.st-tile');
    photos = await page.evaluate(async () => (await (await fetch('/api/photos?all=1')).json()).photos);
    added = photos.find((p: { filename: string }) => p.filename.startsWith('private-test-'));
  }
  assert(added && added.isPublished === false); checks.push('UI photograph upload persisted as private');
  for (const path of [added.url, added.thumbUrl, added.mediumUrl].filter(Boolean)) {
    const response = await fetch(new URL(path, origin)); assert([401,403,404].includes(response.status), 'Private image leaked');
  }
  checks.push('Anonymous full image and derivatives denied');
  await page.locator(`.st-tile[data-photo-id="${added.id}"]`).click();
  const pub = page.getByRole('button', { name: '公開', exact: true });
  if (await pub.count()) { await pub.first().click(); await page.waitForTimeout(700); }
  const tiles = page.locator('.st-tile');
  const ids = await tiles.evaluateAll(es => es.map(e => e.getAttribute('data-photo-id')));
  await tiles.nth(0).dragTo(tiles.nth(2), { targetPosition: { x: 4, y: 20 } });
  await page.waitForTimeout(1000); await page.reload(); await page.waitForSelector('.st-tile');
  const after = await page.locator('.st-tile').evaluateAll(es => es.map(e => e.getAttribute('data-photo-id')));
  assert.notDeepEqual(after, ids); checks.push('UI drag order survived reload');
  await page.screenshot({ path: join(lab, 'evidence/sample/owner-update.png'), fullPage: true });
  // Keep the artificial image private in the finished sample.
  await page.evaluate(async id => { const r = await fetch(`/api/admin/photos/${id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ isPublished: false }) }); if (!r.ok) throw new Error('Private restore failed'); }, added.id);
  await page.getByRole('button', { name: 'サイト', exact: true }).click();
  await page.getByRole('button', { name: 'About（プロフィール）', exact: true }).click();
  const bio = page.getByLabel('自己紹介', { exact: true });
  const priorBio = await bio.inputValue();
  await bio.fill(priorBio + '\n本人更新のブラウザー操作を技術者が検証。');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await page.waitForTimeout(800); await page.reload();
  await page.getByRole('button', { name: 'サイト', exact: true }).click();
  await page.getByRole('button', { name: 'About（プロフィール）', exact: true }).click();
  assert((await page.getByLabel('自己紹介', { exact: true }).inputValue()).includes('本人更新のブラウザー操作を技術者が検証。'));
  checks.push('UI profile save survived reload');
  writeFileSync(join(lab, 'evidence/sample/ui-update.json'), JSON.stringify({ time: new Date().toISOString(), checks, performedBy: 'Codex browser automation, not a customer', artificialPhotoId: added.id }, null, 2));
  console.log('UI update checks: ' + checks.length);
} catch (error) { await page.screenshot({ path: join(lab, 'evidence/sample/ui-failure.png'), fullPage: true }); writeFileSync(join(lab, 'evidence/sample/ui-failure.txt'), await page.locator('body').innerText()); throw error; } finally { await browser.close(); }
