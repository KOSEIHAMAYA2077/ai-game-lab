import { chromium } from '../../prototypes/glyph-creature/node_modules/@playwright/test/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';

// Runs in a disposable browser profile; it never reads the user's writing/diary.
const label = process.argv[2] ?? 'baseline';
const folder = new URL(`./comparison/${label}/`, import.meta.url);
await mkdir(folder, { recursive: true });
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 1 });
const errors = [], results = [];
page.on('pageerror', e => errors.push(e.message));
try {
  await page.goto('http://127.0.0.1:4173/');
  await page.waitForFunction(() => window.__GLYPH_ART__);
  const cases = process.argv[3] === 'forms'
    ? [
        { count: 512, text: '表面 球体', name: 'sphere-surface' },
        { count: 512, text: '流れる 球体', name: 'sphere-flow' },
        { count: 512, text: '表面 メビウスの輪', name: 'mobius-surface' },
        { count: 512, text: '流れる メビウスの輪', name: 'mobius-flow' },
        { count: 4096, text: '表面 メビウスの輪', name: 'mobius-dense' },
      ]
    : [1, 2, 4, 16, 64, 512, 4096].map(count => ({ count, text: '', name: `${count}` }));
  for (const { count, text, name } of cases) {
    await page.evaluate(({ n, text }) => {
      const api = window.__GLYPH_ART__;
      api.reset(1);
      if (n > 1) {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        document.querySelector('#repeat').value = '1';
        document.querySelector('#text-input').value = text + Array.from({ length: n - 1 - [...text.replace(/\s/g, '')].length }, (_, i) => [...'あいうえおかきくけ'][i % 9]).join('');
        document.querySelector('#feed-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      }
      api.pause(true);
      api.step(10000);
    }, { n: count, text });
    await page.locator('#scene canvas').screenshot({ path: new URL(`${name}.png`, folder).pathname });
    const state = await page.evaluate(() => {
      const api = window.__GLYPH_ART__;
      const source = document.querySelector('#scene canvas');
      const canvas = document.createElement('canvas'); canvas.width = source.width; canvas.height = source.height;
      const ctx = canvas.getContext('2d'); ctx.drawImage(source, 0, 0);
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let minX = canvas.width, maxX = 0, minY = canvas.height, maxY = 0, lit = 0;
      for (let i = 0; i < data.length; i += 4) if (data[i] + data[i + 1] + data[i + 2] > 100) {
        const x = i / 4 % canvas.width, y = Math.floor(i / 4 / canvas.width);
        minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); lit++;
      }
      return { ...api.inspect(), image: { bounds: [minX, minY, maxX, maxY], lit } };
    });
    results.push({ name, ...state });
    console.log(JSON.stringify({ count, name, image: state.image, scene: state.scene }));
  }
  await writeFile(new URL('results.json', folder), JSON.stringify({ label, errors, results }, null, 2));
  if (errors.length) throw new Error(errors.join('\n'));
} finally { await browser.close(); }
