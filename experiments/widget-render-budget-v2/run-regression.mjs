import { execFileSync, spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const repository = resolve(here, '../..');
const project = resolve(repository, 'prototypes/glyph-creature');
const require = createRequire(resolve(project, 'package.json'));
const { chromium } = require('@playwright/test');
const baseline = process.env.GLYPH_BASELINE_SHA ?? '68313962729c03324e32ec3b924020ed30ef4752';
const port = Number(process.env.GLYPH_BUDGET_PORT ?? 4263);
const output = process.env.GLYPH_BUDGET_OUTPUT ?? resolve(here, 'regression-result.json');
const local = resolve(project, '.local');
await mkdir(local, { recursive: true });
const source = execFileSync('git', ['show', `${baseline}:prototypes/glyph-creature/src/scene.ts`], { cwd: repository, encoding: 'utf8' });
const imports = source.replaceAll("from './", "from '../src/");
await writeFile(resolve(local, 'widget-render-budget-baseline.ts'), imports);
await writeFile(resolve(local, 'widget-render-budget-probe.ts'), await readFile(resolve(here, 'geometry-regression.ts')));
await writeFile(resolve(local, 'widget-render-budget.html'), '<!doctype html><meta charset="utf-8"><link rel="icon" href="data:,"><title>Glyph render comparison</title><style>html,body{margin:0;background:#000}.host{position:absolute;left:0;top:0;width:400px;height:440px}#baseline{visibility:hidden}</style><div class="host" id="baseline"></div><div class="host" id="candidate"></div><script type="module" src="./widget-render-budget-probe.ts"></script>');
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: project, stdio: ['ignore', 'pipe', 'pipe'] });
let serverLog = ''; server.stdout.on('data', data => { serverLog += data; }); server.stderr.on('data', data => { serverLog += data; });
const url = `http://127.0.0.1:${port}/.local/widget-render-budget.html`;
let browser;
try {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null) throw new Error(`comparison server stopped: ${serverLog}`);
    try { const response = await fetch(url); if (response.ok) break; } catch {}
    if (attempt === 99) throw new Error(`comparison server unavailable: ${serverLog}`);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 400, height: 440 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(url);
  await page.waitForFunction(() => typeof window.runRenderBudget === 'function');
  const result = await page.evaluate(async () => await window.runRenderBudget(), { timeout: 240000 });
  if (errors.length) throw new Error(`browser errors: ${JSON.stringify(errors)}`);
  const sceneSha = execFileSync('git', ['hash-object', 'prototypes/glyph-creature/src/scene.ts'], { cwd: repository, encoding: 'utf8' }).trim();
  await writeFile(output, JSON.stringify({ baseline, candidateSceneBlob: sceneSha, checkedAt: new Date().toISOString(), consoleErrors: errors, ...result }, null, 2) + '\n');
  await page.screenshot({ path: resolve(local, 'widget-render-budget-final.png') });
  process.stdout.write(JSON.stringify({ output, geometry: result.geometry, gpu: result.gpu, arrayBytes: result.timings.cpuArrayBytes, elapsedMs: result.elapsedMs }, null, 2) + '\n');
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
