import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { lab, root, sha, assertLab } from './local';
assertLab();
const sources = JSON.parse(readFileSync(join(root, 'docs/delivery/sample-sources.json'), 'utf8'));
mkdirSync(join(lab, 'materials'), { recursive: true });
for (const source of sources) {
 const destination = join(lab, 'materials', source.file);
 if (!existsSync(destination)) {
  const url = new URL(source.source);
  if (url.origin !== 'https://upload.wikimedia.org') throw new Error('Unexpected source');
  const result = await fetch(url, { headers: { 'User-Agent': 'PortfolioKitLocalSample/1.0' }, signal: AbortSignal.timeout(45000) });
  if (!result.ok) throw new Error(`Source temporarily unavailable (${result.status}); completed files kept; retry later`);
  const bytes = Buffer.from(await result.arrayBuffer()); if (sha(bytes) !== source.sha256) throw new Error('Source has changed; review before using');
  writeFileSync(destination, bytes);
 }
 if (sha(readFileSync(destination)) !== source.sha256) throw new Error('Material integrity mismatch');
}
writeFileSync(join(lab, 'materials/sources.json'), JSON.stringify(sources, null, 2));
console.log('Three source photographs verified');
