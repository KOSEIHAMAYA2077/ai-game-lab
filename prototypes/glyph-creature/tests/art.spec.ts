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
  page.on('console', message => { if (message.type() === 'error') errors.push(`${message.text()} ${message.location().url}`); });
  await page.goto('/');
  await page.waitForFunction(() => Boolean((window as any).__GLYPH_ART__));
  mkdirSync('../../experiments/konjo-v1/regression/art', { recursive: true });
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
  await page.screenshot({ path: '../../experiments/konjo-v1/regression/art/terminal.png' });
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
    await page.screenshot({ path: `../../experiments/konjo-v1/regression/art/${name}.png` });
  }
  await feed(page, '新しい文字', '64'); await advance(page, 4100);
  await page.screenshot({ path: '../../experiments/konjo-v1/regression/art/new-characters.png' });
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
  await page.screenshot({ path: '../../experiments/konjo-v1/regression/art/plane-front.png' });
  await pose(Math.PI / 2); const edge = await measure();
  await page.screenshot({ path: '../../experiments/konjo-v1/regression/art/plane-edge.png' });
  await pose(Math.PI); const back = await measure();
  await page.screenshot({ path: '../../experiments/konjo-v1/regression/art/plane-back.png' });
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
  await page.screenshot({ path: '../../experiments/konjo-v1/regression/art/dense-32000.png' });
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
  await page.screenshot({ path: '../../experiments/konjo-v1/regression/art/mobile.png', fullPage: true });
});

test('導入: 最初のEnterで入力し、文字を送ってからボタンが現れる', async ({ page }) => {
  await expect(page.locator('#start-prompt')).toBeVisible();
  await expect(page.locator('#terminal')).toBeHidden();
  expect((await inspect(page)).count).toBe(1);
  await page.locator('#start-prompt').evaluate(el => el.getAnimations().forEach(animation => animation.effect?.getTiming().iterations === Infinity ? animation.cancel() : animation.finish()));
  await page.screenshot({ path: '../../experiments/konjo-v1/regression/art/initial.png' });
  await page.keyboard.press('Enter');
  expect((await inspect(page)).count).toBe(1);
  await expect(page.locator('#actions')).toBeHidden();
  await expect(page.locator('#text-input')).toBeFocused();
  await expect(page.locator('#input-help')).toContainText('文章');
  await page.screenshot({ path: '../../experiments/konjo-v1/regression/art/terminal.png' });
  await page.locator('#text-input').fill('今日は、文字が空に浮かんでいる。');
  await page.keyboard.press('Enter');
  expect((await inspect(page)).batches[0].text).toBe('今日は、文字が空に浮かんでいる。');
  await expect(page.locator('#actions')).toBeVisible();
  await page.locator('#show-help').click();
  await expect(page.locator('#lesson')).toContainText('1 / 5');
  await page.locator('#lesson-try').click();
  await expect(page.locator('#text-input')).toHaveValue('流れる 球体');
  await page.locator('#text-input').press('Enter');
  expect((await inspect(page)).spec).toMatchObject({shape:'condense', mode:'flow'});
});

test('言葉の形・表面・色・個数・鎖と入力位置からの取り込み', async ({ page }) => {
  await feed(page, '流れる 赤 四角形', '64');
  await advance(page, 600); await page.screenshot({ path: '../../experiments/konjo-v1/regression/art/terminal-intake.png' });
  await advance(page, 5000);
  expect((await inspect(page)).spec).toMatchObject({ shape: 'square', mode: 'flow' });
  const firstBatch = (await inspect(page)).batches[0]; expect(firstBatch.ink).toBe('red');
  await page.screenshot({ path: '../../experiments/konjo-v1/regression/art/flow-square.png' });
  await feed(page, '表面 黄色 立方体', '64'); await advance(page, 6000);
  expect((await inspect(page)).spec).toMatchObject({ shape: 'cube', mode: 'surface' });
  expect((await inspect(page)).batches.map((b: any) => b.ink)).toEqual(['red', 'yellow']);
  await page.screenshot({ path: '../../experiments/konjo-v1/regression/art/surface-cube.png' });
  for (const [words, filename] of [['円 8個', 'eight-rings'], ['円環 鎖', 'chain'], ['流れる メビウスの輪', 'flow-mobius'], ['表面 メビウスの輪', 'surface-mobius'], ['円環 大小', 'unequal-rings'], ['オメガ メビウスの輪', 'omega']]) {
    await feed(page, words, '64'); await advance(page, 6000);
    expect((await inspect(page)).scene.finite).toBe(true);
    if (filename === 'eight-rings') expect((await inspect(page)).spec.count).toBe(8);
    if (filename === 'chain') expect((await inspect(page)).spec.arrangement).toBe('chain');
    await page.screenshot({ path: `../../experiments/konjo-v1/regression/art/${filename}.png` });
  }
});

