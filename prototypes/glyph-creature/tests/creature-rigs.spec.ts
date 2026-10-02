import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
const out = '../../.local/program-rig-regression';
const inspect = (page: Page) => page.evaluate(() => (window as any).__GLYPH_ART__.inspect());

async function feed(page: Page, command: string) {
  await page.goto('/'); await page.waitForFunction(() => Boolean((window as any).__GLYPH_ART__));
  await page.evaluate(() => (window as any).__GLYPH_ART__.reset(7));
  await page.keyboard.press('Enter'); await page.locator('#guide summary').click();
  await page.locator('#repeat').selectOption('1');
  await page.locator('#text-input').fill(command + 'あいうえお'.repeat(500));
  await page.locator('#text-input').press('Enter'); await page.keyboard.press('Escape');
  await page.evaluate(() => { const api = (window as any).__GLYPH_ART__; for (let i = 0; i < 12; i++) api.step(1000); api.planePose(0); });
}

for (const [shape, word, count, times] of [
  ['bird', '鳥', 7, [19.5, 22.5, 25.5]],
  ['fish', '魚', 4, [15.6, 18, 20.4]],
  ['snake', '蛇', 9, [17.1, 20.9, 24.7]],
] as const) {
  test(`${word}の実入力から骨格で動く表面へ、文字と色が残る`, async ({ page }) => {
    mkdirSync(out, { recursive: true });
    const errors: string[] = [], external: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('request', r => { if (!/^(http:\/\/127\.0\.0\.1:4222\/|data:|blob:)/.test(r.url())) external.push(r.url()); });
    await feed(page, `表面 白い${word} 通常`);
    const before = await inspect(page), records = [];
    for (const time of times) {
      await page.evaluate(time => { const api = (window as any).__GLYPH_ART__; api.step((time - api.inspect().time) * 1000); }, time);
      const state = await inspect(page);
      expect(state.spec.shape).toBe(shape); expect(state.scene.finite).toBe(true); expect(state.count).toBe(before.count);
      expect(state.scene.rig.bones).toHaveLength(count); expect(state.scene.rig.inverseBind).toBe(count);
      expect(state.scene.rig.bones.every((b: any) => b.position.every(Number.isFinite))).toBe(true);
      expect(state.scene.drawCalls).toBe(1);
      records.push({ time: state.time, rig: state.scene.rig, count: state.count });
      await page.screenshot({ path: `${out}/${shape}-${time}.png` });
    }
    expect(records[0].rig.bones).not.toEqual(records[1].rig.bones);
    const pixels = await page.locator('#scene canvas').screenshot();
    await page.waitForTimeout(250); expect(await page.locator('#scene canvas').screenshot()).toEqual(pixels);
    await page.locator('#write-word').click(); await page.locator('#text-input').fill('赤い文字'); await page.locator('#text-input').press('Enter');
    const added = await inspect(page);
    expect(added.count).toBeGreaterThan(before.count); expect(added.batches.slice(0, before.batches.length)).toEqual(before.batches);
    expect(added.batches.at(-1).ink).toBe('red'); expect(added.spec.shape).toBe(shape);
    expect(errors).toEqual([]); expect(external).toEqual([]);
    writeFileSync(`${out}/${shape}.json`, JSON.stringify({ errors, external, records, ink: added.batches.at(-1).ink }, null, 2) + '\n');
  });
}

test('複数の鳥でも姿勢キャッシュを共有し、狭い画面とドラッグで壊れない', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await feed(page, '表面 白い鳥 8個 通常');
  const before = await inspect(page);
  await page.evaluate(() => (window as any).__GLYPH_ART__.step(1000));
  const after = await inspect(page);
  expect(after.spec.count).toBe(8); expect(after.scene.finite).toBe(true);
  expect(after.scene.rig.matrixUpdates - before.scene.rig.matrixUpdates).toBeLessThanOrEqual(8);
  const box = (await page.locator('#scene canvas').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 50, box.y + box.height / 2 + 30, { steps: 6 }); await page.mouse.up();
  expect((await inspect(page)).scene.finite).toBe(true);
  await page.screenshot({ path: `${out}/eight-birds-portrait.png` });
});

test('骨格の3形は一周の時刻サンプルでも画面内に残る', async ({ page }) => {
  const results = [];
  for (const word of ['鳥', '魚', '蛇']) {
    await feed(page, `表面 白い${word} 通常`);
    const frames = await page.evaluate(() => {
      const api = (window as any).__GLYPH_ART__; api.planePose(null);
      const canvas = document.querySelector<HTMLCanvasElement>('#scene canvas')!;
      const copy = document.createElement('canvas'); copy.width = canvas.width; copy.height = canvas.height;
      const ctx = copy.getContext('2d')!, frames = [];
      for (let n = 0; n < 36; n++) {
        api.step(6000); ctx.drawImage(canvas, 0, 0);
        const pixels = ctx.getImageData(0, 0, copy.width, copy.height).data;
        let edge = 0, lit = 0;
        for (let y = 0; y < copy.height; y++) for (let x = 0; x < copy.width; x++) {
          const i = (y * copy.width + x) * 4;
          if (pixels[i] + pixels[i + 1] + pixels[i + 2] > 120) {
            lit++; if (x < 4 || x >= copy.width - 4 || y < 4 || y >= copy.height - 4) edge++;
          }
        }
        const state = api.inspect(); frames.push({ time: state.time, shape: state.spec.shape, finite: state.scene.finite, edge, lit });
      }
      return frames;
    });
    for (const frame of frames) { expect(frame.finite).toBe(true); expect(frame.edge).toBe(0); expect(frame.lit).toBeGreaterThan(500); }
    results.push({ word, frames });
  }
  writeFileSync(`${out}/turns.json`, JSON.stringify(results, null, 2) + '\n');
});

test('32000文字の鳥でも骨の更新を文字数へ比例させない', async ({ page }) => {
  await feed(page, '表面 白い鳥 通常');
  await page.locator('#write-word').click();
  if (!(await page.locator('#repeat').isVisible())) await page.locator('#guide summary').click();
  await page.locator('#repeat').selectOption('256');
  await page.locator('#text-input').fill('白い鳥 通常 ' + 'あいうえお'.repeat(30));
  await page.locator('#text-input').press('Enter'); await page.keyboard.press('Escape');
  const result = await page.evaluate(async () => {
    const api = (window as any).__GLYPH_ART__;
    api.planePose(null); for (let i = 0; i < 6; i++) api.step(1000);
    api.pause(false);
    for (let i = 0; i < 45; i++) await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    const before = api.inspect(), intervals = []; let previous = performance.now();
    for (let i = 0; i < 120; i++) {
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      const now = performance.now(); intervals.push(now - previous); previous = now;
    }
    api.pause();
    const after = api.inspect(), sorted = [...intervals].sort((a, b) => a - b);
    return { count: after.count, finite: after.scene.finite, draws: after.scene.drawCalls,
      timeDelta: after.time - before.time, boneUpdates: after.scene.rig.matrixUpdates - before.scene.rig.matrixUpdates,
      samples: intervals.length, median: sorted[60], p95: sorted[114], intervals };
  });
  expect(result.count).toBe(32000); expect(result.finite).toBe(true); expect(result.draws).toBe(1);
  expect(result.boneUpdates).toBeLessThanOrEqual(125); expect(result.timeDelta).toBeGreaterThan(.5);
  writeFileSync(`${out}/realtime-32000-bird.json`, JSON.stringify(result, null, 2) + '\n');
});
