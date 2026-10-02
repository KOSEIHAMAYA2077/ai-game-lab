import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const here = dirname(fileURLToPath(import.meta.url)), repo = resolve(here, '../..');
const sha = b => createHash('sha256').update(b).digest('hex');
const method = JSON.parse(await readFile(resolve(here, 'METHOD.json'), 'utf8'));
for (const row of method.readOnlyInputs) if (sha(await readFile(resolve(repo, row.path))) !== row.sha256) throw new Error(`readonly drift: ${row.path}`);
const out = resolve(here, 'work/bundle-r1');
try { await access(out); throw new Error('preserve old output'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
await mkdir(out, { recursive: true });
const local = createRequire(resolve(repo, 'prototypes/glyph-creature/package.json'));
const { rolldown } = await import(pathToFileURL(local.resolve('rolldown')).href);
const bundle = await rolldown({ input: resolve(repo, 'desktop/glyph-metal-ambient-v1/Sources/receiver-bridge.mjs'), platform: 'neutral' });
await bundle.write({ file: resolve(out, 'Receiver.js'), format: 'iife', name: 'AmbientNativeReceiver', minify: false }); await bundle.close();
const bytes = await readFile(resolve(out, 'Receiver.js'));
await writeFile(resolve(here, 'BUNDLE-R1.json'), JSON.stringify({ version: 'incremental-native-bridge-r1', path: 'work/bundle-r1/Receiver.js', sha256: sha(bytes), bytes: bytes.length,
  samePureR3Source: true, byteIdenticalOldR1: false, oldBundlePreserved: method.readOnlyInputs.find(r => r.path.endsWith('receiver.iife.js')), compiler: 'Rolldown1.2.11', inputs: method.readOnlyInputs }, null, 2) + '\n');
console.log(JSON.stringify({ bytes: bytes.length, sha256: sha(bytes) }));
