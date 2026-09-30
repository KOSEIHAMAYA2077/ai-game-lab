import { expect, test, type Page } from '@playwright/test';
const inspect = (page: Page) => page.evaluate(() => (window as any).__GLYPH_ART__.inspect());
const start = async (page: Page, route = '/?write') => { await page.goto(route); await page.waitForFunction(() => Boolean((window as any).__GLYPH_ART__)); };
const terminalFeed = async (page: Page, text: string) => {
  if (await page.locator('#start-prompt').isVisible()) await page.keyboard.press('Enter');
  else if (!await page.locator('#terminal').isVisible()) await page.locator('#write-word').click();
  await page.locator('#text-input').fill(text); await page.locator('#text-input').press('Enter');
};
const saved = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('glyph-matter:days:v1') ?? '[]')[0]);

test('動きの日記: 通常入力から保存し、執筆・別窓・再読込で維持する', async ({ page, context }) => {
  await start(page, '/'); await terminalFeed(page, '表面 呼吸する 黄色い立方体');
  const original = await inspect(page);
  expect(original.spec).toMatchObject({ shape: 'cube', motion: 'breathe', mode: 'surface' });
  // Normal-art saves await Web Locks. Force that asynchronous gap so a click alone cannot pass this check.
  await page.evaluate(() => {
    const request = (navigator.locks.request as any).bind(navigator.locks);
    (navigator.locks as any).request = (...args: any[]) => new Promise(resolve => setTimeout(resolve, 150)).then(() => request(...args));
  });
  await page.locator('#show-diary').click(); await page.locator('#save-today').click();
  await expect(page.locator('#diary-status')).toContainText('文字の姿を保存しました');
  await expect.poll(async () => (await saved(page))?.spec).toEqual(original.spec);
  await start(page); expect((await inspect(page)).spec).toEqual(original.spec);
  const viewer = await context.newPage(); await start(viewer, '/?companion');
  await expect.poll(async () => (await inspect(viewer)).spec).toEqual(original.spec);
  await page.locator('#manuscript').fill('赤いことば'); await page.locator('#manuscript').press('Enter');
  await expect.poll(async () => (await inspect(viewer)).count).toBe((await inspect(page)).count);
  expect((await inspect(viewer)).spec).toEqual(original.spec);
  expect((await saved(page)).batches.at(-1).ink).toBe('red');
  const beforeReload = await inspect(page); await page.reload(); await page.waitForFunction(() => Boolean((window as any).__GLYPH_ART__));
  expect((await inspect(page)).spec).toEqual(original.spec);
  expect((await inspect(page)).batches).toEqual(beforeReload.batches);
});

test('動きの日記: 指定しない文章・形ボタン・手動辞書でも維持する', async ({ page, context }) => {
  await start(page); const viewer = await context.newPage(); await start(viewer, '/?companion');
  await terminalFeed(page, '波打つ'); expect((await inspect(page)).spec.motion).toBe('wave');
  await page.locator('#choose-form').click(); await page.locator('#quick-forms summary').filter({ hasText: 'もの・空' }).click(); await page.locator('[data-shape="dango"]').click();
  expect((await inspect(page)).spec).toMatchObject({ shape: 'dango', motion: 'wave' });
  await page.locator('#show-help').click(); await page.locator('[data-form="mobius"]').click();
  expect((await saved(page)).spec).toMatchObject({ shape: 'mobius', motion: 'wave' });
  await terminalFeed(page, '流れる 球体');
  expect((await inspect(page)).spec).toMatchObject({ shape: 'condense', motion: 'wave', mode: 'flow' });
  await page.locator('#show-help').click(); await expect(page.locator('#learned-shapes')).toHaveCount(0);
  await terminalFeed(page, 'サイコロを黄色に'); expect((await saved(page)).spec).toMatchObject({ shape: 'cube', motion: 'wave' });
  await terminalFeed(page, 'だんご'); expect((await saved(page)).spec).toMatchObject({ shape: 'dango', motion: 'wave' });
  await expect.poll(async () => (await inspect(viewer)).spec).toEqual((await inspect(page)).spec);
  await terminalFeed(page, '変形なし'); expect((await saved(page)).spec).toMatchObject({ shape: 'dango', motion: 'calm' });
});

test('旧日記: motionがない保存をcalmとして復元し、団子と動きを加えられる', async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 8, 30, 12));
  const oldDay = { version: 1, date: '2026-09-30', seed: 7, time: 8, spec: { shape: 'orbit', mode: 'surface', count: 1, arrangement: 'single', deformation: 'gentle' }, batches: [{ text: '旧記', repeat: 1, added: 2, at: 4, ink: 'cyan', seed: 15 }] };
  await page.addInitScript(day => { if (!localStorage.getItem('glyph-matter:days:v1')) localStorage.setItem('glyph-matter:days:v1', JSON.stringify([day])); }, oldDay);
  await start(page); expect((await inspect(page)).spec).toEqual({ ...oldDay.spec, motion: 'calm' });
  expect((await inspect(page)).batches).toEqual(oldDay.batches); expect((await inspect(page)).count).toBe(3);
  await terminalFeed(page, '呼吸するだんご'); expect((await saved(page)).spec).toMatchObject({ shape: 'dango', motion: 'breathe' });
  await page.reload(); await page.waitForFunction(() => Boolean((window as any).__GLYPH_ART__));
  expect((await inspect(page)).spec).toMatchObject({ shape: 'dango', motion: 'breathe' });
  expect((await inspect(page)).batches[0]).toEqual(oldDay.batches[0]);
});

test('不正な動き: 別窓メッセージを拒否し、現在の形を保つ', async ({ page, context }) => {
  await start(page); await terminalFeed(page, '流れる 波打つ メビウスの輪');
  const viewer = await context.newPage(); await start(viewer, '/?companion');
  const snapshot = await saved(page), expected = await inspect(viewer);
  for (const motion of ['not-a-motion', null, 42, {}]) {
    await page.evaluate(async value => {
      const channel = new BroadcastChannel('glyph-matter:writing:v1');
      channel.postMessage({ type: 'shape', day: { ...value.snapshot, spec: { ...value.snapshot.spec, shape: 'cube', motion: value.motion } } });
      await new Promise(resolve => setTimeout(resolve, 60)); channel.close();
    }, { snapshot, motion });
    expect((await inspect(viewer)).spec).toEqual(expected.spec); expect((await inspect(viewer)).count).toBe(expected.count);
  }
});

test('不正な動き: 壊れた日記を採用せず、原本を消さない', async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 8, 30, 12));
  const invalid = JSON.stringify([{ version: 1, date: '2026-09-30', seed: 7, time: 8, spec: { shape: 'orbit', mode: 'surface', count: 1, arrangement: 'single', deformation: 'gentle', motion: 'invalid' }, batches: [] }]);
  await page.addInitScript(raw => localStorage.setItem('glyph-matter:days:v1', raw), invalid);
  await start(page); expect((await inspect(page)).count).toBe(1); expect((await inspect(page)).spec.motion).toBe('calm');
  await expect(page.locator('#writing-status')).toContainText('日記を読み込めません');
  expect(await page.evaluate(() => localStorage.getItem('glyph-matter:days:v1'))).toBe(invalid);
  await page.locator('#writing-history').click(); await expect(page.locator('#recover-diary')).toBeVisible();
});
