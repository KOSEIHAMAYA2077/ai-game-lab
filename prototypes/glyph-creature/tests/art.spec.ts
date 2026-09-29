import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';

test.use({ hasTouch: true });

const inspect = (page: Page) => page.evaluate(() => (window as any).__GLYPH_ART__.inspect());
const advance = (page: Page, ms: number) => page.evaluate(ms => (window as any).__GLYPH_ART__.step(ms), ms);
const open = async (page: Page) => {
  if (!await page.locator('#terminal').isVisible()) await page.keyboard.press('Enter');
  if (!await page.locator('#repeat').isVisible()) await page.locator('#guide summary').click();
  await page.locator('#text-input').click();
};
const feed = async (page: Page, text: string, times = '1') => {
  await open(page);
  await page.locator('#repeat').selectOption(times);
  await page.locator('#text-input').fill(text);
  await page.locator('#text-input').press('Enter');
};
const form = async (page: Page, name: string) => { await open(page); await page.locator(`[data-form="${name}"]`).click(); };
const browserErrors = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }, testInfo) => {
  const errors: string[] = []; browserErrors.set(page, errors);
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/');
  await page.waitForFunction(() => Boolean((window as any).__GLYPH_ART__));
  mkdirSync('evidence', { recursive: true });
  if (!testInfo.title.startsWith('導入')) await page.evaluate(() => (window as any).__GLYPH_ART__.reset());
});
test.afterEach(async ({ page }) => { expect(browserErrors.get(page)).toEqual([]); });

test('黒い空間からEnterで開き、送信・Escapeで戻る。長押しで誤送信しない', async ({ page }) => {
  await expect(page.locator('#terminal')).toBeHidden();
  expect(await page.locator('button:visible').count()).toBe(0);
  await advance(page, 300);

  const canvasBefore = await page.locator('#scene canvas').boundingBox();
  await page.keyboard.press('Tab');
  expect(await page.locator('#text-input').evaluate(el => el === document.activeElement)).toBe(false);
  await open(page);
  await expect(page.locator('#text-input')).toBeFocused();
  expect((await inspect(page)).count).toBe(1);
  expect(await page.locator('#scene canvas').boundingBox()).toEqual(canvasBefore);
  await page.locator('#repeat').selectOption('1');
  await page.locator('#text-input').fill('あa?');
  await page.locator('#text-input').dispatchEvent('keydown', { key: 'Enter', repeat: true });
  expect((await inspect(page)).count).toBe(1);
  await page.screenshot({ path: 'evidence/terminal.png' });
  await page.keyboard.press('Escape');
  await expect(page.locator('#terminal')).toBeHidden();
  await open(page);
  await expect(page.locator('#text-input')).toHaveValue('あa?');
  await page.keyboard.press('Enter');
  await expect(page.locator('#terminal')).toBeHidden();
  expect((await inspect(page)).count).toBe(4);
  await page.locator('#scene').dispatchEvent('keydown', { key: 'Enter', repeat: true, bubbles: true });
  await expect(page.locator('#terminal')).toBeHidden();
});

test('通常入力・赤白の変化・4形状・蓄積・リセット', async ({ page }) => {
  await feed(page, 'あa?');
  await advance(page, 4100);
  let state = await inspect(page);
  expect(state.count).toBe(4); expect(state.redCount).toBe(3);
  expect(state.characters).toEqual(['@', 'あ', 'a', '?']);
  await advance(page, 9000); expect((await inspect(page)).redCount).toBe(0);
  await feed(page, '文字のかたち 流れ 循環 あいうえお @ abc ?', '256');
  await advance(page, 10000);
  const count = (await inspect(page)).count;
  for (const name of ['condense', 'vortex', 'orbit', 'mobius']) {
    await form(page, name); await advance(page, 3000);
    state = await inspect(page);
    expect(state.form).toBe(name); expect(state.count).toBe(count);
    expect(state.scene.finite).toBe(true); expect(state.scene.drawn).toBe(count);
    expect(state.scene.drawCalls).toBe(1); expect(state.scene.triangles).toBe(count * 2);
    await page.screenshot({ path: `evidence/${name}.png` });
  }
  await feed(page, '新しい文字', '64'); await advance(page, 4100);
  await page.screenshot({ path: 'evidence/new-characters.png' });
  await open(page); await page.locator('#reset').click();
  expect((await inspect(page)).count).toBe(1);
  expect((await inspect(page)).form).toBe('condense');
  await expect(page.locator('#terminal')).toBeHidden();
});

