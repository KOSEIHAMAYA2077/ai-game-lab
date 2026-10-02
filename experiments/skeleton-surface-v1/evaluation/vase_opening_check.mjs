import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, '../../..');
const require = createRequire(path.join(root, 'prototypes/glyph-creature/package.json'));
const { chromium } = require('@playwright/test');
const captureDir = path.join(root, '.local/skeleton-evaluation');
const executablePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({ headless: true, ...(fs.existsSync(executablePath) ? { executablePath } : {}) });
const results = [];
try {
  for (const [id, text] of [['vase-narrow-opening', '首が細い花瓶'], ['vase-wide-opening', '口が広い花瓶']]) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await page.goto('http://127.0.0.1:4212/skeleton.html', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => !!window.__SKELETON_ART__);
    await page.keyboard.press('Enter');
    await page.locator('#guide summary').click();
    await page.locator('#provider').selectOption('model');
    await page.locator('#guide summary').click();
    await page.locator('#text-input').fill(text);
    await page.locator('#text-input').press('Enter');
    await page.waitForFunction(() => window.__SKELETON_ART__.inspect().timings.length === 1);
    await page.mouse.move(720, 500);
    await page.mouse.down();
    await page.mouse.move(720, 650, { steps: 15 });
    await page.mouse.up();
    await page.locator('#pause').click();
    const state = await page.evaluate(() => window.__SKELETON_ART__.inspect());
    await page.screenshot({ path: path.join(captureDir, `${id}.png`) });
    results.push({ id, text, skeleton: state.scene.skeleton, finite: state.scene.finite, manualRotation: state.scene.manualRotation });
    await page.close();
  }
} finally { await browser.close(); }
const destination = path.join(directory, 'vase-opening-check.json');
if (fs.existsSync(destination)) throw new Error('Refusing to overwrite previous result');
fs.writeFileSync(destination, JSON.stringify({ scope: 'Manual pointer rotation through test browser; known-language acceptance check, not held-out accuracy. Images require human visual review.', results }, null, 2) + '\n');
console.log(JSON.stringify(results, null, 2));