test('通常操作は外部通信なし', async ({ page }) => {
  const external: string[] = [];
  page.on('request', request => { if (!request.url().startsWith('http://127.0.0.1:4195') && !request.url().startsWith('data:')) external.push(request.url()); });
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

test('手動辞書の言い換えが形を選び、入力文字と色を保つ', async ({ page }) => {
  const external: string[] = [];
  page.on('request', r => { if (!r.url().startsWith('http://127.0.0.1:4195') && !r.url().startsWith('data:')) external.push(r.url()); });
  await open(page);
  await expect(page.locator('#learned-shapes')).toHaveCount(0);
  await feed(page, 'サイコロを黄色に', '64'); await advance(page, 4500);
  expect((await inspect(page)).spec.shape).toBe('cube');
  expect((await inspect(page)).batches[0]).toMatchObject({ text: 'サイコロを黄色に', ink: 'yellow' });
  await feed(page, 'ドーナツ 8個', '64'); await advance(page, 4500);
  expect((await inspect(page)).spec).toMatchObject({ shape: 'ring', count: 8 });
  await page.screenshot({ path: '../../experiments/konjo-v1/regression/art/learned-rings.png' });
  const spec = (await inspect(page)).spec;
  await feed(page, '今日は眠い', '1');
  expect((await inspect(page)).spec).toEqual(spec);
  await open(page); await page.locator('#reset').click();
  await page.keyboard.press('Enter'); await page.keyboard.press('Enter');
  await page.locator('#guide summary').click();
  await expect(page.locator('#learned-shapes')).toHaveCount(0);
  expect(external).toEqual([]);
});


test('花火を文章から拾い、形ボタンからも切り替えられる', async ({ page }) => {
  await feed(page, '今夜は赤い花火を眺めている。', '64');
  await advance(page, 5500);
  expect((await inspect(page)).spec.shape).toBe('fireworks');
  expect((await inspect(page)).batches[0].ink).toBe('red');
  expect((await inspect(page)).scene.finite).toBe(true);
  await page.screenshot({path:'../../experiments/konjo-v1/regression/art/fireworks.png'});
  await page.locator('#choose-form').click();
  await page.locator('#quick-forms summary').filter({ hasText: '形' }).click(); await page.locator('[data-shape="cube"]').click();
  expect((await inspect(page)).spec.shape).toBe('cube');
});

test('執筆: 入力が届き、Enterで一度取り込み、再読込で日記を復元する', async ({page, context}) => {
  await page.goto('/?write');
  await page.waitForFunction(() => Boolean((window as any).__GLYPH_ART__));
  await page.locator('#live-writing').uncheck();
  const input = page.locator('#manuscript');
  await input.fill('今日は黄色い球体について書く。');
  await expect(page.locator('#draft-preview')).toHaveText('今日は黄色い球体について書く。');
  expect((await inspect(page)).count).toBe(1);
  await input.dispatchEvent('compositionstart');
  await input.dispatchEvent('keydown',{key:'Enter',isComposing:true,keyCode:229});
  expect((await inspect(page)).count).toBe(1);
  await input.dispatchEvent('compositionend');
  await input.press('Enter');
  expect((await inspect(page)).count).toBe(1);
  await page.waitForTimeout(100);
  await input.press('Enter');
  const state = await inspect(page);
  expect(state.batches.length).toBe(1);
  expect(state.spec.shape).toBe('condense');
  expect(state.batches[0].ink).toBe('yellow');
  await expect(input).toBeFocused();
  await advance(page, 5000);
  await page.screenshot({path:'../../experiments/konjo-v1/regression/art/writing-day.png'});
  const view = await context.newPage();
  await view.goto('/?companion');
  await view.waitForFunction(() => Boolean((window as any).__GLYPH_ART__));
  expect((await inspect(view)).count).toBe(state.count);
  await input.fill('流れる 赤 立方体');
  await expect(view.locator('#draft-preview')).toHaveText('流れる 赤 立方体');
  await input.press('Enter');
  await expect.poll(async () => (await inspect(view)).spec.shape).toBe('cube');
  await view.close();
  const latest = await inspect(page);
  await page.reload();
  await page.waitForFunction(() => Boolean((window as any).__GLYPH_ART__));
  expect((await inspect(page)).count).toBe(latest.count);
  expect((await inspect(page)).spec).toEqual(latest.spec);
  await page.locator('#writing-history').click();
  await expect(page.locator('.day')).toHaveCount(1);
});

test('執筆: 日付が変わると前日を保存し新しい @ になる', async ({page}) => {
  await page.clock.setFixedTime(new Date(2026,8,30,23,59,50));
  await page.goto('/?write');
  await page.waitForFunction(() => Boolean((window as any).__GLYPH_ART__));
  await page.locator('#manuscript').fill('水色の円環');
  await page.locator('#manuscript').press('Enter');
  const yesterday = (await inspect(page)).count;
  await page.clock.setFixedTime(new Date(2026,9,1,0,0,1));
  await page.locator('#manuscript').fill('今日は新しい日');
  expect((await inspect(page)).count).toBe(1);
  await page.locator('#manuscript').press('Enter');
  const entries = await page.evaluate(() => JSON.parse(localStorage.getItem('glyph-matter:days:v1')!));
  expect(entries.map((d:any)=>d.date)).toEqual(['2026-10-01','2026-09-30']);
  expect(entries[1].batches.reduce((n:number,b:any)=>n+b.added,1)).toBe(yesterday);
});

test('執筆: 保存失敗時に日付が変わっても前日の文字を消さない', async ({page}) => {
  await page.clock.setFixedTime(new Date(2026,8,30,23,59,50));
  await page.goto('/?write'); await page.waitForFunction(() => Boolean((window as any).__GLYPH_ART__));
  await page.locator('#manuscript').fill('昨日の大切な文字'); await page.locator('#manuscript').press('Enter');
  const count = (await inspect(page)).count;
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new DOMException('full','QuotaExceededError'); }; });
  await page.clock.setFixedTime(new Date(2026,9,1,0,0,1));
  await page.locator('#manuscript').fill('今日の文章');
  expect((await inspect(page)).count).toBe(count);
  await expect(page.locator('#writing-status')).toContainText('保存できません');
  await page.locator('#manuscript').press('Enter');
  expect((await inspect(page)).count).toBe(count);
  await expect(page.locator('#manuscript')).toHaveValue('今日の文章\n');
});

