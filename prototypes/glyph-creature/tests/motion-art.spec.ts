import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 1 });

test('呼吸する立方体は最大に膨らんでも切れず、カメラは呼吸を打ち消さない', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => Boolean((window as any).__GLYPH_ART__));
  await page.keyboard.press('Enter');
  await page.locator('#guide summary').click();
  await page.locator('#repeat').selectOption('1');
  const command = '表面 呼吸する 立方体';
  await page.locator('#text-input').fill(command + 'あ'.repeat(2047 - [...command.replace(/\s/g, '')].length));
  await page.locator('#text-input').press('Enter');
  const frames = await page.evaluate(() => {
    const api = (window as any).__GLYPH_ART__;
    api.pause(true);
    const canvas = document.querySelector<HTMLCanvasElement>('#scene canvas')!;
    const copy = document.createElement('canvas'); copy.width = canvas.width; copy.height = canvas.height;
    const ctx = copy.getContext('2d')!;
    const frames = [];
    for (let t = 1; t <= 35; t++) {
      api.step(1000);
      if (t < 8) continue;
      ctx.clearRect(0, 0, copy.width, copy.height); ctx.drawImage(canvas, 0, 0);
      const pixels = ctx.getImageData(0, 0, copy.width, copy.height).data;
      let edge = 0, lit = 0;
      for (let y = 0; y < copy.height; y++) for (let x = 0; x < copy.width; x++) {
        const i = (y * copy.width + x) * 4;
        if (pixels[i] + pixels[i + 1] + pixels[i + 2] > 120) {
          lit++;
          if (x < 6 || x >= copy.width - 6 || y < 6 || y >= copy.height - 6) edge++;
        }
      }
      const state = api.inspect();
      frames.push({ edge, lit, camera: state.scene.camera, count: state.count, motion: state.spec.motion, finite: state.scene.finite });
    }
    return frames;
  });
  for (const frame of frames) {
    expect(frame.count).toBe(2048); expect(frame.motion).toBe('breathe'); expect(frame.finite).toBe(true);
    expect(frame.lit).toBeGreaterThan(1000); expect(frame.edge).toBe(0);
  }
  const cameras = frames.map(frame => frame.camera);
  expect(Math.max(...cameras) - Math.min(...cameras)).toBeLessThan(.001);
});

test('波打つ団子を32,000字で描き、動き続けても一回の描画に収める', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await page.waitForFunction(() => Boolean((window as any).__GLYPH_ART__));
  await page.keyboard.press('Enter');
  await page.locator('#guide summary').click();
  await page.locator('#repeat').selectOption('256');
  await page.locator('#text-input').fill('表面 波打つ だんご ' + 'あいうえおかきくけこさしすせそ'.repeat(10));
  await page.locator('#text-input').press('Enter');
  const result = await page.evaluate(async () => {
    const api = (window as any).__GLYPH_ART__; api.pause(true);
    for (let i = 0; i < 8; i++) api.step(1000);
    const before = api.inspect();
    api.pause(false);
    const intervals: number[] = [];
    let previous = performance.now();
    for (let i = 0; i < 30; i++) {
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      const now = performance.now(); intervals.push(now - previous); previous = now;
    }
    return { before, after: api.inspect(), intervals };
  });
  expect(result.after.count).toBe(32000); expect(result.after.spec.shape).toBe('dango');
  expect(result.after.spec.motion).toBe('wave'); expect(result.after.scene.finite).toBe(true);
  expect(result.after.scene.drawCalls).toBe(1); expect(result.after.scene.triangles).toBe(64000);
  expect(result.after.scene.points).not.toEqual(result.before.scene.points); expect(errors).toEqual([]);
  const sorted = result.intervals.slice().sort((a, b) => a - b);
  console.log(JSON.stringify({ motionFrameIntervals: { median: sorted[15], p95: sorted[28], max: sorted[29] } }));
});
