import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const inspect = (page: Page) => page.evaluate(() => (window as any).__GLYPH_ART__.inspect());
const advance = (page: Page, ms: number) => page.evaluate(ms => (window as any).__GLYPH_ART__.step(ms), ms);
const browserErrors = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  const errors: string[] = []; browserErrors.set(page, errors);
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/');
  await page.waitForFunction(() => Boolean((window as any).__GLYPH_ART__));
});
test.afterEach(async ({ page }) => { expect(browserErrors.get(page)).toEqual([]); });

test('通常入力・赤白の変化・4形状・蓄積・リセット', async ({ page }) => {
  expect((await inspect(page)).count).toBe(1);
  await page.locator('#text-input').fill('あa?');
  await page.locator('#feed').click();
  await advance(page, 1700);
  let state = await inspect(page);
  expect(state.count).toBe(4); expect(state.redCount).toBe(3);
  expect(state.characters).toEqual(['@', 'あ', 'a', '?']);
  await advance(page, 9000); expect((await inspect(page)).redCount).toBe(0);
  await page.locator('#repeat').selectOption('256');
  await page.locator('#text-input').fill('文字のかたち 流れ 循環 あいうえお @ abc ?');
  await page.locator('#feed').click();
  await advance(page, 10000);
  mkdirSync('evidence', { recursive: true });
  const count = (await inspect(page)).count;
  for (const form of ['condense', 'vortex', 'orbit', 'mobius']) {
    await page.locator(`[data-form="${form}"]`).click();
    await advance(page, 3000);
    state = await inspect(page);
    expect(state.form).toBe(form); expect(state.count).toBe(count);
    expect(state.scene.finite).toBe(true); expect(state.scene.drawn).toBe(count);
    expect(state.scene.drawCalls).toBe(1);
    await page.screenshot({ path: `evidence/${form}.png` });
  }
  await page.locator('#text-input').fill('新しい文字');
  await page.locator('#repeat').selectOption('64');
  await page.locator('#feed').click(); await advance(page, 1600);
  await page.screenshot({ path: 'evidence/new-characters.png' });
  await page.locator('#reset').click();
  expect((await inspect(page)).count).toBe(1);
  expect((await inspect(page)).form).toBe('condense');
});

test('追加直後の一時停止で成長・カメラも静止する', async ({ page }) => {
  await page.locator('#sample').click();
  await page.locator('#pause').click();
  const before = await inspect(page);
  await page.waitForTimeout(150);
  const after = await inspect(page);
  expect(after.time).toBe(before.time);
  expect(after.scene.camera).toBe(before.scene.camera);
  expect(after.scene.renderedScale).toBe(before.scene.renderedScale);
  expect(after.scene.points).toEqual(before.scene.points);
});

test('IME相当イベントで確定Enterを二重送信しない（実IMEとは別）', async ({ page }) => {
  const input = page.locator('#text-input');
  await input.dispatchEvent('compositionstart'); await input.fill('あ');
  await input.dispatchEvent('keydown', { key: 'Enter', isComposing: true, keyCode: 229 });
  await input.dispatchEvent('compositionend', { data: 'あ' });
  await input.dispatchEvent('keydown', { key: 'Enter' });
  expect((await inspect(page)).count).toBe(1);
  await page.waitForTimeout(100);
  await input.press('Enter');
  expect((await inspect(page)).count).toBe(2);
  await input.fill('  '); await page.locator('#feed').click();
  expect((await inspect(page)).count).toBe(2);
  await input.fill('<script>あ</script>'); await page.locator('#feed').click();
  expect((await inspect(page)).characters).toContain('<');
  expect(await page.locator('.console script').count()).toBe(0);
});

test('大量の文字で上限を守り、カメラが引いて操作を続けられる', async ({ page }) => {
  const before = await inspect(page);
  await page.locator('#text-input').fill('あ'.repeat(128));
  await page.locator('#repeat').selectOption('256');
  await page.locator('#feed').click();
  await advance(page, 12000);
  const after = await inspect(page);
  expect(after.count).toBe(32000); expect(after.scene.finite).toBe(true);
  expect(after.scene.camera).toBeGreaterThan(before.scene.camera);
  await expect(page.locator('#status')).toContainText('32,000文字');
  await page.locator('[data-form="mobius"]').click(); await advance(page, 2000);
  expect((await inspect(page)).form).toBe('mobius');
  await page.screenshot({ path: 'evidence/dense-32000.png' });
  await page.locator('#pause').click();
  expect((await inspect(page)).paused).toBe(false);
  const frames = await page.evaluate(() => new Promise<number[]>(resolve => {
    const times: number[] = []; let last = performance.now();
    function sample(now: number) { times.push(now - last); last = now; if (times.length === 30) resolve(times.slice(1)); else requestAnimationFrame(sample); }
    requestAnimationFrame(sample);
  }));
  console.log(JSON.stringify({ density: 32000, animated: true, browser: page.context().browser()?.version(), headlessFrameMedianMs: frames.sort((a, b) => a - b)[Math.floor(frames.length / 2)] }));
});

test('狭い画面でも入力・形の切替を使える', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#sample').click(); await advance(page, 9000);
  await page.locator('[data-form="orbit"]').click(); await advance(page, 2000);
  expect((await inspect(page)).form).toBe('orbit');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(page.locator('#feed')).toBeInViewport();
  await page.screenshot({ path: 'evidence/mobile.png', fullPage: true });
});
