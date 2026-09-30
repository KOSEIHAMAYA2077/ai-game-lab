import { expect, test, type Page } from '@playwright/test';

test.use({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 1 });

const inspect = (page: Page) => page.evaluate(() => (window as any).__GLYPH_ART__.inspect());
const openTerminal = async (page: Page) => {
  if (!await page.locator('#terminal').isVisible()) await page.keyboard.press('Enter');
  if (!await page.locator('#repeat').isVisible()) await page.locator('#guide summary').click();
};
const feed = async (page: Page, text: string, repeat = '1') => {
  await openTerminal(page);
  await page.locator('#repeat').selectOption(repeat);
  await page.locator('#text-input').fill(text);
  await page.locator('#text-input').press('Enter');
};
const errorsByPage = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  const errors: string[] = []; errorsByPage.set(page, errors);
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/');
  await page.waitForFunction(() => Boolean((window as any).__GLYPH_ART__));
  await page.evaluate(() => (window as any).__GLYPH_ART__.reset(7));
});
test.afterEach(async ({ page }) => { expect(errorsByPage.get(page)).toEqual([]); });

test('文章で立方体・メビウス・花火を切り替え、色と文字を保ったまま停止・再開する', async ({ page }) => {
  const cases = [
    { words: '赤い文字が立方体の表面を流れる。', shape: 'cube', ink: 'red' },
    { words: '黄色い文字がメビウスの輪の表面を流れる。', shape: 'mobius', ink: 'yellow' },
    { words: '今夜は青い花火を眺めている。', shape: 'fireworks', ink: 'blue' },
  ];
  let expectedCount = 1;
  for (const [index, sample] of cases.entries()) {
    await feed(page, sample.words, '64');
    expectedCount += [...sample.words.replace(/\s/g, '')].length * 64;
    await page.evaluate(() => (window as any).__GLYPH_ART__.step(10000));
    const state = await inspect(page);
    expect(state.count).toBe(expectedCount);
    expect(state.spec.shape).toBe(sample.shape);
    expect(state.scene.finite).toBe(true);
    expect(state.scene.drawCalls).toBe(1);
    expect(state.batches.map((batch: any) => batch.text)).toEqual(cases.slice(0, index + 1).map(value => value.words));
    expect(state.batches.map((batch: any) => batch.ink)).toEqual(cases.slice(0, index + 1).map(value => value.ink));
    for (const previous of cases.slice(0, index + 1)) for (const char of previous.words) expect(state.characters).toContain(char);
    expect(state.inks.slice(1)).toEqual(Array(state.inks.length - 1).fill('red'));

    // Pause through the actual control, not only the test clock.
    await page.evaluate(() => (window as any).__GLYPH_ART__.pause(false));
    await openTerminal(page); await page.locator('#pause').click();
    const frozen = await inspect(page);
    const pixels = await page.locator('#scene canvas').screenshot();
    await page.waitForTimeout(180);
    const still = await inspect(page);
    expect(still.paused).toBe(true);
    expect(still.time).toBe(frozen.time);
    expect(still.scene).toEqual(frozen.scene);
    expect(await page.locator('#scene canvas').screenshot()).toEqual(pixels);
    await openTerminal(page); await page.locator('#pause').click();
    await expect.poll(async () => (await inspect(page)).time).toBeGreaterThan(still.time);
    expect((await inspect(page)).scene.points).not.toEqual(still.scene.points);
  }
});

