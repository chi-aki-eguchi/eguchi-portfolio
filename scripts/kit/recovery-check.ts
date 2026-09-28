import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { strict as assert } from 'node:assert';
import { lab, root, dir, slots, sql, dbName, run, files, sha, free, assertLab, slot } from './local';
assertLab();
const target = slot(process.argv[2] ?? 'restored');
assert(target !== 'sample');
const origin = `http://127.0.0.1:${slots[target].port}`;
const current = JSON.parse(readFileSync(join(dir(target), 'active-release.json'), 'utf8')).commit;
const baseline = run('git', ['rev-parse', process.argv[3] ?? 'dc392383']);
const tables = ['photos', 'series', 'series_photos', 'site_settings', 'hero_photos', 'categories', 'pricing_plans'];
const snapshot = (name: 'sample' | 'restored' | 'recovered') => Object.fromEntries(tables.map(table => [table, JSON.parse(sql(dbName(name), `SELECT COALESCE(json_agg(t ORDER BY row_to_json(t)::text), '[]') FROM (SELECT * FROM ${table}${table === 'site_settings' ? " WHERE key <> 'siteUrl'" : ''}) t`))]));
const source = snapshot('sample'), restored = snapshot(target);
assert.deepEqual(restored, source);
const inventory = (name: 'sample' | 'restored' | 'recovered', area: string) => files(join(dir(name), area)).map(path => ({ path, sha256: sha(readFileSync(join(dir(name), area, path))) }));
assert.deepEqual(inventory('sample', 'objects'), inventory(target, 'objects'));
assert.deepEqual(inventory('sample', 'projects'), inventory(target, 'projects'));
const checks = ['All seven database tables identical except customer origin', 'Every image and project JSON checksum identical'];
const sourcePassword = JSON.parse(readFileSync(join(dir('sample'), 'access.json'), 'utf8')).password;
const accessPath = join(dir(target), 'access.json');
const oldPassword = JSON.parse(readFileSync(accessPath, 'utf8')).password;
assert.notEqual(sourcePassword, oldPassword);
const login = async (password: string) => fetch(origin + '/api/admin/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password }) });
assert.equal((await login(sourcePassword)).status, 401);
checks.push('Customer A password refused by restored customer B');
const oldLogin = await login(oldPassword); assert(oldLogin.ok);
const oldCookie = oldLogin.headers.get('set-cookie')!.split(';')[0]; await oldLogin.text();
async function stop() {
 const pid = Number(readFileSync(join(dir(target), 'server.pid'), 'utf8'));
 const cwd = run('/usr/sbin/lsof', ['-a', '-p', String(pid), '-d', 'cwd', '-Fn']).split('\n').find(s => s.startsWith('n'))?.slice(1);
 if (cwd !== join(root, 'packages/web') && !cwd?.startsWith(join(lab, 'releases') + '/')) throw new Error('Refusing to signal an unrelated process');
 process.kill(pid, 'SIGTERM');
 for (let i = 0; i < 100; i++) { try { await free(slots[target].port); await free(slots[target].storage); return; } catch { await new Promise(r => setTimeout(r, 100)); } }
 throw new Error('Owned server did not stop');
}
async function start(commit: string) {
 run('bun', ['--no-env-file', 'scripts/kit/release.ts', 'activate', commit, target]);
 const child = spawn('bun', ['--no-env-file', 'scripts/kit/local.ts', 'serve', target], { cwd: root, env: { PATH: process.env.PATH! }, stdio: 'ignore' });
 child.unref();
 for (let i = 0; i < 100; i++) {
   try { const r = await fetch(origin + '/api/health'); if (r.ok) { const h = await r.json(); if (h.build === commit.slice(0, 8)) return; } } catch { /* owned process starting */ }
   await new Promise(r => setTimeout(r, 200));
 }
 throw new Error('Release failed to become healthy');
}
await stop();
await start(baseline); assert.deepEqual(snapshot(target), source);
checks.push('Program rollback booted exact baseline commit; all data preserved ');
await stop();
const newPassword = randomBytes(24).toString('base64url');
writeFileSync(accessPath, JSON.stringify({ password: newPassword }), { mode: 0o600 });
await start(current); assert.deepEqual(snapshot(target), source);
assert.equal((await login(oldPassword)).status, 401);
assert.equal((await login(newPassword)).status, 200);
assert.equal((await fetch(origin + '/api/admin/pdf/photos', { headers: { cookie: oldCookie } })).status, 401);
checks.push('Exact candidate release reactivated; password recovery invalidates prior password and session without data loss');
writeFileSync(join(lab, `recovery-verification-${target}.json`), JSON.stringify({ time: new Date().toISOString(), baseline, current, tables: tables.map(t => ({ table: t, rows: source[t].length })), imageCount: inventory('sample','objects').length, projectCount: inventory('sample','projects').length, checks, status: 'PASS' }, null, 2));
await stop();
console.log('Restore, release rollback/update, customer isolation and access recovery verified; restored server stopped for normal restart');
