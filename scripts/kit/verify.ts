import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { strict as assert } from 'node:assert';
import { lab, dir, slots, slot, assertLab, sql, dbName } from './local';
const target = slot(process.argv[2] ?? 'sample');
assertLab();
const origin = `http://127.0.0.1:${slots[target].port}`;
const evidence = join(lab, 'evidence', target); mkdirSync(evidence, { recursive: true });
const results: { check: string; status: string; detail?: unknown }[] = [];
const pass = (check: string, detail?: unknown) => results.push({ check, status: 'PASS', detail });
const { password } = JSON.parse(readFileSync(join(dir(target), 'access.json'), 'utf8'));
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' });
const errors: string[] = [];
await context.route('**/*', route => {
  const url = new URL(route.request().url());
  return url.origin === origin || ['blob:', 'data:'].includes(url.protocol) ? route.continue() : route.abort();
});
const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
try {
  for (const route of ['/', '/gallery', '/series', '/profile', '/contact', '/series/landforms']) {
    const response = await page.goto(origin + route); assert.equal(response?.status(), 200, route);
    await page.waitForLoadState('networkidle');
    const text = await page.locator('body').innerText();
    assert(!text.includes('江口秋') && !text.includes('akieguchi33'), `Owner identity leak ${route}`);
    const broken = await page.locator('img').evaluateAll(imgs => imgs.filter(i => i.getBoundingClientRect().width && i.complete && !i.naturalWidth).length);
    assert.equal(broken, 0, route);
    await page.screenshot({ path: join(evidence, `${route.replaceAll('/', '-') || 'home'}-desktop.png`), fullPage: true });
  }
  pass('Customer public routes, visible image decoding, no owner identity');
  const html = await (await fetch(origin)).text();
  assert(!html.includes('G-NKECCDLXYD')); assert(html.includes('LAND / ARCHIVE'));
  assert(html.includes(`${origin}/`)); pass('Customer metadata, canonical, analytics');
  assert.equal((await fetch(origin + '/portfolio-kit')).status, 404); pass('Owner sales route excluded');
  assert.equal((await fetch(origin + '/api/admin/pdf/photos')).status, 401); pass('Anonymous PDF access refused');
  await page.goto(origin + '/contact');
  const mail = page.locator('a[href^="mailto:"]'); assert((await mail.first().getAttribute('href'))?.includes('sample@example.invalid'));
  pass('Customer contact address only (no email sent)');
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of ['/', '/gallery', '/series', '/profile', '/contact']) {
    await page.goto(origin + route); await page.waitForLoadState('networkidle');
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Overflow ${route}`);
  }
  await page.screenshot({ path: join(evidence, 'mobile.png'), fullPage: true }); pass('390px emulation, no horizontal overflow');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(origin + '/admin/login');
  await page.locator('input[type=password]').fill(password); await page.locator('button[type=submit]').click();
  await page.waitForSelector('.st-app, .admin-atelier'); pass('Browser login');
  await page.screenshot({ path: join(evidence, 'admin.png'), fullPage: true });
  // Persist actual operations through PostgreSQL, not mocked writes.
  async function api(path: string, method = 'GET', data?: unknown) {
    const result = await context.request.fetch(origin + '/api' + path, { method, data });
    assert(result.ok(), `${path}: ${result.status()} ${await result.text()}`); return result.json();
  }
  const before = await api('/photos?all=1'); const photos = Array.isArray(before) ? before : before.photos;
  assert(photos.length >= 3);
  const privatePhoto = photos.find((p: { isPublished: boolean }) => !p.isPublished);
  if (privatePhoto) {
    assert.equal((await fetch(origin + privatePhoto.url)).status, 404); pass('Unpublished full image not publicly readable');
  }
  if (target === 'sample') {
    const ids = photos.map((p: { id: number }) => p.id);
    await api('/admin/photos/reorder', 'POST', { ids: [...ids].reverse(), expectedIds: ids });
    const after = await api('/photos?all=1'); assert.deepEqual((Array.isArray(after) ? after : after.photos).map((p: { id: number }) => p.id), [...ids].reverse());
    pass('PostgreSQL photo reorder persists');
    await api('/admin/settings', 'POST', { profileBio: '風景のかたち、光、そして遠くへ続く線。\n\n更新リハーサル済み。説明用見本であり、顧客実績ではありません。\nPhotographs: Ansel Adams / National Park Service / U.S. National Archives. Public domain archive images: 79-AA-G01, 79-AA-G09, 79-AAB-10.\nhttps://commons.wikimedia.org/wiki/File:Ansel_Adams_-_National_Archives_79-AA-G01.jpg' });
    assert((await api('/settings')).profileBio.includes('更新リハーサル済み')); pass('PostgreSQL profile save persists');
  }
  await page.goto(origin + '/admin/pdf'); await page.getByLabel('本の名前').waitFor();
  if (target === 'sample' && !existsSync(join(dir(target), 'projects', 'land-archive.json'))) {
    await page.getByLabel('本の名前').fill('地形を読む — 納品見本');
    await page.getByLabel('氏名', { exact: true }).fill('説明用見本 / Ansel Adams');
    await page.locator('.pdf-workflow').getByRole('button', { name: '写真を選ぶ', exact: true }).click();
    for (let n = 0; n < 3; n++) await page.locator('.pdf-picker button').nth(n).click();
    await page.getByRole('button', { name: 'ブラウザーに保存', exact: true }).click();
    const books = await page.evaluate(() => localStorage.getItem('portfolio-pdf.v1.books'));
    assert(books); writeFileSync(join(dir(target), 'projects', 'land-archive.json'), JSON.stringify(JSON.parse(books)[0], null, 2));
  } else {
    await page.locator('input[type=file]').setInputFiles(join(dir(target), 'projects', 'land-archive.json'));
    await page.waitForFunction(() => Array.from(document.querySelectorAll('input')).some(el => el.value === '地形を読む — 納品見本'));
    assert.equal(await page.getByLabel('本の名前').inputValue(), '地形を読む — 納品見本');
    pass('Restored PDF JSON reopens with original photo references');
  }
  await page.locator('.pdf-workflow').getByRole('button', { name: 'PDFを書き出す', exact: true }).click();
  const sizes: number[] = [];
  for (const label of ['送信用', '印刷用']) {
    const start = performance.now();
    await page.getByRole('button', { name: label + 'PDFを生成' }).click();
    await page.getByRole('link', { name: 'PDFを保存', exact: true }).waitFor({ timeout: 60000 });
    const wait = page.waitForEvent('download'); await page.getByRole('link', { name: 'PDFを保存', exact: true }).click();
    const download = await wait; const output = join(evidence, label === '送信用' ? 'screen.pdf' : 'print.pdf'); await download.saveAs(output);
    sizes.push(readFileSync(output).length); pass(`${label}PDF generated`, { bytes: sizes.at(-1), milliseconds: Math.round(performance.now() - start) });
  }
  await page.screenshot({ path: join(evidence, 'pdf-editor.png'), fullPage: true });
  await page.evaluate(async () => { const r = await fetch('/api/admin/logout', { method: 'POST' }); if (!r.ok) throw new Error('Logout failed'); });
  assert.equal((await context.request.get(origin + '/api/admin/pdf/photos')).status(), 401);
  await page.goto(origin + '/admin/login'); await page.locator('input[type=password]').fill(password); await page.locator('button[type=submit]').click();
  await page.waitForSelector('.st-app, .admin-atelier'); pass('Logout, access refusal and re-login');
  assert.equal(errors.length, 0, errors.join('\n')); pass('No JavaScript exceptions');
  const snapshot = sql(dbName(target), "SELECT json_build_object('photos',(SELECT json_agg(p ORDER BY id) FROM photos p),'series',(SELECT json_agg(s ORDER BY id) FROM series s),'settings',(SELECT json_agg(t ORDER BY key) FROM site_settings t WHERE key <> 'siteUrl'),'memberships',(SELECT json_agg(m ORDER BY series_id,photo_id) FROM series_photos m))");
  writeFileSync(join(evidence, 'database-content.json'), snapshot);
} catch (error) {
  // Browser transport errors can carry Cookie headers. Record only their class.
  results.push({ check: 'Verification interrupted', status: 'FAIL', detail: (error as Error).name });
  process.exitCode = 1;
} finally {
  writeFileSync(join(evidence, 'verification.json'), JSON.stringify({ time: new Date().toISOString(), target, database: 'PostgreSQL 17, actual local connection', performedBy: 'Codex automation, not the customer', results, errors }, null, 2));
  await browser.close();
}
console.log(JSON.stringify({ target, passed: results.length }));