for (const [shape, command] of [['cube', '表面 立方体'], ['mobius', '表面 メビウスの輪'], ['fireworks', '花火']] as const) {
  test(`${shape}: 2,048文字を8〜60秒観察し、画面端で欠けず消滅しない`, async ({ page }, testInfo) => {
    await feed(page, command + 'あ'.repeat(2047 - [...command.replace(/\s/g, '')].length));
    const frames = await page.evaluate(() => {
      const api = (window as any).__GLYPH_ART__; api.pause(true);
      const canvas = document.querySelector<HTMLCanvasElement>('#scene canvas')!;
      const copy = document.createElement('canvas'); copy.width = canvas.width; copy.height = canvas.height;
      const context = copy.getContext('2d', { willReadFrequently: true })!;
      const samples: { second: number; edge: number; clipped: number; lit: number; bounds: number[]; count: number; finite: boolean }[] = [];
      for (let second = 1; second <= 60; second++) {
        api.step(1000);
        if (second < 8) continue;
        context.clearRect(0, 0, copy.width, copy.height); context.drawImage(canvas, 0, 0);
        const pixels = context.getImageData(0, 0, copy.width, copy.height).data;
        let edge = 0, clipped = 0, lit = 0, minX = copy.width, maxX = -1, minY = copy.height, maxY = -1;
        for (let y = 0; y < copy.height; y++) for (let x = 0; x < copy.width; x++) {
          const i = (y * copy.width + x) * 4;
          if (pixels[i] + pixels[i + 1] + pixels[i + 2] > 120) {
            lit++;
            minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
            if (x < 6 || x >= copy.width - 6 || y < 6 || y >= copy.height - 6) edge++;
            if (x === 0 || x === copy.width - 1 || y === 0 || y === copy.height - 1) clipped++;
          }
        }
        const state = api.inspect();
        samples.push({ second, edge, clipped, lit, bounds: [minX, minY, maxX, maxY], count: state.count, finite: state.scene.finite });
      }
      return samples;
    });
    console.log(JSON.stringify({ surfacePixelBounds: { shape, samples: frames.length,
      minLit: Math.min(...frames.map(frame => frame.lit)), maxLit: Math.max(...frames.map(frame => frame.lit)),
      edgeFrames: frames.filter(frame => frame.edge > 0) } }));
    await testInfo.attach(`${shape}-60-seconds`, { body: await page.locator('#scene canvas').screenshot(), contentType: 'image/png' });
    for (const frame of frames) {
      expect(frame.count).toBe(2048); expect(frame.finite).toBe(true);
      expect(frame.lit, `t=${frame.second}`).toBeGreaterThan(1000);
      expect(frame.edge, `t=${frame.second}`).toBe(0);
    }
  });

  if (shape !== 'fireworks') test(`${shape}: 32,000文字の通常描画を30フレーム観察する`, async ({ page }) => {
    await feed(page, command + 'あいうえおかきくけこさしすせそ'.repeat(10), '256');
    const result = await page.evaluate(async () => {
      const api = (window as any).__GLYPH_ART__; api.pause(true);
      for (let i = 0; i < 8; i++) api.step(1000);
      const before = api.inspect(); api.pause(false);
      // Warm up ordinary animation before the timed sample; no synthetic stepping here.
      for (let i = 0; i < 8; i++) await new Promise<number>(resolve => requestAnimationFrame(resolve));
      // Start on a RAF boundary, then measure 30 ordinary animation intervals.
      let previous = await new Promise<number>(resolve => requestAnimationFrame(resolve));
      const intervals: number[] = [];
      for (let i = 0; i < 30; i++) {
        const now = await new Promise<number>(resolve => requestAnimationFrame(resolve));
        intervals.push(now - previous); previous = now;
      }
      return { before, after: api.inspect(), intervals };
    });
    expect(result.after.spec).toMatchObject({ shape, mode: 'surface' });
    expect(result.after.count).toBe(32000); expect(result.after.scene.drawn).toBe(32000);
    expect(result.after.scene.finite).toBe(true); expect(result.after.scene.drawCalls).toBe(1);
    expect(result.after.scene.triangles).toBe(64000);
    expect(result.after.scene.points).not.toEqual(result.before.scene.points);
    const sorted = result.intervals.slice().sort((a, b) => a - b);
    console.log(JSON.stringify({ surfaceRafTiming: { shape, glyphs: 32000, samples: 30,
      browser: page.context().browser()?.version(), medianMs: (sorted[14] + sorted[15]) / 2,
      p95Ms: sorted[28], maxMs: sorted[29] } }));
  });
}
