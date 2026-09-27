/** Immutable local release snapshots. No deploy, Git push or customer endpoint. */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { run, lab, root, sha, files, assertLab, slot, dir } from './local';
assertLab();
const [command, ref = 'HEAD', target = 'sample'] = process.argv.slice(2);
const commit = run('git', ['rev-parse', '--verify', `${ref}^{commit}`]);
if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error('Exact commit required');
const release = join(lab, 'releases', commit);
if (command === 'pack') {
  if (run('git', ['status', '--porcelain', '--untracked-files=no'])) throw new Error('Commit tracked source edits before packaging');
  mkdirSync(join(lab, 'releases'), { recursive: true });
  mkdirSync(release); // Immutable: duplicate packaging is rejected.
  const archive = join(release, 'source.tar');
  run('git', ['archive', '--format=tar', `--output=${archive}`, commit]);
  const code = join(release, 'source'); mkdirSync(code);
  run('tar', ['-xf', archive, '-C', code]);
  const sourceFiles = files(code).map(path => ({ path, sha256: sha(readFileSync(join(code, path))) }));
  run('bun', ['install', '--frozen-lockfile'], { cwd: code });
  run('bun', ['run', 'build'], { cwd: code, env: { PATH: process.env.PATH!, NODE_ENV: 'production' } });
  const dist = join(code, 'packages/web/dist');
  writeFileSync(join(release, 'manifest.json'), JSON.stringify({ commit, createdAt: new Date().toISOString(), database: 'postgres', sourceArchiveSha256: sha(readFileSync(archive)), sourceFiles, builtFiles: files(dist).map(path => ({ path, sha256: sha(readFileSync(join(dist, path))) })), migrations: files(join(code, 'packages/web/drizzle-postgres')).filter(p => p.endsWith('.sql')) }, null, 2));
  console.log(`Packaged immutable commit ${commit}`);
} else if (command === 'activate') {
  const s = slot(target);
  const manifest = JSON.parse(readFileSync(join(release, 'manifest.json'), 'utf8'));
  if (manifest.commit !== commit || sha(readFileSync(join(release, 'source.tar'))) !== manifest.sourceArchiveSha256) throw new Error('Release identity mismatch');
  for (const item of manifest.sourceFiles) if (sha(readFileSync(join(release, 'source', item.path))) !== item.sha256) throw new Error('Release source changed');
  for (const item of manifest.builtFiles) if (sha(readFileSync(join(release, 'source/packages/web/dist', item.path))) !== item.sha256) throw new Error('Release build changed');
  if (!existsSync(dir(s))) throw new Error('Initialize target first');
  writeFileSync(join(dir(s), 'active-release.json'), JSON.stringify({ commit, relativePath: `releases/${commit}/source`, activatedAt: new Date().toISOString() }, null, 2));
  console.log(`Pinned ${s} to ${commit}. Restart laboratory site to apply. No database rollback performed.`);
} else throw new Error(`Usage in ${root}: pack REF / activate REF sample|restored`);
