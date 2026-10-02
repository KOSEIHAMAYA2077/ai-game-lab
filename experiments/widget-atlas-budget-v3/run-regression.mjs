import { execFileSync, spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url)), repository = resolve(here, '../..');
const project = resolve(repository, 'prototypes/glyph-creature'), require = createRequire(resolve(project, 'package.json'));
const { chromium } = require('@playwright/test');
const baseline = process.env.GLYPH_BASELINE_SHA ?? execFileSync('git', ['rev-parse', '6788869'], { cwd: repository, encoding: 'utf8' }).trim();
const port = Number(process.env.GLYPH_ATLAS_PORT ?? 4264);
const output = process.env.GLYPH_ATLAS_OUTPUT ?? resolve(here, 'regression-result.json');
const local = resolve(project, '.local'); await mkdir(local, { recursive: true });
const source = execFileSync('git', ['show', `${baseline}:prototypes/glyph-creature/src/scene.ts`], { cwd: repository, encoding: 'utf8' });
await writeFile(resolve(local, 'widget-atlas-baseline.ts'), source.replaceAll("from './", "from '../src/"));
await writeFile(resolve(local, 'widget-atlas-probe.ts'), await readFile(resolve(here, 'atlas-regression.ts')));
await writeFile(resolve(local, 'widget-atlas.html'), '<!doctype html><meta charset="utf-8"><link rel="icon" href="data:,"><title>Glyph atlas comparison</title><style>html,body{margin:0;background:#000}.host{position:absolute;left:0;top:0;width:400px;height:440px}#baseline{visibility:hidden}</style><div class="host" id="baseline"></div><div class="host" id="candidate"></div><script type="module" src="./widget-atlas-probe.ts"></script>');
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: project, stdio: ['ignore', 'pipe', 'pipe'] });
let serverLog = ''; server.stdout.on('data', x => { serverLog += x; }); server.stderr.on('data', x => { serverLog += x; });
const url = `http://127.0.0.1:${port}/.local/widget-atlas.html`; let browser;
try {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null) throw new Error(`comparison server stopped: ${serverLog}`);
    try { if ((await fetch(url)).ok) break; } catch {}
    if (attempt === 99) throw new Error(`comparison server unavailable: ${serverLog}`);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 400, height: 440 }, deviceScaleFactor: 1 });
  const errors = []; page.on('pageerror', x => errors.push(x.message)); page.on('console', x => { if (x.type() === 'error') errors.push(x.text()); });
  await page.goto(url); await page.waitForFunction(() => typeof window.runAtlasBudget === 'function');
  const result = await page.evaluate(async () => await window.runAtlasBudget());
  if (errors.length) throw new Error(`browser errors: ${JSON.stringify(errors)}`);
  const candidateSceneBlob = execFileSync('git', ['hash-object', 'prototypes/glyph-creature/src/scene.ts'], { cwd: repository, encoding: 'utf8' }).trim();
  await writeFile(output, JSON.stringify({ baseline, candidateSceneBlob, checkedAt: new Date().toISOString(), consoleErrors: errors, ...result }, null, 2) + '\n');
  await page.screenshot({ path: resolve(local, 'widget-atlas-final.png') });
  process.stdout.write(JSON.stringify({ output, boundaries: result.checkpoints.map(x => ({ kinds: x.kinds, rows: x.rows, pixelBytes: x.pixelBytes, gpuDifference: x.gpu.maxChannelDifference })), forms: result.forms.length, deferred: result.deferred, storedHistory: result.storedHistory, defaultRows: result.defaultRows }, null, 2) + '\n');
} finally { await browser?.close(); server.kill('SIGTERM'); }
