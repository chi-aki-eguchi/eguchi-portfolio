import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { strict as assert } from 'node:assert';
import { dir, lab, assertLab } from './local';
assertLab();
const origin = 'http://127.0.0.1:5599';
const { password } = JSON.parse(readFileSync(join(dir('sample'), 'access.json'), 'utf8'));
const login = await fetch(origin + '/api/admin/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password }) });
assert(login.ok); const cookie = login.headers.get('set-cookie')!.split(';')[0];
async function api(path: string, method = 'GET', data?: unknown) {
 const r = await fetch(origin + '/api' + path, { method, headers: { cookie, 'content-type': 'application/json' }, ...(method === 'GET' ? {} : { body: JSON.stringify(data) }) });
 assert(r.ok, `${method} ${path}: ${r.status}`); return r.json();
}
const { photos } = await api('/photos?all=1');
const hidden = photos.find((p: { isPublished: boolean }) => p.isPublished === false); assert(hidden);
const paths = [hidden.url, hidden.thumbUrl, hidden.mediumUrl].filter(Boolean);
const checks: string[] = [];
for (const path of paths) {
 for (const suffix of ['', '?w=320&fmt=webp']) {
  const authed = await fetch(origin + path + suffix, { headers: { cookie } }); assert.equal(authed.status, 200); await authed.arrayBuffer();
  assert(authed.headers.get('cache-control')?.includes('no-store'));
  const unauth = await fetch(origin + path + suffix); assert.equal(unauth.status, 404);
 }
}
checks.push('Private originals/derivatives/transforms refuse anonymous access after authenticated cache warm');
await api(`/admin/photos/${hidden.id}`, 'PATCH', { isPublished: true });
assert.equal((await fetch(origin + hidden.url)).status, 200);
await api(`/admin/photos/${hidden.id}`, 'PATCH', { isPublished: false });
assert.equal((await fetch(origin + hidden.url)).status, 404);
assert.equal((await fetch(origin + hidden.url, { method: 'HEAD' })).status, 404);
checks.push('Publish -> warm public cache -> unpublish immediately revokes GET and HEAD');
const health = async () => (await (await fetch(origin + '/api/health')).json()).mem;
const before = await health();
const runs = [];
const ids = photos.filter((p: { isPublished: boolean }) => p.isPublished).map((p: { id: number }) => p.id);
for (let n = 0; n < 12; n++) {
 const start = performance.now(); let bytes = 0;
 for (let batch = 0; batch < 5; batch++) await Promise.all(Array.from({ length: 4 }, async (_, i) => {
   const r = await fetch(`${origin}/api/admin/pdf/photos/${ids[(batch * 4 + i) % ids.length]}/image?quality=print`, { headers: { cookie } }); assert(r.ok); bytes += (await r.arrayBuffer()).byteLength;
 }));
 const memory = await health(); assert.equal(memory.activeImageTransforms, 0); assert.equal(memory.queuedImageTransforms, 0);
 runs.push({ round: n + 1, requests: 20, concurrency: 4, bytes, milliseconds: Math.round(performance.now() - start), memory });
}
const controller = new AbortController();
const pending = fetch(`${origin}/api/admin/pdf/photos/${ids[0]}/image?quality=print`, { headers: { cookie }, signal: controller.signal }).catch(() => null); controller.abort(); await pending;
const missing = await fetch(origin + '/api/admin/pdf/photos/999999/image?quality=print', { headers: { cookie } }); assert.equal(missing.status, 404);
await new Promise(r => setTimeout(r, 1000)); const final = await health();
assert.equal(final.activeImageTransforms, 0); assert.equal(final.queuedImageTransforms, 0);
checks.push('Repeated transforms, abort and missing image release shared queue');
writeFileSync(join(lab, 'security-load.json'), JSON.stringify({ time: new Date().toISOString(), input: '3 public-domain photographs, max 3000px, 20 image requests per round (not 20 distinct original files)', checks, before, runs, final, limitation: 'Short local run, not cloud cost or long-term leak proof. Fake S3 is loopback only; real bucket privacy needs cloud verification.' }, null, 2));
console.log('Security and load checks passed');
