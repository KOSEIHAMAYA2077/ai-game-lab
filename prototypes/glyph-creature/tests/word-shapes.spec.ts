import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
const evidence = '../../experiments/word-shapes-v2/evidence';
test.use({ viewport: { width: 1280, height: 960 }, deviceScaleFactor: 1 });
const inspect = (page: Page) => page.evaluate(() => (window as any).__GLYPH_ART__.inspect());
async function feed(page: Page, words: string, count = 4096) {
  await page.keyboard.press('Enter');
  if (!await page.locator('#repeat').isVisible()) await page.locator('#guide summary').click();
  await page.locator('#repeat').selectOption('1');
  await page.locator('#text-input').fill(words + 'ことば水光abcdefghijklmnopqrstuvwxyz'.repeat(Math.ceil(count / 31)).slice(0, count - 1 - [...words.replace(/\s/g, '')].length));
  await page.locator('#text-input').press('Enter');
  await page.evaluate(() => { const api = (window as any).__GLYPH_ART__; api.pause(); for (let i = 0; i < 12; i++) api.step(1000); });
}

test('十種類の表面を文章から選び、文字・色・有限な描画を保つ', async ({ page }) => {
  test.setTimeout(90000); mkdirSync(evidence, { recursive: true });
  const errors: string[] = [], requests: string[] = []; page.on('pageerror', e => errors.push(e.message));
  page.on('console', e => { if (e.type() === 'error') errors.push(e.text()); });
  page.on('request', r => requests.push(r.url()));
  const records = [];
  for (const [shape, word] of Object.entries({ flower: '花', butterfly: '蝶', jellyfish: 'くらげ', tree: '木', star: '星', helix: '螺旋', hourglass: '砂時計', saturn: '土星', sword: '剣', vase: '花瓶' })) {
    await page.goto('/'); await page.waitForFunction(() => Boolean((window as any).__GLYPH_ART__));
    await page.evaluate(() => (window as any).__GLYPH_ART__.reset(927));
    await feed(page, `白い文字が${word}の表面を流れる`);
    const state = await inspect(page);
    expect(state.spec.shape).toBe(shape); expect(state.scene.finite).toBe(true); expect(state.count).toBe(4096);
    expect(state.batches[0].ink).toBe('white'); expect(state.scene.drawn).toBe(4096);
    await expect(page.locator('#terminal')).toBeHidden(); await expect(page.locator('#learned-shapes')).toHaveCount(0);
    await page.screenshot({ path: `${evidence}/${shape}-4096.png` });
    await page.evaluate(() => { const api = (window as any).__GLYPH_ART__; for (let i = 0; i < 18; i++) api.step(1000); });
    const later = await inspect(page); expect(later.scene.finite).toBe(true); expect(later.scene.points).not.toEqual(state.scene.points);
    await page.screenshot({ path: `${evidence}/${shape}-4096-t30.png` });
    records.push({ shape, count: state.count, shapeState: state.spec, finite: later.scene.finite, changed: true });
  }
  expect(errors).toEqual([]); expect(requests.filter(url => !url.startsWith('http://127.0.0.1:4194') && !url.startsWith('data:'))).toEqual([]);
  expect(requests.some(url => /learned-shape|model\.json/.test(url))).toBe(false);
  writeFileSync(`${evidence}/surfaces.json`, JSON.stringify({ records, errors, externalRequests: [], modelLoaded: false }, null, 2));
});

