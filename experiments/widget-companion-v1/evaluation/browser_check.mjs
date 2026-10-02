/** Independent UI/lifecycle regression. Artificial text only; no app edits. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, '../../..');
const require = createRequire(path.join(root, 'prototypes/glyph-creature/package.json'));
const { chromium } = require('@playwright/test');
const url = process.argv[2] ?? 'http://127.0.0.1:4232/widget.html';
const run = process.argv[3] ?? 'browser-first';
const output = path.join(directory, `${run}.json`);
if (fs.existsSync(output)) throw Error('Refusing to overwrite an evaluation');
const fixtureBytes = fs.readFileSync(path.join(directory, 'fixture.json'));
const fixtureSha = crypto.createHash('sha256').update(fixtureBytes).digest('hex');
if (!fs.readFileSync(path.join(directory, 'fixture.sha256'), 'utf8').startsWith(fixtureSha)) throw Error('Fixture modified');
const fixture = JSON.parse(fixtureBytes);
const dist = path.join(root, 'prototypes/glyph-creature/dist');
function hashes() {
  return Object.fromEntries(['widget.html', ...fs.readdirSync(path.join(dist, 'assets')).filter(name => /\.(js|css)$/.test(name)).map(name => `assets/${name}`)]
    .map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(path.join(dist, file))).digest('hex')]));
}
const frozen = hashes();
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({ headless: true, ...(fs.existsSync(chrome) ? { executablePath: chrome } : {}) });
const context = await browser.newContext({ viewport: { width: 400, height: 440 }, deviceScaleFactor: 2 });
const page = await context.newPage();
const images = path.join(root, '.local/widget-evaluation', run);
fs.mkdirSync(images, { recursive: true });
const external = [], errors = [], cases = [];
let phase = 'startup';
context.on('request', request => {
  const u = new URL(request.url());
  if (!['127.0.0.1', 'localhost', ''].includes(u.hostname)) external.push({ phase, host: u.hostname, pathname: u.pathname, method: request.method(), bodyPresent: request.postData() !== null, queryPresent: Boolean(u.search) });
});
page.on('pageerror', error => errors.push(error.message));
const inspect = () => page.evaluate(() => window.__WIDGET_ART__.inspect());
let preparation, paused, nativeHiddenContract, resumed, delayedReset, persistence, calm;
async function feed(item) {
  const before = await inspect();
  if (!before.terminalOpen) await page.keyboard.press('Enter');
  const start = performance.now();
  await page.locator('#text-input').fill(item.text);
  await page.locator('#text-input').press('Enter');
  await page.waitForFunction(count => window.__WIDGET_ART__.inspect().timings.length > count,
    before.timings.length, { timeout: 45000 });
  const after = await inspect();
  const retained = before.batches.every((batch, index) => JSON.stringify(batch) === JSON.stringify(after.batches[index]));
  const record = { id: item.id, text: item.text, wallMs: performance.now() - start,
    resolution: after.resolution, timing: after.timings.at(-1),
    count: after.count, drawn: after.scene.drawn, finite: after.scene.finite,
    pixelRatio: after.pixelRatio, limits: after.limits, worker: after.worker,
    priorBatchesRetained: retained, priorCharactersRetained: before.characters.every(c => after.characters.includes(c)),
    newBatch: after.batches.at(-1), scene: after.scene, scheduler: after.scheduler };
  cases.push(record);
  if (['white-rod-ball', 'blue-twist-box', 'yellow-vase'].includes(item.id)) {
    await page.screenshot({ path: path.join(images, `${item.id}.png`) });
  }
  console.log(`${item.id}: ${after.resolution?.reason} ${record.wallMs.toFixed(0)}ms; worker ${after.worker.started}/${after.worker.stopped}; ${record.drawn}/${record.count} drawn/stored`);
}
try {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.__WIDGET_ART__);
  await page.keyboard.press('Enter');
  await page.locator('#guide summary').click();
  await page.locator('#provider').selectOption('browser');
  phase = 'explicit-preparation';
  const start = performance.now();
  await page.locator('#prepare-model').click();
  await page.waitForFunction(() => {
    const state = window.__WIDGET_ART__.inspect();
    return state.browserModel && !state.busy && !state.worker.workerActive;
  }, undefined, { timeout: 90000 });
  preparation = { wallMs: performance.now() - start, state: await inspect() };
  await page.locator('#guide summary').click();
  phase = 'model-inputs';
  for (const item of fixture.inputs.slice(0, -1)) await feed(item);
  phase = 'pause';
  await page.locator('#pause').click();
  await page.waitForTimeout(150);
  const pauseBefore = await inspect();
  await page.waitForTimeout(3000);
  const pauseAfter = await inspect();
  paused = { before: pauseBefore.scheduler, after: pauseAfter.scheduler,
    framesDelta: pauseAfter.scheduler.frames - pauseBefore.scheduler.frames,
    ticksDelta: pauseAfter.scheduler.ticks - pauseBefore.scheduler.ticks,
    timeDelta: pauseAfter.time - pauseBefore.time };
  await page.locator('#pause').click();
  phase = 'native-hidden-contract';
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('glyph-widget-lifecycle', { detail: { visible: false } })));
  const hiddenBefore = await inspect();
  await page.waitForTimeout(3000);
  const hiddenAfter = await inspect();
  nativeHiddenContract = { method: 'Synthetic native lifecycle event; actual native hide is tested separately by root',
    before: hiddenBefore.scheduler, after: hiddenAfter.scheduler,
    framesDelta: hiddenAfter.scheduler.frames - hiddenBefore.scheduler.frames,
    ticksDelta: hiddenAfter.scheduler.ticks - hiddenBefore.scheduler.ticks,
    timeDelta: hiddenAfter.time - hiddenBefore.time };
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('glyph-widget-lifecycle', { detail: { visible: true } })));
  await page.waitForTimeout(250);
  const wake = await inspect();
  resumed = { scheduler: wake.scheduler, timeDeltaFromHidden: wake.time - hiddenAfter.time, finite: wake.scene.finite };
  phase = 'calm';
  const calmBefore = await inspect(), at = performance.now();
  await page.waitForTimeout(10000);
  const calmAfter = await inspect(), elapsed = (performance.now() - at) / 1000;
  calm = { elapsedSeconds: elapsed, framesDelta: calmAfter.scheduler.frames - calmBefore.scheduler.frames,
    fps: (calmAfter.scheduler.frames - calmBefore.scheduler.frames) / elapsed,
    lastState: calmAfter.scheduler, finite: calmAfter.scene.finite };
  phase = 'persistence';
  const persistBefore = await inspect();
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.__WIDGET_ART__);
  const persistAfter = await inspect();
  persistence = { countBefore: persistBefore.count, countAfter: persistAfter.count,
    batchesExactlyRetained: JSON.stringify(persistBefore.batches) === JSON.stringify(persistAfter.batches),
    programExactlyRetained: JSON.stringify(persistBefore.scene.program?.spec) === JSON.stringify(persistAfter.scene.program?.spec),
    workerAbsentAfterRestore: !persistAfter.worker.workerActive,
    charactersRetained: persistBefore.characters.every(c => persistAfter.characters.includes(c)) };
  phase = 'delayed-worker-reset';
  await page.locator('#show-help').click();
  await page.locator('#provider').selectOption('browser');
  let delayed = false;
  await page.route('**/*scaffold-model.worker*.js', async route => {
    delayed = true; await new Promise(resolve => setTimeout(resolve, 1000));
    try { await route.continue(); } catch { /* Reset legitimately cancels the worker request. */ }
  });
  await page.locator('#text-input').fill('黄色い花瓶');
  await page.locator('#text-input').press('Enter');
  await page.waitForFunction(() => window.__WIDGET_ART__.inspect().worker.workerActive);
  await page.locator('#reset').click();
  await page.waitForTimeout(2500);
  delayedReset = { delayIntercepted: delayed, state: await inspect() };
  await page.unroute('**/*scaffold-model.worker*.js');
  phase = 'reinput';
  await feed(fixture.inputs.at(-1));
} finally {
  await browser.close();
  const report = { fixtureSha, viewport: { width: 400, height: 440, deviceScaleFactor: 2 },
    sourceUse: 'Grammar/model regression and lifecycle checks, not new unrestricted semantic accuracy',
    distributionHashes: frozen, distributionUnchanged: JSON.stringify(frozen) === JSON.stringify(hashes()),
    preparation, cases, paused, nativeHiddenContract, resumed, calm, persistence, delayedReset,
    externalRequests: external, pageErrors: errors,
    limitations: ['M5/32GB host; target 16GB laptop CPU/iGPU unmeasured.',
      'Native hide here is a bridge-contract event; real macOS UI tested separately.',
      'fill/Enter does not verify actual OS Japanese IME.',
      'Browser process memory is not a native app RAM result.',
      'FPS is measured over10seconds and is not GPU utilization or power.'],
    screenshots: `.local/widget-evaluation/${run}` };
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ cases: cases.length, preparation: preparation?.wallMs,
    paused, nativeHiddenContract, resumed, calm, persistence,
    delayedReset: delayedReset && { count: delayedReset.state.count, worker: delayedReset.state.worker,
      busy: delayedReset.state.busy, intercepted: delayedReset.delayIntercepted }, errors,
    distributionUnchanged: report.distributionUnchanged }, null, 2));
}
