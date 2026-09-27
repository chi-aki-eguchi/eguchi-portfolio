/** Repeatable delivery laboratory. No .env, cloud endpoint or production argument is accepted. */
import { spawnSync, spawn } from 'node:child_process';
import { mkdirSync, existsSync, readFileSync, writeFileSync, readdirSync, copyFileSync, statSync, chmodSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { randomBytes, createHash } from 'node:crypto';
import net from 'node:net';

export const root = resolve(import.meta.dir, '../..');
export const lab = join(root, 'scratch/kit-delivery');
export const pgBin = '/opt/homebrew/opt/postgresql@17/bin';
export const pgPort = 56430;
export const slots = { sample: { port: 5599, storage: 5598 }, restored: { port: 5699, storage: 5698 } } as const;
export type Slot = keyof typeof slots;
export function slot(value: string): Slot {
  if (!(value === 'sample' || value === 'restored')) throw new Error('Only sample / restored are allowed');
  return value;
}
export function run(command: string, args: string[], options: Record<string, unknown> = {}) {
  const result = spawnSync(command, args, { cwd: root, env: { PATH: process.env.PATH!, LANG: 'en_US.UTF-8' }, encoding: 'utf8', ...options });
  if (result.status !== 0) throw new Error(`${command.split('/').pop()} failed: ${result.stderr || result.stdout}`);
  return result.stdout?.trim() ?? '';
}
export function pgArgs(name = 'postgres') { return ['-h', '127.0.0.1', '-p', String(pgPort), '-U', 'kit_lab', '-d', name]; }
export function sql(name: string, query: string) { return run(join(pgBin, 'psql'), [...pgArgs(name), '-X', '-v', 'ON_ERROR_STOP=1', '-At', '-c', query]); }
export const dbName = (s: Slot) => `kit_lab_${s}`;
export const dir = (s: Slot) => join(lab, s);
export const sha = (data: string | Buffer) => createHash('sha256').update(data).digest('hex');
export function files(path: string, prefix = ''): string[] {
  return readdirSync(join(path, prefix)).flatMap(name => {
    const rel = join(prefix, name);
    return statSync(join(path, rel)).isDirectory() ? files(path, rel) : [rel];
  }).sort();
}
export async function free(port: number) {
  await new Promise<void>((yes, no) => {
    const probe = net.createServer(); probe.once('error', no);
    probe.listen(port, '127.0.0.1', () => probe.close(() => yes()));
  });
}
export function assertLab() {
  if (readFileSync(join(lab, 'LAB.json'), 'utf8') !== JSON.stringify({ purpose: 'portfolio-kit-local-only', pgPort })) throw new Error('Laboratory identity mismatch');
}
export async function init(s: Slot) {
  mkdirSync(lab, { recursive: true, mode: 0o700 }); chmodSync(lab, 0o700);
  const marker = join(lab, 'LAB.json');
  if (!existsSync(marker)) {
    if (existsSync(join(lab, 'postgres'))) throw new Error('Unidentified PostgreSQL folder');
    writeFileSync(marker, JSON.stringify({ purpose: 'portfolio-kit-local-only', pgPort }), { mode: 0o600 });
  }
  assertLab();
  const pgData = join(lab, 'postgres');
  if (!existsSync(join(pgData, 'PG_VERSION'))) {
    await free(pgPort);
    run(join(pgBin, 'initdb'), ['-D', pgData, '-U', 'kit_lab', '-A', 'trust', '--no-locale', '-E', 'UTF8']);
  }
  if (!existsSync(join(pgData, 'postmaster.pid'))) {
    await free(pgPort);
    run(join(pgBin, 'pg_ctl'), ['-D', pgData, '-l', join(lab, 'postgres.log'), '-o', `-h 127.0.0.1 -p ${pgPort} -k ${lab}`, '-w', 'start']);
  }
  // Verify the actual server's data directory before issuing any database writes.
  if (sql('postgres', 'SHOW data_directory') !== pgData) throw new Error('Wrong PostgreSQL process');
  const name = dbName(s);
  if (sql('postgres', `SELECT datname FROM pg_database WHERE datname='${name}'`) !== name)
    run(join(pgBin, 'createdb'), ['-h', '127.0.0.1', '-p', String(pgPort), '-U', 'kit_lab', name]);
  mkdirSync(join(dir(s), 'objects'), { recursive: true, mode: 0o700 });
  mkdirSync(join(dir(s), 'projects'), { recursive: true, mode: 0o700 });
  const secret = join(dir(s), 'access.json');
  if (!existsSync(secret)) writeFileSync(secret, JSON.stringify({ password: randomBytes(24).toString('base64url') }), { mode: 0o600 });
  console.log(`Ready: ${s}; data retained. Password is in local access.json, never in logs.`);
}
export function environment(s: Slot) {
  assertLab();
  const { password } = JSON.parse(readFileSync(join(dir(s), 'access.json'), 'utf8'));
  return {
    PATH: process.env.PATH!, LANG: 'en_US.UTF-8', NODE_ENV: 'production',
    DATABASE_PROVIDER: 'postgres', DATABASE_URL: `postgres://kit_lab@127.0.0.1:${pgPort}/${dbName(s)}`,
    HOST: '127.0.0.1', PORT: String(slots[s].port), ADMIN_PASSWORD: password,
    SITE_URL: `http://127.0.0.1:${slots[s].port}`, GA_MEASUREMENT_ID: '', UPLOAD_DEFAULT_VISIBILITY: 'private', PRIVATE_MEDIA_ACCESS: '1',
    S3_ENDPOINT: `http://127.0.0.1:${slots[s].storage}`, S3_BUCKET: 'kit-lab', S3_REGION: 'auto',
    S3_ACCESS_KEY_ID: 'local-only', S3_SECRET_ACCESS_KEY: 'local-only', S3_FORCE_PATH_STYLE: 'true',
    AWS_EC2_METADATA_DISABLED: 'true', AWS_CONFIG_FILE: join(lab, 'no-aws-config'), AWS_SHARED_CREDENTIALS_FILE: join(lab, 'no-aws-credentials'),
  };
}
export async function serve(s: Slot) {
  await init(s); await free(slots[s].port); await free(slots[s].storage);
  const objects = join(dir(s), 'objects');
  const storage = Bun.serve({ hostname: '127.0.0.1', port: slots[s].storage, async fetch(req) {
    const pathname = new URL(req.url).pathname;
    if (!pathname.startsWith('/kit-lab/')) return new Response(null, { status: 404 });
    const key = decodeURIComponent(pathname.slice('/kit-lab/'.length));
    if (!key || key.includes('..') || key.includes('\\') || key.startsWith('/')) return new Response(null, { status: 400 });
    const path = join(objects, key);
    if (req.method === 'PUT') {
      mkdirSync(resolve(path, '..'), { recursive: true });
      writeFileSync(path, new Uint8Array(await req.arrayBuffer()));
      return new Response(null, { headers: { etag: '"local"' } });
    }
    // Deletion is deliberately unsupported in this laboratory's storage.
    if (!['GET', 'HEAD'].includes(req.method)) return new Response(null, { status: 405 });
    if (!existsSync(path)) return new Response('<Error><Code>NoSuchKey</Code></Error>', { status: 404 });
    const body = readFileSync(path);
    return new Response(req.method === 'HEAD' ? null : body, { headers: { 'content-type': key.endsWith('.webp') ? 'image/webp' : 'image/jpeg', 'content-length': String(body.length), etag: '"local"' } });
  }});
  const activeFile = join(dir(s), 'active-release.json');
  const active = existsSync(activeFile) ? JSON.parse(readFileSync(activeFile, 'utf8')) : null;
  if (active && (!/^[a-f0-9]{40}$/.test(active.commit) || active.relativePath !== `releases/${active.commit}/source`)) throw new Error('Invalid release pin');
  const code = active ? join(lab, active.relativePath) : root;
  // A preload enforces loopback even for older releases that lack HOST configuration.
  const preload = join(import.meta.dir, 'loopback.ts');
  const child = spawn('bun', ['--no-env-file', '--preload', preload, 'src/server.ts'], { cwd: join(code, 'packages/web'), env: { ...environment(s), RAILWAY_GIT_COMMIT_SHA: active?.commit ?? '' }, stdio: ['ignore', 'inherit', 'inherit'] });
  writeFileSync(join(dir(s), 'server.pid'), String(child.pid), { mode: 0o600 });
  const stop = () => { child.kill('SIGTERM'); storage.stop(true); };
  process.on('SIGTERM', stop); process.on('SIGINT', stop);
  child.on('exit', code => { storage.stop(true); process.exit(code ?? 0); });
  console.log(`Local ${s}: http://127.0.0.1:${slots[s].port}/ ; admin: /admin`);
}
export async function backup(s: Slot, label: string) {
  assertLab(); await free(slots[s].port); // App must be stopped: database and objects form one quiet snapshot.
  if (!/^[a-z0-9-]+$/.test(label)) throw new Error('Invalid snapshot label');
  if (sql('postgres', 'SHOW data_directory') !== join(lab, 'postgres')) throw new Error('Wrong PostgreSQL process');
  const target = join(lab, 'backups', label);
  mkdirSync(join(lab, 'backups'), { recursive: true, mode: 0o700 });
  mkdirSync(target, { mode: 0o700 }); // Fail if already exists, never overwrite.
  run(join(pgBin, 'pg_dump'), [...pgArgs(dbName(s)), '--format=custom', '--no-owner', '-f', join(target, 'database.dump')]);
  for (const area of ['objects', 'projects']) {
    mkdirSync(join(target, area));
    for (const rel of files(join(dir(s), area))) {
      mkdirSync(resolve(target, area, rel, '..'), { recursive: true });
      copyFileSync(join(dir(s), area, rel), join(target, area, rel));
    }
  }
  const inventory = files(target).map(path => ({ path, bytes: statSync(join(target, path)).size, sha256: sha(readFileSync(join(target, path))) }));
  writeFileSync(join(target, 'manifest.json'), JSON.stringify({ schema: 1, source: s, createdAt: new Date().toISOString(), commit: existsSync(join(dir(s), 'active-release.json')) ? JSON.parse(readFileSync(join(dir(s), 'active-release.json'), 'utf8')).commit : run('git', ['rev-parse', 'HEAD']), inventory, excludes: ['credentials', 'browser-local projects not exported', 'camera originals'] }, null, 2));
  console.log(`Backup ${label}: ${inventory.length} files. Credentials excluded.`);
}
export async function restore(label: string, apply = false) {
  assertLab();
  if (!/^[a-z0-9-]+$/.test(label)) throw new Error('Invalid snapshot label');
  const source = join(lab, 'backups', label);
  const manifest = JSON.parse(readFileSync(join(source, 'manifest.json'), 'utf8'));
  if (manifest.schema !== 1 || !Array.isArray(manifest.inventory)) throw new Error('Invalid backup manifest');
  for (const item of manifest.inventory) {
    if (typeof item.path !== 'string' || item.path.includes('..') || item.path.startsWith('/')) throw new Error('Unsafe manifest path');
    if (sha(readFileSync(join(source, item.path))) !== item.sha256) throw new Error('Backup integrity mismatch');
  }
  const listed = manifest.inventory.map((item: { path: string }) => item.path).sort();
  if (JSON.stringify(listed) !== JSON.stringify(files(source).filter(path => path !== 'manifest.json')) || !listed.includes('database.dump')) throw new Error('Backup inventory mismatch');
  await init('restored'); await free(slots.restored.port);
  if (sql(dbName('restored'), "SELECT count(*) FROM pg_tables WHERE schemaname NOT IN ('pg_catalog','information_schema')") !== '0' || files(join(dir('restored'), 'objects')).length || files(join(dir('restored'), 'projects')).length)
    throw new Error('Restore target must be empty; existing data is never overwritten');
  console.log(`Verified ${label}; target=restored (local empty database). ${apply ? 'Applying' : 'Dry-run only; pass --apply'}`);
  if (!apply) return;
  run(join(pgBin, 'pg_restore'), [...pgArgs(dbName('restored')), '--exit-on-error', '--single-transaction', '--no-owner', join(source, 'database.dump')]);
  for (const area of ['objects', 'projects']) for (const rel of files(join(source, area))) {
    mkdirSync(resolve(dir('restored'), area, rel, '..'), { recursive: true });
    copyFileSync(join(source, area, rel), join(dir('restored'), area, rel));
  }
  // Restored site gets its own origin and independently generated credential.
  sql(dbName('restored'), `UPDATE site_settings SET value='http://127.0.0.1:${slots.restored.port}' WHERE key='siteUrl'`);
  writeFileSync(join(dir('restored'), 'restore.json'), JSON.stringify({ label, restoredAt: new Date().toISOString(), manifestSha256: sha(readFileSync(join(source, 'manifest.json'))) }, null, 2));
}
if (import.meta.main) {
  const [command, argument = 'sample', flag] = process.argv.slice(2);
  if (command === 'init') await init(slot(argument));
  else if (command === 'serve') await serve(slot(argument));
  else if (command === 'backup') await backup('sample', argument);
  else if (command === 'restore') await restore(argument, flag === '--apply');
  else throw new Error('Usage: bun --no-env-file scripts/kit/local.ts init|serve sample|restored / backup LABEL / restore LABEL [--apply]');
}
