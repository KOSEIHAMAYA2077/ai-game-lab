import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const here = dirname(fileURLToPath(import.meta.url)), repo = resolve(here, '../..');
const method = JSON.parse(await readFile(resolve(here, 'METHOD.json'), 'utf8'));
const sha = data => createHash('sha256').update(data).digest('hex');
for (const row of method.readOnlyInputs) if (sha(await readFile(resolve(repo, row.path))) !== row.sha256) throw new Error(`readonly source drift: ${row.path}`);
const out = resolve(here, '.runtime/bundle-r1');
try { await access(out); throw new Error('preserve previous bundle'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
await mkdir(out, { recursive: true });
const requireLocal = createRequire(resolve(repo, 'prototypes/glyph-creature/package.json'));
const { rolldown } = await import(pathToFileURL(requireLocal.resolve('rolldown')).href);
const bundle = await rolldown({ input: resolve(here, 'bridge.mjs'), platform: 'neutral', treeshake: true });
await bundle.write({ file: resolve(out, 'receiver.iife.js'), format: 'iife', name: 'AmbientJSC', minify: false });
await bundle.close();
const bytes = await readFile(resolve(out, 'receiver.iife.js'));
await writeFile(resolve(here, 'BUNDLE-R1.json'), JSON.stringify({ version: 'shared-node-jsc-bundle-r1', bundle: '.runtime/bundle-r1/receiver.iife.js', sha256: sha(bytes), bytes: bytes.length,
  compiler: 'local installed Rolldown1.2.11; neutral IIFE, no minify', readOnlyInputs: method.readOnlyInputs }, null, 2) + '\n');
console.log(JSON.stringify({ bundle: '.runtime/bundle-r1/receiver.iife.js', sha256: sha(bytes), bytes: bytes.length }));
