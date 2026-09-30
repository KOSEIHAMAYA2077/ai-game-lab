import { expect, test, type Page } from '@playwright/test';

const inspect = (page: Page) => page.evaluate(() => (window as any).__GLYPH_ART__.inspect());
const start = async (page: Page, route = '/?write') => {
  await page.goto(route); await page.waitForFunction(() => Boolean((window as any).__GLYPH_ART__));
};
const advanceCycle = (page: Page, seconds: number) => page.evaluate(seconds => (window as any).__GLYPH_ART__.step(seconds * 1000, true), seconds);
const expectCount = (page: Page, count: number) => expect.poll(async () => (await inspect(page)).count).toBe(count);
const saved = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('glyph-matter:days:v1') || '[]')[0]);

test('執筆差分: 入力を蓄積し、改行・再読込・削除で重複や文字の消失がない', async ({ page }) => {
  await start(page); const manuscript = page.locator('#manuscript');
  await expect(page.locator('#live-writing')).toBeChecked();
  await manuscript.fill('原稿abc'); await expectCount(page, 6);
  await manuscript.press('Enter'); await expect(manuscript).toHaveValue('原稿abc\n');
  await page.waitForTimeout(450); expect((await inspect(page)).count).toBe(6);
  await page.keyboard.insertText('続き'); await expectCount(page, 8);
  await expect.poll(async () => (await saved(page))?.batches.map((b: any) => b.text).join('')).toBe('原稿abc続き');
  await page.reload(); await page.waitForFunction(() => Boolean((window as any).__GLYPH_ART__));
  await expect(manuscript).toHaveValue('原稿abc\n続き');
  await page.waitForTimeout(450); expect((await inspect(page)).count).toBe(8);
  await manuscript.fill('原稿abc\n続'); await page.waitForTimeout(450);
  expect((await inspect(page)).count).toBe(8);
  await manuscript.fill('原稿Xabc\n続'); await expectCount(page, 9);
  const state = await inspect(page);
  expect(state.characters).toContain('き');
  expect(state.batches.map((b: any) => b.text).join('')).toBe('原稿abc続きX');
});

test('IMEイベント: 未確定の文字を追加せず、確定後に一度だけ受け取る', async ({ page }) => {
  await start(page); const manuscript = page.locator('#manuscript');
  await manuscript.dispatchEvent('compositionstart');
  await manuscript.evaluate((el: HTMLTextAreaElement) => {
    el.value = 'に'; el.setSelectionRange(1, 1);
    el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertCompositionText', data: 'に', isComposing: true }));
  });
  await page.waitForTimeout(450); expect((await inspect(page)).count).toBe(1);
  await manuscript.evaluate((el: HTMLTextAreaElement) => {
    el.value = '日本'; el.setSelectionRange(2, 2);
    el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertCompositionText', data: '日本', isComposing: true }));
  });
  await page.waitForTimeout(450); expect((await inspect(page)).count).toBe(1);
  await manuscript.dispatchEvent('compositionend', { data: '日本' });
  await expectCount(page, 3);
  await manuscript.press('Enter'); await page.waitForTimeout(450);
  expect((await inspect(page)).batches.map((b: any) => b.text)).toEqual(['日本']);
});

test('形の優先: 分割して書いた語に反応し、普通の追記で優先時間を延ばさず周期へ戻る', async ({ page }) => {
  await start(page); const manuscript = page.locator('#manuscript');
  await manuscript.fill('立'); await expectCount(page, 2);
  await manuscript.fill('立方体'); await expectCount(page, 4);
  expect((await inspect(page)).spec.shape).toBe('cube');
  await advanceCycle(page, 35);
  const held = await inspect(page); expect(held.spec.shape).toBe('cube');
  expect(held.cycle.remaining).toBeGreaterThan(20); expect(held.cycle.remaining).toBeLessThan(26);
  await manuscript.fill('立方体について考える'); await expectCount(page, 11);
  const typed = await inspect(page);
  expect(typed.spec.shape).toBe('cube'); expect(typed.cycle.remaining).toBeLessThan(26);
  await advanceCycle(page, 30);
  const cycled = await inspect(page); expect(cycled.spec.shape).toBe('mobius');
  expect(cycled.count).toBe(typed.count); expect(cycled.batches).toEqual(typed.batches);
  await manuscript.fill('立方体について考える。'); await expectCount(page, 12);
  expect((await inspect(page)).spec.shape).toBe('mobius');
  await manuscript.press('Enter'); await page.keyboard.insertText('今夜の花火'); await expectCount(page, 17);
  expect((await inspect(page)).spec.shape).toBe('fireworks');
  expect((await inspect(page)).cycle.remaining).toBeGreaterThan(58);
});

