import { chromium } from '../../prototypes/glyph-creature/node_modules/@playwright/test/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';

// Synthetic text in a disposable browser context; no user draft or screenshot is read.
// Usage: node experiments/surface-coverage-20260930/qa-capture.mjs candidate http://127.0.0.1:4173/
const label = process.argv[2] || 'candidate';
if (!/^[a-z0-9-]+$/.test(label)) throw new Error('Use a simple output label.');
const url = process.argv[3] || 'http://127.0.0.1:4173/';
const output = new URL(`./qa/${label}/`, import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const cases = [
  ['sphere-512', '流れる 球体', 512],
  ['sphere-2048', '流れる 球体', 2048],
  ['sphere-8192', '流れる 球体', 8192],
  ['cube-2048', '流れる 立方体', 2048],
  ['dango-2048', '流れる だんご', 2048],
];
const results = [], errors = [];
try {
  for (const [name, command, count] of cases) {
    const context = await browser.newContext({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(`${name}: ${error.message}`));
    await page.goto(url);
    await page.waitForFunction(() => Boolean(window.__GLYPH_ART__));
    await page.evaluate(() => window.__GLYPH_ART__.reset(7));
    await page.keyboard.press('Enter');
    if (!await page.locator('#repeat').isVisible()) await page.locator('#guide summary').click();
    await page.locator('#repeat').selectOption('1');
    const filler = [...'あいうえおかきくけこさしすせそ'];
    const text = command + Array.from({ length: count - 1 - [...command.replace(/\s/g, '')].length }, (_, i) => filler[i % filler.length]).join('');
    await page.locator('#text-input').fill(text);
    await page.locator('#text-input').press('Enter');
    await page.evaluate(() => window.__GLYPH_ART__.pause(true));
    await page.addStyleTag({ content: '#app > :not(#scene) { visibility: hidden !important; }' });
    const snapshots = [];
    for (let second = 1; second <= 20; second++) {
      // Input intentionally uses the normal UI. Account for the RAF between Enter and pause.
      await page.evaluate(second => { const api = window.__GLYPH_ART__; api.step((second - api.inspect().time) * 1000); }, second);
      if (![12, 20].includes(second)) continue;
      const sample = await page.evaluate(() => {
        const canvas = document.querySelector('#scene canvas');
        const copy = document.createElement('canvas'); copy.width = canvas.width; copy.height = canvas.height;
        const ctx = copy.getContext('2d', { willReadFrequently: true }); ctx.drawImage(canvas, 0, 0);
        const pixels = ctx.getImageData(0, 0, copy.width, copy.height).data;
        const lit = (x, y) => { const i = (y * copy.width + x) * 4; return pixels[i] + pixels[i + 1] + pixels[i + 2] > 120; };
        let minX = copy.width, minY = copy.height, maxX = -1, maxY = -1, litPixels = 0, edgePixels = 0;
        for (let y = 0; y < copy.height; y++) for (let x = 0; x < copy.width; x++) if (lit(x, y)) {
          minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); litPixels++;
          if (x < 6 || x >= copy.width - 6 || y < 6 || y >= copy.height - 6) edgePixels++;
        }
        const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, rx = (maxX - minX) / 2, ry = (maxY - minY) / 2;
        let innerPixels = 0, innerLit = 0, cells = 0, cellsWithInk = 0;
        // Central ellipse deliberately excludes silhouette. A line can fill its bounds but leaves most cells blank.
        for (let gy = 0; gy < 16; gy++) for (let gx = 0; gx < 16; gx++) {
          const nx = (gx + .5) / 8 - 1, ny = (gy + .5) / 8 - 1;
          if (nx * nx + ny * ny > .7 * .7) continue;
          cells++; let ink = 0;
          const x0 = Math.floor(cx + (gx / 8 - 1) * rx), x1 = Math.floor(cx + ((gx + 1) / 8 - 1) * rx);
          const y0 = Math.floor(cy + (gy / 8 - 1) * ry), y1 = Math.floor(cy + ((gy + 1) / 8 - 1) * ry);
          for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { innerPixels++; if (lit(x, y)) { innerLit++; ink++; } }
          if (ink >= 3) cellsWithInk++;
        }
        const state = window.__GLYPH_ART__.inspect();
        return { time: state.time, count: state.count, seed: state.seed, spec: state.spec, scene: state.scene,
          pixels: { bounds: [minX, minY, maxX, maxY], litPixels, edgePixels, innerInkFraction: innerLit / innerPixels, filledCentralCells: cellsWithInk, centralCells: cells } };
      });
      if (sample.count !== count || !sample.scene.finite) throw new Error(`${name}: invalid capture state`);
      sample.image = `${name}-t${second}.png`;
      await page.locator('#scene canvas').screenshot({ path: new URL(sample.image, output).pathname });
      snapshots.push(sample);
    }
    results.push({ name, command, count, snapshots });
    console.log(JSON.stringify({ label, name, snapshots: snapshots.map(s => ({ time: s.time, pixels: s.pixels })) }));
    await context.close();
  }
  await writeFile(new URL('results.json', output), JSON.stringify({ viewport: [1200, 900], browser: browser.version(), syntheticInput: true, actualImeTested: false, errors, results }, null, 2));
  if (errors.length) throw new Error(errors.join('\n'));
} finally { await browser.close(); }
