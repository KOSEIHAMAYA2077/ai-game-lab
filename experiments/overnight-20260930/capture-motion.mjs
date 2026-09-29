import { chromium } from '../../prototypes/glyph-creature/node_modules/@playwright/test/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';

const folder = new URL(`./comparison/${process.argv[2] || 'motion'}/`, import.meta.url);
await mkdir(folder, { recursive: true });
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 1 });
const errors = [], results = [];
page.on('pageerror', e => errors.push(e.message));
try {
  await page.goto('http://127.0.0.1:4173/');
  await page.waitForFunction(() => window.__GLYPH_ART__);
  const cases = [
    ['cube-calm', '表面 黄色 立方体', 2048, 10.472],
    ['cube-breathe-out', '表面 呼吸する 黄色 立方体', 2048, 10.472],
    ['cube-breathe-in', '表面 呼吸する 黄色 立方体', 2048, 14.661],
    ['mobius-calm', '流れる メビウスの輪', 2048, 10.472],
    ['mobius-wave', '流れる 波打つ メビウスの輪', 2048, 10.472],
    ['dango-sparse', 'だんご', 64, 10.472],
    ['dango-surface', '表面 だんご', 2048, 10.472],
    ['dango-flow', '流れる だんご', 2048, 10.472],
    ['dango-breathe', '表面 呼吸する だんご', 2048, 10.472],
    ['dango-pair', '表面 呼吸する だんご 2個', 2048, 10.472],
  ];
  for (const [name, command, count, time] of cases) {
    await page.evaluate(({ command, count, time }) => {
      const api = window.__GLYPH_ART__; api.reset(1);
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      document.querySelector('#repeat').value = '1';
      document.querySelector('#text-input').value = command + Array.from({ length: count - 1 - [...command.replace(/\s/g, '')].length }, (_, i) => [...'あいうえおかきくけ'][i % 9]).join('');
      document.querySelector('#feed-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      api.pause(true);
      for (let i = 0; i < Math.floor(time); i++) api.step(1000);
      api.step((time % 1) * 1000);
    }, { command, count, time });
    // Export only the art canvas, without temporary help or controls over it.
    const data = await page.locator('#scene canvas').evaluate(canvas => canvas.toDataURL('image/png'));
    await writeFile(new URL(`${name}.png`, folder), Buffer.from(data.split(',')[1], 'base64'));
    const state = await page.evaluate(() => window.__GLYPH_ART__.inspect());
    results.push({ name, command, ...state });
    console.log(JSON.stringify({ name, count: state.count, spec: state.spec, finite: state.scene.finite }));
  }
  await writeFile(new URL('results.json', folder), JSON.stringify({ errors, results }, null, 2));
  if (errors.length) throw new Error(errors.join('\n'));
} finally { await browser.close(); }