test('一時停止で移動・平面回転・拡縮・カメラが静止する', async ({ page }) => {
  await feed(page, 'あいうえお @ abc ?', '64');
  await open(page); await page.locator('#pause').click();
  const before = await inspect(page);
  const pixelsBefore = await page.locator('#scene canvas').screenshot();
  await page.waitForTimeout(150);
  const after = await inspect(page);
  expect(after.time).toBe(before.time);
  expect(after.scene.camera).toBe(before.scene.camera);
  expect(after.scene.renderedScale).toBe(before.scene.renderedScale);
  expect(after.scene.points).toEqual(before.scene.points);
  expect(await page.locator('#scene canvas').screenshot()).toEqual(pixelsBefore);
});

test('IME相当の確定EnterとEscapeを開閉・送信に使わない（実IMEとは別）', async ({ page }) => {
  await open(page);
  await page.locator('#repeat').selectOption('1');
  const input = page.locator('#text-input');
  await input.dispatchEvent('compositionstart'); await input.fill('あ');
  await input.dispatchEvent('keydown', { key: 'Enter', isComposing: true, keyCode: 229 });
  await input.dispatchEvent('keydown', { key: 'Escape', isComposing: true, bubbles: true });
  await expect(page.locator('#terminal')).toBeVisible();
  await input.dispatchEvent('compositionend', { data: 'あ' });
  await input.dispatchEvent('keydown', { key: 'Enter' });
  await input.dispatchEvent('keydown', { key: 'Escape', bubbles: true });
  expect((await inspect(page)).count).toBe(1);
  await expect(page.locator('#terminal')).toBeVisible();
  await page.waitForTimeout(100);
  await input.press('Enter');
  expect((await inspect(page)).count).toBe(2);
  await expect(page.locator('#terminal')).toBeHidden();
  await feed(page, '  ');
  await expect(page.locator('#terminal')).toBeVisible();
  expect((await inspect(page)).count).toBe(2);
  await feed(page, '<script>あ</script>');
  expect((await inspect(page)).characters).toContain('<');
  expect(await page.locator('#terminal script').count()).toBe(0);
});

test('厚さゼロの文字は正面→真横で消える→裏面に戻る。自然な動きでも画素が変化する', async ({ page }) => {
  const measure = () => page.evaluate(() => {
    const source = document.querySelector<HTMLCanvasElement>('#scene canvas')!;
    const copy = document.createElement('canvas'); copy.width = source.width; copy.height = source.height;
    const ctx = copy.getContext('2d')!; ctx.drawImage(source, 0, 0);
    const pixels = ctx.getImageData(0, 0, copy.width, copy.height).data;
    let lit = 0;
    for (let i = 0; i < pixels.length; i += 4) if (pixels[i] + pixels[i + 1] + pixels[i + 2] > 100) lit++;
    return lit;
  });
  const pose = (yaw: number | null) => page.evaluate(yaw => (window as any).__GLYPH_ART__.planePose(yaw), yaw);
  await pose(0); const front = await measure();
  await page.screenshot({ path: 'evidence/plane-front.png' });
  await pose(Math.PI / 2); const edge = await measure();
  await page.screenshot({ path: 'evidence/plane-edge.png' });
  await pose(Math.PI); const back = await measure();
  await page.screenshot({ path: 'evidence/plane-back.png' });
  expect(front).toBeGreaterThan(100);
  expect(edge).toBeLessThan(front * 0.06);
  expect(back).toBeGreaterThan(front * 0.85);
  await pose(null); const before = await page.locator('#scene canvas').screenshot();
  await advance(page, 2000);
  expect(await page.locator('#scene canvas').screenshot()).not.toEqual(before);
  console.log(JSON.stringify({ planePixels: { front, edge, back } }));
});

