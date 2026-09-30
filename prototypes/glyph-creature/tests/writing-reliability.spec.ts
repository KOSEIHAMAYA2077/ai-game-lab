import { expect, test, type Page } from '@playwright/test';
const inspect = (page: Page) => page.evaluate(() => (window as any).__GLYPH_ART__.inspect());
const start = async (page: Page, route = '/?write') => { await page.goto(route); await page.waitForFunction(() => Boolean((window as any).__GLYPH_ART__)); };
const write = async (page: Page, text: string) => { await page.locator('#manuscript').fill(text); await page.locator('#manuscript').press('Enter'); };
const savedTexts = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('glyph-matter:days:v1')!)[0].batches.map((b: any) => b.text));

test('手動追加の原稿: 未送信の行と選択位置を復元し、勝手に取り込まない', async ({ page }) => {
  await start(page); await page.locator('#live-writing').uncheck(); const input = page.locator('#manuscript');
  await input.fill('書きかけの文章\nまだ送っていない');
  await input.evaluate((el: HTMLTextAreaElement) => { el.setSelectionRange(3, 5); el.dispatchEvent(new Event('select')); });
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('glyph-matter:manuscript:v1') || '{}').start)).toBe(3);
  await page.reload(); await page.waitForFunction(() => Boolean((window as any).__GLYPH_ART__));
  await page.locator('#live-writing').uncheck();
  await expect(input).toHaveValue('書きかけの文章\nまだ送っていない');
  expect(await input.evaluate((el: HTMLTextAreaElement) => [el.selectionStart, el.selectionEnd])).toEqual([3, 5]);
  expect((await inspect(page)).count).toBe(1);
  await input.press('Enter'); expect((await inspect(page)).batches).toHaveLength(1);
});

test('原稿: 日付変更で形が新しくなっても、書きかけは残る', async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 8, 30, 23, 59)); await start(page); await page.locator('#live-writing').uncheck();
  await write(page, '昨日の一行');
  await page.locator('#manuscript').fill('昨日の一行\n日をまたぐ書きかけ');
  await page.clock.setFixedTime(new Date(2026, 9, 1, 0, 1));
  await page.locator('#manuscript').press('End'); await page.keyboard.insertText('。');
  await expect(page.locator('#manuscript')).toHaveValue('昨日の一行\n日をまたぐ書きかけ。');
  expect((await inspect(page)).count).toBe(1);
});

test('複数タブ: 二つ目は上書きせず、元を閉じてから引き継ぐ', async ({ page, context }) => {
  await start(page); await write(page, '最初のタブの文章');
  const second = await context.newPage(); await start(second);
  await expect(second.locator('#manuscript')).toHaveAttribute('readonly', '');
  await expect(second.locator('#writing-status')).toContainText('別のタブ');
  await expect(second.locator('#writing-feed')).toBeDisabled();
  expect(await savedTexts(second)).toEqual(['最初のタブの文章']);
  await page.close(); await second.locator('#resume-writing').click();
  await expect(second.locator('#manuscript')).not.toHaveAttribute('readonly', '');
  await expect(second.locator('#manuscript')).toHaveValue('最初のタブの文章\n');
  await write(second, '続きの文章'); expect(await savedTexts(second)).toEqual(['最初のタブの文章', '続きの文章']);
});

test('別窓: ターミナル・形ボタン・リセットの変更を受け取る', async ({ page, context }) => {
  await start(page); const viewer = await context.newPage(); await start(viewer, '/?companion');
  await page.locator('#write-word').click(); await page.locator('#text-input').fill('表面 黄色 立方体'); await page.locator('#text-input').press('Enter');
  await expect.poll(async () => (await inspect(viewer)).count).toBe((await inspect(page)).count);
  await expect.poll(async () => (await inspect(viewer)).spec.shape).toBe('cube');
  await page.locator('#show-help').click(); await page.locator('[data-form="mobius"]').click();
  await expect.poll(async () => (await inspect(viewer)).spec.shape).toBe('mobius');
  await page.locator('#show-help').click(); await page.locator('#reset').click();
  await expect.poll(async () => (await inspect(viewer)).count).toBe(1);
  expect(await savedTexts(page)).toEqual([]);
});

