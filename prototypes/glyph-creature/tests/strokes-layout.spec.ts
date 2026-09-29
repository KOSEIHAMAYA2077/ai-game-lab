import { expect, test } from '@playwright/test';

test('筆画のHELPで空間が跳ばず、狭い画面でも六文字と流れが収まる', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 900 });
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    let seed = 12345;
    Math.random = () => { seed = Math.imul(1664525, seed) + 1013904223 | 0; return (seed >>> 0) / 4294967296; };
  });
  await page.clock.install({ time: new Date('2026-09-30T12:00:00Z') });
  await page.goto('/strokes.html');
  await expect(page.locator('#strokes-scene')).toHaveAttribute('data-strokes', '11');
  await page.clock.pauseAt(new Date('2026-09-30T12:00:01Z'));
  await page.clock.runFor(4000);
  const view = () => page.evaluate(() => (window as any).__GLYPH_STROKES__.inspect().view);
  const before = await view();
  await page.locator('#stroke-help').dispatchEvent('click');
  await page.clock.runFor(16); const first = await view();
  expect(Math.abs(first.centerY - before.centerY)).toBeLessThan(10);
  await page.clock.runFor(3000); const settled = await view();
  expect(before.centerY - settled.centerY).toBeGreaterThan(40);
  await page.locator('#stroke-help').dispatchEvent('click');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#stroke-input').fill('あ花火永水字');
  await page.locator('#stroke-form').dispatchEvent('submit');
  await expect(page.locator('#strokes-scene')).toHaveAttribute('data-text', 'あ花火永水字');
  await page.clock.runFor(5000);
  for (const mode of ['write', 'scatter', 'flow', 'gather']) {
    if (mode !== 'write') { await page.locator(`[data-motion="${mode}"]`).dispatchEvent('click'); await page.clock.runFor(4000); }
    const pixels = await page.locator('#strokes-scene').evaluate((element: HTMLCanvasElement) => {
      const data = element.getContext('2d')!.getImageData(0, 0, element.width, element.height).data;
      const top = document.querySelector('#stroke-terminal')!.getBoundingClientRect().top;
      let lit = 0, clipped = 0;
      for (let y = 0; y < element.height; y++) for (let x = 0; x < element.width; x++) {
        const i = (y * element.width + x) * 4;
        if (data[i] + data[i + 1] + data[i + 2] > 180) {
          lit++;
          if (x < 2 || x >= element.width - 2 || y < 36 || y >= top) clipped++;
        }
      }
      return { lit, clipped };
    });
    expect(pixels.lit).toBeGreaterThan(100); expect(pixels.clipped).toBe(0);
  }
  expect(errors).toEqual([]);
});
