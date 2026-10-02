import { expect, test } from '@playwright/test';

const inspect = (page: import('@playwright/test').Page) => page.evaluate(() => (window as any).__PROGRAM_ART__.inspect());

test('input constructs two surface parts, retains earlier text and scopes new color', async ({ page }) => {
  const errors: string[] = [], external: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', req => { if (!req.url().startsWith(`http://127.0.0.1:${process.env.GLYPH_TEST_PORT ?? '4222'}/`) && !/^(data:|blob:)/.test(req.url())) external.push(req.url()); });
  await page.goto('/program.html');
  await expect(page.getByRole('button', { name: 'press enter' })).toBeVisible();
  await page.keyboard.press('Enter');
  await page.getByLabel('加える文字').fill('白い細い棒の先に大きな球');
  await page.getByLabel('加える文字').press('Enter');
  await expect(page.locator('#thicken')).toBeEnabled({ timeout: 15_000 });
  const first = await inspect(page);
  expect(first.scene.program.spec.parts.map((p: any) => p.primitive)).toEqual(['tube','sphere']);
  expect(first.scene.program.spec.parts[0].width).toBeLessThan(first.scene.program.spec.parts[1].width);
  expect(first.scene.program.spec.relation.kind).toBe('end');
  expect(first.timings[0].totalMs).toBeLessThan(30_000);
  expect(first.timings[0].totalMs).toBeGreaterThan(first.timings[0].firstFrameMs);
  expect(first.scene.finite).toBe(true);
  await page.keyboard.press('Enter');
  await page.getByLabel('加える文字').fill('黄色い箱を輪が貫く');
  await page.getByLabel('加える文字').press('Enter');
  await expect(page.locator('#thicken')).toBeEnabled({ timeout: 15_000 });
  const second = await inspect(page);
  expect(second.scene.program.spec.parts.map((p: any) => p.primitive)).toEqual(['box','ring']);
  expect(second.scene.program.spec.relation.kind).toBe('through');
  expect(second.characters).toEqual(expect.arrayContaining(first.characters));
  expect(second.batches.slice(0,first.batches.length)).toEqual(first.batches);
  expect(second.batches.at(-1).ink).toBe('yellow');
  expect(second.scene.drawCalls).toBe(1);
  expect(errors).toEqual([]); expect(external).toEqual([]);
});

test('unrecognized text keeps the generated form and reset clears it', async ({ page }) => {
  await page.goto('/program.html'); await page.keyboard.press('Enter');
  await page.getByLabel('加える文字').fill('大きな球の上に小さな球');
  await page.getByLabel('加える文字').press('Enter');
  await expect(page.locator('#thicken')).toBeEnabled({ timeout: 15_000 });
  const first = await inspect(page);
  await page.keyboard.press('Enter');
  await page.getByLabel('加える文字').fill('今日の文章を続けます');
  await page.getByLabel('加える文字').press('Enter');
  await expect(page.locator('#thicken')).toBeEnabled({ timeout: 15_000 });
  const held = await inspect(page);
  expect(held.scene.program.spec).toEqual(first.scene.program.spec);
  expect(held.timings.at(-1).program).toBeNull();
  expect(held.count).toBeGreaterThan(first.count);
  await page.getByRole('button', { name: '最初へ' }).click();
  expect((await inspect(page)).scene.program).toBeNull();
  expect((await inspect(page)).count).toBe(1);
  await expect(page.getByRole('button', { name: 'press enter' })).toBeVisible();
});
