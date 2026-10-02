// Fresh artificial operation sequences. This is UI integration, not a held-out language evaluation.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import path from 'node:path';
const repo = path.resolve(import.meta.dirname, '../..'), project = path.join(repo, 'prototypes/glyph-creature');
const require = createRequire(path.join(project, 'package.json'));
const { chromium } = require('@playwright/test');
const port = 4285, origin = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: project, stdio: ['ignore', 'pipe', 'pipe'] });
let serverOutput = ''; for (const pipe of [server.stdout, server.stderr]) pipe.on('data', d => serverOutput += d);
const report = { createdAt: new Date().toISOString(), environment: { browser: 'Chrome headless', realWebGL: true, nativeUI: false, actualIME: false }, tests: [], measurements: [], requests: [], exceptions: [], freezeSha256: {}, passed: false };
let browser, context;
const frozenFiles = ['experiments/widget-student-v1/student-model.json', 'prototypes/glyph-creature/src/widget-student.ts', 'prototypes/glyph-creature/src/widget-student-guard-v2.ts'];
for (const file of frozenFiles) report.freezeSha256[file] = createHash('sha256').update(await readFile(path.join(repo, file))).digest('hex');
const record = (name, evidence) => report.tests.push({ name, passed: true, evidence });
const inspect = page => page.evaluate(() => window.__WIDGET_ART__.inspect());
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function openTerminal(page) { if (!await page.locator('#terminal').isVisible()) { await page.locator('#scene').focus(); await page.keyboard.press('Enter'); } await page.locator('#text-input').waitFor({ state: 'visible' }); }
async function help(page) { await openTerminal(page); await page.locator('#guide').evaluate(e => e.open = true); }
async function feed(page, text, waitAbsorb = true) {
  await openTerminal(page); const prior = (await inspect(page)).batches.length;
  await page.locator('#text-input').fill(text); await page.locator('#text-input').press('Enter');
  await page.waitForFunction(prior => window.__WIDGET_ART__.inspect().batches.length > prior || !window.__WIDGET_ART__.inspect().busy, prior);
  assert.equal((await inspect(page)).batches.length, prior + 1, `body should accept full source: ${text.slice(0, 80)}`);
  if (waitAbsorb) { await page.waitForFunction(() => !window.__WIDGET_ART__.inspect().busy, null, { timeout: 30000 }); const latest = (await inspect(page)).timings.at(-1); assert(latest?.within30s); report.measurements.push({ text, ...latest }); }
  return inspect(page);
}
async function newPage() {
  const page = await context.newPage();
  page.on('pageerror', e => report.exceptions.push(String(e)));
  await page.goto(`${origin}/widget.html`); await page.waitForFunction(() => window.__WIDGET_ART__);
  return page;
}
try {
  for (let i = 0; i < 100; i++) { if (server.exitCode !== null) throw new Error(`Vite exited before readiness: ${serverOutput}`); try { const r = await fetch(`${origin}/widget.html`); if (r.ok) break; } catch {} if (i === 99) throw new Error(serverOutput); await sleep(100); }
  browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--enable-webgl', '--use-angle=metal', '--disable-background-timer-throttling'] });
  context = await browser.newContext({ viewport: { width: 680, height: 500 } });
  await context.addInitScript(() => {
    window.__testWorkers = [];
    const NativeWorker = window.Worker;
    window.Worker = class extends NativeWorker { constructor(url, options) { window.__testWorkers.push(String(url)); super(url, options); } };
  });
  await context.route('**/*', async route => { const url = route.request().url(); if (!url.startsWith(origin) && !url.startsWith('data:') && !url.startsWith('blob:')) { report.requests.push({ url, blocked: true }); await route.abort(); } else await route.continue(); });
  const page = await newPage();
  let state = await inspect(page); assert.equal(state.provider, 'rules'); assert.equal(state.tinyClassifier.loaded, false); assert.equal(state.scene.atlas.rows, 1); assert.equal(state.scene.atlas.dynamic, true);
  state = await feed(page, '表面 メビウスの輪');
  assert.equal(state.spec.shape, 'mobius', 'default rich Möbius must remain authored');
  assert.equal(state.scene.program, null, 'default Möbius must not become scaffold ring');
  record('default authored Möbius and lazy tiny import', { shape: state.spec.shape, atlas: state.scene.atlas, tinyLoaded: state.tinyClassifier.loaded });
  if (process.argv.includes('--baseline-only')) { report.passed = true; }
  else {
    for (const [text, shape] of [['表面 クラゲ', 'jellyfish'], ['表面 鳥', 'bird'], ['表面 魚', 'fish'], ['表面 蛇', 'snake'], ['表面 メビウス', 'mobius']]) {
      state = await feed(page, text); assert.equal(state.spec.shape, shape); assert.equal(state.scene.program, null); assert.equal(state.scene.finite, true);
      record(`default authored ${shape} preserves surface/rig`, { shape: state.spec.shape, mode: state.spec.mode, rig: state.scene.rig });
    }
    await help(page); await page.locator('#provider').selectOption('tiny'); await page.locator('#repeat').selectOption('1');
    await page.waitForFunction(() => window.__WIDGET_ART__.inspect().tinyClassifier.loaded);
    assert.equal(await page.locator('#prepare-model').textContent(), 'MiniLMを取得（初回約128MB）');
    const authoredSpec = structuredClone((await inspect(page)).spec);
    state = await feed(page, '表面 クラゲ'); assert.equal(state.resolution.program, null); assert.equal(state.scene.program, null); assert.deepEqual(state.spec, authoredSpec);
    record('tiny hold preserves authored Möbius too; no 60-shape rescue', { shape: state.spec.shape, reason: state.resolution.reason });
    state = await feed(page, '棒の先端に球体');
    assert.equal(state.resolution.source, 'tiny-student'); assert.equal(state.scene.program?.spec.parts.length, 2); assert.equal(state.scene.program.spec.relation.kind, 'end');
    assert.deepEqual(state.scene.program.spec.parts.map(p => p.primitive), ['tube', 'sphere']);
    assert.equal(state.tinyClassifier.decodedWeightBytes, 91136); assert.equal(state.worker.started, 0);
    record('tiny positive two parts; decoded weights separate from Worker', { program: state.scene.program.spec, classifier: state.tinyClassifier, worker: state.worker });
    const originalProgram = structuredClone(state.scene.program.spec), originalSpec = structuredClone(state.spec), originalBatches = structuredClone(state.batches);
    for (const [name, text] of [['negated', '立方体は作らないでください'], ['unsupported-authored', '表面 クラゲ'], ['unsupported-free-text', '夕方の空を眺めて深呼吸した']]) {
      const previous = await inspect(page); state = await feed(page, text);
      assert.equal(state.resolution.source, 'tiny-student'); assert.equal(state.resolution.program, null, `${name} must hold`);
      assert.deepEqual(state.scene.program.spec, originalProgram); assert.deepEqual(state.spec, originalSpec);
      assert(state.count > previous.count); assert.deepEqual(state.batches.slice(0, previous.batches.length), previous.batches); assert.equal(state.batches.at(-1).text, text);
      record(`${name} holds geometry and still adds body`, { reason: state.resolution.reason, beforeCount: previous.count, afterCount: state.count });
    }
    state = await feed(page, '赤'); assert.deepEqual(state.scene.program.spec, originalProgram); assert.equal(state.batches.at(-1).ink, 'red'); assert.deepEqual(state.batches.slice(0, originalBatches.length), originalBatches);
    record('current batch color only', { oldBatches: originalBatches.length, newInk: state.batches.at(-1).ink });
    assert.equal(report.requests.length, 0); assert.equal((await page.evaluate(() => window.__testWorkers)).length, 0);
    record('tiny classification makes no external requests and creates no Worker', { externalRequests: report.requests.length, workersCreated: 0 });
    const beforeBudget = state.batches.length; await openTerminal(page); await page.locator('#text-input').fill('界'.repeat(4001)); await page.locator('#text-input').press('Enter'); state = await inspect(page); assert.equal(state.batches.length, beforeBudget); assert.equal(state.busy, false); assert.match(await page.locator('#status').textContent(), /4,000/);
    record('4k code-unit budget is enforced before classification', { unchangedBatches: beforeBudget });
    const saved = { program: state.scene.program.spec, spec: state.spec, batches: state.batches, count: state.count };
    await page.reload(); await page.waitForFunction(() => window.__WIDGET_ART__); state = await inspect(page);
    assert.deepEqual(state.scene.program.spec, saved.program); assert.deepEqual(state.spec, saved.spec); assert.deepEqual(state.batches, saved.batches); assert.equal(state.count, saved.count); assert.equal(state.provider, 'rules'); assert.equal(state.tinyClassifier.loaded, false);
    record('reload preserves full original batches/color/program; rules default', { batches: state.batches.length, count: state.count });
    // Use the app lifecycle seam, not a claim that the locked native desktop was operated.
    await page.locator('#pause').click(); await sleep(150); const pausedState = await inspect(page); await sleep(400); state = await inspect(page); assert.equal(state.scheduler.pending, 0); assert.equal(state.scheduler.ticks, pausedState.scheduler.ticks); assert.equal(state.scheduler.frames, pausedState.scheduler.frames);
    record('pause has zero frame/timer queue', { before: pausedState.scheduler, after: state.scheduler });
    await page.locator('#pause').click();
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('glyph-widget-lifecycle', { detail: { visible: false } }))); await sleep(150); const hidden = await inspect(page); await sleep(400); state = await inspect(page); assert.equal(state.scheduler.pending, 0); assert.equal(state.scheduler.frames, hidden.scheduler.frames); assert.equal(state.worker.workerCount, 0);
    record('synthetic native hidden lifecycle has zero queue', { before: hidden.scheduler, after: state.scheduler });
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('glyph-widget-lifecycle', { detail: { visible: true } })));
    // Real MiniLM Worker is created, then canceled before its guarded external download can persist.
    await help(page); await page.locator('#prepare-model').click(); await page.waitForFunction(() => window.__WIDGET_ART__.inspect().worker.started > 0);
    await page.locator('#provider').selectOption('tiny'); await page.waitForFunction(() => window.__WIDGET_ART__.inspect().worker.workerCount === 0);
    const cancelled = await inspect(page); await sleep(300); state = await inspect(page); assert.equal(state.provider, 'tiny'); assert.equal(state.busy, false); assert.deepEqual(state.batches, saved.batches); assert.deepEqual(state.scene.program.spec, saved.program); assert.equal(state.browserModel, null);
    record('MiniLM prepare cancellation/provider switch keeps body and releases Worker', { started: state.worker.started, stopped: state.worker.stopped, browserInfo: state.browserModel });
    // Fresh page with a paused module response makes import races reproducible.
    const raceContext = await browser.newContext({ viewport: { width: 680, height: 500 } });
    await raceContext.addInitScript(() => { localStorage.clear(); window.__testWorkers = []; const NativeWorker = window.Worker; window.Worker = class extends NativeWorker { constructor(url, options) { window.__testWorkers.push(String(url)); super(url, options); } }; });
    let releaseImport, sawImport; const release = new Promise(r => releaseImport = r), saw = new Promise(r => sawImport = r);
    const raceRequests = [];
    await raceContext.route('**/*', async route => { const url = route.request().url(); if (url.includes('/src/widget-student-guard-v2.ts')) { sawImport(); await release; await route.continue(); } else if (!url.startsWith(origin)) { raceRequests.push(url); await route.abort(); } else await route.continue(); });
    const racePage = await raceContext.newPage(); racePage.on('pageerror', e => report.exceptions.push(String(e))); await racePage.goto(`${origin}/widget.html`); await racePage.waitForFunction(() => window.__WIDGET_ART__); await help(racePage); await racePage.locator('#provider').selectOption('tiny'); await saw;
    await racePage.locator('#text-input').fill('棒の先端に球体'); await racePage.locator('#text-input').press('Enter'); await racePage.waitForFunction(() => window.__WIDGET_ART__.inspect().busy);
    await help(racePage); await racePage.locator('#provider').selectOption('rules'); releaseImport(); await sleep(500);
    let raced = await inspect(racePage); assert.equal(raced.count, 1); assert.equal(raced.batches.length, 0); assert.equal(raced.resolution, null); assert.equal(raced.provider, 'rules'); assert.equal(raced.busy, false); assert.match(await racePage.locator('#connection').textContent(), /根性/);
    record('deferred tiny import discarded after provider switch', { count: raced.count, provider: raced.provider, browserModel: raced.browserModel });
    await raceContext.close();
    const resetContext = await browser.newContext({ viewport: { width: 680, height: 500 } });
    let releaseResetImport, sawResetImport; const resetRelease = new Promise(r => releaseResetImport = r), resetSaw = new Promise(r => sawResetImport = r);
    await resetContext.route('**/*', async route => { const url = route.request().url(); if (url.includes('/src/widget-student-guard-v2.ts')) { sawResetImport(); await resetRelease; await route.continue(); } else if (!url.startsWith(origin)) { raceRequests.push(url); await route.abort(); } else await route.continue(); });
    const resetPage = await resetContext.newPage(); resetPage.on('pageerror', e => report.exceptions.push(String(e))); await resetPage.goto(`${origin}/widget.html`); await resetPage.waitForFunction(() => window.__WIDGET_ART__);
    await feed(resetPage, '表面 鳥'); await help(resetPage); await resetPage.locator('#provider').selectOption('tiny'); await resetSaw;
    await resetPage.locator('#text-input').fill('棒の先端に球体'); await resetPage.locator('#text-input').press('Enter'); await resetPage.waitForFunction(() => window.__WIDGET_ART__.inspect().busy);
    await resetPage.locator('#reset').click(); releaseResetImport(); await sleep(500); const resetRaced = await inspect(resetPage);
    assert.equal(resetRaced.count, 1); assert.equal(resetRaced.batches.length, 0); assert.equal(resetRaced.resolution, null); assert.equal(resetRaced.timings.length, 0); assert.equal(resetRaced.busy, false); assert.equal(resetRaced.scene.program, null);
    record('reset rejects deferred classifier result; loaded module may remain', { count: resetRaced.count, tinyLoaded: resetRaced.tinyClassifier.loaded, atlas: resetRaced.scene.atlas }); await resetContext.close();
    // Reset while a real absorption is pending must cancel stale timing and preserve tiny module accounting.
    state = await feed(page, '球体の上に箱', false); assert.equal(state.busy, true); await page.locator('#reset').click(); await sleep(500); state = await inspect(page); assert.equal(state.count, 1); assert.equal(state.batches.length, 0); assert.equal(state.resolution, null); assert.equal(state.timings.length, 0); assert.equal(state.busy, false); assert.equal(state.scene.atlas.rows, 1);
    record('reset cancels active absorption and shrinks atlas', { count: state.count, atlas: state.scene.atlas });
    await help(page); await page.locator('#repeat').selectOption('256'); const fullSource = '青い空を歩く🌊e\u0301'.repeat(25);
    state = await feed(page, fullSource); assert(state.count > 31500 && state.count <= 32000); assert.equal(state.scene.drawn, 1536); assert.equal(state.batches.at(-1).text, fullSource);
    if (state.count < 32000) state = await feed(page, '✦'); assert.equal(state.count, 32000);
    const capacitySave = state.batches; await page.reload(); await page.waitForFunction(() => window.__WIDGET_ART__); state = await inspect(page); assert.equal(state.count, 32000); assert.deepEqual(state.batches, capacitySave);
    record('full capacity stores original Unicode source; draws only cap; reload exact', { count: state.count, drawn: state.scene.drawn, sourceCodeUnits: fullSource.length, batches: state.batches });
    assert.equal(raceRequests.length, 0); assert.equal(report.exceptions.length, 0);
    const tinyPhase = await page.evaluate(() => window.__testWorkers); // Reloaded default page should have no Worker.
    assert.equal(tinyPhase.length, 0);
    record('no new Worker in tiny/default path and no unhandled exceptions', { reloadWorkers: tinyPhase, exceptions: report.exceptions });
    report.passed = true;
  }
} catch (error) {
  report.failure = { message: String(error).replaceAll(repo, '<repo>'), stack: error.stack?.replaceAll(repo, '<repo>') };
  const filename = process.argv.includes('--baseline-only') ? 'initial-default-failure.json' : `failure-${Date.now()}.json`;
  await writeFile(path.join(import.meta.dirname, filename), JSON.stringify(report, null, 2));
  console.error(error); process.exitCode = 1;
} finally {
  for (const file of frozenFiles) { const after = createHash('sha256').update(await readFile(path.join(repo, file))).digest('hex'); if (after !== report.freezeSha256[file]) { report.failure = { message: `${file} frozen hash changed` }; report.passed = false; process.exitCode = 1; } }
  await writeFile(path.join(import.meta.dirname, 'ui-regression-result.json'), JSON.stringify(report, null, 2));
  await context?.close(); await browser?.close(); server.kill('SIGTERM');
}
console.log(JSON.stringify({ passed: report.passed, tests: report.tests.length, measurements: report.measurements.map(m => ({ text: m.text, source: m.source, totalMs: m.totalMs, classifierMs: m.classifierMs, guardMs: m.guardMs })), externalRequests: report.requests.length, exceptions: report.exceptions.length, failure: report.failure }));
