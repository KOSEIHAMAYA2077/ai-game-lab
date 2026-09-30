import { chromium } from '../../prototypes/glyph-creature/node_modules/@playwright/test/index.mjs';
import { writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
const browser = await chromium.launch({ ...(existsSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome') ? { executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' } : {}) });
const page = await browser.newPage({ viewport: { width: 1280, height: 960 }, deviceScaleFactor: 1 });
const errors = []; page.on('pageerror', e => errors.push(e.message));
await page.goto('http://127.0.0.1:4196'); await page.waitForFunction(() => window.__GLYPH_ART__);
await page.keyboard.press('Enter'); await page.locator('#guide').evaluate(el => el.open = true);
await page.locator('#repeat').selectOption('1'); await page.locator('#auto-shape').uncheck();
await page.locator('#text-input').fill('白い球体' + 'ことばの面'.repeat(700)); await page.locator('#text-input').press('Enter');
await page.keyboard.press('Enter'); await page.locator('#repeat').selectOption('16'); await page.locator('#contour-mode').selectOption('contour');
await page.locator('#text-input').fill('赤いあいうえおかきくけこさしすせそ'); await page.locator('#text-input').press('Enter');
await page.evaluate(() => { const api = window.__GLYPH_ART__; for (let i = 0; i < 300; i++) api.step(1000 / 30); api.pause(false); });
const result = await page.evaluate(async () => {
  const intervals = []; let last = performance.now();
  for (let i = 0; i < 720; i++) { const next = await new Promise(resolve => requestAnimationFrame(resolve)); if (i >= 120) intervals.push(next - last); last = next; }
  intervals.sort((a,b) => a-b); const q = p => intervals[Math.floor(intervals.length * p)];
  const canvas = document.querySelector('#scene canvas'), gl = canvas.getContext('webgl2'), debug = gl?.getExtension('WEBGL_debug_renderer_info');
  return { samples: intervals.length, medianMs: q(.5), p95Ms: q(.95), p99Ms: q(.99), over25ms: intervals.filter(v => v > 25).length, maxMs: Math.max(...intervals),
    graphics: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : 'unavailable', state: window.__GLYPH_ART__.inspect() };
});
await page.evaluate(() => window.__GLYPH_ART__.pause());
const hashes = {}; for (const file of ['src/contour.ts', 'src/scene.ts', 'src/main.ts']) hashes[file] = createHash('sha256').update(await readFile(new URL('../../prototypes/glyph-creature/' + file, import.meta.url))).digest('hex');
await writeFile(new URL('./realtime.json', import.meta.url), JSON.stringify({ browser: await browser.version(), ...result, errors, hashes, note: '600 real animation-frame intervals after 120 warm-up frames. Mac only, not a general-PC guarantee.' }, null, 2));
console.log(JSON.stringify({ count: result.state.count, samples: result.samples, medianMs: result.medianMs, p95Ms: result.p95Ms, p99Ms: result.p99Ms, graphics: result.graphics, errors }));
await browser.close();
