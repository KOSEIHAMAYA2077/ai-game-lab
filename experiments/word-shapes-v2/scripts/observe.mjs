import { chromium } from '../../../prototypes/glyph-creature/node_modules/@playwright/test/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
const directory = new URL('../evidence/', import.meta.url);
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 960 }, deviceScaleFactor: 1 });
const errors = []; page.on('pageerror', e => errors.push(e.message));
const records = [];
for (const [shape, word] of [['flower','花'], ['jellyfish','くらげ'], ['vase','花瓶'], ['saturn','土星']]) {
  await page.goto('http://127.0.0.1:4194/'); await page.waitForFunction(() => window.__GLYPH_ART__);
  await page.keyboard.press('Enter'); await page.locator('#text-input').fill(`白い文字が${word}の表面を流れる`); await page.locator('#text-input').press('Enter');
  await page.evaluate(() => { window.__GLYPH_ART__.pause(); for (let i = 0; i < 12; i++) window.__GLYPH_ART__.step(1000); });
  await page.screenshot({ path: new URL(`${shape}-default-input.png`, directory).pathname });
  const state = await page.evaluate(() => window.__GLYPH_ART__.inspect());
  await page.evaluate(() => window.__GLYPH_ART__.pause(false));
  const timings = await page.evaluate(async () => {
    const samples = []; let last = performance.now();
    for (let i = 0; i < 150; i++) { const now = await new Promise(requestAnimationFrame); if (i >= 30) samples.push(now - last); last = now; }
    samples.sort((a,b) => a-b); return { median: samples[60], p95: samples[114], n: samples.length };
  });
  records.push({ shape, glyphs: state.count, timings });
}
await page.goto('http://127.0.0.1:4194/'); await page.waitForFunction(() => window.__GLYPH_ART__);
await page.keyboard.press('Enter'); await page.locator('#guide summary').click(); await page.locator('#repeat').selectOption('256');
await page.locator('#text-input').fill('表面 白 花瓶' + 'あいうえお'.repeat(25)); await page.locator('#text-input').press('Enter');
await page.evaluate(() => { window.__GLYPH_ART__.pause(); for(let i=0;i<12;i++)window.__GLYPH_ART__.step(1000); window.__GLYPH_ART__.pause(false); });
const heavy = await page.evaluate(async () => {
  const samples = []; let last = performance.now();
  for(let i=0;i<150;i++){const now=await new Promise(requestAnimationFrame);if(i>=30)samples.push(now-last);last=now;}
  samples.sort((a,b)=>a-b); return { glyphs:window.__GLYPH_ART__.inspect().count, median:samples[60],p95:samples[114],n:samples.length};
});
await writeFile(new URL('frame-observation.json',directory),JSON.stringify({browser:await browser.version(),platform:process.platform,records,heavy,errors,note:'Short headless requestAnimationFrame intervals, not GPU time or an ordinary-PC guarantee.'},null,2));
await browser.close();
