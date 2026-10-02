import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';
import { access, mkdir } from 'node:fs/promises';
const here = dirname(fileURLToPath(import.meta.url));
const requireExisting = createRequire(resolve(here, '../../prototypes/glyph-creature/package.json'));
const { build } = await import(pathToFileURL(requireExisting.resolve('vite')).href);
const mode = process.argv[2] ?? 'production';
const outDir = resolve(here, '.runtime', mode === 'cpu' ? 'cpu-r1' : 'dist-r1');
try { await access(outDir); throw new Error('output exists; preserve it and use a new version'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
await mkdir(dirname(outDir), { recursive: true });
const common = { root: here, configFile: false, cacheDir: resolve(here, '.runtime/cache-r1'),
  resolve: { alias: { three: dirname(requireExisting.resolve('three/package.json')) } },
  build: { outDir, emptyOutDir: false, sourcemap: false } };
if (mode === 'cpu') common.build.lib = { entry: resolve(here, 'surface.ts'), formats: ['es'], fileName: () => 'surface.mjs' };
await build(common);