test('通常空間: 執筆中も遊べるが、日記は上書きしない', async ({ page, context }) => {
  await start(page); await write(page, '残しておく文章');
  const art = await context.newPage(); await start(art, '/');
  await art.keyboard.press('Enter'); await art.locator('#text-input').fill('赤い花火'); await art.locator('#text-input').press('Enter');
  expect((await inspect(art)).count).toBeGreaterThan(1);
  await art.locator('#show-diary').click(); await art.locator('#save-today').click();
  await expect(art.locator('#diary-status')).toContainText('執筆タブ');
  expect(await savedTexts(art)).toEqual(['残しておく文章']);
});

test('日記: 壊れた保存の原本を退避し、保存を再開できる', async ({ page }) => {
  await start(page); await page.evaluate(() => localStorage.setItem('glyph-matter:days:v1', 'broken original'));
  await write(page, '失わない文章'); await page.locator('#writing-history').click();
  await expect(page.locator('#recover-diary')).toBeVisible();
  const download = page.waitForEvent('download'); await page.locator('#recover-diary').click(); await download;
  expect(await page.evaluate(() => Object.keys(localStorage).some(key => key.includes(':recovery:') && localStorage.getItem(key) === 'broken original'))).toBe(true);
  await page.locator('#save-today').click(); expect(await savedTexts(page)).toEqual(['失わない文章']);
});

test('保存容量: エラーでも別窓へ文字が届き、原稿を書き出せる', async ({ page, context }) => {
  await start(page); const viewer = await context.newPage(); await start(viewer, '/?companion');
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new DOMException('full', 'QuotaExceededError'); }; });
  await write(page, '保存できなくても残したい');
  await expect.poll(async () => (await inspect(viewer)).count).toBe((await inspect(page)).count);
  await expect(page.locator('#draft-status')).toContainText('原稿を保存できません');
  await expect(page.locator('#writing-status')).toContainText('保存できません');
  const download = page.waitForEvent('download'); await page.locator('#export-manuscript').click();
  expect((await download).suggestedFilename()).toMatch(/^glyph-manuscript-.*\.txt$/);
});

test('原稿: 壊れた原本は自動上書きせず、退避してから再開する', async ({ page }) => {
  await start(page);
  await page.evaluate(() => localStorage.setItem('glyph-matter:manuscript:v1', 'broken manuscript'));
  // Reload saves the present draft on pagehide, so corrupt only the next document's storage.
  await page.addInitScript(() => localStorage.setItem('glyph-matter:manuscript:v1', 'broken manuscript'));
  await page.reload(); await page.waitForFunction(() => Boolean((window as any).__GLYPH_ART__));
  await page.locator('#manuscript').fill('復旧するまでの文章');
  await expect(page.locator('#draft-status')).toContainText('壊れています');
  expect(await page.evaluate(() => localStorage.getItem('glyph-matter:manuscript:v1'))).toBe('broken manuscript');
  await page.locator('#writing-history').click(); const download = page.waitForEvent('download'); await page.locator('#recover-diary').click(); await download;
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('glyph-matter:manuscript:v1')!).text)).toBe('復旧するまでの文章');
  expect(await page.evaluate(() => Object.keys(localStorage).some(key => key.includes('manuscript:v1:recovery:') && localStorage.getItem(key) === 'broken manuscript'))).toBe(true);
});

test('別窓: 日付変更直後の通常ターミナル入力も新しい日に入る', async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 8, 30, 23, 59)); await start(page); await write(page, '昨日の文字');
  await page.clock.setFixedTime(new Date(2026, 9, 1, 0, 1));
  await page.locator('#write-word').click(); await page.locator('#text-input').fill('今日の文字'); await page.locator('#text-input').press('Enter');
  const days = await page.evaluate(() => JSON.parse(localStorage.getItem('glyph-matter:days:v1')!));
  expect(days.map((d: any) => d.date)).toEqual(['2026-10-01', '2026-09-30']);
  expect(days[0].batches.map((b: any) => b.text)).toEqual(['今日の文字']);
  expect(days[1].batches.map((b: any) => b.text)).toEqual(['昨日の文字']);
});