test('周期の所有権: 別窓へ形だけが届き、読取専用・日記閲覧・停止では自動変更しない', async ({ page, context }) => {
  await start(page); await page.locator('#manuscript').fill('abc'); await expectCount(page, 4);
  const viewer = await context.newPage(); await start(viewer, '/?companion'); await expectCount(viewer, 4);
  const follower = await context.newPage(); await start(follower); await expectCount(follower, 4);
  await expect(follower.locator('#manuscript')).toHaveAttribute('readonly', '');
  const original = await inspect(page);
  await advanceCycle(page, 31);
  for (const target of [viewer, follower]) {
    await expect.poll(async () => (await inspect(target)).spec.shape).toBe('cube');
    expect((await inspect(target)).batches).toEqual(original.batches);
    await advanceCycle(target, 60);
    expect((await inspect(target)).spec.shape).toBe('cube');
  }
  expect((await saved(page)).batches).toEqual(original.batches);
  await page.locator('#writing-history').click(); await page.locator('#days .day').first().click();
  const archive = await inspect(page); await expect(page.locator('#manuscript')).toHaveAttribute('readonly', '');
  await advanceCycle(page, 60);
  expect((await inspect(page)).spec).toEqual(archive.spec);
  expect((await inspect(page)).cycle.remaining).toBe(archive.cycle.remaining);
  await page.locator('#diary-close').click();
  await expect(page.locator('#manuscript')).not.toHaveAttribute('readonly', '');
  expect((await inspect(page)).batches).toEqual(original.batches);
  await page.locator('#show-help').click(); await page.locator('#pause').click();
  const paused = await inspect(page); expect(paused.paused).toBe(true);
  await page.waitForTimeout(450);
  expect((await inspect(page)).cycle.remaining).toBe(paused.cycle.remaining);
  expect((await inspect(page)).time).toBe(paused.time);
});

test('切替: Enterで追加する方式と、自動形状変更を止める設定を使える', async ({ page }) => {
  await start(page); await page.locator('#live-writing').uncheck();
  await page.locator('#manuscript').fill('文章'); await page.waitForTimeout(450);
  expect((await inspect(page)).count).toBe(1);
  await page.locator('#manuscript').press('Enter'); await expectCount(page, 3);
  await page.locator('#show-help').click(); await page.locator('#auto-shape').uncheck();
  await advanceCycle(page, 60);
  expect((await inspect(page)).spec.shape).toBe('condense');
  expect((await inspect(page)).cycle.enabled).toBe(false);
  await page.locator('#auto-shape').check(); await advanceCycle(page, 31);
  expect((await inspect(page)).spec.shape).toBe('cube');
  expect((await inspect(page)).batches.map((b: any) => b.text)).toEqual(['文章']);
});

test('入力した行: 受信待ちの間にカーソルを移しても、確定したフレーズを解釈する', async ({ page }) => {
  await start(page); const manuscript = page.locator('#manuscript');
  await manuscript.fill('前の行\n'); await expectCount(page, 4);
  await manuscript.fill('前の行\n花火');
  await manuscript.evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(0, 0));
  await expectCount(page, 6);
  expect((await inspect(page)).spec.shape).toBe('fireworks');

  await manuscript.evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(el.value.length, el.value.length));
  await manuscript.press('Shift+Enter'); await page.waitForTimeout(450);
  await manuscript.dispatchEvent('compositionstart');
  await manuscript.evaluate((el: HTMLTextAreaElement) => {
    el.value += 'メビウス'; el.setSelectionRange(el.value.length, el.value.length);
    el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertCompositionText', data: 'メビウス', isComposing: true }));
  });
  await manuscript.dispatchEvent('compositionend', { data: 'メビウス' });
  await manuscript.evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(0, 0));
  await expectCount(page, 10);
  expect((await inspect(page)).spec.shape).toBe('mobius');

  // A multiline paste still interprets all newly inserted lines, even when
  // its final line has no shape word.
  await manuscript.fill('前の行\n花火\nメビウス\n球体\nについて');
  await manuscript.evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(0, 0));
  await expectCount(page, 16);
  expect((await inspect(page)).spec.shape).toBe('condense');
  expect((await inspect(page)).batches.map((b: any) => b.text)).toEqual(['前の行\n', '花火', 'メビウス', '\n球体\nについて']);
});