test('32,000枚でも形を切り替え、カメラが引いて操作を続けられる', async ({ page }) => {
  const before = await inspect(page);
  await feed(page, 'あ'.repeat(128), '256');
  await advance(page, 12000);
  const after = await inspect(page);
  expect(after.count).toBe(32000); expect(after.scene.finite).toBe(true);
  expect(after.scene.camera).toBeGreaterThan(before.scene.camera);
  await expect(page.locator('#status')).toContainText('32,000文字');
  await form(page, 'mobius'); await advance(page, 2000);
  expect((await inspect(page)).form).toBe('mobius');
  expect((await inspect(page)).scene.drawCalls).toBe(1);
  await page.screenshot({ path: 'evidence/dense-32000.png' });
  await open(page); await page.locator('#pause').click();
  expect((await inspect(page)).paused).toBe(false);
  const frames = await page.evaluate(() => new Promise<number[]>(resolve => {
    const times: number[] = []; let last = performance.now();
    function sample(now: number) { times.push(now - last); last = now; if (times.length === 30) resolve(times.slice(1)); else requestAnimationFrame(sample); }
    requestAnimationFrame(sample);
  }));
  console.log(JSON.stringify({ density: 32000, animated: true, browser: page.context().browser()?.version(), headlessFrameMedianMs: frames.sort((a, b) => a - b)[Math.floor(frames.length / 2)] }));
});

test('狭い画面でも入力・形の切替が収まり、タッチで開く', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.touchscreen.tap(195, 422);
  await expect(page.locator('#terminal')).toBeVisible();
  await feed(page, 'あいうえお @ abc ?', '64'); await advance(page, 9000);
  await form(page, 'orbit'); await advance(page, 2000);
  expect((await inspect(page)).form).toBe('orbit');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await open(page);
  await expect(page.locator('#feed')).toBeInViewport();
  await expect(page.locator('#close')).toBeInViewport();
  await page.screenshot({ path: 'evidence/mobile.png', fullPage: true });
});

test('導入: press enter自身が材料になり、二回目で文章を入力できる', async ({ page }) => {
  await expect(page.locator('#start-prompt')).toBeVisible();
  await expect(page.locator('#terminal')).toBeHidden();
  expect((await inspect(page)).count).toBe(1);
  await page.locator('#start-prompt').evaluate(el => el.getAnimations().forEach(animation => animation.finish()));
  await page.screenshot({ path: 'evidence/initial.png' });
  await page.keyboard.press('Enter');
  expect((await inspect(page)).batches[0].text).toBe('press enter');
  expect((await inspect(page)).count).toBe(11);
  await expect(page.locator('#terminal')).toBeHidden();
  await advance(page, 700);
  await page.screenshot({ path: 'evidence/intro-intake.png' });
  await advance(page, 4000);
  await page.keyboard.press('Enter');
  await expect(page.locator('#text-input')).toBeFocused();
  await expect(page.locator('#input-help')).toContainText('文章');
  await page.screenshot({ path: 'evidence/terminal.png' });
  await page.locator('#text-input').fill('今日は、文字が空に浮かんでいる。');
  await page.keyboard.press('Enter');
  expect((await inspect(page)).batches[1].text).toBe('今日は、文字が空に浮かんでいる。');
});