test('分類から形を選び、執筆の特定語でも追加形へ移る', async ({ page }) => {
  await page.goto('/'); await page.waitForFunction(() => Boolean((window as any).__GLYPH_ART__));
  await page.keyboard.press('Enter'); await page.locator('#text-input').fill('エンター'); await page.locator('#text-input').press('Enter');
  await page.locator('#choose-form').click(); await page.locator('#quick-forms summary').filter({ hasText: '生きもの' }).click();
  await page.locator('[data-shape="jellyfish"]').click(); expect((await inspect(page)).spec.shape).toBe('jellyfish');
  await page.goto('/?write'); await page.waitForFunction(() => Boolean((window as any).__GLYPH_ART__));
  await page.locator('#manuscript').fill('砂時計を眺める。');
  await expect.poll(async () => (await inspect(page)).spec.shape).toBe('hourglass');
  const count = (await inspect(page)).count; await page.locator('#manuscript').fill('砂時計を眺める。花瓶の話も加える。');
  await expect.poll(async () => (await inspect(page)).count).toBeGreaterThan(count);
});

test('少数文字から＋文字で増やしても、後で選んだ形と前の色を変えない', async ({ page }) => {
  await page.goto('/'); await page.waitForFunction(() => Boolean((window as any).__GLYPH_ART__));
  await page.keyboard.press('Enter'); await page.locator('#text-input').fill('赤い花'); await page.locator('#text-input').press('Enter');
  const first = await inspect(page); expect(first.count).toBe(193);
  await page.locator('#choose-form').click(); await page.locator('#quick-forms summary').filter({ hasText: 'もの・空' }).click();
  await page.locator('[data-shape="vase"]').click();
  await page.locator('#thicken').click();
  const next = await inspect(page); expect(next.count).toBe(385); expect(next.spec.shape).toBe('vase');
  expect(next.batches.map((batch: any) => batch.ink)).toEqual(['red', 'red']);
  expect(next.batches[0]).toEqual(first.batches[0]); expect(next.scene.finite).toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('#thicken')).toBeInViewport();
  await page.locator('#show-help').click(); await expect(page.locator('#feed')).toBeInViewport(); await expect(page.locator('#close')).toBeInViewport();
  await page.locator('#close').click(); await expect(page.locator('#terminal')).toBeHidden();
});

test('一時間相当の時刻前進でも全追加形状が有限で画面に残る', async ({ page }) => {
  test.setTimeout(90000); mkdirSync(evidence, { recursive: true });
  const records = [];
  for (const [shape, word] of Object.entries({ flower: '花', butterfly: '蝶', jellyfish: 'くらげ', tree: '木', star: '星', helix: '螺旋', hourglass: '砂時計', saturn: '土星', sword: '剣', vase: '花瓶' })) {
    await page.goto('/'); await page.waitForFunction(() => Boolean((window as any).__GLYPH_ART__));
    await page.evaluate(() => (window as any).__GLYPH_ART__.reset(927));
    await feed(page, `白い文字が${word}の表面を流れる`);
    await page.evaluate(() => { const api = (window as any).__GLYPH_ART__; for (let i = 0; i < 60; i++) api.step(60000); });
    const state = await inspect(page); expect(state.scene.finite).toBe(true); expect(state.spec.shape).toBe(shape); expect(state.count).toBe(4096);
    const lit = await page.locator('#scene canvas').evaluate((canvas: HTMLCanvasElement) => {
      const copy = document.createElement('canvas'); copy.width = canvas.width; copy.height = canvas.height;
      const ctx = copy.getContext('2d')!; ctx.drawImage(canvas, 0, 0); const pixels = ctx.getImageData(0, 0, copy.width, copy.height).data;
      let lit = 0; for (let i = 0; i < pixels.length; i += 4) if (pixels[i] + pixels[i + 1] + pixels[i + 2] > 120) lit++;
      return lit;
    });
    expect(lit).toBeGreaterThan(1000);
    records.push({ shape, glyphs: state.count, simulationSeconds: state.time, finite: true, litPixels: lit });
    if (['jellyfish', 'mobius', 'vase', 'butterfly'].includes(shape)) await page.screenshot({ path: `${evidence}/${shape}-4096-t3612.png` });
  }
  writeFileSync(`${evidence}/one-hour-simulation.json`, JSON.stringify({ records, note: 'Fixed clock advancement, not a one-hour real-time observation.' }, null, 2));
});
