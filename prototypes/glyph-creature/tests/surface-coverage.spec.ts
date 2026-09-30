import { expect, test, type Page } from '@playwright/test';

test.use({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 1 });
const inspect = (page: Page) => page.evaluate(() => (window as any).__GLYPH_ART__.inspect());
const settle = (page: Page) => page.evaluate(() => { const api = (window as any).__GLYPH_ART__; api.pause(true); for (let i = 0; i < 12; i++) api.step(1000); });
async function feed(page: Page, command: string, count = 2048, repeat = '1') {
  await page.keyboard.press('Enter');
  if (!await page.locator('#repeat').isVisible()) await page.locator('#guide summary').click();
  await page.locator('#repeat').selectOption(repeat);
  const filler = [...'あいうえおかきくけこさしすせそ'];
  const length = count - 1 - [...command.replace(/\s/g, '')].length;
  await page.locator('#text-input').fill(command + Array.from({ length }, (_, i) => filler[i % filler.length]).join(''));
  await page.locator('#text-input').press('Enter');
  await settle(page);
}

async function coverage(page: Page) {
  return page.locator('#scene canvas').evaluate((canvas: HTMLCanvasElement) => {
    const copy = document.createElement('canvas'); copy.width = canvas.width; copy.height = canvas.height;
    const ctx = copy.getContext('2d', { willReadFrequently: true })!; ctx.drawImage(canvas, 0, 0);
    const pixels = ctx.getImageData(0, 0, copy.width, copy.height).data;
    const lit = (x: number, y: number) => { const i = (y * copy.width + x) * 4; return pixels[i] + pixels[i + 1] + pixels[i + 2] > 120; };
    let minX = copy.width, minY = copy.height, maxX = -1, maxY = -1, edge = 0;
    for (let y = 0; y < copy.height; y++) for (let x = 0; x < copy.width; x++) if (lit(x, y)) {
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      if (x < 6 || x >= copy.width - 6 || y < 6 || y >= copy.height - 6) edge++;
    }
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, rx = (maxX - minX) / 2, ry = (maxY - minY) / 2;
    let cells = 0, filled = 0;
    // Check the inside, not the silhouette: the former rope filled its bounds but only 36/96 cells.
    for (let gy = 0; gy < 16; gy++) for (let gx = 0; gx < 16; gx++) {
      const nx = (gx + .5) / 8 - 1, ny = (gy + .5) / 8 - 1;
      if (nx * nx + ny * ny > .49) continue;
      cells++; let ink = 0;
      for (let y = Math.floor(cy + (gy / 8 - 1) * ry); y < Math.floor(cy + ((gy + 1) / 8 - 1) * ry); y++)
        for (let x = Math.floor(cx + (gx / 8 - 1) * rx); x < Math.floor(cx + ((gx + 1) / 8 - 1) * rx); x++) if (lit(x, y)) ink++;
      if (ink >= 3) filled++;
    }
    return { filled, cells, edge };
  });
}

const errorsByPage = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const errors: string[] = []; errorsByPage.set(page, errors);
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/'); await page.waitForFunction(() => Boolean((window as any).__GLYPH_ART__));
  await page.evaluate(() => (window as any).__GLYPH_ART__.reset(7));
});
test.afterEach(async ({ page }) => { expect(errorsByPage.get(page)).toEqual([]); });

test('流れる球体は文字と色を保ち、輪郭の内側にも表面が広がる', async ({ page }, testInfo) => {
  await feed(page, '流れる 赤 球体');
  const state = await inspect(page);
  expect(state.spec).toMatchObject({ shape: 'condense', mode: 'flow' });
  expect(state.count).toBe(2048); expect(state.scene.finite).toBe(true);
  expect(state.batches[0].ink).toBe('red'); expect(state.characters).toContain('球');
  expect(state.inks.slice(1)).toEqual(Array(state.inks.length - 1).fill('red'));
  const pixels = await coverage(page);
  expect(pixels.cells).toBe(96); expect(pixels.filled).toBeGreaterThanOrEqual(80); expect(pixels.edge).toBe(0);
  await testInfo.attach('flow-sphere-surface', { body: await page.locator('#scene canvas').screenshot(), contentType: 'image/png' });
});

test('流れる立方体から形ボタンで球へ変えても、面の分布と文字を保つ', async ({ page }) => {
  await feed(page, '流れる 立方体');
  const before = await inspect(page);
  expect(before.spec).toMatchObject({ shape: 'cube', mode: 'flow' });
  expect((await coverage(page)).filled).toBeGreaterThanOrEqual(80);
  await page.locator('#choose-form').click(); await page.locator('[data-shape="condense"]').click();
  await settle(page);
  const after = await inspect(page);
  expect(after.spec).toMatchObject({ shape: 'condense', mode: 'flow' });
  expect(after.count).toBe(2048); expect(after.batches).toEqual(before.batches);
  expect(after.characters).toEqual(before.characters); expect(after.inks).toEqual(before.inks);
  const pixels = await coverage(page);
  expect(pixels.filled).toBeGreaterThanOrEqual(80); expect(pixels.edge).toBe(0);
});

test('32,000文字の球を通常の描画で30フレーム動かす', async ({ page }) => {
  await feed(page, '流れる 球体', 150, '256');
  const result = await page.evaluate(async () => {
    const api = (window as any).__GLYPH_ART__; const before = api.inspect(); api.pause(false);
    for (let i = 0; i < 8; i++) await new Promise<number>(resolve => requestAnimationFrame(resolve));
    let previous = await new Promise<number>(resolve => requestAnimationFrame(resolve));
    const intervals: number[] = [];
    for (let i = 0; i < 30; i++) { const now = await new Promise<number>(resolve => requestAnimationFrame(resolve)); intervals.push(now - previous); previous = now; }
    return { before, after: api.inspect(), intervals };
  });
  expect(result.after.count).toBe(32000); expect(result.after.scene.finite).toBe(true);
  expect(result.after.scene.drawCalls).toBe(1); expect(result.after.scene.triangles).toBe(64000);
  expect(result.after.scene.points).not.toEqual(result.before.scene.points);
  const sorted = result.intervals.slice().sort((a, b) => a - b);
  console.log(JSON.stringify({ surfaceSphereRaf: { count: 32000, samples: 30, browser: page.context().browser()?.version(), medianMs: (sorted[14] + sorted[15]) / 2, p95Ms: sorted[28], maxMs: sorted[29] } }));
});
