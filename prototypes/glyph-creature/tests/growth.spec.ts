import { expect, test } from '@playwright/test';

test('一文字を足しても種が急に縮まず、少数から身体が広がる', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => Boolean((window as any).__GLYPH_ART__));
  const states = [];
  for (const count of [1, 2, 4, 64, 512]) {
    const state = await page.evaluate(count => {
      const api = (window as any).__GLYPH_ART__;
      api.reset(1);
      if (count > 1) {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        (document.querySelector('#repeat') as HTMLSelectElement).value = '1';
        (document.querySelector('#text-input') as HTMLInputElement).value = 'あ'.repeat(count - 1);
        document.querySelector('#feed-form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      }
      api.pause(true);
      for (let i = 0; i < 10; i++) api.step(1000);
      return api.inspect();
    }, count);
    expect(state.count).toBe(count);
    expect(state.scene.finite).toBe(true);
    states.push(state);
  }
  const apparentSize = (state: any) => state.scene.glyphSize * state.scene.renderedScale / state.scene.camera;
  expect(apparentSize(states[1])).toBeGreaterThan(apparentSize(states[0]) * .85);
  expect(states[1].scene.camera).toBeLessThan(states[0].scene.camera * 1.06);
  const radius = (state: any) => Math.max(...state.scene.points.map(Math.abs));
  expect(radius(states[2])).toBeLessThan(.45);
  expect(radius(states[3])).toBeGreaterThan(radius(states[2]) * 2);
  expect(radius(states[4])).toBeGreaterThan(radius(states[3]));
  expect(states[4].scene.drawn).toBe(512);
  expect(states[4].scene.drawCalls).toBe(1);
});
