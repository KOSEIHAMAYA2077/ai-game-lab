/** Production widget v3 capacity regression adapted from the v2 harness; artificial inputs only. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, '../..');
const require = createRequire(path.join(root, 'prototypes/glyph-creature/package.json'));
const { chromium } = require('@playwright/test');
const url = process.argv[2] ?? 'http://127.0.0.1:4267/widget.html';
const output = process.argv[3] ?? path.join(directory, 'raw-capacity-result.json');
if (fs.existsSync(output)) throw Error('Refusing to overwrite an evaluation');
const artificial = [
  '白い球体' + 'あ'.repeat(121),
  '青い箱' + 'い'.repeat(98),
  '黄色いメビウスの輪' + 'う'.repeat(120) + 'e\u0301👩🏽‍🚀',
];
const dist = process.argv[4] ?? path.join(root, '.local/widget-v3-release-source/prototypes/glyph-creature/dist');
const hashes = () => Object.fromEntries(['widget.html', ...fs.readdirSync(path.join(dist, 'assets'))
  .filter(name => /\.(js|css)$/.test(name)).map(name => `assets/${name}`)]
  .map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(path.join(dist, file))).digest('hex')]));
const beforeHashes = hashes(), external = [], errors = [], cases = [];
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const context = await browser.newContext({ viewport: { width: 400, height: 440 }, deviceScaleFactor: 1 });
context.on('request', request => {
  const host = new URL(request.url()).hostname;
  if (host && host !== '127.0.0.1') external.push(host);
});
const page = await context.newPage();
page.on('pageerror', error => errors.push(error.message));
const inspect = () => page.evaluate(() => window.__WIDGET_ART__.inspect());
try {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.__WIDGET_ART__);
  await page.keyboard.press('Enter');
  await page.locator('#guide summary').click();
  await page.locator('#repeat').selectOption('256');
  await page.locator('#guide summary').click();
  for (const text of artificial) {
    const before = await inspect();
    if (!before.terminalOpen) await page.locator('#write-word').click();
    await page.locator('#text-input').fill(text);
    await page.locator('#text-input').press('Enter');
    await page.waitForFunction(n => window.__WIDGET_ART__.inspect().timings.length > n,
      before.timings.length, { timeout: 15000 });
    const after = await inspect();
    cases.push({ submitted: text, beforeCount: before.count, afterCount: after.count,
      fullTextRetained: after.batches.at(-1)?.text === text,
      priorBatchesRetained: before.batches.every((b, i) => JSON.stringify(b) === JSON.stringify(after.batches[i])),
      newBatch: after.batches.at(-1), drawn: after.scene.drawn,
      finite: after.scene.finite, workerActive: after.worker.workerActive });
  }
  const full = await inspect();
  await page.locator('#pause').click();
  const imageDir = path.join(root, '.local/widget-v3-release-verification-qa', path.basename(output, '.json'));
  fs.mkdirSync(imageDir, { recursive: true });
  await page.screenshot({ path: path.join(imageDir, 'capacity.png') });
  await page.reload();
  await page.waitForFunction(() => !!window.__WIDGET_ART__);
  const restored = await inspect();
  const persistence = { beforeCount: full.count, restoredCount: restored.count,
    batchesIdentical: JSON.stringify(full.batches) === JSON.stringify(restored.batches),
    charactersIdentical: JSON.stringify(full.characters) === JSON.stringify(restored.characters),
    inksIdentical: JSON.stringify(full.inks) === JSON.stringify(restored.inks),
    specIdentical: JSON.stringify(full.spec) === JSON.stringify(restored.spec),
    drawn: restored.scene.drawn, finite: restored.scene.finite };
  const checks = {
    allFullInputsRetained: cases.every(c => c.fullTextRetained && c.priorBatchesRetained),
    tailAcceptedOnlyPartOfFinalInput: cases.at(-1).newBatch.added < Array.from(new Intl.Segmenter('ja', { granularity: 'grapheme' }).segment(artificial.at(-1))).length,
    capacityReached: full.count === 32000 && restored.count === 32000,
    restoredAllHistory: persistence.batchesIdentical && persistence.charactersIdentical && persistence.inksIdentical && persistence.specIdentical,
    boundedFiniteRendering: cases.every(c => c.drawn <= 1536 && c.finite && !c.workerActive) && persistence.drawn <= 1536 && persistence.finite,
    noExternalRequests: !external.length, noPageErrors: !errors.length,
    artifactsUnchanged: JSON.stringify(beforeHashes) === JSON.stringify(hashes()),
  };
  const result = { version: 1, note: 'Fresh browser context, artificial inputs only. UI fill/Enter and reload; not Japanese IME or whole-app performance.', cases, persistence, checks, external, errors, artifactHashes: beforeHashes };
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(checks));
  if (Object.values(checks).some(value => !value)) process.exitCode = 1;
} finally { await browser.close(); }
