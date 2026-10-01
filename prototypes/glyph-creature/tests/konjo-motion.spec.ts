import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const inspect = (page: Page) => page.evaluate(() => (window as any).__GLYPH_ART__.inspect());
async function start(page: Page, command: string) {
  await page.goto('/');
  await page.waitForFunction(() => Boolean((window as any).__GLYPH_ART__));
  await page.evaluate(() => (window as any).__GLYPH_ART__.reset(7));
  await page.keyboard.press('Enter');
  await page.locator('#guide summary').click();
  await page.locator('#repeat').selectOption('1');
  await page.locator('#text-input').fill(command + 'あいうえお'.repeat(410));
  await page.locator('#text-input').press('Enter');
  await page.keyboard.press('Escape');
  await page.evaluate(() => { const api = (window as any).__GLYPH_ART__; for (let i = 0; i < 12; i++) api.step(1000); });
}

for (const viewport of [{ width: 1200, height: 900 }, { width: 390, height: 844 }]) {
  test(`クラゲの拍動と緩やかな回転は画面内に収まる ${viewport.width}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
    await start(page, '白い文字が表面で呼吸するクラゲ');
    const before = await inspect(page);
    const frames = await page.evaluate(() => {
      const api = (window as any).__GLYPH_ART__;
      const canvas = document.querySelector<HTMLCanvasElement>('#scene canvas')!;
      const copy = document.createElement('canvas'); copy.width = canvas.width; copy.height = canvas.height;
      const ctx = copy.getContext('2d')!;
      const samples = [];
      for (let i = 0; i < 36; i++) {
        api.step(6000); ctx.drawImage(canvas, 0, 0);
        const data = ctx.getImageData(0, 0, copy.width, copy.height).data;
        let edge = 0, lit = 0;
        for (let y = 0; y < copy.height; y++) for (let x = 0; x < copy.width; x++) {
          const k = (y * copy.width + x) * 4;
          if (data[k] + data[k + 1] + data[k + 2] > 120) {
            lit++; if (x < 4 || x >= copy.width - 4 || y < 4 || y >= copy.height - 4) edge++;
          }
        }
        samples.push({ ...api.inspect().scene, lit, edge });
      }
      return samples;
    });
    for (const sample of frames) { expect(sample.finite).toBe(true); expect(sample.edge).toBe(0); expect(sample.lit).toBeGreaterThan(500); }
    const after = await inspect(page);
    expect(after.count).toBe(before.count); expect(after.spec.shape).toBe('jellyfish');
    expect(after.scene.viewRotation[1] - before.scene.viewRotation[1]).toBeCloseTo(6.48, 5);
    expect(after.scene.viewRotation[0]).not.toBe(before.scene.viewRotation[0]);
    expect(errors).toEqual([]);
    const out = '../../experiments/konjo-motion-v1/evidence-v2';
    mkdirSync(out, { recursive: true });
    writeFileSync(`${out}/jellyfish-${viewport.width}.json`, JSON.stringify({ viewport, count: after.count,
      shape: after.spec.shape, motion: after.spec.motion, beforeRotation: before.scene.viewRotation,
      afterRotation: after.scene.viewRotation, errors, frames }, null, 2) + '\n');
    await page.screenshot({ path: `../../experiments/konjo-motion-v1/evidence-v2/jellyfish-${viewport.width}.png` });
  });
}

test('止めるで拍動も回転も止まり、ドラッグと拡大は使える', async ({ page }) => {
  await start(page, '青いクラゲ');
  const before = await inspect(page);
  const canvas = page.locator('#scene canvas');
  const pixels = await canvas.screenshot();
  await page.waitForTimeout(350);
  expect(await canvas.screenshot()).toEqual(pixels);
  expect((await inspect(page)).scene.viewRotation).toEqual(before.scene.viewRotation);
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down(); await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2 + 35, { steps: 8 }); await page.mouse.up();
  const dragged = await inspect(page);
  expect(dragged.scene.manualRotation[1]).toBeGreaterThan(before.scene.manualRotation[1]);
  await page.mouse.wheel(0, 250);
  await page.evaluate(() => (window as any).__GLYPH_ART__.step(1000));
  const zoomed = await inspect(page);
  expect(zoomed.scene.camera).toBeGreaterThan(dragged.scene.camera); expect(zoomed.scene.finite).toBe(true);
  await page.evaluate(() => (window as any).__GLYPH_ART__.pause(false));
  await expect.poll(async () => (await inspect(page)).time).toBeGreaterThan(zoomed.time);
  await page.evaluate(() => (window as any).__GLYPH_ART__.pause());
});