test('執筆: 日記を見ている間は操作ボタンが入力を受けず、戻れば続けられる', async ({page}) => {
  await page.goto('/?write'); await page.waitForFunction(() => Boolean((window as any).__GLYPH_ART__));
  await page.locator('#manuscript').fill('球体を見つめる'); await page.locator('#manuscript').press('Enter');
  await page.locator('#writing-history').click(); await page.locator('.day').click();
  expect(await page.locator('#actions').evaluate(el => (el as HTMLElement).inert)).toBe(true);
  await page.locator('#diary-close').click();
  expect(await page.locator('#actions').evaluate(el => (el as HTMLElement).inert)).toBe(false);
  await page.locator('#manuscript').fill('次の行は立方体'); await page.locator('#manuscript').press('Enter');
  expect((await inspect(page)).batches).toHaveLength(2);
});

test('執筆: 別窓が開き、編集側の行を同時に受け取る（通常窓の代替）', async ({page}) => {
  await page.addInitScript(() => Object.defineProperty(window,'documentPictureInPicture',{value:undefined, configurable:true}));
  await page.goto('/?write'); await page.waitForFunction(() => Boolean((window as any).__GLYPH_ART__));
  const popupPromise=page.waitForEvent('popup'); await page.locator('#floating').click(); const popup=await popupPromise;
  await popup.waitForFunction(() => Boolean((window as any).__GLYPH_ART__));
  await page.locator('#manuscript').fill('青い立方体'); await page.locator('#manuscript').press('Enter');
  await expect.poll(async () => (await inspect(popup)).spec.shape).toBe('cube');
  await expect(popup.locator('#actions')).toBeHidden(); await popup.close();
});

test('筆画: 同梱の花火11画をほどいて戻し、未収録は現在の形を保つ', async ({page}) => {
  const external:string[]=[];
  page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:4195')&&!r.url().startsWith('data:'))external.push(r.url());});
  await page.goto('/strokes.html');
  await expect(page.locator('#stroke-status')).toContainText('11画');
  await page.locator('[data-motion="scatter"]').click();
  await expect(page.locator('#strokes-scene')).toHaveAttribute('data-mode','scatter');
  await page.locator('[data-motion="flow"]').click();
  await expect(page.locator('#strokes-scene')).toHaveAttribute('data-mode','flow');
  await page.locator('[data-motion="gather"]').click();
  await expect(page.locator('#strokes-scene')).toHaveAttribute('data-mode','gather');
  await page.locator('#stroke-input').fill('空'); await page.locator('#stroke-input').press('Enter');
  await expect(page.locator('#stroke-status')).toContainText('未収録');
  await expect(page.locator('#strokes-scene')).toHaveAttribute('data-mode','gather');
  expect(external).toEqual([]);
});