test('言葉の形・表面・色・個数・鎖と入力位置からの取り込み', async ({ page }) => {
  await feed(page, '流れる 赤 四角形', '64');
  await advance(page, 600); await page.screenshot({ path: 'evidence/terminal-intake.png' });
  await advance(page, 5000);
  expect((await inspect(page)).spec).toMatchObject({ shape: 'square', mode: 'flow' });
  const firstBatch = (await inspect(page)).batches[0]; expect(firstBatch.ink).toBe('red');
  await page.screenshot({ path: 'evidence/flow-square.png' });
  await feed(page, '表面 黄色 立方体', '64'); await advance(page, 6000);
  expect((await inspect(page)).spec).toMatchObject({ shape: 'cube', mode: 'surface' });
  expect((await inspect(page)).batches.map((b: any) => b.ink)).toEqual(['red', 'yellow']);
  await page.screenshot({ path: 'evidence/surface-cube.png' });
  for (const [words, filename] of [['円 8個', 'eight-rings'], ['円環 鎖', 'chain'], ['流れる メビウスの輪', 'flow-mobius'], ['表面 メビウスの輪', 'surface-mobius'], ['円環 大小', 'unequal-rings'], ['オメガ メビウスの輪', 'omega']]) {
    await feed(page, words, '64'); await advance(page, 6000);
    expect((await inspect(page)).scene.finite).toBe(true);
    if (filename === 'eight-rings') expect((await inspect(page)).spec.count).toBe(8);
    if (filename === 'chain') expect((await inspect(page)).spec.arrangement).toBe('chain');
    await page.screenshot({ path: `evidence/${filename}.png` });
  }
});

test('通常操作は外部通信なし', async ({ page }) => {
  const external: string[] = [];
  page.on('request', request => { if (!request.url().startsWith('http://127.0.0.1:4173') && !request.url().startsWith('data:')) external.push(request.url()); });
  await feed(page, '表面 青 三角形', '16');
  await feed(page, '円環 鎖', '16');
  expect((await inspect(page)).spec.arrangement).toBe('chain');
  expect(external).toEqual([]);
});

test('吸収中に形を変えても既存の文字が跳び戻らない', async ({ page }) => {
  await feed(page, 'あa?文字', '16');
  await advance(page, 1300);
  const before = (await inspect(page)).scene.points;
  // Freeze the same instant around a real form-button action to isolate continuity.
  const after = await page.evaluate(() => {
    (document.querySelector('[data-form="mobius"]') as HTMLButtonElement).click();
    (window as any).__GLYPH_ART__.step(0);
    return (window as any).__GLYPH_ART__.inspect().scene.points;
  });
  for (let i = 0; i < before.length; i++) expect(Math.abs(after[i] - before[i])).toBeLessThan(.00001);
});

test('実験用の学習モデルが形だけを補い、入力文字と色を保つ', async ({ page }) => {
  const external: string[] = [];
  page.on('request', r => { if (!r.url().startsWith('http://127.0.0.1:4173') && !r.url().startsWith('data:')) external.push(r.url()); });
  await open(page);
  await expect(page.locator('#learned-shapes')).not.toBeChecked();
  await page.locator('#learned-shapes').check();
  await feed(page, 'サイコロを黄色に', '64'); await advance(page, 4500);
  expect((await inspect(page)).spec.shape).toBe('cube');
  expect((await inspect(page)).batches[0]).toMatchObject({ text: 'サイコロを黄色に', ink: 'yellow' });
  await feed(page, 'ドーナツ 8個', '64'); await advance(page, 4500);
  expect((await inspect(page)).spec).toMatchObject({ shape: 'ring', count: 8 });
  await page.screenshot({ path: 'evidence/learned-rings.png' });
  const spec = (await inspect(page)).spec;
  await feed(page, '今日は眠い', '1');
  expect((await inspect(page)).spec).toEqual(spec);
  await open(page); await page.locator('#reset').click();
  await page.keyboard.press('Enter'); await page.keyboard.press('Enter');
  await page.locator('#guide summary').click();
  await expect(page.locator('#learned-shapes')).not.toBeChecked();
  expect(external).toEqual([]);
});
