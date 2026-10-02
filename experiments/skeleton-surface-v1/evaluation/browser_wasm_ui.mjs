import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const directory = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(directory, '../../..');
const require = createRequire(path.join(root, 'prototypes/glyph-creature/package.json'));
const { chromium } = require('@playwright/test');
const fixture = JSON.parse(fs.readFileSync(path.join(directory, 'fixture.json'), 'utf8'));
const selectedIds = ['paraphrase-vase-ja', 'attr-sword-bend', 'attr-ring-twist', 'attr-cube-wide-en'];
const selected = selectedIds.map(id => fixture.cases.find(row => row.id === id));
const destination = path.join(directory, 'browser-wasm-ui-1.json');
if (fs.existsSync(destination)) throw new Error('Refusing to overwrite browser result');
const executablePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({ headless: true, ...(fs.existsSync(executablePath) ? { executablePath } : {}) });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const errors = [], requests = [];
let phase = 'startup';
page.on('pageerror', error => errors.push(error.message));
context.on('request', request => {
  const host = new URL(request.url()).hostname;
  if (!['127.0.0.1', 'localhost'].includes(host)) requests.push({ phase, host, method: request.method(), resourceType: request.resourceType() });
});
async function ready() {
  await page.goto('http://127.0.0.1:4212/skeleton.html', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.__SKELETON_ART__);
  await page.keyboard.press('Enter');
  await page.locator('#guide summary').click();
  await page.locator('#repeat').selectOption('64');
}
async function prepare() {
  const before = performance.now();
  await page.locator('#prepare-model').click();
  await page.waitForFunction(() => !!window.__SKELETON_ART__.inspect().browserModel, undefined, { timeout: 60000 });
  return { wallMs: performance.now() - before, model: await page.evaluate(() => window.__SKELETON_ART__.inspect().browserModel) };
}
async function feed(item) {
  const before = await page.evaluate(() => window.__SKELETON_ART__.inspect());
  if (!before.terminalOpen) await page.keyboard.press('Enter');
  await page.locator('#text-input').fill(item.text);
  await page.locator('#text-input').press('Enter');
  await page.waitForFunction(previous => window.__SKELETON_ART__.inspect().timings.length > previous, before.timings.length, { timeout: 35000 });
  const after = await page.evaluate(() => window.__SKELETON_ART__.inspect());
  return { id: item.id, spec: after.scene.skeleton, expectedFamily: item.expectedFamily, familyPass: after.scene.skeleton?.family === item.expectedFamily,
    previousCharactersRetained: before.characters.every(letter => after.characters.includes(letter)), previousBatchesRetained: after.batches.length === before.batches.length + 1,
    finite: after.scene.finite, timing: after.timings.at(-1), glyphs: after.count };
}
let cold, warm, rows = [], stress;
try {
  await ready(); phase = 'cold-model-preparation'; cold = await prepare();
  await page.locator('#guide summary').click(); phase = 'interpretation-and-render';
  for (const item of selected) rows.push(await feed(item));
  await page.screenshot({ path: path.join(root, '.local/skeleton-evaluation/browser-wasm-ui-cube.png') });
  phase = 'warm-model-preparation'; await ready(); warm = await prepare();
  await page.locator('#guide summary').click();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  phase = 'synthetic-4x-throttle'; stress = await feed(fixture.cases.find(row => row.id === 'attr-sphere-tall-en'));
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
} finally { await browser.close(); }
const summary = {
  cases: rows.length, familyPass: rows.filter(row => row.familyPass).length,
  retainedHistoryPass: rows.filter(row => row.previousCharactersRetained && row.previousBatchesRetained).length,
  allUnder10s: rows.every(row => row.timing.totalMs <= 10000), allUnder30s: rows.every(row => row.timing.totalMs <= 30000),
  inferenceExternalRequests: requests.filter(row => row.phase === 'interpretation-and-render' || row.phase === 'synthetic-4x-throttle').length,
  caveat: 'Actual UI browser WASM on Apple M5 32GB. Download/preparation measured separately; totalMs includes interpretation, geometry/glyph generation and absorption completion. 4x CDP throttling is only artificial stress and is not a 16GB laptop test. Same already-seen fixture after fixes: regression/acceptance, not new held-out accuracy.'
};
fs.writeFileSync(destination, JSON.stringify({ summary, cold, warm, rows, stress, requests, errors }, null, 2) + '\n');
console.log(JSON.stringify({ summary, cold, warm, rows, stress, errors }, null, 2));
