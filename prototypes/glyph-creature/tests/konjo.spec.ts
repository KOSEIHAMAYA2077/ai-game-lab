import { expect, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
const out = '../../experiments/konjo-v1/browser';
const state = (page: any) => page.evaluate(() => (window as any).__GLYPH_ART__.inspect());
async function add(page: any, text: string) {
  await page.locator('#write-word').click();
  await page.locator('#text-input').fill(text); await page.locator('#text-input').press('Enter');
}

test('輪っか・同義語・誤字を通常の入力で送り、元の文章と色を保つ', async ({ page }) => {
  mkdirSync(out, { recursive: true });
  const errors: string[] = [], external: string[] = [];
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('request', r => { if (!/^(http:\/\/127\.0\.0\.1:4195\/|data:|blob:)/.test(r.url())) external.push(r.url()); });
  await page.goto('/'); await page.waitForFunction(() => Boolean((window as any).__GLYPH_ART__));
  await page.keyboard.press('Enter'); await page.locator('#text-input').fill('白い輪っか'); await page.locator('#text-input').press('Enter');
  expect(['mobius','ring']).toContain((await state(page)).spec.shape);
  const records = [];
  for (const [text, choices] of [['青いねじれた輪っか',['mobius']], ['赤い花を生けるもの',['vase','cup']], ['黄色いbutterfyl',['butterfly']], ['白い雪の結晶',['snowflake']], ['紫の王冠',['crown']]] as const) {
    const before = await state(page); await add(page,text); const after = await state(page);
    expect(choices).toContain(after.spec.shape); expect(after.count).toBeGreaterThan(before.count);
    expect(after.batches.slice(0,before.batches.length)).toEqual(before.batches); expect(after.batches.at(-1).text).toBe(text);
    await page.evaluate(() => { const a = (window as any).__GLYPH_ART__; for (let i = 0; i < 12; i++) a.step(1000); });
    expect((await state(page)).scene.finite).toBe(true);
    records.push({ text, shape: after.spec.shape, count: after.count, ink: after.batches.at(-1).ink });
  }
  await page.screenshot({path:`${out}/crown-after-inputs.png`});
  expect(errors).toEqual([]); expect(external).toEqual([]);
  writeFileSync(`${out}/input-results.json`, JSON.stringify({ records, errors, external },null,2));
});

test('60形のメニューが小さい画面からも開閉できる', async ({ page }) => {
  await page.setViewportSize({width:390,height:844}); await page.goto('/'); await page.keyboard.press('Enter');
  await page.locator('#text-input').fill('文字'); await page.locator('#text-input').press('Enter'); await page.locator('#choose-form').click();
  await expect(page.locator('[data-shape]')).toHaveCount(60);
  for (const shape of ['teapot','moon','knot']) {
    await page.locator('[data-shape="'+shape+'"]').evaluate(button => { const parent = button.closest('details'); if (parent) parent.open = true; });
    await page.locator('[data-shape="'+shape+'"]').click(); expect((await state(page)).spec.shape).toBe(shape);
    await page.locator('#choose-form').click();
  }
  await page.screenshot({path:`${out}/menu-portrait.png`});
});

test('新しい同義語の執筆と追加文が形の保持時間を乱さない', async ({ page }) => {
  await page.goto('/?write'); await page.waitForFunction(() => Boolean((window as any).__GLYPH_ART__));
  await page.locator('#manuscript').fill('ねじれた輪っか。');
  await expect.poll(async () => (await state(page)).spec.shape).toBe('mobius');
  const before = await state(page);
  await page.locator('#manuscript').fill('ねじれた輪っか。\n言葉を静かに追加する。');
  await expect.poll(async () => (await state(page)).count).toBeGreaterThan(before.count);
  expect((await state(page)).spec.shape).toBe('mobius');
  await page.locator('#manuscript').fill('ねじれた輪っか。\n白いティーポット');
  await expect.poll(async () => (await state(page)).spec.shape).toBe('teapot');
  await page.screenshot({path:`${out}/writing.png`});
});

test('名詞がない文章は形を維持し、60形の周期と停止を保つ', async ({ page }) => {
  await page.goto('/'); await page.keyboard.press('Enter'); await page.locator('#text-input').fill('表面 白い宝石'); await page.locator('#text-input').press('Enter');
  await add(page,'言葉を追加する。木曜日の予定。'); expect((await state(page)).spec.shape).toBe('diamond');
  await page.evaluate(() => { const a=(window as any).__GLYPH_ART__; a.pause(); a.step(61000,true); });
  expect((await state(page)).spec.shape).toBe('octahedron');
  const before=await state(page); await page.waitForTimeout(200); expect((await state(page)).time).toBe(before.time);
});
