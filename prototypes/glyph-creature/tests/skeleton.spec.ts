import { expect, test } from '@playwright/test';

test('original dark opening, local interpretation, generation and absorption complete', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/skeleton.html');
  await expect(page.getByRole('button', { name: 'press enter' })).toBeVisible();
  await page.keyboard.press('Enter');
  await page.locator('#guide').evaluate((node: HTMLDetailsElement) => { node.open = true; });
  await page.locator('#provider').selectOption('rules');
  await page.getByLabel('加える文字').fill('細長い花瓶');
  await page.getByLabel('加える文字').press('Enter');
  await expect(page.locator('#terminal')).toBeHidden();
  await expect(page.locator('#thicken')).toBeEnabled({ timeout: 15_000 });
  const first = await page.evaluate(() => (window as any).__SKELETON_ART__.inspect());
  expect(first.scene.skeleton).toMatchObject({ family: 'vase', height: 1.65, width: .7 });
  expect(first.scene.finite).toBe(true);
  expect(first.timings[0].totalMs).toBeLessThan(30_000);
  expect(first.timings[0].firstFrameMs).toBeGreaterThan(0);
  expect(first.timings[0].totalMs).toBeGreaterThan(first.timings[0].firstFrameMs);
  await page.keyboard.press('Enter');
  await page.getByLabel('加える文字').fill('黄色い曲がった剣');
  await page.getByLabel('加える文字').press('Enter');
  await expect(page.locator('#thicken')).toBeEnabled({ timeout: 15_000 });
  const second = await page.evaluate(() => (window as any).__SKELETON_ART__.inspect());
  expect(second.scene.skeleton).toMatchObject({ family: 'sword', bend: .65 });
  expect(second.characters).toEqual(expect.arrayContaining(first.characters));
  expect(second.count).toBeGreaterThan(first.count);
  expect(errors).toEqual([]);
});

test('reset cancels pending model result without reviving an old shape', async ({ page }) => {
  let reply: (() => void) | undefined;
  await page.route('http://127.0.0.1:4213/interpret', async route => {
    await new Promise<void>(resolve => { reply = resolve; });
    try { await route.fulfill({ json: { source: 'semantic-model', modelMs: 100, reason: 'selected', spec: { family: 'vase', height: 1, width: 1, neck: .45, bend: 0, twist: 0 } } }); } catch { /* aborted request */ }
  });
  await page.goto('/skeleton.html');
  await page.keyboard.press('Enter');
  await page.locator('#guide').evaluate((node: HTMLDetailsElement) => { node.open = true; });
  await page.locator('#provider').selectOption('rules');
  await page.getByLabel('加える文字').fill('球体');
  await page.getByLabel('加える文字').press('Enter');
  await expect(page.locator('#thicken')).toBeEnabled({ timeout: 15_000 });
  await page.keyboard.press('Enter');
  await page.locator('#provider').selectOption('model');
  await page.getByLabel('加える文字').fill('花瓶');
  await page.getByLabel('加える文字').press('Enter');
  await page.getByRole('button', { name: '最初へ' }).click();
  reply?.();
  await expect(page.getByRole('button', { name: 'press enter' })).toBeVisible();
  const state = await page.evaluate(() => (window as any).__SKELETON_ART__.inspect());
  expect(state.count).toBe(1);
  expect(state.busy).toBe(false);
  expect(state.scene.skeleton).toBeNull();
});
