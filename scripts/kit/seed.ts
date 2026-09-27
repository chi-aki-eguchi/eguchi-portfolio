import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { lab, dir, slots, assertLab, sha } from './local';
assertLab();
const origin = `http://127.0.0.1:${slots.sample.port}`;
const { password } = JSON.parse(readFileSync(join(dir('sample'), 'access.json'), 'utf8'));
const response = await fetch(`${origin}/api/admin/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password }) });
if (!response.ok) throw new Error('Local login failed');
const cookie = response.headers.get('set-cookie')!.split(';')[0];
async function api(path: string, method = 'GET', data?: unknown) {
  const result = await fetch(origin + '/api' + path, { method, headers: { cookie, ...(data instanceof FormData ? {} : { 'content-type': 'application/json' }) }, ...(method === 'GET' ? {} : { body: data instanceof FormData ? data : data === undefined ? undefined : JSON.stringify(data) }) });
  if (!result.ok) throw new Error(`${method} ${path}: ${result.status} ${await result.text()}`);
  return result.json();
}
const settings = await api('/settings');
if (settings.siteName !== 'Photographer Name' && settings.siteName !== 'LAND / ARCHIVE') throw new Error('Not the sample site; refusing to overwrite');
if (existsSync(join(dir('sample'), 'seed.json'))) { console.log('Already initialized: preserving customer edits; no writes performed.'); process.exit(0); }
const sources = JSON.parse(readFileSync(join(lab, 'materials/sources.json'), 'utf8'));
const existing = await api('/photos?all=1');
const photos = Array.isArray(existing) ? existing : existing.photos;
const titles = ['川の曲線 / Snake River', '山と平野 / Signal Mountain', '峡谷の奥へ / Colorado River'];
const ids: number[] = [];
for (const [i, source] of sources.entries()) {
  const filename = source.file;
  const found = photos.find((p: { filename: string }) => p.filename === filename);
  let photo = found;
  if (!photo) {
    const bytes = readFileSync(join(lab, 'materials', filename));
    if (sha(bytes) !== source.sha256) throw new Error('Source checksum mismatch');
    const data = new FormData(); data.append('file', new Blob([bytes], { type: 'image/jpeg' }), filename);
    const uploaded = await api('/admin/upload', 'POST', data);
    if (uploaded.duplicate) throw new Error('Unmatched duplicate: review partial setup before continuing');
    const result = await api('/admin/photos', 'POST', { ...uploaded, filename, title: titles[i] });
    photo = result.photo ?? result;
  }
  ids.push(photo.id);
  await api(`/admin/photos/${photo.id}`, 'PATCH', { isPublished: true, title: titles[i], description: 'Ansel Adams / National Park Service. Public-domain archive image. 説明用見本・顧客実績ではありません。' });
}
await api('/admin/settings', 'POST', {
  siteName: 'LAND / ARCHIVE', siteNameEn: 'LAND / ARCHIVE', siteUrl: origin,
  siteDescription: '風景を読む。公的アーカイブ写真によるPortfolio Kitの納品見本。顧客実績ではありません。',
  profileName: 'LAND / ARCHIVE', profileNameEn: 'LAND / ARCHIVE',
  profileBio: '風景のかたち、光、そして遠くへ続く線。\n\nこれはPortfolio Kitの説明用見本です。写真はAnsel AdamsがNational Park Serviceの職務として撮影した公的アーカイブ資料を使用しています。実在の顧客や納品実績を表していません。\n\nPhotographs: Ansel Adams / U.S. National Archives, 79-AA-G01, 79-AA-G09, 79-AAB-10. Public domain. https://commons.wikimedia.org/wiki/File:Ansel_Adams_-_National_Archives_79-AA-G01.jpg',
  profileBioEn: 'An illustrative Portfolio Kit delivery sample, not a real client. Photographs by Ansel Adams / National Park Service / U.S. National Archives. Public domain archival images. No sales or client endorsement is implied.',
  contactEmail: 'sample@example.invalid', formspreeUrl: '',
  siteDesign: 'book', servicePageMode: 'off', serviceNavMode: 'off', templateCreditLabel: '', templateCreditUrl: '',
});
const series = await api('/series');
const list = Array.isArray(series) ? series : series.series;
if (!list.some((s: { slug: string }) => s.slug === 'landforms')) {
  const created = await api('/admin/series', 'POST', { title: '地形を読む — 川と山のあいだに残る光の記録', slug: 'landforms', description: '公的アーカイブによる説明用シリーズ。Ansel Adams / National Park Service。', isPublished: true });
  const id = (created.series ?? created).id;
  for (const photoId of ids) await api(`/admin/photos/${photoId}`, 'PATCH', { seriesId: id });
}
const hero = await api('/hero-photos');
for (const photoId of ids) if (!hero.heroPhotos.some((p: { id: number }) => p.id === photoId)) await api('/admin/hero-photos', 'POST', { photoId });
writeFileSync(join(dir('sample'), 'seed.json'), JSON.stringify({ completedAt: new Date().toISOString(), photos: ids, sources }, null, 2));
console.log(`Sample configured: ${ids.length} photographs. Re-running preserves IDs and prevents duplicate registration.`);
