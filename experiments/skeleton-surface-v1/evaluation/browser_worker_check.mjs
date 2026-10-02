import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, '../../..');
const require = createRequire(path.join(root, 'prototypes/glyph-creature/package.json'));
const { chromium } = require('@playwright/test');
const fixtureBytes = fs.readFileSync(path.join(directory, 'fixture.json'));
const fixtureSha = crypto.createHash('sha256').update(fixtureBytes).digest('hex');
if (fixtureSha !== fs.readFileSync(path.join(directory, 'fixture.sha256'), 'utf8').split(/\s+/)[0]) throw new Error('Fixture hash changed');
const fixture = JSON.parse(fixtureBytes);
const destination = path.join(directory, 'browser-worker-regression-1.json');
if (fs.existsSync(destination)) throw new Error('Refusing to overwrite browser result');
const executablePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({ headless: true, ...(fs.existsSync(executablePath) ? { executablePath } : {}) });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
let result;
try {
  await page.goto('http://127.0.0.1:4212/skeleton.html', { waitUntil: 'networkidle' });
  result = await page.evaluate(async (cases) => {
    const module = await import('/src/skeleton-browser-client.ts');
    const beforeLoad = performance.now();
    const progress = [];
    const model = await module.loadBrowserModel(value => { if (!progress.length || progress[progress.length - 1].stage !== value.stage) progress.push(value); });
    const preparationWallMs = performance.now() - beforeLoad;
    const rows = [];
    for (const item of cases) {
      const start = performance.now();
      const output = await module.browserModelResolution(item.text, new AbortController().signal);
      rows.push({ id: item.id, group: item.group, wallMs: performance.now() - start, output });
    }
    return { model, preparationWallMs, progress, rows };
  }, fixture.cases);
} finally { await browser.close(); }
fs.writeFileSync(destination, JSON.stringify({ fixtureSha256: fixtureSha, evaluationUse: 'First measurement of browser engine using the same already-seen fixture after Python controller fixes; regression/engine parity, not fresh held-out accuracy.', includesGeometryOrRendering: false, errors, ...result }, null, 2) + '\n');
console.log(JSON.stringify({ model: result.model, preparationWallMs: result.preparationWallMs, cases: result.rows.length, errors }, null, 2));
