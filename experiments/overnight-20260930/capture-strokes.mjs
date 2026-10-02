import { chromium } from '../../prototypes/glyph-creature/node_modules/@playwright/test/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
const folder = new URL(`./comparison/${process.argv[2] || 'strokes-baseline'}/`, import.meta.url);
await mkdir(folder, { recursive: true });
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 1 });
  await page.addInitScript(() => { let seed = 12345; Math.random = () => { seed = Math.imul(1664525, seed) + 1013904223 | 0; return (seed >>> 0) / 4294967296; }; });
  await page.clock.install({ time: new Date('2026-09-30T12:00:00Z') });
  await page.goto('http://127.0.0.1:4173/strokes.html');
  await page.locator('#strokes-scene[data-strokes="11"]').waitFor();
  await page.clock.pauseAt(new Date('2026-09-30T12:00:01Z'));
  const results = [];
  const save = async name => {
    const snapshot = await page.locator('#strokes-scene').evaluate(c => {
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let minX = c.width, minY = c.height, maxX = 0, maxY = 0, lit = 0;
      for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
        const i = (y * c.width + x) * 4;
        if (d[i] + d[i + 1] + d[i + 2] > 180) { lit++; minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }
      }
      return { png: c.toDataURL('image/png').split(',')[1], mode: c.dataset.mode, lit, bounds: [minX, minY, maxX, maxY], inspect: window.__GLYPH_STROKES__?.inspect() };
    });
    const { png, ...measurements } = snapshot;
    await writeFile(new URL(`${name}.png`, folder), Buffer.from(png, 'base64'));
    results.push({ name, ...measurements });
  };
  await page.clock.runFor(4000); await save('write');
  for (const mode of ['scatter', 'flow', 'gather']) {
    await page.locator(`[data-motion="${mode}"]`).dispatchEvent('click');
    await page.clock.runFor(16); await save(`${mode}-16ms`);
    await page.clock.runFor(284); await save(`${mode}-300ms`);
    await page.clock.runFor(2700); await save(`${mode}-3000ms`);
  }
  await writeFile(new URL('results.json', folder), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results.map(({ name, bounds, lit }) => ({ name, bounds, lit }))));
} finally { await browser.close(); }
