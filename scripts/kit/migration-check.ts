import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { strict as assert } from 'node:assert';
import { run, sql, lab, root, pgBin, pgPort, assertLab } from './local';
assertLab();
const name = 'kit_lab_upgrade';
assert.equal(sql('postgres', 'SHOW data_directory'), join(lab, 'postgres'));
if (!sql('postgres', `SELECT datname FROM pg_database WHERE datname='${name}'`)) run(join(pgBin, 'createdb'), ['-h', '127.0.0.1', '-p', String(pgPort), '-U', 'kit_lab', name]);
if (sql(name, "SELECT count(*) FROM pg_tables WHERE schemaname='public'") !== '0') throw new Error('Existing upgrade data preserved; inspect evidence');
const source = join(root, 'packages/web/drizzle-postgres');
const migrationDir = join(lab, 'upgrade-migrations'); mkdirSync(join(migrationDir, 'meta'), { recursive: true });
const journal = JSON.parse(readFileSync(join(source, 'meta/_journal.json'), 'utf8'));
writeFileSync(join(migrationDir, 'meta/_journal.json'), JSON.stringify({ ...journal, entries: journal.entries.slice(0, -1) }));
for (const entry of journal.entries.slice(0, -1)) writeFileSync(join(migrationDir, `${entry.tag}.sql`), readFileSync(join(source, `${entry.tag}.sql`)));
// The real Drizzle PostgreSQL migrator uses a dedicated fresh database.
const require = createRequire(join(root, 'packages/web/package.json'));
const { Pool } = require('pg');
const { drizzle } = require('drizzle-orm/node-postgres');
const { migrate } = require('drizzle-orm/node-postgres/migrator');
const pool = new Pool({ host: '127.0.0.1', port: pgPort, user: 'kit_lab', database: name });
try {
 const db = drizzle(pool); await migrate(db, { migrationsFolder: migrationDir });
 await pool.query("INSERT INTO series (slug,title) VALUES ('keep','残す作品'); INSERT INTO photos (filename,url,title,series_id,sort_order) VALUES ('keep.jpg','/api/images/photos/keep.jpg','残す写真',1,7); INSERT INTO site_settings VALUES ('siteName','Keep Customer')");
 const before = (await pool.query('SELECT * FROM photos')).rows;
 await migrate(db, { migrationsFolder: source }); await migrate(db, { migrationsFolder: source });
 assert.deepEqual((await pool.query('SELECT * FROM photos')).rows, before);
 assert.deepEqual((await pool.query('SELECT * FROM series_photos')).rows, [{ series_id: 1, photo_id: 1, sort_order: 7 }]);
 assert.equal((await pool.query("SELECT value FROM site_settings WHERE key='siteName'")).rows[0].value, 'Keep Customer');
 writeFileSync(join(lab, 'migration-verification.json'), JSON.stringify({ time: new Date().toISOString(), status: 'PASS', from: journal.entries.at(-2).tag, to: journal.entries.at(-1).tag, checks: ['actual PostgreSQL connection', 'existing photo fields and settings preserved', 'series membership backfilled', 'repeated migration is idempotent'] }, null, 2));
 console.log('PostgreSQL upgrade and repeated migration passed');
} finally { await pool.end(); }
